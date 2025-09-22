---
title: 内存监控与压力管理
---
# 内存监控与压力管理

本页介绍DicomTextureCache的内存监控机制、压力检测和自适应管理策略。

## 内存压力阈值

系统使用固定阈值监控内存压力状态:

```csharp
// 内存压力阈值（95%）
private readonly float _criticalMemoryPressureThreshold = 0.95f;

// 检查内存压力
private bool IsMemoryPressureCritical(long totalSize, long memoryLimit)
{
    if (memoryLimit <= 0) return false;
    
    float memoryPressure = (float)totalSize / memoryLimit;
    return memoryPressure > _criticalMemoryPressureThreshold;
}
```

当任一平面的内存占用超过95%限制时，触发紧急清理机制。

## 纹理大小估算

系统通过纹理格式和尺寸估算内存占用:

```csharp
private long EstimateTextureSize(Texture2D texture)
{
    if (texture == null) return 0;
    
    int width = texture.width;
    int height = texture.height;
    int bytesPerPixel = 0;
    
    // 根据纹理格式计算每像素字节数
    switch (texture.format)
    {
        case TextureFormat.Alpha8: 
            bytesPerPixel = 1; 
            break;
        case TextureFormat.RGB24: 
            bytesPerPixel = 3; 
            break;
        case TextureFormat.RGBA32:
        case TextureFormat.ARGB32: 
            bytesPerPixel = 4; 
            break;
        case TextureFormat.RGB565:
        case TextureFormat.RGBA4444:
        case TextureFormat.ARGB4444: 
            bytesPerPixel = 2; 
            break;
        default: 
            bytesPerPixel = 4;  // 默认RGBA32
            break;
    }
    
    // 基础纹理大小
    long textureSize = (long)width * height * bytesPerPixel;
    
    // Mipmap额外开销（约33%）
    if (texture.mipmapCount > 1)
    {
        textureSize = (long)(textureSize * 1.33f);
    }
    
    return textureSize;
}
```

### 内存统计维护

每个平面维护独立的内存统计:

```csharp
// 添加纹理时更新统计
public void AddTextureToCache(DicomPlane.PlaneType planeType, string key, Texture2D texture)
{
    long textureSize = EstimateTextureSize(texture);
    ref long totalSize = ref GetTotalSizeRefForPlane(planeType);
    
    if (cache.ContainsKey(key))
    {
        // 替换现有纹理，调整内存差值
        long oldSize = _textureSizes.TryGetValue(key, out long size) ? size : 0;
        totalSize = totalSize - oldSize + textureSize;
    }
    else
    {
        // 新增纹理
        totalSize += textureSize;
    }
    
    _textureSizes[key] = textureSize;
    
    // 检查是否需要紧急清理
    long memoryLimit = GetMemoryLimitForPlane(planeType);
    if (IsMemoryPressureCritical(totalSize, memoryLimit))
    {
        EmergencyCleanup(cache, lruList, ref totalSize, 5);
    }
}

// 移除纹理时更新统计
private bool RemoveTextureByKey(Dictionary<string, Texture2D> cache, LinkedList<string> lruList, 
                               string key, ref long totalSize)
{
    if (_textureSizes.TryGetValue(key, out long size))
    {
        totalSize -= size;
        _textureSizes.Remove(key);
    }
    
    // ... 其他清理逻辑
}
```

## 内存限制配置

不同平面使用不同的内存系数:

```csharp
public void SetCacheSize(int axialSize, int sagittalSize, int coronalSize)
{
    lock (_cacheLock)
    {
        // 轴向纹理内存系数:512KB
        _axialMemoryLimit = 512 * 1024L * axialSize;
        
        // 矢状/冠状纹理内存系数:768KB（重建复杂度更高）
        _sagittalMemoryLimit = 768 * 1024L * sagittalSize;
        _coronalMemoryLimit = 768 * 1024L * coronalSize;
        
        // 立即检查并修剪缓存
        CheckAndTrimCache();
    }
}
```

### 获取平面内存限制

```csharp
private long GetMemoryLimitForPlane(DicomPlane.PlaneType planeType)
{
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            return _axialMemoryLimit;
        case DicomPlane.PlaneType.Sagittal:
            return _sagittalMemoryLimit;
        case DicomPlane.PlaneType.Coronal:
            return _coronalMemoryLimit;
        default:
            return _axialMemoryLimit;
    }
}

private ref long GetTotalSizeRefForPlane(DicomPlane.PlaneType planeType)
{
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            return ref _axialTotalSize;
        case DicomPlane.PlaneType.Sagittal:
            return ref _sagittalTotalSize;
        case DicomPlane.PlaneType.Coronal:
            return ref _coronalTotalSize;
        default:
            return ref _axialTotalSize;
    }
}
```

## 选择锁保护机制

选择锁防止在用户快速浏览时清理当前纹理:

```csharp
// 激活选择锁
public void LockSelectionMode()
{
    lock (_cacheLock)
    {
        _selectionLockActive = true;
        _selectionLockTime = Time.realtimeSinceStartup;
    }
}

// 检查并释放过期的选择锁
private void CheckAndReleaseSelectionLock()
{
    if (_selectionLockActive)
    {
        float elapsedTime = Time.realtimeSinceStartup - _selectionLockTime;
        if (elapsedTime > SELECTION_LOCK_DURATION)  // 3秒
        {
            _selectionLockActive = false;
        }
    }
}

// 修剪时检查选择锁状态
private void CheckAndTrimCache()
{
    lock (_cacheLock)
    {
        // 选择锁期间暂停缓存修剪
        if (_selectionLockActive)
        {
            return;
        }
        
        // 正常修剪逻辑...
    }
}
```

### 最后有效纹理保护

```csharp
// 保存最后有效纹理，用于选择锁期间的恢复
public void MarkTextureAsVisible(DicomPlane.PlaneType planeType, string key)
{
    lock (_cacheLock)
    {
        string fullKey = GetContextKey(planeType, key);
        _visibleTextures.Add(fullKey);
        _currentDisplayedTextures[planeType] = key;
        
        // 保存为最后有效纹理
        if (HasTextureInCache(planeType, key))
        {
            _lastValidTextures[planeType] = GetCacheForPlane(planeType)[key];
        }
    }
}

// 选择锁期间的纹理恢复
public Texture2D GetTextureFromCache(DicomPlane.PlaneType planeType, string key)
{
    lock (_cacheLock)
    {
        // 正常缓存查找...
        
        // 如果缓存未命中且选择锁启用，尝试恢复最后有效纹理
        if (texture == null && _selectionLockActive && _lastValidTextures[planeType] != null)
        {
            // 将最后有效纹理重新放入缓存
            string recoveryKey = _currentDisplayedTextures[planeType];
            if (!string.IsNullOrEmpty(recoveryKey))
            {
                cache[recoveryKey] = _lastValidTextures[planeType];
                UpdateLRU(lruList, recoveryKey);
                _usageCounter[recoveryKey] = 100;
                _lastAccessTime[recoveryKey] = Time.realtimeSinceStartup;
                
                MarkTextureAsPermanent(planeType, recoveryKey);
            }
            
            return _lastValidTextures[planeType];
        }
        
        return texture;
    }
}
```

## 自适应清理策略

### 渐进式清理

```csharp
private void TrimCacheToFitLimits(Dictionary<string, Texture2D> cache, LinkedList<string> lruList, 
                                 ref long totalSize, int maxCount, long maxSize)
{
    // 设定缓冲区，目标为最大值的80%
    long targetSize = (long)(maxSize * 0.8f);
    int targetCount = (int)(maxCount * 0.8f);
    
    // 渐进式移除，直到达到目标或无法继续移除
    while ((cache.Count > targetCount || totalSize > targetSize) && lruList.Count > 0)
    {
        bool removed = RemoveWithBalancedStrategy(cache, lruList, ref totalSize);
        if (!removed) 
        {
            // 如果无法移除更多纹理（都被保护），跳出循环
            break;
        }
    }
}
```

### 紧急清理触发

```csharp
// 在添加纹理时检查内存压力
if (IsMemoryPressureCritical(totalSize, memoryLimit))
{
    // 紧急清理，一次移除5个纹理
    EmergencyCleanup(cache, lruList, ref totalSize, 5);
    
    // 如果仍然超限，再次尝试
    if (IsMemoryPressureCritical(totalSize, memoryLimit))
    {
        EmergencyCleanup(cache, lruList, ref totalSize, 10);
    }
}
```

## 内存优化建议

### 平台适配

```csharp
// 根据平台调整内存策略
public void ConfigureForPlatform()
{
    #if UNITY_EDITOR
        // 编辑器环境，使用较大缓存
        SetCacheSize(512, 128, 128);
    #elif UNITY_WSA && !UNITY_EDITOR
        // HoloLens平台，内存受限
        SetCacheSize(128, 32, 32);
    #elif UNITY_ANDROID || UNITY_IOS
        // 移动平台，中等缓存
        SetCacheSize(256, 64, 64);
    #else
        // 桌面平台，标准缓存
        SetCacheSize(256, 64, 64);
    #endif
}
```

### 动态调整

```csharp
// 根据系统内存状态动态调整
public void AdaptToSystemMemory()
{
    long availableMemory = GetAvailableSystemMemory();
    
    if (availableMemory < 512 * 1024 * 1024)  // < 512MB
    {
        // 低内存模式
        SetCacheSize(64, 16, 16);
        _criticalMemoryPressureThreshold = 0.85f;
    }
    else if (availableMemory < 1024 * 1024 * 1024)  // < 1GB
    {
        // 中等内存模式
        SetCacheSize(128, 32, 32);
        _criticalMemoryPressureThreshold = 0.90f;
    }
    else
    {
        // 高内存模式
        SetCacheSize(256, 64, 64);
        _criticalMemoryPressureThreshold = 0.95f;
    }
}
```

有效的内存监控确保缓存系统在各种设备上稳定运行，避免内存不足导致的应用崩溃。