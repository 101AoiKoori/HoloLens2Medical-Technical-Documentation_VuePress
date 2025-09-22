---
title: 异步纹理创建
---
# 异步纹理创建

本页详细介绍MPRTextureManager如何处理异步纹理创建，包括协程管理、并发控制和错误处理。

## 异步创建概述

MPRTextureManager使用协程实现异步纹理创建，避免主线程阻塞:

- **轴向纹理**:快速同步创建，必要时也可异步
- **矢状纹理**:复杂重建，必须异步创建
- **冠状纹理**:复杂重建，必须异步创建

## 纹理创建调度

### 创建策略选择

`CreateTextureAsync()` 方法根据平面类型选择创建策略:

```csharp
private IEnumerator CreateTextureAsync(TextureRequest request)
{
    Texture2D texture = null;
    float startTime = Time.realtimeSinceStartup;
    
    try
    {
        switch (request.PlaneType)
        {
            case DicomPlane.PlaneType.Axial:
                // 轴向切片同步创建（快速）
                texture = CreateAxialTextureSafe(request.Index, request.WindowCenter, request.WindowWidth);
                yield return null; // 让出一帧
                break;
                
            case DicomPlane.PlaneType.Sagittal:
                // 矢状面异步创建
                yield return StartCoroutine(CreateSagittalTextureAsync(request));
                break;
                
            case DicomPlane.PlaneType.Coronal:
                // 冠状面异步创建
                yield return StartCoroutine(CreateCoronalTextureAsync(request));
                break;
        }
        
        // 记录处理时间
        float processingTime = Time.realtimeSinceStartup - startTime;
        RecordTextureCreation(processingTime);
        
        if (texture != null && !_isShuttingDown)
        {
            // 添加到缓存
            AddTextureToCache(request.PlaneType, request.CacheKey, texture);
            
            // 触发完成事件
            OnTextureCreated?.Invoke(request.PlaneType, request.Index);
        }
    }
    catch (Exception ex)
    {
        Debug.LogError($"异步创建 {request.PlaneType} 纹理时出错: {ex.Message}");
        texture = null;
    }
    
    // 完成请求处理
    CompleteRequest(request, texture);
}
```

### 轴向纹理创建

```csharp
private Texture2D CreateAxialTextureSafe(int index, float windowCenter, float windowWidth)
{
    if (_isShuttingDown || _dicomSeries == null) return null;
    
    try
    {
        // 直接从DicomSeries获取轴向纹理
        Texture2D texture = _dicomSeries.GetAxialTexture(index, windowCenter, windowWidth);
        
        if (texture != null)
        {
            RecordCacheHit();
        }
        else
        {
            RecordCacheMiss();
        }
        
        return texture;
    }
    catch (Exception ex)
    {
        Debug.LogError($"创建轴向纹理 #{index} 时出错: {ex.Message}");
        return null;
    }
}
```

## 矢状面异步创建

`CreateSagittalTextureAsync()` 处理复杂的矢状面重建:

```csharp
private IEnumerator CreateSagittalTextureAsync(TextureRequest request)
{
    if (_dicomSeries == null || _isShuttingDown)
    {
        CompleteRequest(request, null);
        yield break;
    }
    
    Texture2D texture = null;
    bool completed = false;
    Exception processingError = null;
    
    try
    {
        // 使用DicomSeries的异步创建方法
        var coroutine = _dicomSeries.CreateSagittalTextureCoroutine(
            request.Index, 
            request.WindowCenter, 
            request.WindowWidth,
            (result) =>
            {
                texture = result;
                completed = true;
            });
            
        if (coroutine != null)
        {
            yield return coroutine;
            
            // 设置超时检查
            float timeout = 10.0f;
            float elapsed = 0f;
            
            while (!completed && elapsed < timeout && !_isShuttingDown)
            {
                yield return null;
                elapsed += Time.deltaTime;
            }
            
            if (!completed && !_isShuttingDown)
            {
                Debug.LogWarning($"矢状面纹理 #{request.Index} 创建超时");
                texture = null;
            }
        }
    }
    catch (Exception ex)
    {
        processingError = ex;
        Debug.LogError($"创建矢状面纹理协程时出错: {ex.Message}");
    }
    
    // 确保在所有情况下都调用回调
    if (processingError == null && texture != null)
    {
        RecordCacheHit();
    }
    else
    {
        RecordCacheMiss();
    }
}
```

## 冠状面异步创建

`CreateCoronalTextureAsync()` 处理冠状面重建:

```csharp
private IEnumerator CreateCoronalTextureAsync(TextureRequest request)
{
    if (_dicomSeries == null || _isShuttingDown)
    {
        CompleteRequest(request, null);
        yield break;
    }
    
    Texture2D texture = null;
    bool completed = false;
    Exception processingError = null;
    
    try
    {
        // 使用DicomSeries的异步创建方法
        var coroutine = _dicomSeries.CreateCoronalTextureCoroutine(
            request.Index,
            request.WindowCenter,
            request.WindowWidth,
            (result) =>
            {
                texture = result;
                completed = true;
            });
            
        if (coroutine != null && !_isShuttingDown)
        {
            yield return coroutine;
            
            // 超时处理
            float timeout = 10.0f;
            float elapsed = 0f;
            
            while (!completed && elapsed < timeout && !_isShuttingDown)
            {
                yield return null;
                elapsed += Time.deltaTime;
            }
            
            if (!completed && !_isShuttingDown)
            {
                Debug.LogWarning($"冠状面纹理 #{request.Index} 创建超时");
                texture = null;
            }
        }
    }
    catch (Exception ex)
    {
        processingError = ex;
        Debug.LogError($"创建冠状面纹理协程时出错: {ex.Message}");
    }
    
    // 记录结果
    if (processingError == null && texture != null)
    {
        RecordCacheHit();
    }
    else
    {
        RecordCacheMiss();
    }
}
```

## 并发控制

### 任务数量限制

```csharp
[SerializeField] private int maxConcurrentTasks = 2;
private int _activeTaskCount = 0;

// 在ProcessQueueCoroutine中检查并发限制
private IEnumerator ProcessQueueCoroutine()
{
    while (!_isShuttingDown)
    {
        lock (_requestQueue)
        {
            // 如果当前任务数量达上限，等待
            if (_activeTaskCount >= maxConcurrentTasks)
            {
                yield return new WaitForSeconds(0.05f);
                continue;
            }
            
            // 获取下一个请求...
        }
        
        // 处理请求
        if (request != null)
        {
            yield return StartCoroutine(ProcessSingleRequest(request));
        }
    }
}
```

### 任务计数管理

```csharp
private IEnumerator ProcessSingleRequest(TextureRequest request)
{
    // 增加活跃任务计数
    _activeTaskCount++;
    
    try
    {
        // 再次检查缓存（避免重复创建）
        Texture2D cachedTexture = _textureCache?.GetTextureFromCache(request.PlaneType, request.CacheKey);
        if (cachedTexture != null)
        {
            CompleteRequest(request, cachedTexture);
            yield break;
        }
        
        // 创建纹理
        yield return StartCoroutine(CreateTextureAsync(request));
    }
    finally
    {
        // 确保计数正确减少
        _activeTaskCount--;
    }
}
```

## 超时和错误处理

### 超时机制

```csharp
private IEnumerator CreateTextureWithTimeout(TextureRequest request, float timeoutSeconds)
{
    bool completed = false;
    Texture2D result = null;
    Exception error = null;
    
    // 启动创建协程
    var creationCoroutine = StartCoroutine(CreateTextureWithCallback(request, 
        (texture, ex) =>
        {
            result = texture;
            error = ex;
            completed = true;
        }));
    
    // 等待完成或超时
    float elapsed = 0f;
    while (!completed && elapsed < timeoutSeconds && !_isShuttingDown)
    {
        yield return null;
        elapsed += Time.deltaTime;
    }
    
    if (!completed)
    {
        // 超时处理
        StopCoroutine(creationCoroutine);
        Debug.LogWarning($"纹理创建超时: {request.PlaneType} #{request.Index}");
        CompleteRequest(request, null);
    }
    else if (error != null)
    {
        // 错误处理
        Debug.LogError($"纹理创建错误: {error.Message}");
        CompleteRequest(request, null);
    }
    else
    {
        // 成功完成
        CompleteRequest(request, result);
    }
}
```

### 异常恢复

```csharp
private IEnumerator CreateTextureWithRetry(TextureRequest request, int maxRetries = 2)
{
    int retryCount = 0;
    
    while (retryCount <= maxRetries && !_isShuttingDown)
    {
        try
        {
            yield return StartCoroutine(CreateTextureAsync(request));
            break; // 成功，退出重试循环
        }
        catch (Exception ex)
        {
            retryCount++;
            
            if (retryCount <= maxRetries)
            {
                Debug.LogWarning($"创建纹理失败，进行第 {retryCount} 次重试: {ex.Message}");
                yield return new WaitForSeconds(0.5f); // 短暂延迟后重试
            }
            else
            {
                Debug.LogError($"创建纹理最终失败，已重试 {maxRetries} 次: {ex.Message}");
                CompleteRequest(request, null);
            }
        }
    }
}
```

## 协程生命周期管理

### 协程启动和跟踪

```csharp
private List<Coroutine> _activeCoroutines = new List<Coroutine>();

private Coroutine StartTrackedCoroutine(IEnumerator routine)
{
    if (_isShuttingDown) return null;
    
    try
    {
        Coroutine coroutine = StartCoroutine(routine);
        _activeCoroutines.Add(coroutine);
        return coroutine;
    }
    catch (Exception ex)
    {
        Debug.LogError($"启动协程时出错: {ex.Message}");
        return null;
    }
}
```

### 协程清理

```csharp
private void CleanupCompletedCoroutines()
{
    // 移除空引用（已完成的协程）
    _activeCoroutines.RemoveAll(c => c == null);
}

private void StopAllTrackedCoroutines()
{
    foreach (var coroutine in _activeCoroutines)
    {
        if (coroutine != null)
        {
            try
            {
                StopCoroutine(coroutine);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"停止协程时出错: {ex.Message}");
            }
        }
    }
    
    _activeCoroutines.Clear();
    _activeTaskCount = 0;
}
```

## 请求完成处理

### 完成回调

```csharp
private void CompleteRequest(TextureRequest request, Texture2D texture)
{
    // 减少活跃任务计数
    _activeTaskCount--;
    
    // 从待处理请求中移除
    lock (_requestQueue)
    {
        _pendingRequests.Remove(request.CacheKey);
    }
    
    // 如果组件正在关闭但纹理已创建，确保纹理被销毁
    if (_isShuttingDown && texture != null)
    {
        UnityEngine.Object.Destroy(texture);
        texture = null;
    }
    
    // 执行请求回调
    if (!_isShuttingDown && request.Callback != null)
    {
        try
        {
            request.Callback.Invoke(texture);
        }
        catch (Exception ex)
        {
            Debug.LogError($"执行请求回调时出错: {ex.Message}");
        }
    }
    
    if (enableDebugLog && texture != null)
    {
        Debug.Log($"完成 {request.PlaneType} #{request.Index} 纹理创建");
    }
}
```

## 性能优化

### 批量处理

```csharp
// 批量处理相似请求
private IEnumerator ProcessBatchRequests(List<TextureRequest> batch)
{
    // 按平面类型分组
    var groupedRequests = batch.GroupBy(r => r.PlaneType);
    
    foreach (var group in groupedRequests)
    {
        if (_isShuttingDown) break;
        
        // 预缓存体素数据（用于矢状/冠状面）
        if (group.Key != DicomPlane.PlaneType.Axial)
        {
            yield return StartCoroutine(PreparVolumeDataForBatch(group.First()));
        }
        
        // 并发处理组内请求
        var tasks = new List<Coroutine>();
        
        foreach (var request in group.Take(maxConcurrentTasks))
        {
            if (_activeTaskCount < maxConcurrentTasks)
            {
                var task = StartCoroutine(ProcessSingleRequest(request));
                tasks.Add(task);
            }
        }
        
        // 等待批次完成
        yield return new WaitUntil(() => tasks.All(t => t == null) || _isShuttingDown);
    }
}
```

### 内存压力响应

```csharp
private IEnumerator AdaptiveTextureCreation(TextureRequest request)
{
    // 检查内存压力
    if (IsSystemMemoryPressureHigh())
    {
        // 高内存压力时降低质量或跳过非关键请求
        if (!IsCurrentSlice(request.PlaneType, request.Index))
        {
            Debug.Log($"内存压力高，跳过非当前切片: {request.PlaneType} #{request.Index}");
            CompleteRequest(request, null);
            yield break;
        }
    }
    
    // 正常创建流程
    yield return StartCoroutine(CreateTextureAsync(request));
}
```

## 使用建议

### 最佳实践

```csharp
// 1. 合理设置并发数
void ConfigureConcurrency()
{
    int processorCount = SystemInfo.processorCount;
    
    if (processorCount >= 8)
        mprManager.maxConcurrentTasks = 4;
    else if (processorCount >= 4)
        mprManager.maxConcurrentTasks = 2;
    else
        mprManager.maxConcurrentTasks = 1;
}

// 2. 监控性能指标
void MonitorAsyncPerformance()
{
    // 检查任务积压
    int pendingCount = mprManager.GetPendingRequestCount();
    int activeCount = mprManager.GetActiveTaskCount();
    
    if (pendingCount > 20)
    {
        Debug.LogWarning($"请求队列积压: {pendingCount} 个待处理");
    }
    
    if (activeCount == mprManager.maxConcurrentTasks)
    {
        Debug.Log("所有并发槽位都在使用中");
    }
}

// 3. 错误处理
mprManager.OnTextureCreated += (planeType, index) =>
{
    Texture2D texture = mprManager.GetTexture(planeType, index);
    if (texture == null)
    {
        Debug.LogWarning($"纹理创建完成但获取失败: {planeType} #{index}");
        // 实现错误恢复逻辑
    }
};
```

异步纹理创建是MPR系统性能的关键，合理的并发控制和错误处理确保系统在各种条件下都能稳定运行。