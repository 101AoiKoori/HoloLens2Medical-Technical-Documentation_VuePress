---
title: 管理器协调机制实现
---
# 管理器协调机制实现

## DicomSlice3DManager协调架构

DicomSlice3DManager作为3D切片系统的核心管理器，采用了复杂的组件协调机制来管理三个正交平面的生命周期。

### 组件初始化序列

**第一阶段:延迟初始化策略**
```csharp
private void StartInitializationProcess()
{
    isInitializing = true;
    StopAllActiveCoroutines();
    SafeStartCoroutine(DelayedStartCoroutine(), "延迟初始化");
}

private IEnumerator DelayedStartCoroutine()
{
    yield return new WaitForSeconds(initializationDelay);
    
    if (!CanStartCoroutine())
    {
        isInitializing = false;
        yield break;
    }
    
    Initialize();
    isInitializing = false;
}
```

延迟初始化确保其他组件（如DicomSeriesLoader、MPRViewer）有足够时间完成自身初始化，避免依赖关系冲突。

**第二阶段:依赖查找与连接**
```csharp
private void FindAndConnectToLoader()
{
    if (seriesLoader == null)
    {
        seriesLoader = FindObjectOfType<DicomSeriesLoader>();
    }
    
    if (seriesLoader != null && !hasRegisteredToLoader)
    {
        seriesLoader.OnLoadingComplete.AddListener(HandleDicomLoadingComplete);
        hasRegisteredToLoader = true;
    }
}
```

系统通过自动查找机制建立与DicomSeriesLoader和MPRViewer的连接，支持运行时动态绑定。

### 平面控制器创建流程

**容器创建机制**:
```csharp
private void CreatePlaneContainers()
{
    if (axialPlaneContainer == null && autoCreatePlanes)
    {
        axialPlaneContainer = new GameObject("AxialPlaneContainer");
        axialPlaneContainer.transform.SetParent(planesParent);
        axialPlaneContainer.transform.localPosition = Vector3.zero;
    }
    // 矢状面和冠状面类似处理
}
```

**控制器配置策略**:
```csharp
private void SetupPlaneController(DicomPlaneController controller, DicomPlane.PlaneType type)
{
    controller.planeType = type;
    controller.dicomSeries = dicomSeries;
    controller.mprViewer = mprViewer;
    controller.dicomSliceShader = dicomSliceShader;
    controller.planeOpacity = planeOpacity;
    controller.planeSize = planeSize;
    controller.movementRange = planeMovementRange;
    
    // 事件绑定
    controller.OnSliceIndexChanged += HandleSliceIndexChanged;
    controller.Initialize();
    controller.SetDicomDataReady(false); // 初始时标记数据未就绪
}
```

## 协程安全管理实现

### 安全启动机制

```csharp
private bool CanStartCoroutine()
{
    bool canStart = gameObject.activeInHierarchy && enabled;
    
    if (!canStart && enableDebugLog)
    {
        Debug.LogWarning($"GameObject '{gameObject.name}' 不能启动协程: " +
            $"activeInHierarchy={gameObject.activeInHierarchy}, enabled={enabled}");
    }
    
    return canStart;
}

private Coroutine SafeStartCoroutine(IEnumerator routine, string operationName)
{
    if (!CanStartCoroutine())
    {
        if (enableDebugLog)
            Debug.LogWarning($"跳过{operationName}，GameObject未激活");
        return null;
    }
    
    try
    {
        Coroutine coroutine = StartCoroutine(routine);
        activeCoroutines.Add(coroutine);
        return coroutine;
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"启动{operationName}协程时出错: {ex.Message}");
        return null;
    }
}
```

### 协程生命周期追踪

**活动协程管理**:
```csharp
private List<Coroutine> activeCoroutines = new List<Coroutine>();

private void StopAllActiveCoroutines()
{
    foreach (var coroutine in activeCoroutines)
    {
        if (coroutine != null)
        {
            try
            {
                StopCoroutine(coroutine);
            }
            catch (System.Exception)
            {
                // 忽略已完成的协程异常
            }
        }
    }
    activeCoroutines.Clear();
}
```

这确保了在组件禁用或GameObject销毁时能正确清理所有运行中的协程，避免内存泄漏。

## 数据就绪状态管理

### 多条件检查机制

```csharp
private bool IsAllReady()
{
    bool seriesReady = dicomSeries != null && 
                      dicomSeries.Slices != null && 
                      dicomSeries.Slices.Count > 0;
    
    // 如果未使用MPRViewer，则认为查看器条件已满足
    bool viewerReady = (mprViewer == null) || 
                      (mprViewer.GetTextureManager() != null);
    
    return seriesReady && viewerReady;
}
```

**等待策略实现**:
```csharp
private IEnumerator WaitUntilReadyThenSetupPlanes()
{
    float timeout = 5f;
    float elapsed = 0f;
    
    while (!IsAllReady() && elapsed < timeout)
    {
        elapsed += 0.1f;
        yield return new WaitForSeconds(0.1f);
    }
    
    if (IsAllReady())
    {
        dicomDataReady = true;
        SetupPlanesWhenDataReady();
    }
    else
    {
        // 超时后的降级处理
        if (dicomSeries != null && dicomSeries.Slices != null && dicomSeries.Slices.Count > 0)
        {
            dicomDataReady = true;
            SetupPlanesWhenDataReady();
            Debug.LogWarning("等待资源超时，但DICOM数据已准备好，尝试仅使用DICOM数据初始化");
        }
    }
}
```

### 安全的平面控制器调用

```csharp
private bool SafeCallPlaneController(DicomPlaneController controller, 
                                    System.Action<DicomPlaneController> action, 
                                    string operationName)
{
    if (controller == null)
    {
        if (enableDebugLog)
            Debug.LogWarning($"平面控制器为空，无法执行{operationName}");
        return false;
    }
    
    if (!controller.gameObject.activeInHierarchy)
    {
        if (enableDebugLog)
            Debug.LogWarning($"平面控制器GameObject未激活，跳过{operationName}");
        return false;
    }
    
    if (!controller.enabled)
    {
        if (enableDebugLog)
            Debug.LogWarning($"平面控制器组件未启用，跳过{operationName}");
        return false;
    }
    
    try
    {
        action?.Invoke(controller);
        return true;
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"执行平面控制器{operationName}时出错: {ex.Message}");
        return false;
    }
}
```

## 事件处理与状态同步

### 双向索引同步

```csharp
private void HandleSliceIndexChanged(DicomPlane.PlaneType planeType, int index)
{
    // 触发外部事件
    OnSliceChanged?.Invoke(planeType, index);
    
    // 同步到MPRViewer
    if (mprViewer != null)
    {
        try
        {
            int mprIndex = mprViewer.GetSliceIndex(planeType);
            
            if (mprIndex != index)
            {
                mprViewer.SetSliceIndex(planeType, index);
            }
        }
        catch (System.Exception ex)
        {
            if (enableDebugLog)
                Debug.LogWarning($"同步切片索引到MPRViewer失败: {ex.Message}");
        }
    }
}
```

### MPRViewer纹理准备检查

```csharp
private bool WaitForMPRViewerTextures()
{
    if (mprViewer == null) return false;
    
    bool axialReady = IsTextureReady(mprViewer, "axialImage");
    bool sagittalReady = IsTextureReady(mprViewer, "sagittalImage");
    bool coronalReady = IsTextureReady(mprViewer, "coronalImage");
    
    return axialReady && sagittalReady && coronalReady;
}

private bool IsTextureReady(MPRViewer viewer, string fieldName)
{
    try
    {
        System.Type viewerType = viewer.GetType();
        System.Reflection.FieldInfo field = viewerType.GetField(fieldName,
            System.Reflection.BindingFlags.Instance |
            System.Reflection.BindingFlags.NonPublic);
        
        if (field != null)
        {
            UnityEngine.UI.RawImage rawImage = field.GetValue(viewer) as UnityEngine.UI.RawImage;
            return rawImage != null && rawImage.texture != null;
        }
    }
    catch (System.Exception ex)
    {
        if (enableDebugLog)
            Debug.LogWarning($"检查纹理状态时出错: {ex.Message}");
    }
    
    return false;
}
```

## 自动重连机制

### Update中的状态检查

```csharp
void Update()
{
    // 检查是否需要查找或连接到加载器
    if (!hasRegisteredToLoader && autoReconnect)
    {
        FindAndConnectToLoader();
    }
    
    // 检查DICOM数据是否刚刚准备好（用于处理非标准初始化路径）
    if (!dicomDataReady && dicomSeries != null && 
        dicomSeries.Slices != null && dicomSeries.Slices.Count > 0)
    {
        dicomDataReady = true;
        SetupPlanesWhenDataReady();
        
        if (enableDebugLog)
            Debug.Log("DICOM数据现已准备好，初始化切片平面");
    }
}
```

这种轮询机制确保了即使在复杂的初始化序列中，管理器也能检测到数据状态变化并做出响应。