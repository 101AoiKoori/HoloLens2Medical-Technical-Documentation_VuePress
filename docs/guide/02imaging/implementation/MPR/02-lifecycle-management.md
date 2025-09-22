---
title: 生命周期管理
---
# 生命周期管理

本页详细介绍MPRTextureManager的生命周期管理，包括初始化、运行时监控和资源清理。

## 生命周期概述

MPRTextureManager作为MonoBehaviour，遵循Unity的标准生命周期:

```csharp
Awake() → OnEnable() → Start() → Update() → OnDisable() → OnDestroy()
```

每个阶段都有特定的职责和处理逻辑。

## 初始化阶段

### Awake初始化

`Awake()` 方法在对象创建时调用，执行基础初始化:

```csharp
private void Awake()
{
    Initialize();
}

public void Initialize()
{
    // 初始化纹理缓存
    if (_textureCache == null)
    {
        _textureCache = new DicomTextureCache(enableDebugLog);
        _textureCache.SetCacheSize(maxAxialTextureCount, maxSagittalTextureCount, maxCoronalTextureCount);
    }
    
    // 初始化时间戳
    _lastMemoryCheckTime = Time.realtimeSinceStartup;
    _lastResourceReleaseTime = Time.realtimeSinceStartup;
    
    if (enableDebugLog)
    {
        Debug.Log($"[MPRTextureManager] 初始化完成 - 缓存大小: A{maxAxialTextureCount}/S{maxSagittalTextureCount}/C{maxCoronalTextureCount}");
    }
}
```

### 初始化配置

初始化期间设置的关键参数:

```csharp
[Header("纹理缓存设置")]
[SerializeField] private int maxAxialTextureCount = 128;
[SerializeField] private int maxSagittalTextureCount = 32;
[SerializeField] private int maxCoronalTextureCount = 32;

[Header("性能优化")]
[SerializeField] private int maxConcurrentTasks = 2;
[SerializeField] private bool enableDebugLog = false;

[Header("内存监控")]
[SerializeField] private bool enableMemoryMonitoring = true;
[SerializeField] private float memoryMonitorInterval = 5.0f;
[SerializeField] private float resourceReleaseInterval = 30.0f;
```

## 启用和禁用

### OnEnable处理

```csharp
private void OnEnable()
{
    _isShuttingDown = false;
    
    if (enableDebugLog)
    {
        Debug.Log("[MPRTextureManager] 组件已启用");
    }
}
```

组件启用时重置关闭标志，允许正常处理请求。

### OnDisable处理

```csharp
private void OnDisable()
{
    _isShuttingDown = true;
    
    // 停止所有协程
    StopAllCoroutines();
    ClearActiveCoroutines();
    
    if (enableDebugLog)
    {
        Debug.Log("[MPRTextureManager] 组件已禁用，停止所有处理");
    }
}
```

组件禁用时立即停止所有异步操作，防止在无效状态下继续执行。

## 运行时监控

### Update循环

`Update()` 方法执行定期监控任务:

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

### 内存压力检测

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

### 资源释放

```csharp
private void ReleaseUnusedResources()
{
    if (_isShuttingDown) return;
    
    // 清理已完成的协程引用
    CleanupCompletedCoroutines();
    
    // 异步卸载未使用的资源
    Resources.UnloadUnusedAssets();
    
    // 触发垃圾回收
    System.GC.Collect();
    
    if (enableDebugLog)
        Debug.Log("[MPRTextureManager] 资源释放完成");
}
```

## DICOM序列管理

### 设置新序列

`SetDicomSeries()` 方法处理序列切换:

```csharp
public void SetDicomSeries(DicomSeries series)
{
    // 清理旧序列的资源
    if (_dicomSeries != null && _dicomSeries != series)
    {
        ClearAllTextures();
    }
    
    _dicomSeries = series;
    
    if (series != null)
    {
        // 使用新序列的默认窗宽窗位
        _currentWindowCenter = series.DefaultWindowCenter;
        _currentWindowWidth = series.DefaultWindowWidth;
        
        // 重置索引
        _currentAxialIndex = -1;
        _currentSagittalIndex = -1;
        _currentCoronalIndex = -1;
        
        // 更新缓存的窗宽窗位键
        if (_textureCache != null)
        {
            _textureCache.SetCurrentWindowLevelKey(_currentWindowCenter, _currentWindowWidth);
        }
        
        if (enableDebugLog)
        {
            Debug.Log($"[MPRTextureManager] 设置新序列 - 切片数: {series.Slices.Count}, " +
                     $"窗宽窗位: {_currentWindowCenter}/{_currentWindowWidth}");
        }
    }
}
```

### 序列切换流程

```csharp
// 典型的序列切换使用模式
public void SwitchToNewSeries(DicomSeries newSeries)
{
    // 1. 停止当前处理
    CancelAllRequests();
    
    // 2. 设置新序列
    mprManager.SetDicomSeries(newSeries);
    
    // 3. 设置初始索引
    int initialAxial = newSeries.Slices.Count / 2;
    int initialSagittal = newSeries.Dimensions.x / 2;
    int initialCoronal = newSeries.Dimensions.y / 2;
    
    mprManager.SetCurrentIndices(initialAxial, initialSagittal, initialCoronal);
    
    // 4. 请求初始纹理
    RequestInitialTextures();
}
```

## 协程管理

### 活跃协程跟踪

```csharp
private List<Coroutine> _activeCoroutines = new List<Coroutine>();

// 启动协程时添加到列表
private Coroutine StartManagedCoroutine(IEnumerator routine)
{
    Coroutine coroutine = StartCoroutine(routine);
    _activeCoroutines.Add(coroutine);
    return coroutine;
}

// 清理活跃协程
private void ClearActiveCoroutines()
{
    foreach (var coroutine in _activeCoroutines)
    {
        if (coroutine != null)
        {
            StopCoroutine(coroutine);
        }
    }
    _activeCoroutines.Clear();
    _activeTaskCount = 0;
}
```

### 协程清理

```csharp
private void CleanupCompletedCoroutines()
{
    // 移除空引用（已完成的协程）
    _activeCoroutines.RemoveAll(c => c == null);
}
```

## 完整清理

### OnDestroy处理

```csharp
private void OnDestroy()
{
    CleanupResources();
}

private void CleanupResources()
{
    _isShuttingDown = true;
    
    // 停止所有协程
    StopAllCoroutines();
    ClearActiveCoroutines();
    
    // 清空请求队列
    ClearRequestQueue();
    
    // 清理纹理缓存
    if (_textureCache != null)
    {
        _textureCache.Dispose();
        _textureCache = null;
    }
    
    // 清除DICOM序列引用
    _dicomSeries = null;
    
    // 清除事件订阅
    ClearEventSubscriptions();
    
    // 强制资源回收
    Resources.UnloadUnusedAssets();
    System.GC.Collect();
    
    if (enableDebugLog)
    {
        Debug.Log("[MPRTextureManager] 资源清理完成");
    }
}
```

### 事件清理

```csharp
private void ClearEventSubscriptions()
{
    if (OnTextureCreated != null)
    {
        // 移除所有事件订阅
        foreach (var handler in OnTextureCreated.GetInvocationList())
        {
            OnTextureCreated -= (TextureCreatedEventHandler)handler;
        }
    }
}
```

## 状态管理

### 关闭状态检查

```csharp
private bool _isShuttingDown = false;

// 在关键操作前检查状态
private bool ShouldContinueProcessing()
{
    return !_isShuttingDown && this != null && gameObject.activeInHierarchy;
}
```

### 队列处理状态

```csharp
private bool _isProcessingQueue = false;

// 确保只有一个队列处理协程运行
private void EnsureQueueProcessing()
{
    if (!_isProcessingQueue && !_isShuttingDown && _requestQueue.Count > 0)
    {
        _isProcessingQueue = true;
        var coroutine = StartCoroutine(ProcessQueueCoroutine());
        _activeCoroutines.Add(coroutine);
    }
}
```

## 错误恢复

### 异常处理

```csharp
public void HandleCriticalError(Exception ex)
{
    Debug.LogError($"[MPRTextureManager] 发生严重错误: {ex.Message}");
    
    try
    {
        // 停止所有处理
        _isShuttingDown = true;
        StopAllCoroutines();
        
        // 清理状态
        ClearRequestQueue();
        _activeTaskCount = 0;
        
        // 尝试释放资源
        if (_textureCache != null)
        {
            _textureCache.ClearAllCaches();
        }
        
        Resources.UnloadUnusedAssets();
        System.GC.Collect();
    }
    catch (Exception cleanupEx)
    {
        Debug.LogError($"[MPRTextureManager] 清理时发生额外错误: {cleanupEx.Message}");
    }
    finally
    {
        // 标记需要重新初始化
        _isShuttingDown = false;
    }
}
```

### 重新初始化

```csharp
public void Reinitialize()
{
    if (enableDebugLog)
    {
        Debug.Log("[MPRTextureManager] 开始重新初始化");
    }
    
    try
    {
        // 确保清理完成
        CleanupResources();
        
        // 等待一帧
        StartCoroutine(DelayedReinitialize());
    }
    catch (Exception ex)
    {
        Debug.LogError($"[MPRTextureManager] 重新初始化失败: {ex.Message}");
    }
}

private IEnumerator DelayedReinitialize()
{
    yield return null;
    
    // 重新初始化
    Initialize();
    
    if (enableDebugLog)
    {
        Debug.Log("[MPRTextureManager] 重新初始化完成");
    }
}
```

## 调试和监控

### 状态报告

```csharp
public void LogCurrentStatus()
{
    if (!enableDebugLog) return;
    
    string status = $"[MPRTextureManager] 当前状态:\n" +
                   $"  序列: {(_dicomSeries != null ? $"{_dicomSeries.Slices.Count}切片" : "无")}\n" +
                   $"  当前索引: A{_currentAxialIndex}/S{_currentSagittalIndex}/C{_currentCoronalIndex}\n" +
                   $"  窗宽窗位: {_currentWindowCenter}/{_currentWindowWidth}\n" +
                   $"  队列处理: {(_isProcessingQueue ? "运行中" : "停止")}\n" +
                   $"  待处理请求: {_requestQueue.Count}\n" +
                   $"  活跃任务: {_activeTaskCount}/{maxConcurrentTasks}\n" +
                   $"  活跃协程: {_activeCoroutines.Count}\n" +
                   $"  关闭状态: {_isShuttingDown}";
                   
    if (_textureCache != null)
    {
        status += $"\n  缓存统计: A{_textureCache.GetCacheCount(DicomPlane.PlaneType.Axial)}" +
                 $"/S{_textureCache.GetCacheCount(DicomPlane.PlaneType.Sagittal)}" +
                 $"/C{_textureCache.GetCacheCount(DicomPlane.PlaneType.Coronal)}";
    }
    
    Debug.Log(status);
}
```

### 性能指标收集

```csharp
// 性能统计字段
private int _totalTexturesCreated = 0;
private float _totalProcessingTime = 0f;
private int _cacheHits = 0;
private int _cacheMisses = 0;

public void RecordTextureCreation(float processingTime)
{
    _totalTexturesCreated++;
    _totalProcessingTime += processingTime;
}

public void RecordCacheHit()
{
    _cacheHits++;
}

public void RecordCacheMiss()
{
    _cacheMisses++;
}

public void LogPerformanceStats()
{
    if (!enableDebugLog) return;
    
    float avgProcessingTime = _totalTexturesCreated > 0 ? _totalProcessingTime / _totalTexturesCreated : 0f;
    float cacheHitRate = (_cacheHits + _cacheMisses) > 0 ? (float)_cacheHits / (_cacheHits + _cacheMisses) : 0f;
    
    Debug.Log($"[MPRTextureManager] 性能统计:\n" +
             $"  生成纹理总数: {_totalTexturesCreated}\n" +
             $"  平均处理时间: {avgProcessingTime:F3}秒\n" +
             $"  缓存命中率: {cacheHitRate:P1}\n" +
             $"  缓存命中/未命中: {_cacheHits}/{_cacheMisses}");
}
```

## 使用建议

### 最佳实践

```csharp
// 1. 在合适的时机初始化
void Start()
{
    MPRTextureManager mprManager = GetComponent<MPRTextureManager>();
    
    // 可以在Start中进行额外配置
    mprManager.maxConcurrentTasks = SystemInfo.processorCount > 4 ? 3 : 2;
    mprManager.enableMemoryMonitoring = true;
}

// 2. 正确处理序列切换
public void LoadNewPatientData(DicomSeries newSeries)
{
    // 显示加载界面
    ShowLoadingUI(true);
    
    // 设置新序列
    mprManager.SetDicomSeries(newSeries);
    
    // 设置初始视图
    SetInitialView();
    
    // 隐藏加载界面
    ShowLoadingUI(false);
}

// 3. 在场景切换前清理
void OnApplicationPause(bool pauseStatus)
{
    if (pauseStatus)
    {
        // 应用暂停时清理资源
        mprManager.ClearAllTextures();
    }
}
```

### 错误处理

```csharp
// 监听并处理潜在错误
void MonitorMPRHealth()
{
    // 检查是否有异常状态
    if (mprManager.GetActiveTaskCount() > mprManager.maxConcurrentTasks * 2)
    {
        Debug.LogWarning("检测到异常的活跃任务数，重置MPR管理器");
        mprManager.CancelAllRequests();
    }
    
    // 检查内存使用
    if (SystemInfo.systemMemorySize > 0)
    {
        long usedMemory = System.GC.GetTotalMemory(false);
        if (usedMemory > SystemInfo.systemMemorySize * 0.8f)
        {
            Debug.LogWarning("内存使用率过高，强制清理");
            mprManager.ClearAllTextures();
            Resources.UnloadUnusedAssets();
        }
    }
}
```

### 平台适配

```csharp
// 根据平台调整设置
void ConfigureForPlatform()
{
    #if UNITY_WSA && !UNITY_EDITOR
        // HoloLens平台
        mprManager.maxAxialTextureCount = 64;
        mprManager.maxSagittalTextureCount = 16;
        mprManager.maxCoronalTextureCount = 16;
        mprManager.maxConcurrentTasks = 1;
        mprManager.memoryMonitorInterval = 2.0f;
        mprManager.resourceReleaseInterval = 10.0f;
    #elif UNITY_ANDROID || UNITY_IOS
        // 移动平台
        mprManager.maxAxialTextureCount = 96;
        mprManager.maxSagittalTextureCount = 24;
        mprManager.maxCoronalTextureCount = 24;
        mprManager.maxConcurrentTasks = 2;
    #else
        // 桌面平台
        mprManager.maxAxialTextureCount = 128;
        mprManager.maxSagittalTextureCount = 32;
        mprManager.maxCoronalTextureCount = 32;
        mprManager.maxConcurrentTasks = 3;
    #endif
}
```

## Inspector调试工具

```csharp
#if UNITY_EDITOR
[UnityEditor.CustomEditor(typeof(MPRTextureManager))]
public class MPRTextureManagerEditor : UnityEditor.Editor
{
    public override void OnInspectorGUI()
    {
        DrawDefaultInspector();
        
        MPRTextureManager manager = (MPRTextureManager)target;
        
        if (Application.isPlaying)
        {
            UnityEditor.EditorGUILayout.Space();
            UnityEditor.EditorGUILayout.LabelField("运行时状态", UnityEditor.EditorStyles.boldLabel);
            
            UnityEditor.EditorGUILayout.LabelField($"待处理请求: {manager.GetPendingRequestCount()}");
            UnityEditor.EditorGUILayout.LabelField($"活跃任务: {manager.GetActiveTaskCount()}/{manager.maxConcurrentTasks}");
            
            if (UnityEditor.EditorGUILayout.Button("记录状态"))
            {
                manager.LogCurrentStatus();
            }
            
            if (UnityEditor.EditorGUILayout.Button("清理所有纹理"))
            {
                manager.ClearAllTextures();
            }
            
            if (UnityEditor.EditorGUILayout.Button("性能统计"))
            {
                manager.LogPerformanceStats();
            }
        }
    }
}
#endif
```

正确的生命周期管理确保MPRTextureManager在各种情况下都能稳定运行，避免内存泄漏和性能问题。