---
title: 后台预取策略实现
---
# 后台预取策略实现

> 深入解析SliceControl模块的智能预取算法与批量加载机制

## 相邻切片预取算法

### LoadAdjacentSlicesCoroutine核心实现
```csharp
private IEnumerator LoadAdjacentSlicesCoroutine(DicomPlane.PlaneType planeType, int centerIndex, int range) {
    for (int offset = 1; offset <= range; offset++) {
        // 计算前后索引
        int index1 = centerIndex - offset;  // 向前预取
        int index2 = centerIndex + offset;  // 向后预取
        
        // 根据平面类型进行边界检查和预取
        switch (planeType) {
            case DicomPlane.PlaneType.Axial:
                if (index1 >= 0 && index1 < viewer.loadedSeries.Slices.Count) {
                    viewer.textureManager.GetTexture(planeType, index1);
                }
                if (index2 >= 0 && index2 < viewer.loadedSeries.Slices.Count) {
                    viewer.textureManager.GetTexture(planeType, index2);
                }
                break;
                
            case DicomPlane.PlaneType.Sagittal:
                if (index1 >= 0 && index1 < viewer.loadedSeries.GetSagittalDimension()) {
                    viewer.textureManager.GetTexture(planeType, index1);
                }
                if (index2 >= 0 && index2 < viewer.loadedSeries.GetSagittalDimension()) {
                    viewer.textureManager.GetTexture(planeType, index2);
                }
                break;
                
            case DicomPlane.PlaneType.Coronal:
                if (index1 >= 0 && index1 < viewer.loadedSeries.GetCoronalDimension()) {
                    viewer.textureManager.GetTexture(planeType, index1);
                }
                if (index2 >= 0 && index2 < viewer.loadedSeries.GetCoronalDimension()) {
                    viewer.textureManager.GetTexture(planeType, index2);
                }
                break;
        }
        
        // 逐帧让出执行权，避免卡顿
        yield return null;
        
        // 内存压力检测与自适应延迟
        if (viewer.coroutineModule.IsMemoryPressureHigh()) {
            yield return new WaitForSeconds(0.5f);
        }
    }
}
```

**算法特点分析**:
- **对称预取**:基于当前索引向两侧等距离预取
- **局部性原理**:用户通常浏览相邻切片，预取命中率高
- **边界安全**:严格的索引边界检查防止越界
- **性能友好**:逐帧让出执行权，不影响UI响应

## 系统性后台加载机制

### BackgroundLoadingCoroutine主流程
```csharp
private IEnumerator BackgroundLoadingCoroutine() {
    // 初始等待，确保主要纹理已生成
    yield return new WaitForSeconds(0.5f);
    
    // 配置批量参数
    int batchSize = 3;
    
    // 计算各平面的批次数量（限制最大批次数）
    int totalAxialBatches = Mathf.Min(5, 
        Mathf.CeilToInt((float)viewer.loadedSeries.Slices.Count / batchSize));
    int totalSagittalBatches = Mathf.Min(3, 
        Mathf.CeilToInt((float)viewer.loadedSeries.GetSagittalDimension() / batchSize));
    int totalCoronalBatches = Mathf.Min(3, 
        Mathf.CeilToInt((float)viewer.loadedSeries.GetCoronalDimension() / batchSize));
    
    // 第一阶段:轴向优先处理
    for (int batch = 0; batch < totalAxialBatches; batch++) {
        yield return LoadAxialBatchCoroutine(batch, batchSize);
        
        // 内存压力检测
        if (viewer.coroutineModule.IsMemoryPressureHigh()) {
            yield return new WaitForSeconds(1.0f);
        }
    }
    
    // 第二阶段:矢状/冠状并行处理
    for (int batch = 0; batch < Mathf.Max(totalSagittalBatches, totalCoronalBatches); batch++) {
        // 交替处理矢状和冠状
        if (batch < totalSagittalBatches) {
            yield return LoadSagittalBatchCoroutine(batch, batchSize);
        }
        
        if (viewer.coroutineModule.IsMemoryPressureHigh()) {
            yield return new WaitForSeconds(1.0f);
        }
        
        if (batch < totalCoronalBatches) {
            yield return LoadCoronalBatchCoroutine(batch, batchSize);
        }
        
        // 批次间等待
        yield return new WaitForSeconds(0.2f);
        
        if (viewer.coroutineModule.IsMemoryPressureHigh()) {
            yield return new WaitForSeconds(1.0f);
        }
    }
    
    Debug.Log("后台加载完成");
}
```

**分阶段策略优势**:
- **轴向优先**:医学影像最常用的浏览方向
- **批次限制**:避免过度预取占用内存
- **压力感知**:根据内存状况动态调整节奏

## 批量加载算法实现

### LoadAxialBatchCoroutine详细实现
```csharp
private IEnumerator LoadAxialBatchCoroutine(int batchIndex, int batchSize) {
    if (viewer.loadedSeries == null || viewer.textureManager == null) yield break;
    
    // 计算当前批次的偏移量
    int offset = (batchIndex + 1) * batchSize / 2;
    
    for (int i = 0; i < batchSize; i++) {
        // 基于当前轴向索引向两侧扩展
        int idx1 = axialIndex - offset + i;
        int idx2 = axialIndex + offset - i;
        
        // 边界检查并请求纹理
        if (idx1 >= 0 && idx1 < viewer.loadedSeries.Slices.Count) {
            viewer.textureManager.GetTexture(DicomPlane.PlaneType.Axial, idx1);
        }
        
        if (idx2 >= 0 && idx2 < viewer.loadedSeries.Slices.Count && idx2 != idx1) {
            viewer.textureManager.GetTexture(DicomPlane.PlaneType.Axial, idx2);
        }
        
        // 每处理2张切片让出一次执行权
        if (i % 2 == 1) yield return null;
    }
}
```

### LoadSagittalBatchCoroutine实现
```csharp
private IEnumerator LoadSagittalBatchCoroutine(int batchIndex, int batchSize) {
    if (viewer.loadedSeries == null || viewer.textureManager == null) yield break;
    
    int offset = (batchIndex + 1) * batchSize / 2;
    
    for (int i = 0; i < batchSize; i++) {
        int idx1 = sagittalIndex - offset + i;
        int idx2 = sagittalIndex + offset - i;
        
        if (idx1 >= 0 && idx1 < viewer.loadedSeries.GetSagittalDimension()) {
            viewer.textureManager.GetTexture(DicomPlane.PlaneType.Sagittal, idx1);
        }
        
        if (idx2 >= 0 && idx2 < viewer.loadedSeries.GetSagittalDimension() && idx2 != idx1) {
            viewer.textureManager.GetTexture(DicomPlane.PlaneType.Sagittal, idx2);
        }
        
        if (i % 2 == 1) yield return null;
    }
}
```

### LoadCoronalBatchCoroutine实现
冠状面的批量加载与矢状面实现相同，只是调用不同的维度方法:
```csharp
// 主要区别在于边界检查
if (idx1 >= 0 && idx1 < viewer.loadedSeries.GetCoronalDimension()) {
    viewer.textureManager.GetTexture(DicomPlane.PlaneType.Coronal, idx1);
}
```

## 内存感知的自适应策略

### 内存压力下的行为调整
```csharp
// 在各种等待点检查内存压力
if (viewer.coroutineModule.IsMemoryPressureHigh()) {
    // 策略1:增加等待时间
    yield return new WaitForSeconds(1.0f);
    
    // 策略2:减少批量大小
    batchSize = Mathf.Max(1, batchSize / 2);
    
    // 策略3:触发资源清理
    Resources.UnloadUnusedAssets();
    
    // 策略4:极端情况下暂停预取
    if (GetMemoryUsageRatio() > 0.9f) {
        Debug.LogWarning("内存使用率过高，暂停后台预取");
        yield break;
    }
}
```

### 动态批量大小调整
```csharp
private int GetAdaptiveBatchSize(int baseBatchSize) {
    float memoryPressure = GetMemoryPressureLevel();
    
    if (memoryPressure < 0.5f) {
        return baseBatchSize * 2;  // 低压力时加速
    } else if (memoryPressure < 0.7f) {
        return baseBatchSize;      // 正常批量
    } else if (memoryPressure < 0.85f) {
        return baseBatchSize / 2;  // 减半
    } else {
        return 1;                  // 逐个处理
    }
}

private float GetMemoryPressureLevel() {
    // 基于多个指标综合评估
    long allocated = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong();
    long reserved = UnityEngine.Profiling.Profiler.GetTotalReservedMemoryLong();
    
    // 计算内存使用率
    float allocatedRatio = (float)allocated / (SystemInfo.systemMemorySize * 1024L * 1024L);
    float reservedRatio = (float)reserved / (SystemInfo.systemMemorySize * 1024L * 1024L);
    
    return Mathf.Max(allocatedRatio, reservedRatio);
}
```

## 预取优先级策略

### 基于距离的优先级计算
```csharp
private float CalculatePreloadPriority(DicomPlane.PlaneType planeType, int targetIndex) {
    int currentIndex = GetCurrentIndex(planeType);
    int distance = Mathf.Abs(targetIndex - currentIndex);
    
    // 距离越近优先级越高
    float distancePriority = 1.0f / (distance + 1);
    
    // 平面类型权重
    float planeWeight = GetPlaneWeight(planeType);
    
    // 访问频率权重（可扩展）
    float accessFrequency = GetAccessFrequency(planeType, targetIndex);
    
    return distancePriority * planeWeight * accessFrequency;
}

private float GetPlaneWeight(DicomPlane.PlaneType planeType) {
    switch (planeType) {
        case DicomPlane.PlaneType.Axial:    return 1.0f;  // 最高权重
        case DicomPlane.PlaneType.Sagittal: return 0.7f;  // 中等权重
        case DicomPlane.PlaneType.Coronal:  return 0.5f;  // 较低权重
        default: return 0.1f;
    }
}
```

### 智能预取范围调整
```csharp
private int GetAdaptivePreloadRange(DicomPlane.PlaneType planeType) {
    int baseRange = 3;  // 默认预取范围
    
    // 根据数据大小调整
    int totalSlices = GetTotalSlices(planeType);
    if (totalSlices < 20) {
        return Mathf.Min(baseRange, totalSlices / 4);  // 小数据集减小范围
    } else if (totalSlices > 200) {
        return baseRange * 2;  // 大数据集增加范围
    }
    
    // 根据设备性能调整
    if (SystemInfo.systemMemorySize < 4096) {  // 4GB以下设备
        return baseRange - 1;
    } else if (SystemInfo.systemMemorySize > 8192) {  // 8GB以上设备
        return baseRange + 2;
    }
    
    return baseRange;
}
```

## 用户行为预测优化

### 浏览模式识别
```csharp
private enum BrowsePattern {
    Sequential,    // 顺序浏览
    Jump,         // 跳跃浏览
    Focus,        // 集中浏览某个区域
    Random        // 随机浏览
}

private BrowsePattern AnalyzeBrowsePattern() {
    // 基于最近的索引变化历史分析用户浏览模式
    if (recentIndexChanges.Count < 3) return BrowsePattern.Sequential;
    
    int sequentialCount = 0;
    int jumpCount = 0;
    
    for (int i = 1; i < recentIndexChanges.Count; i++) {
        int diff = Mathf.Abs(recentIndexChanges[i] - recentIndexChanges[i-1]);
        if (diff == 1) {
            sequentialCount++;
        } else if (diff > 5) {
            jumpCount++;
        }
    }
    
    if (sequentialCount > jumpCount * 2) {
        return BrowsePattern.Sequential;
    } else if (jumpCount > sequentialCount) {
        return BrowsePattern.Jump;
    }
    
    return BrowsePattern.Focus;
}

private void AdjustPreloadStrategy(BrowsePattern pattern) {
    switch (pattern) {
        case BrowsePattern.Sequential:
            // 增加前进方向的预取范围
            preloadForwardRange = 5;
            preloadBackwardRange = 2;
            break;
            
        case BrowsePattern.Jump:
            // 减少预取范围，但增加缓存时间
            preloadForwardRange = 2;
            preloadBackwardRange = 2;
            break;
            
        case BrowsePattern.Focus:
            // 增加当前区域的预取密度
            preloadForwardRange = 3;
            preloadBackwardRange = 3;
            break;
    }
}
```

## 性能监控与调优

### 预取效率统计
```csharp
public class PreloadStats {
    public int TotalRequests;
    public int CacheHits;
    public int CacheMisses;
    public float AverageLoadTime;
    public float MemoryUsage;
    
    public float HitRate => TotalRequests > 0 ? (float)CacheHits / TotalRequests : 0;
}

private PreloadStats GetPreloadStatistics() {
    return new PreloadStats {
        TotalRequests = totalPreloadRequests,
        CacheHits = cacheHitCount,
        CacheMisses = cacheMissCount,
        AverageLoadTime = totalLoadTime / totalPreloadRequests,
        MemoryUsage = GetCurrentTextureMemoryUsage()
    };
}

private void LogPreloadPerformance() {
    var stats = GetPreloadStatistics();
    Debug.Log($"预取性能统计 - 命中率: {stats.HitRate:P2}, " +
              $"平均加载时间: {stats.AverageLoadTime:F2}ms, " +
              $"内存使用: {stats.MemoryUsage / 1024 / 1024:F1}MB");
}
```

### 自适应参数调整
```csharp
private void OptimizePreloadParameters() {
    var stats = GetPreloadStatistics();
    
    // 根据命中率调整预取范围
    if (stats.HitRate < 0.7f) {
        // 命中率低，增加预取范围
        currentPreloadRange = Mathf.Min(currentPreloadRange + 1, maxPreloadRange);
    } else if (stats.HitRate > 0.9f && stats.MemoryUsage > memoryThreshold) {
        // 命中率高但内存使用过多，减少预取范围
        currentPreloadRange = Mathf.Max(currentPreloadRange - 1, minPreloadRange);
    }
    
    // 根据加载时间调整批量大小
    if (stats.AverageLoadTime > 100f) {  // 超过100ms
        currentBatchSize = Mathf.Max(currentBatchSize - 1, 1);
    } else if (stats.AverageLoadTime < 50f) {  // 低于50ms
        currentBatchSize = Mathf.Min(currentBatchSize + 1, maxBatchSize);
    }
}
```

## 协程安全与取消机制

### 安全的协程启动
```csharp
public void StartBackgroundLoading() {
    if (viewer.useBackgroundLoading && !isBackgroundLoadingActive) {
        isBackgroundLoadingActive = true;
        backgroundLoadingCoroutine = viewer.coroutineModule.StartCoroutineTracked(
            BackgroundLoadingCoroutine());
    }
}
```

### 协程取消与清理
```csharp
public void StopBackgroundLoading() {
    if (backgroundLoadingCoroutine != null) {
        viewer.StopCoroutine(backgroundLoadingCoroutine);
        backgroundLoadingCoroutine = null;
    }
    isBackgroundLoadingActive = false;
    
    // 清理预取队列
    if (viewer.textureManager != null) {
        viewer.textureManager.ClearPreloadQueue();
    }
}
```

### 状态一致性保护
```csharp
// 在所有预取协程中检查状态
private bool ShouldContinuePreloading() {
    return !viewer.isShuttingDown && 
           viewer.isInitialized && 
           viewer.useBackgroundLoading && 
           viewer.loadedSeries != null;
}

// 在协程循环中使用
for (int batch = 0; batch < totalBatches; batch++) {
    if (!ShouldContinuePreloading()) {
        Debug.Log("预取被中断");
        yield break;
    }
    
    yield return LoadBatchCoroutine(batch, batchSize);
}
```

## 与纹理管理器的协作

### 预取请求的提交
```csharp
// 通过textureManager.GetTexture()提交预取请求
viewer.textureManager.GetTexture(planeType, index);

// 该调用会:
// 1. 检查缓存中是否已存在
// 2. 如果不存在，添加到请求队列
// 3. 异步生成纹理
// 4. 完成后触发OnTextureCreated事件
```

### 预取优先级设置
```csharp
// 为预取请求设置较低优先级
viewer.textureManager.GetTexture(planeType, index, priority: TexturePriority.Low);

// 当前切片请求使用高优先级
viewer.textureManager.GetTexture(planeType, currentIndex, priority: TexturePriority.High);
```

### 预取队列管理
```csharp
// 定期清理过期的预取请求
private void CleanupOldPreloadRequests() {
    var currentTime = Time.realtimeSinceStartup;
    
    // 移除超过一定时间未访问的预取请求
    viewer.textureManager.RemoveStaleRequests(currentTime - 60f);  // 60秒过期
}
```