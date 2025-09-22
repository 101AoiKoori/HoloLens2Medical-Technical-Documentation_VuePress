---
title: 内存优化实现
---
# 内存优化实现

UI模块的内存优化策略涵盖事件监听器管理、组件引用清理和协程资源释放等多个方面。本节深入分析内存管理的技术实现和优化策略。

## 事件监听器生命周期管理

### 对称绑定和解绑策略

DicomUIController采用严格的对称事件管理模式:

```csharp
public class DicomUIController : MonoBehaviour
{
    private void Start()
    {
        // 统一的事件绑定入口
        ConnectAllEvents();
    }

    private void OnDestroy()
    {
        // 统一的事件解绑入口
        DisconnectAllEvents();
        
        // 清理组件引用
        ClearComponentReferences();
        
        // 停止所有协程
        StopAllCoroutines();
    }

    private void ConnectAllEvents()
    {
        ConnectButtonEvents();
        ConnectSliderEvents();
        ConnectMPRViewerEvents();
    }

    private void DisconnectAllEvents()
    {
        DisconnectButtonEvents();
        DisconnectSliderEvents();
        DisconnectMPRViewerEvents();
    }
}
```

### 精确事件解绑实现

每个事件类型都有对应的精确解绑方法:

```csharp
private void DisconnectButtonEvents()
{
    // MRTK3按钮事件精确解绑
    if (loadButton != null)
    {
        loadButton.OnClicked.RemoveListener(OnLoadButtonClicked);
    }
    
    if (resetButton != null)
    {
        resetButton.OnClicked.RemoveListener(OnResetButtonClicked);
    }

    // Lambda表达式事件使用RemoveAllListeners
    if (togglePlanesButton != null)
    {
        togglePlanesButton.OnClicked.RemoveAllListeners();
    }
    
    if (toggleBoundingButton != null)
    {
        toggleBoundingButton.OnClicked.RemoveAllListeners();
    }
}

private void DisconnectSliderEvents()
{
    // 滑块事件批量清理
    var sliders = new[] { 
        axialSlider, sagittalSlider, coronalSlider,
        windowCenterSlider, windowWidthSlider 
    };

    foreach (var slider in sliders)
    {
        if (slider != null)
        {
            slider.OnValueUpdated.RemoveAllListeners();
        }
    }
}

private void DisconnectMPRViewerEvents()
{
    if (mprViewer != null)
    {
        // C#事件的精确解绑
        mprViewer.OnDicomLoaded -= HandleDicomLoaded;
        mprViewer.OnWindowLevelChanged -= HandleWindowLevelChanged;
        mprViewer.OnSliceChanged -= HandleSliceChanged;
    }
}
```

### 动态事件绑定管理

支持运行时安全地替换事件目标:

```csharp
public void SetMPRViewer(MPRViewer newViewer)
{
    // 安全断开旧连接
    if (mprViewer != null)
    {
        DisconnectMPRViewerEvents();
    }
    
    // 更新引用
    mprViewer = newViewer;
    
    // 建立新连接
    if (mprViewer != null)
    {
        ConnectMPRViewerEvents();
        
        // 同步UI状态
        UpdateAllSliders();
        UpdateStatus("MPRViewer连接已更新");
    }
    else
    {
        // 清理状态
        EnableControls(false);
        UpdateStatus("MPRViewer连接已断开");
    }
}
```

## 组件引用清理策略

### 引用置空机制

确保所有外部组件引用被正确清理:

```csharp
private void ClearComponentReferences()
{
    // 清理UI控件引用
    loadButton = null;
    resetButton = null;
    axialSlider = null;
    sagittalSlider = null;
    coronalSlider = null;
    windowCenterSlider = null;
    windowWidthSlider = null;
    togglePlanesButton = null;
    toggleBoundingButton = null;
    statusText = null;
    
    // 清理外部组件引用
    mprViewer = null;
    slice3DManager = null;
    visibilityController = null;
    
    // 清理UI面板引用
    uiPanel = null;
    uiParent = null;
    
    Debug.Log("UI组件引用已清理");
}
```

### 弱引用模式实现

对于可选的组件引用，实现弱引用模式:

```csharp
private System.WeakReference<DicomSlice3DManager> weakSlice3DManager;
private System.WeakReference<MPRVisibilityController> weakVisibilityController;

private DicomSlice3DManager GetSlice3DManager()
{
    if (weakSlice3DManager != null && weakSlice3DManager.TryGetTarget(out DicomSlice3DManager manager))
    {
        return manager;
    }
    
    // 重新查找组件
    manager = FindObjectOfType<DicomSlice3DManager>();
    if (manager != null)
    {
        weakSlice3DManager = new System.WeakReference<DicomSlice3DManager>(manager);
    }
    
    return manager;
}

private MPRVisibilityController GetVisibilityController()
{
    if (weakVisibilityController != null && weakVisibilityController.TryGetTarget(out MPRVisibilityController controller))
    {
        return controller;
    }
    
    // 重新查找组件
    controller = FindObjectOfType<MPRVisibilityController>();
    if (controller != null)
    {
        weakVisibilityController = new System.WeakReference<MPRVisibilityController>(controller);
    }
    
    return controller;
}
```

## 协程资源管理

### 协程追踪机制

实现协程的完整生命周期管理:

```csharp
private List<Coroutine> activeCoroutines = new List<Coroutine>();

private Coroutine StartTrackedCoroutine(IEnumerator routine, string operationName = "Unknown")
{
    // 检查GameObject状态
    if (!gameObject.activeInHierarchy)
    {
        Debug.LogWarning($"无法启动协程 {operationName}:GameObject未激活");
        return null;
    }
    
    try
    {
        Coroutine coroutine = StartCoroutine(routine);
        activeCoroutines.Add(coroutine);
        
        Debug.Log($"启动协程: {operationName}");
        return coroutine;
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"启动协程 {operationName} 失败: {ex.Message}");
        return null;
    }
}

private void StopTrackedCoroutine(Coroutine coroutine)
{
    if (coroutine != null)
    {
        StopCoroutine(coroutine);
        activeCoroutines.Remove(coroutine);
    }
}

private void StopAllTrackedCoroutines()
{
    foreach (var coroutine in activeCoroutines)
    {
        if (coroutine != null)
        {
            StopCoroutine(coroutine);
        }
    }
    
    activeCoroutines.Clear();
    Debug.Log($"停止了 {activeCoroutines.Count} 个协程");
}
```

### 延迟同步协程管理

对于延迟同步协程的特殊管理:

```csharp
private Coroutine delayedSyncCoroutine;
private const float SYNC_DELAY = 0.1f;

private void ScheduleDelayedSync()
{
    // 取消之前的延迟同步
    if (delayedSyncCoroutine != null)
    {
        StopTrackedCoroutine(delayedSyncCoroutine);
        delayedSyncCoroutine = null;
    }

    // 启动新的延迟同步
    delayedSyncCoroutine = StartTrackedCoroutine(DelayedSyncCoroutine(), "DelayedSync");
}

private IEnumerator DelayedSyncCoroutine()
{
    yield return new WaitForSeconds(SYNC_DELAY);
    
    try
    {
        // 执行同步操作
        if (!isUpdatingUI && mprViewer != null)
        {
            UpdateAllSliders();
        }
    }
    finally
    {
        // 清理协程引用
        delayedSyncCoroutine = null;
    }
}
```

## 缓存管理优化

### UI状态缓存机制

实现UI状态的智能缓存管理:

```csharp
private struct UIStateCache
{
    public bool isValid;
    public float lastUpdateTime;
    public bool controlsEnabled;
    public string statusText;
    public Dictionary<DicomPlane.PlaneType, float> sliderValues;
    public (float center, float width) windowLevel;
}

private UIStateCache stateCache;
private const float CACHE_VALIDITY_PERIOD = 1.0f; // 1秒缓存有效期

private bool IsStateCacheValid()
{
    return stateCache.isValid && 
           (Time.time - stateCache.lastUpdateTime) < CACHE_VALIDITY_PERIOD;
}

private void UpdateStateCache()
{
    stateCache.isValid = true;
    stateCache.lastUpdateTime = Time.time;
    stateCache.controlsEnabled = AreControlsEnabled();
    stateCache.statusText = statusText?.text ?? "";
    
    // 缓存滑块值
    if (stateCache.sliderValues == null)
    {
        stateCache.sliderValues = new Dictionary<DicomPlane.PlaneType, float>();
    }
    
    stateCache.sliderValues.Clear();
    if (axialSlider != null) stateCache.sliderValues[DicomPlane.PlaneType.Axial] = axialSlider.Value;
    if (sagittalSlider != null) stateCache.sliderValues[DicomPlane.PlaneType.Sagittal] = sagittalSlider.Value;
    if (coronalSlider != null) stateCache.sliderValues[DicomPlane.PlaneType.Coronal] = coronalSlider.Value;
    
    // 缓存窗宽窗位
    if (mprViewer != null)
    {
        stateCache.windowLevel = (mprViewer.GetWindowCenter(), mprViewer.GetWindowWidth());
    }
}

private void InvalidateStateCache()
{
    stateCache.isValid = false;
}
```

### 查找结果缓存

优化UI元素查找的性能:

```csharp
private Dictionary<string, Component> componentCache = new Dictionary<string, Component>();
private const int MAX_CACHE_SIZE = 50;

private T GetCachedComponent<T>(string nameHint) where T : Component
{
    string cacheKey = $"{typeof(T).Name}_{nameHint}";
    
    if (componentCache.TryGetValue(cacheKey, out Component cached) && cached != null)
    {
        return cached as T;
    }
    
    // 执行查找
    T component = FindComponentInHierarchy<T>(transform, nameHint);
    if (component != null)
    {
        // 限制缓存大小
        if (componentCache.Count >= MAX_CACHE_SIZE)
        {
            componentCache.Clear();
        }
        
        componentCache[cacheKey] = component;
    }
    
    return component;
}

private void ClearComponentCache()
{
    componentCache.Clear();
}
```

## 内存压力监控

### 内存使用监控

实现内存使用情况的监控和报告:

```csharp
private void MonitorMemoryUsage()
{
    if (!enableMemoryMonitoring) return;
    
    // 获取当前内存使用情况
    long totalMemory = System.GC.GetTotalMemory(false);
    float totalMemoryMB = totalMemory / (1024f * 1024f);
    
    // Unity特定的内存信息
    long unityTotalReserved = UnityEngine.Profiling.Profiler.GetTotalReservedMemory(null);
    long unityTotalAllocated = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemory(null);
    
    float reservedMB = unityTotalReserved / (1024f * 1024f);
    float allocatedMB = unityTotalAllocated / (1024f * 1024f);
    
    // 检查内存压力
    if (totalMemoryMB > memoryWarningThreshold)
    {
        Debug.LogWarning($"UI模块内存使用警告: {totalMemoryMB:F2}MB " +
                        $"(Unity预留: {reservedMB:F2}MB, 已分配: {allocatedMB:F2}MB)");
        
        // 触发内存清理
        TriggerMemoryCleanup();
    }
}

private void TriggerMemoryCleanup()
{
    Debug.Log("触发UI模块内存清理");
    
    // 清理缓存
    ClearComponentCache();
    InvalidateStateCache();
    
    // 强制垃圾回收
    System.GC.Collect();
    System.GC.WaitForPendingFinalizers();
    System.GC.Collect();
    
    // 清理Unity资源
    Resources.UnloadUnusedAssets();
}
```

### 自动内存管理

实现自动的内存管理策略:

```csharp
private float lastMemoryCheckTime = 0;
private const float MEMORY_CHECK_INTERVAL = 30f; // 30秒检查一次
private const float MEMORY_WARNING_THRESHOLD = 500f; // 500MB警告阈值

private void Update()
{
    // 定期检查内存使用情况
    if (Time.time - lastMemoryCheckTime > MEMORY_CHECK_INTERVAL)
    {
        MonitorMemoryUsage();
        lastMemoryCheckTime = Time.time;
    }
}

private void OnApplicationPause(bool pauseStatus)
{
    if (pauseStatus)
    {
        // 应用暂停时清理非必要资源
        Debug.Log("应用暂停，清理UI资源");
        TriggerMemoryCleanup();
    }
}

private void OnApplicationFocus(bool hasFocus)
{
    if (!hasFocus)
    {
        // 失去焦点时的轻量级清理
        InvalidateStateCache();
    }
}
```

## 资源释放验证

### 析构验证机制

实现资源释放的验证机制:

```csharp
~DicomUIController()
{
    // 析构函数中的资源泄漏检查
    if (activeCoroutines.Count > 0)
    {
        Debug.LogWarning($"UI控制器析构时仍有 {activeCoroutines.Count} 个协程未清理");
    }
    
    if (componentCache.Count > 0)
    {
        Debug.LogWarning($"UI控制器析构时组件缓存未清理，大小: {componentCache.Count}");
    }
}

#if UNITY_EDITOR
private void OnValidate()
{
    // 编辑器中验证内存管理设置
    if (enableMemoryMonitoring && memoryWarningThreshold <= 0)
    {
        memoryWarningThreshold = 500f; // 设置默认值
        Debug.LogWarning("内存警告阈值已设置为默认值500MB");
    }
}
#endif
```
1. 我需要你按照文档重组提示.yaml的要求visualization3d部分的开发文档.
2. 重写implementation文件夹下的所有md文档，检查原理解释explanations文件夹下的文档描述与visualization3d模块的cs文件是否有描述错误的地方。 各个文档文件名请以数字开头，英文书写文件名。内容使用中文书写，要求符合vuepress的语法.
3. visualization3d属于MedicalMR.DICOM.visualization3d。每个文档请分开书写.