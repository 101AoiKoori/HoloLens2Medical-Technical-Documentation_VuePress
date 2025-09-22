---
title: 纹理存取操作
---
# 纹理存取操作

本页详细说明如何从缓存获取纹理、存储新纹理以及管理纹理状态。

## 获取纹理

`GetTextureFromCache()` 从指定平面缓存中获取纹理，并自动更新相关统计:

```csharp
DicomTextureCache cache = GetComponent<DicomTextureCache>();

// 生成缓存键
string cacheKey = cache.GetTextureCacheKey(DicomPlane.PlaneType.Axial, 25);

// 从缓存获取纹理
Texture2D texture = cache.GetTextureFromCache(DicomPlane.PlaneType.Axial, cacheKey);

if (texture != null)
{
    // 缓存命中，直接使用纹理
    rawImage.texture = texture;
}
else
{
    // 缓存未命中，需要生成新纹理
    GenerateNewTexture();
}
```

### 获取过程详解

方法内部执行以下操作:

1. **检查选择锁**:调用 `CheckAndReleaseSelectionLock()` 检查并释放过期的选择锁

2. **查找纹理**:在对应平面的缓存字典中查找键值

3. **更新统计信息**（如果找到）:
   ```csharp
   UpdateLRU(lruList, key);  // 移动到LRU链表尾部
   _usageCounter[key]++;     // 增加使用计数
   _lastAccessTime[key] = Time.realtimeSinceStartup;  // 更新访问时间
   ```

4. **标记状态**:
   ```csharp
   MarkTextureAsActive(planeType, key);    // 标记为活跃
   _currentDisplayedTextures[planeType] = key;  // 设为当前显示
   _lastValidTextures[planeType] = texture;     // 保存为最后有效纹理
   ```

### 选择锁恢复机制

当选择锁启用时，如果缓存中找不到请求的纹理，会尝试恢复最后有效的纹理:

```csharp
if (_selectionLockActive && _lastValidTextures[planeType] != null)
{
    // 将最后有效纹理重新放入缓存
    string recoveryKey = _currentDisplayedTextures[planeType];
    cache[recoveryKey] = _lastValidTextures[planeType];
    
    // 更新LRU和统计
    UpdateLRU(lruList, recoveryKey);
    _usageCounter[recoveryKey] = 100;
    
    // 标记为永久保护
    MarkTextureAsPermanent(planeType, recoveryKey);
    
    return _lastValidTextures[planeType];
}
```

## 存储纹理

`AddTextureToCache()` 将新生成的纹理添加到缓存中:

```csharp
// 生成新纹理后
Texture2D newTexture = CreateNewTexture();
string cacheKey = cache.GetTextureCacheKey(DicomPlane.PlaneType.Axial, index);

// 添加到缓存
cache.AddTextureToCache(DicomPlane.PlaneType.Axial, cacheKey, newTexture);
```

### 存储过程详解

1. **窗位键索引**:建立窗宽窗位到纹理键的映射
   ```csharp
   string windowLevelKey = ExtractWindowLevelFromKey(key);
   if (!_windowLevelToTextureKeys.ContainsKey(windowLevelKey))
   {
       _windowLevelToTextureKeys[windowLevelKey] = new HashSet<string>();
   }
   _windowLevelToTextureKeys[windowLevelKey].Add(key);
   ```

2. **检查缓存压力**:
   ```csharp
   // 计算纹理大小
   long textureSize = EstimateTextureSize(texture);
   
   // 检查是否需要紧急清理
   float memoryPressure = (float)totalSize / memoryLimit;
   if (memoryPressure > _criticalMemoryPressureThreshold)
   {
       EmergencyCleanup(cache, lruList, ref totalSize, 5);
   }
   ```

3. **处理重复键**:
   ```csharp
   if (cache.ContainsKey(key))
   {
       // 更新现有纹理，调整内存统计
       long oldSize = _textureSizes[key];
       totalSize = totalSize - oldSize + textureSize;
   }
   else
   {
       // 新增纹理
       totalSize += textureSize;
   }
   ```

4. **设置状态和统计**:
   ```csharp
   cache[key] = texture;
   _textureSizes[key] = textureSize;
   UpdateLRU(lruList, key);
   _usageCounter[key] = 1;
   _lastAccessTime[key] = Time.realtimeSinceStartup;
   
   MarkTextureAsActive(planeType, key);
   MarkTextureAsVisible(planeType, key);
   _currentDisplayedTextures[planeType] = key;
   _lastValidTextures[planeType] = texture;
   ```

5. **选择锁处理**:
   ```csharp
   if (_selectionLockActive)
   {
       MarkTextureAsPermanent(planeType, key);
   }
   ```

## 纹理状态管理

### 标记为活跃
```csharp
cache.MarkTextureAsActive(DicomPlane.PlaneType.Axial, cacheKey);
```
增加引用计数，防止在异步操作期间被淘汰。

### 标记为可见
```csharp
cache.MarkTextureAsVisible(DicomPlane.PlaneType.Axial, cacheKey);
```
标记纹理当前在UI上显示，增加额外的保护权重。

### 标记为永久
```csharp
cache.MarkTextureAsPermanent(DicomPlane.PlaneType.Axial, cacheKey);
```
在选择锁期间防止纹理被淘汰，同时设置为活跃和可见状态。

## 缓存键管理

### 生成缓存键
```csharp
string cacheKey = cache.GetTextureCacheKey(
    DicomPlane.PlaneType.Axial, 
    sliceIndex, 
    windowLevelKey  // 可选，默认使用当前窗宽窗位
);
```

### 生成窗位键
```csharp
string windowLevelKey = cache.GetWindowLevelKey(center, width);
// 结果:"{center}-{width}"，如"40-400"
```

## 使用建议

- **及时标记状态**:生成纹理后立即标记为活跃，防止被意外清理
- **检查返回值**:获取纹理时务必检查null值
- **合理使用永久标记**:仅在必要时使用，避免内存泄漏
- **窗位键一致性**:确保生成和查询时使用相同的窗宽窗位值
