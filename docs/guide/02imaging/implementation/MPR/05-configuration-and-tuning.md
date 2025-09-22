---
title: 配置与调优
---
# 配置与调优

本页介绍如何配置和调优MPRTextureManager以获得最佳性能，包括参数设置、平台适配和性能监控。

## 基础配置参数

### Inspector可配置参数

MPRTextureManager提供了多个可在Inspector中调整的参数:

```csharp
[Header("纹理缓存设置")]
[SerializeField] private int maxAxialTextureCount = 128;        // 轴向纹理最大缓存数
[SerializeField] private int maxSagittalTextureCount = 32;      // 矢状纹理最大缓存数  
[SerializeField] private int maxCoronalTextureCount = 32;       // 冠状纹理最大缓存数

[Header("性能优化")]
[SerializeField] private int maxConcurrentTasks = 2;            // 最大并发任务数
[SerializeField] private bool enableDebugLog = false;          // 启用调试日志

[Header("内存监控")]
[SerializeField] private bool enableMemoryMonitoring = true;   // 启用内存监控
[SerializeField] private float memoryMonitorInterval = 5.0f;   // 内存检查间隔(秒)
[SerializeField] private float resourceReleaseInterval = 30.0f; // 资源释放间隔(秒)
```

### 参数配置指南

```csharp
public void ConfigureBasicSettings()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // 1. 缓存大小配置
    // 轴向纹理:用户最常浏览，需要较大缓存
    mpr.maxAxialTextureCount = 128;
    
    // 矢状/冠状纹理:重建成本高但使用频率低
    mpr.maxSagittalTextureCount = 32;
    mpr.maxCoronalTextureCount = 32;
    
    // 2. 性能配置
    // 根据CPU核心数设置并发任务
    int coreCount = SystemInfo.processorCount;
    mpr.maxConcurrentTasks = Mathf.Clamp(coreCount / 2, 1, 4);
    
    // 3. 监控配置
    mpr.enableMemoryMonitoring = true;
    mpr.memoryMonitorInterval = 5.0f;
    mpr.resourceReleaseInterval = 30.0f;
}
```

## 平台特定配置

### HoloLens 2配置

```csharp
public void ConfigureForHoloLens()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // HoloLens内存严重受限
    mpr.maxAxialTextureCount = 32;          // 大幅减少轴向缓存
    mpr.maxSagittalTextureCount = 8;        // 最小矢状缓存
    mpr.maxCoronalTextureCount = 8;         // 最小冠状缓存
    
    // 单任务处理避免资源竞争
    mpr.maxConcurrentTasks = 1;
    
    // 激进的内存监控
    mpr.enableMemoryMonitoring = true;
    mpr.memoryMonitorInterval = 1.0f;       // 每秒检查
    mpr.resourceReleaseInterval = 5.0f;     // 5秒释放一次
    
    // 启用调试以监控性能
    mpr.enableDebugLog = true;
    
    Debug.Log("[MPR] 已配置HoloLens 2优化设置");
}
```

### 移动平台配置

```csharp
public void ConfigureForMobile()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // 移动设备内存受限但比HoloLens宽松
    mpr.maxAxialTextureCount = 64;
    mpr.maxSagittalTextureCount = 16;
    mpr.maxCoronalTextureCount = 16;
    
    // 限制并发任务
    mpr.maxConcurrentTasks = 1;
    
    // 中等频率的内存监控
    mpr.enableMemoryMonitoring = true;
    mpr.memoryMonitorInterval = 3.0f;
    mpr.resourceReleaseInterval = 15.0f;
    
    Debug.Log("[MPR] 已配置移动平台优化设置");
}
```

### 桌面平台配置

```csharp
public void ConfigureForDesktop()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // 桌面平台资源相对充足
    mpr.maxAxialTextureCount = 256;         // 大容量轴向缓存
    mpr.maxSagittalTextureCount = 64;       // 充足的重建缓存
    mpr.maxCoronalTextureCount = 64;
    
    // 根据CPU核心数设置并发
    int coreCount = SystemInfo.processorCount;
    if (coreCount >= 8)
        mpr.maxConcurrentTasks = 4;
    else if (coreCount >= 4)
        mpr.maxConcurrentTasks = 3;
    else
        mpr.maxConcurrentTasks = 2;
    
    // 宽松的内存监控
    mpr.enableMemoryMonitoring = true;
    mpr.memoryMonitorInterval = 10.0f;      // 10秒检查
    mpr.resourceReleaseInterval = 60.0f;    // 1分钟释放
    
    Debug.Log($"[MPR] 已配置桌面平台设置 (核心数: {coreCount}, 并发: {mpr.maxConcurrentTasks})");
}
```

## 自动平台适配

### 智能配置系统

```csharp
public void AutoConfigureForPlatform()
{
    #if UNITY_WSA && !UNITY_EDITOR
        ConfigureForHoloLens();
    #elif UNITY_ANDROID || UNITY_IOS
        ConfigureForMobile();
    #elif UNITY_STANDALONE
        ConfigureForDesktop();
    #else
        ConfigureDefault();
    #endif
}

private void ConfigureDefault()
{
    // 默认保守配置
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    mpr.maxAxialTextureCount = 96;
    mpr.maxSagittalTextureCount = 24;
    mpr.maxCoronalTextureCount = 24;
    mpr.maxConcurrentTasks = 2;
    mpr.enableMemoryMonitoring = true;
    mpr.memoryMonitorInterval = 5.0f;
    mpr.resourceReleaseInterval = 30.0f;
    
    Debug.Log("[MPR] 已应用默认配置");
}
```

### 运行时自适应

```csharp
public void AdaptiveConfiguration()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // 检测系统规格
    long totalMemory = SystemInfo.systemMemorySize; // MB
    int processorCount = SystemInfo.processorCount;
    int graphicsMemory = SystemInfo.graphicsMemorySize; // MB
    
    // 基于内存调整缓存大小
    float memoryFactor = Mathf.Clamp01(totalMemory / 4096f); // 4GB为基准
    
    mpr.maxAxialTextureCount = (int)(128 * memoryFactor);
    mpr.maxSagittalTextureCount = (int)(32 * memoryFactor);
    mpr.maxCoronalTextureCount = (int)(32 * memoryFactor);
    
    // 基于CPU调整并发
    mpr.maxConcurrentTasks = Mathf.Clamp(processorCount / 2, 1, 4);
    
    // 基于显存调整监控频率
    if (graphicsMemory < 2048) // 2GB以下显存
    {
        mpr.memoryMonitorInterval = 2.0f;
        mpr.resourceReleaseInterval = 10.0f;
    }
    
    Debug.Log($"[MPR] 自适应配置完成 - 内存: {totalMemory}MB, CPU: {processorCount}核, 显存: {graphicsMemory}MB");
}
```

## 性能调优

### 缓存大小优化

```csharp
public void OptimizeCacheSize()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // 获取当前序列信息
    if (mpr._dicomSeries != null)
    {
        Vector3Int dimensions = mpr._dicomSeries.Dimensions;
        int totalSlices = mpr._dicomSeries.Slices.Count;
        
        // 基于序列大小调整轴向缓存
        if (totalSlices <= 50)
        {
            // 小序列:缓存全部
            mpr.maxAxialTextureCount = totalSlices;
        }
        else if (totalSlices <= 200)
        {
            // 中等序列:缓存50%
            mpr.maxAxialTextureCount = totalSlices / 2;
        }
        else
        {
            // 大序列:固定缓存数量
            mpr.maxAxialTextureCount = 128;
        }
        
        // 基于重建复杂度调整矢状/冠状缓存
        long reconstructionComplexity = dimensions.x * dimensions.y * dimensions.z;
        
        if (reconstructionComplexity < 100 * 1024 * 1024) // 小于100M体素
        {
            mpr.maxSagittalTextureCount = 16;
            mpr.maxCoronalTextureCount = 16;
        }
        else if (reconstructionComplexity < 500 * 1024 * 1024) // 小于500M体素
        {
            mpr.maxSagittalTextureCount = 8;
            mpr.maxCoronalTextureCount = 8;
        }
        else
        {
            // 大体积:最小缓存
            mpr.maxSagittalTextureCount = 4;
            mpr.maxCoronalTextureCount = 4;
        }
        
        Debug.Log($"[MPR] 缓存优化完成 - 序列: {totalSlices}切片, 复杂度: {reconstructionComplexity / (1024*1024)}M体素");
    }
}
```

### 并发任务优化

```csharp
public void OptimizeConcurrency()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // 基于当前负载调整并发
    float cpuUsage = GetCPUUsage(); // 需要实现CPU使用率检测
    int currentActiveCount = mpr.GetActiveTaskCount();
    int currentPendingCount = mpr.GetPendingRequestCount();
    
    int optimalConcurrency = mpr.maxConcurrentTasks;
    
    // 高CPU使用率时减少并发
    if (cpuUsage > 0.8f)
    {
        optimalConcurrency = Mathf.Max(1, mpr.maxConcurrentTasks - 1);
    }
    // 积压严重时增加并发
    else if (currentPendingCount > 10 && cpuUsage < 0.5f)
    {
        optimalConcurrency = Mathf.Min(4, mpr.maxConcurrentTasks + 1);
    }
    
    // 动态调整（如果支持运行时修改）
    if (optimalConcurrency != mpr.maxConcurrentTasks)
    {
        mpr.maxConcurrentTasks = optimalConcurrency;
        Debug.Log($"[MPR] 并发调整: {optimalConcurrency} (CPU: {cpuUsage:P1}, 积压: {currentPendingCount})");
    }
}

private float GetCPUUsage()
{
    // 简化的CPU使用率估算
    // 实际项目中可使用性能分析器或系统API
    return Mathf.Clamp01(Time.deltaTime * 60f / 16.67f); // 基于帧时间估算
}
```

## 窗宽窗位优化

### 窗宽窗位缓存策略

```csharp
public void ConfigureWindowLevelCaching(List<(float center, float width)> commonPresets)
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // 为常用窗宽窗位预留缓存空间
    int presetsCount = commonPresets.Count;
    
    if (presetsCount > 1)
    {
        // 多窗位模式:减少单个窗位的缓存
        float reductionFactor = 1.0f / Mathf.Sqrt(presetsCount);
        
        mpr.maxAxialTextureCount = (int)(mpr.maxAxialTextureCount * reductionFactor);
        mpr.maxSagittalTextureCount = (int)(mpr.maxSagittalTextureCount * reductionFactor);
        mpr.maxCoronalTextureCount = (int)(mpr.maxCoronalTextureCount * reductionFactor);
        
        Debug.Log($"[MPR] 多窗位模式配置: {presetsCount}个预设, 缓存缩减系数: {reductionFactor:F2}");
    }
}
```

### 预设窗宽窗位管理

```csharp
public class WindowLevelPresetManager
{
    private MPRTextureManager _mprManager;
    private Dictionary<string, (float center, float width)> _presets;
    
    public WindowLevelPresetManager(MPRTextureManager mprManager)
    {
        _mprManager = mprManager;
        InitializePresets();
    }
    
    private void InitializePresets()
    {
        _presets = new Dictionary<string, (float, float)>
        {
            {"腹部", (40f, 400f)},
            {"肺部", (-600f, 1500f)},
            {"脑部", (40f, 80f)},
            {"骨骼", (400f, 1800f)},
            {"肝脏", (60f, 160f)},
            {"软组织", (50f, 350f)}
        };
    }
    
    public void ApplyPreset(string presetName)
    {
        if (_presets.TryGetValue(presetName, out var preset))
        {
            _mprManager.SetWindowLevel(preset.center, preset.width);
            Debug.Log($"[MPR] 应用窗宽窗位预设: {presetName} ({preset.center}/{preset.width})");
        }
        else
        {
            Debug.LogWarning($"[MPR] 未找到窗宽窗位预设: {presetName}");
        }
    }
    
    public void PreloadCommonPresets()
    {
        // 预加载常用窗宽窗位的当前切片
        foreach (var preset in _presets.Values)
        {
            _mprManager.SetWindowLevel(preset.center, preset.width);
            
            // 请求当前切片以触发缓存
            var currentAxial = _mprManager._currentAxialIndex;
            var currentSagittal = _mprManager._currentSagittalIndex;
            var currentCoronal = _mprManager._currentCoronalIndex;
            
            if (currentAxial >= 0)
                _mprManager.GetTexture(DicomPlane.PlaneType.Axial, currentAxial);
        }
    }
}
```

## 调试和监控配置

### 性能监控设置

```csharp
public void ConfigurePerformanceMonitoring(bool enableDetailedLogging = false)
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    mpr.enableDebugLog = enableDetailedLogging;
    
    if (enableDetailedLogging)
    {
        // 启动性能监控协程
        StartCoroutine(PerformanceMonitoringCoroutine());
    }
}

private IEnumerator PerformanceMonitoringCoroutine()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    while (true)
    {
        yield return new WaitForSeconds(10f); // 每10秒记录一次
        
        // 记录关键指标
        int pendingRequests = mpr.GetPendingRequestCount();
        int activeTasks = mpr.GetActiveTaskCount();
        long currentMemory = System.GC.GetTotalMemory(false);
        
        Debug.Log($"[MPR性能] 待处理: {pendingRequests}, 活跃: {activeTasks}, 内存: {currentMemory / (1024*1024)}MB");
        
        // 检查异常状态
        if (pendingRequests > 50)
        {
            Debug.LogWarning("[MPR性能] 请求队列积压严重");
        }
        
        if (activeTasks == mpr.maxConcurrentTasks)
        {
            Debug.Log("[MPR性能] 所有并发槽位已占用");
        }
    }
}
```

### 配置验证

```csharp
public bool ValidateConfiguration()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    bool isValid = true;
    
    // 检查缓存大小合理性
    if (mpr.maxAxialTextureCount < 8)
    {
        Debug.LogWarning("[MPR配置] 轴向缓存过小，可能影响浏览流畅度");
        isValid = false;
    }
    
    if (mpr.maxSagittalTextureCount < 2 || mpr.maxCoronalTextureCount < 2)
    {
        Debug.LogWarning("[MPR配置] 重建缓存过小，可能导致频繁重新生成");
        isValid = false;
    }
    
    // 检查并发设置
    if (mpr.maxConcurrentTasks > SystemInfo.processorCount)
    {
        Debug.LogWarning($"[MPR配置] 并发任务数({mpr.maxConcurrentTasks})超过CPU核心数({SystemInfo.processorCount})");
        isValid = false;
    }
    
    // 检查监控间隔
    if (mpr.memoryMonitorInterval < 1.0f)
    {
        Debug.LogWarning("[MPR配置] 内存监控间隔过短，可能影响性能");
    }
    
    // 估算内存使用
    long estimatedMemory = EstimateMemoryUsage(mpr);
    long availableMemory = SystemInfo.systemMemorySize * 1024L * 1024L;
    
    if (estimatedMemory > availableMemory * 0.3f)
    {
        Debug.LogWarning($"[MPR配置] 估算内存使用({estimatedMemory/(1024*1024)}MB)可能过高");
        isValid = false;
    }
    
    return isValid;
}

private long EstimateMemoryUsage(MPRTextureManager mpr)
{
    // 简化的内存使用估算
    long axialMemory = mpr.maxAxialTextureCount * 1024 * 1024; // 假设1MB/张
    long sagittalMemory = mpr.maxSagittalTextureCount * 2 * 1024 * 1024; // 假设2MB/张
    long coronalMemory = mpr.maxCoronalTextureCount * 2 * 1024 * 1024;
    
    return axialMemory + sagittalMemory + coronalMemory;
}
```

## 配置文件管理

### 配置保存和加载

```csharp
[System.Serializable]
public class MPRConfiguration
{
    public int maxAxialTextureCount = 128;
    public int maxSagittalTextureCount = 32;
    public int maxCoronalTextureCount = 32;
    public int maxConcurrentTasks = 2;
    public bool enableMemoryMonitoring = true;
    public float memoryMonitorInterval = 5.0f;
    public float resourceReleaseInterval = 30.0f;
    public bool enableDebugLog = false;
}

public void SaveConfiguration(string configPath)
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    MPRConfiguration config = new MPRConfiguration
    {
        maxAxialTextureCount = mpr.maxAxialTextureCount,
        maxSagittalTextureCount = mpr.maxSagittalTextureCount,
        maxCoronalTextureCount = mpr.maxCoronalTextureCount,
        maxConcurrentTasks = mpr.maxConcurrentTasks,
        enableMemoryMonitoring = mpr.enableMemoryMonitoring,
        memoryMonitorInterval = mpr.memoryMonitorInterval,
        resourceReleaseInterval = mpr.resourceReleaseInterval,
        enableDebugLog = mpr.enableDebugLog
    };
    
    string json = JsonUtility.ToJson(config, true);
    System.IO.File.WriteAllText(configPath, json);
    
    Debug.Log($"[MPR] 配置已保存到: {configPath}");
}

public void LoadConfiguration(string configPath)
{
    if (!System.IO.File.Exists(configPath))
    {
        Debug.LogWarning($"[MPR] 配置文件不存在: {configPath}");
        return;
    }
    
    try
    {
        string json = System.IO.File.ReadAllText(configPath);
        MPRConfiguration config = JsonUtility.FromJson<MPRConfiguration>(json);
        
        ApplyConfiguration(config);
        
        Debug.Log($"[MPR] 配置已从文件加载: {configPath}");
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"[MPR] 加载配置失败: {ex.Message}");
    }
}

private void ApplyConfiguration(MPRConfiguration config)
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    mpr.maxAxialTextureCount = config.maxAxialTextureCount;
    mpr.maxSagittalTextureCount = config.maxSagittalTextureCount;
    mpr.maxCoronalTextureCount = config.maxCoronalTextureCount;
    mpr.maxConcurrentTasks = config.maxConcurrentTasks;
    mpr.enableMemoryMonitoring = config.enableMemoryMonitoring;
    mpr.memoryMonitorInterval = config.memoryMonitorInterval;
    mpr.resourceReleaseInterval = config.resourceReleaseInterval;
    mpr.enableDebugLog = config.enableDebugLog;
    
    // 验证配置有效性
    if (!ValidateConfiguration())
    {
        Debug.LogWarning("[MPR] 加载的配置可能不适合当前平台");
    }
}
```

## 使用建议

### 初始化最佳实践

```csharp
void Start()
{
    // 1. 自动平台适配
    AutoConfigureForPlatform();
    
    // 2. 验证配置
    if (!ValidateConfiguration())
    {
        Debug.LogWarning("MPR配置验证失败，使用保守设置");
        ConfigureDefault();
    }
    
    // 3. 启用性能监控（开发期间）
    #if DEVELOPMENT_BUILD || UNITY_EDITOR
        ConfigurePerformanceMonitoring(true);
    #endif
    
    // 4. 设置窗宽窗位预设
    var presetManager = new WindowLevelPresetManager(GetComponent<MPRTextureManager>());
    presetManager.ApplyPreset("腹部"); // 设置默认窗位
}
```

### 运行时调优

```csharp
void Update()
{
    // 每30秒进行一次自适应调优
    if (Time.frameCount % (30 * 60) == 0) // 假设60fps
    {
        OptimizeConcurrency();
        
        // 根据当前性能调整配置
        AdaptConfigurationToPerformance();
    }
}

private void AdaptConfigurationToPerformance()
{
    MPRTextureManager mpr = GetComponent<MPRTextureManager>();
    
    // 检查平均帧率
    float avgFrameRate = 1.0f / Time.smoothDeltaTime;
    
    if (avgFrameRate < 30f) // 帧率过低
    {
        // 降低质量以提升性能
        mpr.maxAxialTextureCount = Mathf.Max(32, mpr.maxAxialTextureCount / 2);
        mpr.maxConcurrentTasks = Mathf.Max(1, mpr.maxConcurrentTasks - 1);
        
        Debug.Log($"[MPR] 检测到性能问题，降低配置 (FPS: {avgFrameRate:F1})");
    }
    else if (avgFrameRate > 55f && mpr.GetPendingRequestCount() == 0)
    {
        // 性能充足，可以提升质量
        if (mpr.maxAxialTextureCount < 128)
        {
            mpr.maxAxialTextureCount = Mathf.Min(128, mpr.maxAxialTextureCount * 2);
            Debug.Log($"[MPR] 性能充足，提升缓存配置 (FPS: {avgFrameRate:F1})");
        }
    }
}
```

正确的配置和调优能确保MPRTextureManager在不同平台和使用场景下都能提供最佳性能。