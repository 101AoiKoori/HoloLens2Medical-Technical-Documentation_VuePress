---
title: 纹理请求管理
---
# 纹理请求管理

本页详细介绍MPRTextureManager如何管理纹理请求，包括请求队列、优先级计算和异步处理机制。

## 获取纹理接口

`GetTexture()` 是获取纹理的主要接口，支持缓存查询和异步生成:

```csharp
MPRTextureManager mprManager = GetComponent<MPRTextureManager>();

// 获取轴向纹理
Texture2D axialTexture = mprManager.GetTexture(DicomPlane.PlaneType.Axial, 25);

if (axialTexture != null)
{
    // 缓存命中，直接使用
    axialImage.texture = axialTexture;
}
else
{
    // 缓存未命中，已加入异步生成队列
    // 通过OnTextureCreated事件接收结果
}
```

### 获取流程详解

`GetTexture()` 方法的执行步骤:

1. **状态和索引验证**:
   ```csharp
   if (_dicomSeries == null || _isShuttingDown) return null;
   
   if (!IsValidIndex(planeType, index))
   {
       Debug.LogWarning($"索引 {index} 超出 {planeType} 平面的有效范围");
       return null;
   }
   ```

2. **缓存查询**:
   ```csharp
   string cacheKey = GenerateCacheKey(planeType, index, _currentWindowCenter, _currentWindowWidth);
   Texture2D cachedTexture = _textureCache?.GetTextureFromCache(planeType, cacheKey);
   
   if (cachedTexture != null)
   {
       return cachedTexture; // 缓存命中
   }
   ```

3. **当前切片同步生成**:
   ```csharp
   bool isCurrentSlice = IsCurrentSlice(planeType, index);
   if (isCurrentSlice)
   {
       // 当前显示的切片优先同步生成
       Texture2D texture = CreateTextureSync(planeType, index);
       if (texture != null)
       {
           OnTextureCreated?.Invoke(planeType, index);
           return texture;
       }
   }
   ```

4. **异步请求排队**:
   ```csharp
   float priority = isCurrentSlice ? 1.0f : CalculatePriority(planeType, index);
   RequestTexture(planeType, index, priority);
   return null; // 异步生成中
   ```

## 请求队列机制

### 请求结构

内部使用 `TextureRequest` 类管理请求信息:

```csharp
private class TextureRequest
{
    public DicomPlane.PlaneType PlaneType;  // 平面类型
    public int Index;                       // 切片索引
    public float Priority;                  // 优先级(0-1)
    public float WindowCenter;              // 窗位
    public float WindowWidth;               // 窗宽
    public string CacheKey;                 // 缓存键
    public Action<Texture2D> Callback;      // 完成回调
    public float RequestTime;               // 请求时间
}
```

### 添加请求

`RequestTexture()` 方法将请求加入队列:

```csharp
private void RequestTexture(DicomPlane.PlaneType planeType, int index, float priority)
{
    string cacheKey = GenerateCacheKey(planeType, index, _currentWindowCenter, _currentWindowWidth);
    
    lock (_requestQueue)
    {
        // 避免重复请求
        if (_pendingRequests.Contains(cacheKey))
        {
            return;
        }
        
        // 创建新请求
        var newRequest = new TextureRequest(planeType, index, priority,
                                          _currentWindowCenter, _currentWindowWidth, cacheKey);
        
        _requestQueue.Enqueue(newRequest);
        _pendingRequests.Add(cacheKey);
        
        // 启动队列处理协程
        if (!_isProcessingQueue && !_isShuttingDown)
        {
            _isProcessingQueue = true;
            var coroutine = StartCoroutine(ProcessQueueCoroutine());
            _activeCoroutines.Add(coroutine);
        }
    }
}
```

## 优先级计算

`CalculatePriority()` 根据与当前切片的距离计算优先级:

```csharp
private float CalculatePriority(DicomPlane.PlaneType planeType, int index)
{
    float priority = 0.5f; // 默认优先级
    
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            if (_currentAxialIndex >= 0)
            {
                int distance = Mathf.Abs(index - _currentAxialIndex);
                if (distance < 5)
                    priority = 0.8f;      // 高优先级:邻近切片
                else if (distance < 10)
                    priority = 0.6f;      // 中优先级:附近切片
                else
                    priority = 0.4f;      // 低优先级:远距离切片
            }
            break;
            
        case DicomPlane.PlaneType.Sagittal:
            if (_currentSagittalIndex >= 0)
            {
                int distance = Mathf.Abs(index - _currentSagittalIndex);
                if (distance < 3)
                    priority = 0.7f;
                else if (distance < 6)
                    priority = 0.5f;
                else
                    priority = 0.3f;
            }
            break;
            
        case DicomPlane.PlaneType.Coronal:
            if (_currentCoronalIndex >= 0)
            {
                int distance = Mathf.Abs(index - _currentCoronalIndex);
                if (distance < 3)
                    priority = 0.7f;
                else if (distance < 6)
                    priority = 0.5f;
                else
                    priority = 0.3f;
            }
            break;
    }
    
    return priority;
}
```

### 优先级策略

- **轴向切片**:距离阈值较大（5/10），因为切换频繁
- **矢状/冠状**:距离阈值较小（3/6），重建成本更高
- **当前切片**:始终最高优先级（1.0）
- **邻近切片**:高优先级，便于快速浏览

## 队列处理协程

`ProcessQueueCoroutine()` 持续处理请求队列:

```csharp
private IEnumerator ProcessQueueCoroutine()
{
    while (!_isShuttingDown)
    {
        TextureRequest request = null;
        
        lock (_requestQueue)
        {
            // 队列为空或任务数达上限
            if (_requestQueue.Count == 0)
            {
                _isProcessingQueue = false;
                yield break;
            }
            
            if (_activeTaskCount >= maxConcurrentTasks)
            {
                yield return new WaitForSeconds(0.05f);
                continue;
            }
            
            // 按优先级排序队列
            var requestList = _requestQueue.ToList();
            requestList.Sort((a, b) => b.Priority.CompareTo(a.Priority));
            
            // 移除超时请求（30秒，非当前切片）
            CleanupExpiredRequests(requestList);
            
            // 获取最高优先级请求
            if (requestList.Count > 0)
            {
                request = requestList[0];
                _requestQueue = new Queue<TextureRequest>(requestList.Skip(1));
            }
        }
        
        if (request != null)
        {
            // 异步处理请求
            yield return StartCoroutine(ProcessSingleRequest(request));
        }
        
        yield return null;
    }
}
```

### 超时清理

```csharp
private void CleanupExpiredRequests(List<TextureRequest> requestList)
{
    float currentTime = Time.realtimeSinceStartup;
    
    for (int i = requestList.Count - 1; i >= 0; i--)
    {
        var req = requestList[i];
        bool isExpired = (currentTime - req.RequestTime) > 30.0f;
        bool isCurrentSlice = IsCurrentSlice(req.PlaneType, req.Index);
        
        if (isExpired && !isCurrentSlice)
        {
            // 移除超时的非当前切片请求
            requestList.RemoveAt(i);
            _pendingRequests.Remove(req.CacheKey);
            
            if (enableDebugLog)
            {
                Debug.Log($"移除超时请求: {req.PlaneType} #{req.Index}");
            }
        }
    }
}
```

## 请求处理

### 单个请求处理

```csharp
private IEnumerator ProcessSingleRequest(TextureRequest request)
{
    _activeTaskCount++;
    
    try
    {
        // 再次检查缓存（可能在等待期间已生成）
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
        _activeTaskCount--;
    }
}
```

### 异步纹理创建

```csharp
private IEnumerator CreateTextureAsync(TextureRequest request)
{
    Texture2D texture = null;
    
    switch (request.PlaneType)
    {
        case DicomPlane.PlaneType.Axial:
            // 轴向切片可以同步快速生成
            texture = CreateAxialTextureSafe(request.Index, request.WindowCenter, request.WindowWidth);
            yield return null;
            break;
            
        case DicomPlane.PlaneType.Sagittal:
            // 矢状面需要异步生成
            yield return StartCoroutine(CreateSagittalTextureAsync(request));
            break;
            
        case DicomPlane.PlaneType.Coronal:
            // 冠状面需要异步生成
            yield return StartCoroutine(CreateCoronalTextureAsync(request));
            break;
    }
    
    if (texture != null && !_isShuttingDown)
    {
        // 添加到缓存
        _textureCache?.AddTextureToCache(request.PlaneType, request.CacheKey, texture);
        
        // 触发事件
        OnTextureCreated?.Invoke(request.PlaneType, request.Index);
    }
    
    CompleteRequest(request, texture);
}
```

## 请求管理接口

### 设置当前索引

```csharp
public void SetCurrentIndices(int axialIndex, int sagittalIndex, int coronalIndex)
{
    _currentAxialIndex = axialIndex;
    _currentSagittalIndex = sagittalIndex;
    _currentCoronalIndex = coronalIndex;
    
    // 更新队列中所有请求的优先级
    UpdateRequestPriorities();
}
```

### 添加高优先级请求

```csharp
private void AddHighPriorityRequests()
{
    if (_dicomSeries == null) return;
    
    // 当前轴向切片
    if (_currentAxialIndex >= 0)
    {
        RequestTexture(DicomPlane.PlaneType.Axial, _currentAxialIndex, 1.0f);
    }
    
    // 当前矢状切片
    if (_currentSagittalIndex >= 0)
    {
        RequestTexture(DicomPlane.PlaneType.Sagittal, _currentSagittalIndex, 0.9f);
    }
    
    // 当前冠状切片
    if (_currentCoronalIndex >= 0)
    {
        RequestTexture(DicomPlane.PlaneType.Coronal, _currentCoronalIndex, 0.9f);
    }
}
```

### 取消所有请求

```csharp
public void CancelAllRequests()
{
    lock (_requestQueue)
    {
        _requestQueue.Clear();
        _pendingRequests.Clear();
    }
    
    if (enableDebugLog)
    {
        Debug.Log("已取消所有待处理的纹理请求");
    }
}
```

## 状态查询

### 检查加载状态

```csharp
public bool IsSliceLoading(DicomPlane.PlaneType planeType, int index)
{
    if (_isShuttingDown) return false;
    
    string cacheKey = GenerateCacheKey(planeType, index, _currentWindowCenter, _currentWindowWidth);
    
    lock (_requestQueue)
    {
        return _pendingRequests.Contains(cacheKey);
    }
}
```

### 获取缓存统计

```csharp
public int GetCachedTextureCount(DicomPlane.PlaneType planeType)
{
    return _textureCache?.GetCacheCount(planeType) ?? 0;
}

public int GetPendingRequestCount()
{
    lock (_requestQueue)
    {
        return _requestQueue.Count;
    }
}

public int GetActiveTaskCount()
{
    return _activeTaskCount;
}
```

## 事件通知

### 纹理创建完成事件

```csharp
public delegate void TextureCreatedEventHandler(DicomPlane.PlaneType planeType, int index);
public event TextureCreatedEventHandler OnTextureCreated;

// 订阅事件
mprManager.OnTextureCreated += (planeType, index) =>
{
    // 重新获取纹理并更新UI
    Texture2D texture = mprManager.GetTexture(planeType, index);
    if (texture != null)
    {
        UpdatePlaneTexture(planeType, texture);
    }
};
```

## 使用建议

### 最佳实践

```csharp
// 1. 设置当前索引以获得正确的优先级
mprManager.SetCurrentIndices(axialIndex, sagittalIndex, coronalIndex);

// 2. 获取纹理时检查返回值
Texture2D texture = mprManager.GetTexture(DicomPlane.PlaneType.Axial, index);
if (texture != null)
{
    // 立即可用
    UpdateUI(texture);
}
else
{
    // 异步生成中，通过事件接收
    ShowLoadingIndicator(true);
}

// 3. 合理使用事件避免UI闪烁
mprManager.OnTextureCreated += (planeType, index) =>
{
    if (planeType == currentPlaneType && index == currentIndex)
    {
        ShowLoadingIndicator(false);
        Texture2D newTexture = mprManager.GetTexture(planeType, index);
        UpdateUI(newTexture);
    }
};
```

### 性能优化

```csharp
// 预加载邻近切片
public void PreloadAdjacentSlices(int currentIndex, int range = 3)
{
    for (int i = -range; i <= range; i++)
    {
        int targetIndex = currentIndex + i;
        if (targetIndex >= 0 && targetIndex < maxSliceCount)
        {
            mprManager.GetTexture(DicomPlane.PlaneType.Axial, targetIndex);
        }
    }
}
```

纹理请求管理是MPR系统的核心，合理的优先级策略和异步处理确保了流畅的用户体验。