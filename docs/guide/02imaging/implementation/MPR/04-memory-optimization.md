---
title: 内存优化与压力管理
---
# 内存优化与压力管理

本页详细介绍MPRTextureManager如何进行内存优化，包括压力检测、缓存修剪和资源释放策略。

## 内存监控机制

### 监控配置

MPRTextureManager提供可配置的内存监控参数:

```csharp
[Header("内存压力监视")]
[SerializeField] private bool enableMemoryMonitoring = true;
[SerializeField] private float memoryMonitorInterval = 5.0f;
[SerializeField] private float resourceReleaseInterval = 30.0f;
```

### 定期检测

在 `Update()` 方法中执行定期内存检测:

```csharp
private void Update()
{
    if (_isShuttingDown) return;
    
    float currentTime = Time.realtimeSinceStartup;
    
    // 内存压力监控
    if (enableMemoryMonitoring && currentTime - _lastMemoryCheckTime > memoryMonitorInterval)
    {
        CheckMemoryPressure();
        _lastMemoryCheckTime = currentTime;
    }
    
    // 定期资源释放
    if (currentTime - _lastResourceReleaseTime > resourceReleaseInterval)
    {
        ReleaseUnusedResources();
        _lastResourceReleaseTime = currentTime;
    }
}
```

## 内存压力检测

### 基础检测方法

```csharp
private void CheckMemoryPressure()
{
    if (_isShuttingDown) return;
    
    // 使用系统内存压力检测
    bool isHighMemoryPressure = IsSystemMemoryPressureHigh();
    
    if (isHighMemoryPressure)
    {
        if (enableDebugLog)
            Debug.Log("[MPRTextureManager] 检测到高内存压力，清理资源");
            
        // 保留当前视图的纹理，清理其他
        TrimCacheToEssential();
        
        // 立即回收未使用的资源
        ReleaseUnusedResources();
    }
}
```

### 系统内存压力检测

```csharp
private bool IsSystemMemoryPressureHigh()
{
    try
    {
        // Unity提供的内存信息
        long totalMemory = SystemInfo.systemMemorySize * 1024L * 1024L; // MB转字节
        long usedMemory = System.GC.GetTotalMemory(false);
        
        // 检查托管内存使用率
        float managedMemoryRatio = (float)usedMemory / totalMemory;
        
        #if UNITY_WSA && !UNITY_EDITOR
            // HoloLens平台，更严格的内存限制
            return managedMemoryRatio > 0.6f;
        #elif UNITY_ANDROID || UNITY_IOS
            // 移动平台
            return managedMemoryRatio > 0.7f;
        #else
            // 桌面平台
            return managedMemoryRatio > 0.8f;
        #endif
    }
    catch (Exception ex)
    {
        Debug.LogWarning($"检测内存压力时出错: {ex.Message}");
        return false;
    }
}
```

### 增强内存检测

```csharp
private bool IsMemoryPressureCritical()
{
    try
    {
        // 检查多个内存指标
        long totalMemory = SystemInfo.systemMemorySize * 1024L * 1024L;
        long usedMemory = System.GC.GetTotalMemory(false);
        
        // 1. 托管内存使用率
        float managedRatio = (float)usedMemory / totalMemory;
        
        // 2. 纹理缓存大小
        long textureCacheSize = 0;
        if (_textureCache != null)
        {
            textureCacheSize += _textureCache.GetCacheCount(DicomPlane.PlaneType.Axial) * EstimateAxialTextureSize();
            textureCacheSize += _textureCache.GetCacheCount(DicomPlane.PlaneType.Sagittal) * EstimateSagittalTextureSize();
            textureCacheSize += _textureCache.GetCacheCount(DicomPlane.PlaneType.Coronal) * EstimateCoronalTextureSize();
        }
        
        float textureCacheRatio = (float)textureCacheSize / totalMemory;
        
        // 3. GC压力检测
        bool highGCPressure = CheckGCPressure();
        
        // 综合判断
        return managedRatio > 0.85f || textureCacheRatio > 0.3f || highGCPressure;
    }
    catch (Exception ex)
    {
        Debug.LogWarning($"检测关键内存压力时出错: {ex.Message}");
        return false;
    }
}

private bool CheckGCPressure()
{
    // 简单的GC压力检测（可根据需要扩展）
    long beforeGC = System.GC.GetTotalMemory(false);
    long afterGC = System.GC.GetTotalMemory(true);
    
    // 如果强制GC后释放的内存较少，说明大部分是活跃对象
    float gcEfficiency = (float)(beforeGC - afterGC) / beforeGC;
    return gcEfficiency < 0.2f; // GC效率低于20%认为压力较大
}
```

### 纹理大小估算

```csharp
private long EstimateAxialTextureSize()
{
    if (_dicomSeries == null) return 1024 * 1024; // 默认1MB
    
    Vector3Int dimensions = _dicomSeries.Dimensions;
    return dimensions.x * dimensions.y * 4; // RGBA32格式
}

private long EstimateSagittalTextureSize()
{
    if (_dicomSeries == null) return 1024 * 1024;
    
    Vector3Int dimensions = _dicomSeries.Dimensions;
    return dimensions.z * dimensions.y * 4; // RGBA32格式
}

private long EstimateCoronalTextureSize()
{
    if (_dicomSeries == null) return 1024 * 1024;
    
    Vector3Int dimensions = _dicomSeries.Dimensions;
    return dimensions.x * dimensions.z * 4; // RGBA32格式
}
```

## 缓存修剪策略

### 保留关键纹理

`TrimCacheToEssential()` 只保留当前视图的纹理:

```csharp
private void TrimCacheToEssential()
{
    // 暂停队列处理避免冲突
    bool wasProcessing = _isProcessingQueue;
    _isProcessingQueue = false;
    
    // 停止所有活跃协程
    ClearActiveCoroutines();
    
    try
    {
        // 修剪各平面缓存，保留当前切片
        TrimPlaneCache(DicomPlane.PlaneType.Axial, _currentAxialIndex);
        TrimPlaneCache(DicomPlane.PlaneType.Sagittal, _currentSagittalIndex);
        TrimPlaneCache(DicomPlane.PlaneType.Coronal, _currentCoronalIndex);
        
        // 清空请求队列，减少内存占用
        lock (_requestQueue)
        {
            _requestQueue.Clear();
            _pendingRequests.Clear();
        }
        
        // 重新添加当前视图的高优先级请求
        AddHighPriorityRequests();
        
        if (enableDebugLog)
        {
            Debug.Log("[MPRTextureManager] 缓存修剪完成，仅保留关键纹理");
        }
    }
    finally
    {
        // 恢复队列处理
        if (wasProcessing && !_isShuttingDown)
        {
            _isProcessingQueue = true;
            var coroutine = StartCoroutine(ProcessQueueCoroutine());
            _activeCoroutines.Add(coroutine);
        }
    }
}
```

### 单平面缓存修剪

```csharp
private void TrimPlaneCache(DicomPlane.PlaneType planeType, int currentIndex)
{
    if (_textureCache == null) return;
    
    // 获取当前缓存数量
    int currentCount = _textureCache.GetCacheCount(planeType);
    
    if (currentCount <= 1) return; // 已经很少了
    
    // 计算保留数量（当前切片附近的几张）
    int keepCount = CalculateKeepCount(planeType, currentCount);
    
    // 如果需要清理
    if (currentCount > keepCount)
    {
        // 标记当前切片及其邻近切片为永久保护
        MarkNearbyTexturesAsPermanent(planeType, currentIndex, keepCount / 2);
        
        // 触发缓存清理（Cache模块会自动保护被标记的纹理）
        _textureCache.CheckAndTrimCache();
        
        if (enableDebugLog)
        {
            int newCount = _textureCache.GetCacheCount(planeType);
            Debug.Log($"修剪 {planeType} 缓存: {currentCount} → {newCount}");
        }
    }
}

private int CalculateKeepCount(DicomPlane.PlaneType planeType, int currentCount)
{
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            return Mathf.Min(10, currentCount); // 最多保留10张轴向
        case DicomPlane.PlaneType.Sagittal:
        case DicomPlane.PlaneType.Coronal:
            return Mathf.Min(3, currentCount);  // 最多保留3张重建
        default:
            return 1;
    }
}

private void MarkNearbyTexturesAsPermanent(DicomPlane.PlaneType planeType, int centerIndex, int range)
{
    if (_textureCache == null || centerIndex < 0) return;
    
    for (int i = -range; i <= range; i++)
    {
        int index = centerIndex + i;
        if (IsValidIndex(planeType, index))
        {
            string cacheKey = GenerateCacheKey(planeType, index, _currentWindowCenter, _currentWindowWidth);
            _textureCache.MarkTextureAsPermanent(planeType, cacheKey);
        }
    }
}
```

## 资源释放

### 主动资源释放

```csharp
private void ReleaseUnusedResources()
{
    if (_isShuttingDown) return;
    
    // 清理已完成的协程引用
    CleanupCompletedCoroutines();
    
    // 检查是否需要强制释放
    bool forceRelease = ShouldForceReleaseResources();
    
    if (forceRelease)
    {
        // 强制模式:更激进的清理
        ForceReleaseResources();
    }
    else
    {
        // 正常模式:温和的清理
        NormalReleaseResources();
    }
    
    if (enableDebugLog)
    {
        long memoryAfter = System.GC.GetTotalMemory(false);
        Debug.Log($"[MPRTextureManager] 资源释放完成，当前内存: {memoryAfter / (1024 * 1024)}MB");
    }
}

private bool ShouldForceReleaseResources()
{
    // 检查内存使用率
    long totalMemory = SystemInfo.systemMemorySize * 1024L * 1024L;
    long usedMemory = System.GC.GetTotalMemory(false);
    float memoryRatio = (float)usedMemory / totalMemory;
    
    return memoryRatio > 0.75f;
}

private void ForceReleaseResources()
{
    // 强制清理所有非关键缓存
    TrimCacheToEssential();
    
    // 强制垃圾回收
    System.GC.Collect();
    System.GC.WaitForPendingFinalizers();
    System.GC.Collect();
    
    // 卸载未使用的Unity资源
    Resources.UnloadUnusedAssets();
    
    if (enableDebugLog)
    {
        Debug.Log("[MPRTextureManager] 执行强制资源释放");
    }
}

private void NormalReleaseResources()
{
    // 温和的资源清理
    CleanupCompletedCoroutines();
    
    // 单次垃圾回收
    System.GC.Collect();
    
    // 卸载Unity资源
    Resources.UnloadUnusedAssets();
}
```

## 自适应缓存大小

### 动态调整缓存

```csharp
private void AdaptCacheSizeToMemory()
{
    if (_textureCache == null) return;
    
    // 获取当前内存状态
    long totalMemory = SystemInfo.systemMemorySize * 1024L * 1024L;
    long usedMemory = System.GC.GetTotalMemory(false);
    float memoryRatio = (float)usedMemory / totalMemory;
    
    // 根据内存使用率调整缓存大小
    float adaptiveRatio = CalculateAdaptiveRatio(memoryRatio);
    
    int newAxialSize = (int)(maxAxialTextureCount * adaptiveRatio);
    int newSagittalSize = (int)(maxSagittalTextureCount * adaptiveRatio);
    int newCoronalSize = (int)(maxCoronalTextureCount * adaptiveRatio);
    
    // 确保最小缓存大小
    newAxialSize = Mathf.Max(8, newAxialSize);
    newSagittalSize = Mathf.Max(2, newSagittalSize);
    newCoronalSize = Mathf.Max(2, newCoronalSize);
    
    _textureCache.SetCacheSize(newAxialSize, newSagittalSize, newCoronalSize);
    
    if (enableDebugLog)
    {
        Debug.Log($"[MPRTextureManager] 自适应缓存大小: A{newAxialSize}/S{newSagittalSize}/C{newCoronalSize} (比例: {adaptiveRatio:F2})");
    }
}

private float CalculateAdaptiveRatio(float memoryRatio)
{
    if (memoryRatio < 0.5f)
        return 1.0f;    // 内存充足，使用全部缓存
    else if (memoryRatio < 0.7f)
        return 0.8f;    // 内存一般，减少20%
    else if (memoryRatio < 0.85f)
        return 0.6f;    // 内存紧张，减少40%
    else
        return 0.4f;    // 内存严重不足，仅保留40%
}
```

## 内存泄漏检测

### 泄漏监控

```csharp
private long _lastMemorySnapshot = 0;
private int _memoryGrowthCount = 0;

private void MonitorMemoryLeaks()
{
    long currentMemory = System.GC.GetTotalMemory(false);
    
    if (_lastMemorySnapshot > 0)
    {
        long memoryGrowth = currentMemory - _lastMemorySnapshot;
        
        // 如果内存持续增长
        if (memoryGrowth > 10 * 1024 * 1024) // 10MB增长
        {
            _memoryGrowthCount++;
            
            if (_memoryGrowthCount >= 3) // 连续3次增长
            {
                Debug.LogWarning($"[MPRTextureManager] 检测到潜在内存泄漏，内存增长: {memoryGrowth / (1024 * 1024)}MB");
                
                // 执行泄漏修复措施
                FixPotentialMemoryLeak();
                _memoryGrowthCount = 0;
            }
        }
        else
        {
            _memoryGrowthCount = 0; // 重置计数器
        }
    }
    
    _lastMemorySnapshot = currentMemory;
}

private void FixPotentialMemoryLeak()
{
    // 1. 强制清理所有缓存
    ClearAllTextures();
    
    // 2. 停止所有协程
    StopAllCoroutines();
    ClearActiveCoroutines();
    
    // 3. 清空请求队列
    ClearRequestQueue();
    
    // 4. 强制垃圾回收
    System.GC.Collect();
    System.GC.WaitForPendingFinalizers();
    System.GC.Collect();
    
    // 5. 卸载Unity资源
    Resources.UnloadUnusedAssets();
    
    Debug.Log("[MPRTextureManager] 执行内存泄漏修复");
}
```

## 平台特定优化

### 移动平台优化

```csharp
#if UNITY_ANDROID || UNITY_IOS
private void OptimizeForMobile()
{
    // 更激进的内存管理
    memoryMonitorInterval = 2.0f;      // 更频繁的检查
    resourceReleaseInterval = 10.0f;   // 更频繁的释放
    
    // 降低缓存大小
    maxAxialTextureCount = 64;
    maxSagittalTextureCount = 16;
    maxCoronalTextureCount = 16;
    
    // 限制并发
    maxConcurrentTasks = 1;
    
    // 启用更严格的内存监控
    enableMemoryMonitoring = true;
}
#endif
```

### HoloLens优化

```csharp
#if UNITY_WSA && !UNITY_EDITOR
private void OptimizeForHoloLens()
{
    // HoloLens内存极其有限
    memoryMonitorInterval = 1.0f;      // 每秒检查
    resourceReleaseInterval = 5.0f;    // 5秒释放一次
    
    // 最小缓存
    maxAxialTextureCount = 32;
    maxSagittalTextureCount = 8;
    maxCoronalTextureCount = 8;
    
    // 单任务模式
    maxConcurrentTasks = 1;
    
    // 启用所有优化
    enableMemoryMonitoring = true;
}
#endif
```

## 使用建议

### 最佳实践

```csharp
// 1. 根据平台配置内存管理
void Start()
{
    ConfigureMemoryManagement();
}

void ConfigureMemoryManagement()
{
    #if UNITY_WSA && !UNITY_EDITOR
        OptimizeForHoloLens();
    #elif UNITY_ANDROID || UNITY_IOS
        OptimizeForMobile();
    #else
        // 桌面平台使用默认设置
    #endif
}

// 2. 监控内存使用情况
void Update()
{
    // 定期检查内存状态
    MonitorMemoryUsage();
}

void MonitorMemoryUsage()
{
    if (Time.frameCount % 300 == 0) // 每5秒检查一次（60fps）
    {
        long currentMemory = System.GC.GetTotalMemory(false);
        float memoryMB = currentMemory / (1024f * 1024f);
        
        if (memoryMB > 500f) // 超过500MB警告
        {
            Debug.LogWarning($"内存使用较高: {memoryMB:F1}MB");
        }
    }
}

// 3. 场景切换时清理
void OnApplicationPause(bool pauseStatus)
{
    if (pauseStatus)
    {
        // 应用暂停时释放所有可释放的资源
        mprManager.ClearAllTextures();
        Resources.UnloadUnusedAssets();
        System.GC.Collect();
    }
}
```

### 调试工具

```csharp
#if UNITY_EDITOR
[UnityEditor.MenuItem("Tools/MPR/Force Memory Cleanup")]
static void ForceMemoryCleanup()
{
    var manager = FindObjectOfType<MPRTextureManager>();
    if (manager != null)
    {
        manager.ClearAllTextures();
        Resources.UnloadUnusedAssets();
        System.GC.Collect();
        Debug.Log("强制内存清理完成");
    }
}

[UnityEditor.MenuItem("Tools/MPR/Memory Report")]
static void GenerateMemoryReport()
{
    long totalMemory = System.GC.GetTotalMemory(false);
    Debug.Log($"当前托管内存: {totalMemory / (1024 * 1024)}MB");
    
    var manager = FindObjectOfType<MPRTextureManager>();
    if (manager != null)
    {
        manager.LogCurrentStatus();
    }
}
#endif
```

有效的内存优化确保MPRTextureManager在各种设备上都能稳定运行，避免内存不足导致的应用崩溃。