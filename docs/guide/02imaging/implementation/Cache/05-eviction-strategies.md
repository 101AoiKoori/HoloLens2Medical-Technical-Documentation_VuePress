---
title: 缓存淘汰策略实现
---
# 缓存淘汰策略实现

本页详细介绍DicomTextureCache的缓存淘汰算法，包括平衡策略、紧急清理和LRU管理。

## 平衡淘汰策略

`RemoveWithBalancedStrategy()` 是核心淘汰方法，综合考虑使用频率、访问时间、纹理大小和引用计数:

```csharp
private bool RemoveWithBalancedStrategy(Dictionary<string, Texture2D> cache, 
                                       LinkedList<string> lruList, ref long totalSize)
{
    if (lruList.Count == 0) return false;
    
    List<KeyValuePair<string, float>> candidates = new List<KeyValuePair<string, float>>();
    float currentTime = Time.realtimeSinceStartup;
    DicomPlane.PlaneType planeType = GetPlaneTypeFromCache(cache);
    int checkedItems = 0;
    LinkedListNode<string> node = lruList.First;
    
    // 检查LRU链表前10个候选项
    while (node != null && checkedItems < 10)
    {
        string key = node.Value;
        string fullKey = GetContextKey(planeType, key);
        
        // 跳过受保护的纹理
        if (IsTextureProtected(fullKey, key, planeType))
        {
            node = node.Next;
            checkedItems++;
            continue;
        }
        
        // 计算淘汰分数
        float score = CalculateEvictionScore(key, fullKey, currentTime);
        candidates.Add(new KeyValuePair<string, float>(key, score));
        
        node = node.Next;
        checkedItems++;
    }
    
    // 选择分数最低的纹理淘汰
    if (candidates.Count > 0)
    {
        candidates.Sort((a, b) => a.Value.CompareTo(b.Value));
        string keyToRemove = candidates[0].Key;
        return RemoveTextureByKey(cache, lruList, keyToRemove, ref totalSize);
    }
    
    return false;
}
```

### 淘汰分数计算

分数计算综合多个因素，分数越低的纹理越优先被淘汰:

```csharp
private float CalculateEvictionScore(string key, string fullKey, float currentTime)
{
    // 基础使用计数
    int useCount = _usageCounter.TryGetValue(key, out int count) ? count : 0;
    
    // 时间因子（距离上次访问的时间）
    float timeFactor = _lastAccessTime.TryGetValue(key, out float lastTime) ? 
                      (currentTime - lastTime) : 100f;
    
    // 纹理大小
    long size = _textureSizes.TryGetValue(key, out long textureSize) ? 
               textureSize : 1024 * 1024;
    
    // 引用计数加权
    int refCount = _textureRefCounts.TryGetValue(fullKey, out int refs) ? refs : 0;
    if (refCount > 0)
    {
        useCount += refCount * 5;  // 引用计数权重为5
    }
    
    // 分数公式:使用频率 × 时间权重 / 纹理大小
    float score = (useCount + 1) * (10f / (timeFactor + 1)) / size;
    
    return score;
}
```

### 纹理保护检查

以下类型的纹理受到保护，不会被淘汰:

```csharp
private bool IsTextureProtected(string fullKey, string key, DicomPlane.PlaneType planeType)
{
    return _permanentTextures.Contains(fullKey) ||
           (_currentDisplayedTextures.ContainsKey(planeType) && _currentDisplayedTextures[planeType] == key) ||
           _activeTextures.Contains(fullKey) || 
           _visibleTextures.Contains(fullKey);
}
```

保护类型说明:
- **永久纹理**:选择锁期间标记的纹理
- **当前显示**:正在UI上显示的纹理  
- **活跃纹理**:正在被异步操作使用的纹理
- **可见纹理**:在视口中可见的纹理

## 紧急清理策略

当内存压力超过95%阈值时，触发 `EmergencyCleanup()` 进行快速清理:

```csharp
private void EmergencyCleanup(Dictionary<string, Texture2D> cache, LinkedList<string> lruList, 
                             ref long totalSize, int itemsToRemove)
{
    int removedCount = 0;
    DicomPlane.PlaneType planeType = GetPlaneTypeFromCache(cache);
    var itemScores = new List<(string key, float score)>();
    float currentTime = Time.realtimeSinceStartup;
    
    // 为所有纹理计算紧急清理分数
    foreach (var key in lruList)
    {
        string fullKey = GetContextKey(planeType, key);
        
        // 跳过关键纹理（当前显示、永久、可见）
        if (_permanentTextures.Contains(fullKey) ||
            (_currentDisplayedTextures.ContainsKey(planeType) && _currentDisplayedTextures[planeType] == key) ||
            _visibleTextures.Contains(fullKey))
            continue;
            
        // 计算紧急清理分数（权重不同）
        float score = CalculateEmergencyScore(key, fullKey, currentTime);
        itemScores.Add((key, score));
    }
    
    // 按分数排序，移除指定数量的纹理
    foreach (var item in itemScores.OrderBy(i => i.score).Take(itemsToRemove))
    {
        if (RemoveTextureByKey(cache, lruList, item.key, ref totalSize))
        {
            removedCount++;
        }
        
        if (removedCount >= itemsToRemove)
            break;
    }
    
    if (removedCount > 0)
    {
        Resources.UnloadUnusedAssets();
    }
}

private float CalculateEmergencyScore(string key, string fullKey, float currentTime)
{
    int refCount = _textureRefCounts.TryGetValue(fullKey, out int refs) ? refs : 0;
    int useCount = _usageCounter.TryGetValue(key, out int count) ? count : 0;
    float timeFactor = _lastAccessTime.TryGetValue(key, out float lastTime) ? 
                      (currentTime - lastTime) : 100f;
    
    // 紧急清理时引用计数权重为2（比正常情况更低）
    useCount += refCount * 2;
    
    // 活跃纹理分数放大10倍，降低被清理概率
    float score = useCount / (timeFactor + 1);
    if (_activeTextures.Contains(fullKey))
    {
        score *= 10;
    }
    
    return score;
}
```

## LRU链表管理

### 更新LRU位置

```csharp
private void UpdateLRU(LinkedList<string> lruList, string key)
{
    // 如果键已存在，先移除
    LinkedListNode<string> existingNode = lruList.Find(key);
    if (existingNode != null)
    {
        lruList.Remove(existingNode);
    }
    
    // 添加到链表尾部（最近使用）
    lruList.AddLast(key);
}
```

LRU链表维护访问顺序:
- **链表头部**:最久未使用的纹理
- **链表尾部**:最近使用的纹理
- **淘汰顺序**:从头部开始检查候选项

## 缓存修剪流程

### 自动修剪触发

```csharp
private void CheckAndTrimCache()
{
    lock (_cacheLock)
    {
        // 选择锁期间不执行修剪
        if (_selectionLockActive)
        {
            return;
        }
        
        // 检查各平面是否超限
        if (_axialTextureCache.Count > _axialCacheMaxSize || 
            _axialTotalSize > _axialMemoryLimit)
        {
            TrimCacheToFitLimits(_axialTextureCache, _axialLRU, 
                               ref _axialTotalSize, _axialCacheMaxSize, _axialMemoryLimit);
        }
        
        // 类似地检查矢状面和冠状面...
    }
}
```

### 修剪到目标限制

```csharp
private void TrimCacheToFitLimits(Dictionary<string, Texture2D> cache, LinkedList<string> lruList, 
                                 ref long totalSize, int maxCount, long maxSize)
{
    // 设定目标为最大值的80%
    long targetSize = (long)(maxSize * 0.8f);
    int targetCount = (int)(maxCount * 0.8f);
    
    while ((cache.Count > targetCount || totalSize > targetSize) && lruList.Count > 0)
    {
        bool removed = RemoveWithBalancedStrategy(cache, lruList, ref totalSize);
        if (!removed) break;  // 如果无法移除更多纹理，退出循环
    }
}
```

## 纹理移除实现

### 安全移除纹理

```csharp
private bool RemoveTextureByKey(Dictionary<string, Texture2D> cache, LinkedList<string> lruList, 
                               string key, ref long totalSize)
{
    if (!cache.ContainsKey(key)) return false;
    
    DicomPlane.PlaneType planeType = GetPlaneTypeFromCache(cache);
    string fullKey = GetContextKey(planeType, key);
    
    // 最后一次检查保护状态
    if (IsTextureProtected(fullKey, key, planeType))
    {
        return false;
    }
    
    try
    {
        // 检查是否为最后有效纹理，避免销毁
        bool safeToDestroy = true;
        foreach (var entry in _lastValidTextures)
        {
            if (entry.Value == cache[key])
            {
                safeToDestroy = false;
                break;
            }
        }
        
        // 安全销毁纹理对象
        if (safeToDestroy && cache[key] != null)
        {
            UnityEngine.Object.Destroy(cache[key]);
        }
    }
    catch { }
    
    // 更新内存统计
    if (_textureSizes.TryGetValue(key, out long size))
    {
        totalSize -= size;
        _textureSizes.Remove(key);
    }
    
    // 清理相关数据结构
    cache.Remove(key);
    
    LinkedListNode<string> node = lruList.Find(key);
    if (node != null)
    {
        lruList.Remove(node);
    }
    
    _usageCounter.Remove(key);
    _lastAccessTime.Remove(key);
    _textureRefCounts.Remove(fullKey);
    
    // 清理窗位键索引
    CleanupWindowLevelIndex(key);
    
    return true;
}

private void CleanupWindowLevelIndex(string key)
{
    string windowLevelKey = ExtractWindowLevelFromKey(key);
    if (!string.IsNullOrEmpty(windowLevelKey) && _windowLevelToTextureKeys.ContainsKey(windowLevelKey))
    {
        _windowLevelToTextureKeys[windowLevelKey].Remove(key);
        if (_windowLevelToTextureKeys[windowLevelKey].Count == 0)
        {
            _windowLevelToTextureKeys.Remove(windowLevelKey);
        }
    }
}
```

## 性能优化建议

### 淘汰策略调优

- **候选项数量**:检查LRU前10项平衡性能和效果
- **权重系数**:引用计数权重5，紧急清理时降为2
- **时间因子**:使用实时时间差，避免频繁访问影响
- **分数公式**:平衡使用频率、时间和大小的影响

### 内存监控

- **阈值设置**:95%触发紧急清理，80%作为修剪目标
- **分批清理**:紧急清理时一次移除5个纹理
- **资源释放**:清理后调用Unity资源释放API

### 并发安全

- **锁保护**:所有缓存操作使用 `_cacheLock`
- **原子操作**:确保统计数据的一致性
- **异常处理**:纹理销毁时进行异常捕获