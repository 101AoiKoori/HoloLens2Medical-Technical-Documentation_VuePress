---
title: 窗宽窗位管理
---
# 窗宽窗位管理

本页详细介绍DicomTextureCreator如何处理窗宽窗位变化，包括延迟更新机制和事件通知。

## 窗宽窗位设置

`SetWindowLevel()` 是更新窗宽窗位的主要接口:

```csharp
DicomTextureCreator creator = GetTextureCreator();

// 设置新的窗宽窗位
creator.SetWindowLevel(50.0f, 350.0f); // 窗位50，窗宽350
```

### 延迟更新机制

为避免用户拖动滑块时的频繁重计算，系统使用延迟更新策略:

```csharp
public void SetWindowLevel(float center, float width)
{
    // 保存待处理的值
    _pendingWindowCenter = center;
    _pendingWindowWidth = width;
    _hasPendingWindowLevelChange = true;
    _lastChangeTime = Time.realtimeSinceStartup;
    
    // 启动延迟更新协程（单例模式）
    if (_delayedUpdateCoroutine == null && _coroutineRunner != null)
    {
        _delayedUpdateCoroutine = _coroutineRunner.StartCoroutine(DelayedWindowLevelUpdate());
    }
}
```

### 延迟更新协程

```csharp
private IEnumerator DelayedWindowLevelUpdate()
{
    while (_hasPendingWindowLevelChange)
    {
        float elapsedTime = Time.realtimeSinceStartup - _lastChangeTime;
        
        // 等待变化稳定（默认300ms）
        if (elapsedTime >= _updateDelay)
        {
            // 应用窗宽窗位变化
            ApplyWindowLevelChanges(_pendingWindowCenter, _pendingWindowWidth);
            _hasPendingWindowLevelChange = false;
        }
        
        yield return new WaitForSeconds(0.1f); // 100ms检查间隔
    }
    
    _delayedUpdateCoroutine = null;
}
```

#### 延迟机制优势

- **减少计算**:避免滑块拖动时的频繁重计算
- **提升性能**:批量处理窗宽窗位变化
- **用户体验**:保持UI响应性
- **资源节约**:减少不必要的纹理重生成

## 窗宽窗位应用

`ApplyWindowLevelChanges()` 执行实际的窗宽窗位应用:

```csharp
private void ApplyWindowLevelChanges(float center, float width)
{
    // 更新内部状态
    _lastWindowCenter = center;
    _lastWindowWidth = width;
    
    // 更新缓存的窗宽窗位键
    _textureCache.SetCurrentWindowLevelKey(center, width);
    
    if (_rawVolumeData != null && _rawVolumeData.Length > 0)
    {
        // 重新应用窗宽窗位到体素数据
        ApplyWindowLevelToVolumeData(center, width);
        
        // 通知外部监听器
        OnWindowLevelChanged?.Invoke(center, width);
        
        // 更新所有平面的纹理
        UpdateAllCurrentTextures();
    }
    else
    {
        // 如果没有体素缓存，清除相关缓存
        ClearVolumeCache();
    }
}
```

### 体素数据重映射

体素缓存存在时，重新应用窗宽窗位映射:

```csharp
private void ApplyWindowLevelToVolumeData(float center, float width)
{
    if (_rawVolumeData == null || _rawVolumeData.Length == 0)
        return;
        
    // 确保显示数据数组存在
    if (_cachedVolumeData == null || _cachedVolumeData.Length != _rawVolumeData.Length)
    {
        _cachedVolumeData = new Color32[_rawVolumeData.Length];
    }
    
    // 计算窗宽窗位参数
    float lowValue = center - 0.5f * width;
    float highValue = center + 0.5f * width;
    float windowScale = 1.0f / width;
    
    // 批量重新映射所有体素
    for (int i = 0; i < _rawVolumeData.Length; i++)
    {
        float pixelValue = _rawVolumeData[i];
        float normalizedValue;
        
        if (pixelValue <= lowValue)
            normalizedValue = 0f;
        else if (pixelValue >= highValue)
            normalizedValue = 1f;
        else
            normalizedValue = (pixelValue - lowValue) * windowScale;
            
        byte intensity = (byte)(normalizedValue * 255);
        _cachedVolumeData[i] = new Color32(intensity, intensity, intensity, 255);
    }
    
    _volumeDataCached = true;
}
```

## 全平面纹理更新

窗宽窗位变化后需要更新当前显示的所有纹理:

```csharp
private void UpdateAllCurrentTextures()
{
    if (_dicomSeries != null)
    {
        // 获取当前显示的切片索引
        int axialIndex = GetCurrentIndex(DicomPlane.PlaneType.Axial);
        int sagittalIndex = GetCurrentIndex(DicomPlane.PlaneType.Sagittal);
        int coronalIndex = GetCurrentIndex(DicomPlane.PlaneType.Coronal);
        
        // 更新所有平面纹理
        UpdateAllPlaneTextures(axialIndex, sagittalIndex, coronalIndex);
    }
}

public void UpdateAllPlaneTextures(int axialIndex, int sagittalIndex, int coronalIndex)
{
    // 更新当前索引
    _currentAxialIndex = axialIndex;
    _currentSagittalIndex = sagittalIndex;
    _currentCoronalIndex = coronalIndex;
    
    // 确保体素数据已应用当前窗宽窗位
    if (!_volumeDataCached)
    {
        CacheVolumeData(_lastWindowCenter, _lastWindowWidth);
    }
    
    // 重新生成三个平面的纹理
    GetAxialTexture(axialIndex, _lastWindowCenter, _lastWindowWidth);
    CreateSagittalTexture(sagittalIndex, _lastWindowCenter, _lastWindowWidth);
    CreateCoronalTexture(coronalIndex, _lastWindowCenter, _lastWindowWidth);
}
```

### 当前索引获取

```csharp
private int GetCurrentIndex(DicomPlane.PlaneType planeType)
{
    // 尝试从MPRViewer获取当前索引
    MPRViewer mprViewer = FindMPRViewer();
    if (mprViewer != null)
    {
        return mprViewer.GetSliceIndex(planeType);
    }
    
    // 回退到内部跟踪的索引
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            return _currentAxialIndex;
        case DicomPlane.PlaneType.Sagittal:
            return _currentSagittalIndex;
        case DicomPlane.PlaneType.Coronal:
            return _currentCoronalIndex;
        default:
            return 0;
    }
}

private MPRViewer FindMPRViewer()
{
    return GameObject.FindObjectOfType<MPRViewer>();
}
```

## 事件通知机制

### 窗宽窗位变化事件

```csharp
public delegate void WindowLevelChangedCallback(float center, float width);
public event WindowLevelChangedCallback OnWindowLevelChanged;
```

事件在窗宽窗位应用后触发，通知UI层更新:

```csharp
// 订阅窗宽窗位变化事件
creator.OnWindowLevelChanged += (center, width) =>
{
    // 更新UI显示
    windowCenterText.text = $"窗位: {center:F0}";
    windowWidthText.text = $"窗宽: {width:F0}";
    
    // 更新滑块位置（避免递归调用）
    if (!isDraggingSlider)
    {
        centerSlider.value = center;
        widthSlider.value = width;
    }
};
```

### 纹理更新事件

```csharp
public delegate void TextureUpdatedCallback(DicomPlane.PlaneType planeType, int index, Texture2D texture);
public event TextureUpdatedCallback OnTextureUpdated;
```

每个纹理生成完成后触发:

```csharp
// 在各纹理生成方法中触发
if (texture != null)
{
    OnTextureUpdated?.Invoke(DicomPlane.PlaneType.Axial, index, texture);
}
```

## 配置参数管理

### 延迟时间配置

```csharp
private float _updateDelay = 0.3f; // 默认300ms延迟

public void SetUpdateDelay(float delaySeconds)
{
    _updateDelay = Mathf.Clamp(delaySeconds, 0.1f, 2.0f);
}
```

### 平台优化配置

```csharp
void ConfigureForPlatform()
{
    #if UNITY_WSA && !UNITY_EDITOR
        // HoloLens平台，使用较长延迟
        _updateDelay = 0.5f;
    #elif UNITY_ANDROID || UNITY_IOS
        // 移动平台，中等延迟
        _updateDelay = 0.4f;
    #else
        // 桌面平台，较短延迟
        _updateDelay = 0.2f;
    #endif
}
```

## 窗宽窗位验证

### 参数有效性检查

```csharp
public bool IsValidWindowLevel(float center, float width)
{
    // 窗宽必须大于0
    if (width <= 0)
    {
        Debug.LogWarning($"无效的窗宽值: {width}，必须大于0");
        return false;
    }
    
    // 窗位应在合理范围内（取决于具体的DICOM数据）
    if (center < -1024 || center > 3072)
    {
        Debug.LogWarning($"窗位值 {center} 可能超出正常范围");
        // 不阻止设置，只警告
    }
    
    return true;
}

public void SetWindowLevelSafe(float center, float width)
{
    if (IsValidWindowLevel(center, width))
    {
        SetWindowLevel(center, width);
    }
}
```

### 自动范围调整

```csharp
public void AutoAdjustWindowLevel()
{
    if (_rawVolumeData == null || _rawVolumeData.Length == 0)
        return;
        
    // 计算体素值的统计信息
    ushort minValue = ushort.MaxValue;
    ushort maxValue = ushort.MinValue;
    long sum = 0;
    
    for (int i = 0; i < _rawVolumeData.Length; i++)
    {
        ushort value = _rawVolumeData[i];
        minValue = System.Math.Min(minValue, value);
        maxValue = System.Math.Max(maxValue, value);
        sum += value;
    }
    
    float mean = (float)sum / _rawVolumeData.Length;
    float range = maxValue - minValue;
    
    // 设置自动窗宽窗位
    float autoCenter = mean;
    float autoWidth = range * 0.8f; // 使用80%的值域作为窗宽
    
    SetWindowLevel(autoCenter, autoWidth);
    
    if (_enableDebugLog)
    {
        Debug.Log($"自动窗宽窗位: 中心={autoCenter:F1}, 宽度={autoWidth:F1} " +
                 $"(范围: {minValue}-{maxValue})");
    }
}
```

## 预设窗宽窗位

### 常用预设

```csharp
public static class WindowLevelPresets
{
    public static readonly (float center, float width) Abdomen = (40, 400);
    public static readonly (float center, float width) Lung = (-600, 1500);
    public static readonly (float center, float width) Brain = (40, 80);
    public static readonly (float center, float width) Bone = (400, 1800);
    public static readonly (float center, float width) Liver = (60, 160);
}

public void ApplyPreset(string presetName)
{
    (float center, float width) preset;
    
    switch (presetName.ToLower())
    {
        case "abdomen":
            preset = WindowLevelPresets.Abdomen;
            break;
        case "lung":
            preset = WindowLevelPresets.Lung;
            break;
        case "brain":
            preset = WindowLevelPresets.Brain;
            break;
        case "bone":
            preset = WindowLevelPresets.Bone;
            break;
        case "liver":
            preset = WindowLevelPresets.Liver;
            break;
        default:
            Debug.LogWarning($"未知的窗宽窗位预设: {presetName}");
            return;
    }
    
    SetWindowLevel(preset.center, preset.width);
    
    if (_enableDebugLog)
    {
        Debug.Log($"应用窗宽窗位预设 '{presetName}': {preset.center}/{preset.width}");
    }
}
```

## 性能监控

### 更新频率统计

```csharp
private int _windowLevelUpdateCount = 0;
private float _lastStatsResetTime = 0;

private void LogUpdateStats()
{
    float currentTime = Time.realtimeSinceStartup;
    float timeSinceReset = currentTime - _lastStatsResetTime;
    
    if (timeSinceReset >= 60f) // 每分钟统计一次
    {
        float updatesPerSecond = _windowLevelUpdateCount / timeSinceReset;
        
        if (_enableDebugLog)
        {
            Debug.Log($"窗宽窗位更新频率: {updatesPerSecond:F2} 次/秒");
        }
        
        _windowLevelUpdateCount = 0;
        _lastStatsResetTime = currentTime;
    }
}
```

### 延迟效果评估

```csharp
private float _totalDelayTime = 0f;
private int _delayedUpdateCount = 0;

private void TrackDelayEffectiveness()
{
    // 在DelayedWindowLevelUpdate中调用
    _totalDelayTime += _updateDelay;
    _delayedUpdateCount++;
    
    if (_delayedUpdateCount >= 10)
    {
        float averageDelay = _totalDelayTime / _delayedUpdateCount;
        
        if (_enableDebugLog)
        {
            Debug.Log($"平均延迟时间: {averageDelay:F2}秒, " +
                     $"减少更新次数: {_delayedUpdateCount}");
        }
        
        _totalDelayTime = 0f;
        _delayedUpdateCount = 0;
    }
}
```

## 使用建议

### 最佳实践

```csharp
// 1. 初始化时设置合理的默认值
void InitializeWindowLevel()
{
    // 使用DICOM文件中的默认值或常用预设
    DicomSlice firstSlice = _sliceManager.GetSlice(0);
    if (firstSlice != null)
    {
        SetWindowLevel(firstSlice.WindowCenter, firstSlice.WindowWidth);
    }
    else
    {
        ApplyPreset("abdomen"); // 默认腹部窗
    }
}

// 2. UI滑块事件处理
void OnWindowLevelSliderChanged(float center, float width)
{
    // 直接设置，延迟机制会自动处理
    creator.SetWindowLevel(center, width);
}

// 3. 程序化批量设置
void BatchUpdateWindowLevel(List<(float center, float width)> presets)
{
    foreach (var preset in presets)
    {
        creator.SetWindowLevel(preset.center, preset.width);
        
        // 等待处理完成
        yield return new WaitUntil(() => !creator.HasPendingWindowLevelChange);
        
        // 执行其他操作...
    }
}
```

### 错误处理

```csharp
public bool SetWindowLevelWithFallback(float center, float width)
{
    try
    {
        if (!IsValidWindowLevel(center, width))
        {
            // 回退到自动调整
            AutoAdjustWindowLevel();
            return false;
        }
        
        SetWindowLevel(center, width);
        return true;
    }
    catch (Exception ex)
    {
        Debug.LogError($"设置窗宽窗位失败: {ex.Message}");
        
        // 回退到默认值
        SetWindowLevel(40, 400);
        return false;
    }
}
```

窗宽窗位管理是医学影像显示的核心功能，合理的延迟更新机制能显著提升用户体验。