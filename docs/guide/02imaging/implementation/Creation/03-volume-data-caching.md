---
title: 体素数据缓存
---
# 体素数据缓存

本页详细介绍如何缓存和管理3D体素数据，以及窗宽窗位的应用机制。

## 体素缓存概述

体素缓存将所有轴向切片的像素数据解码到一个连续的3D数组中，使矢状和冠状面纹理能够快速提取:

```csharp
// 缓存体素数据并应用窗宽窗位
bool success = creator.CacheVolumeData(40.0f, 400.0f);

if (success)
{
    Debug.Log("体素数据缓存成功，可以使用快速路径");
}
```

### 数据结构

体素缓存维护两个数组:

- **`_rawVolumeData`**:原始16位体素值，未应用窗宽窗位
- **`_cachedVolumeData`**:应用窗宽窗位后的Color32数组，直接用于纹理生成

## 原始体素数据缓存

`CacheRawVolumeData()` 方法解码所有切片的原始像素:

```csharp
private bool CacheRawVolumeData()
{
    // 检查是否已缓存
    if (_rawVolumeData != null && _rawVolumeData.Length > 0)
        return true;
        
    if (_sliceManager.SliceCount == 0)
        return false;
        
    try
    {
        Vector3Int dimensions = _dicomSeries.Dimensions;
        _cachedDimensions = dimensions;
        
        // 分配整个体积的内存
        int voxelCount = dimensions.x * dimensions.y * dimensions.z;
        _rawVolumeData = new ushort[voxelCount];
        
        // 遍历所有轴向切片
        for (int z = 0; z < _sliceManager.SliceCount; z++)
        {
            DicomSlice slice = _sliceManager.GetSlice(z);
            if (slice == null || !slice.DecodePixelData()) 
                continue;
                
            ExtractSliceVoxels(slice, z, dimensions);
        }
        
        // 应用窗宽窗位到体素数据
        ApplyWindowLevelToVolumeData(_lastWindowCenter, _lastWindowWidth);
        
        return true;
    }
    catch (Exception ex)
    {
        Debug.LogError($"缓存原始体素数据时出错: {ex.Message}");
        _rawVolumeData = null;
        _volumeDataCached = false;
        return false;
    }
}
```

### 切片体素提取

`ExtractSliceVoxels()` 从单个切片提取16位像素值:

```csharp
private void ExtractSliceVoxels(DicomSlice slice, int zIndex, Vector3Int dimensions)
{
    byte[] pixelData = slice.PixelData;
    if (pixelData == null || pixelData.Length < dimensions.x * dimensions.y * 2)
        return;
        
    // 计算切片在体积中的偏移
    int sliceOffset = zIndex * dimensions.x * dimensions.y;
    
    // 提取16位像素数据（小端序）
    for (int i = 0; i < dimensions.x * dimensions.y; i++)
    {
        int byteIndex = i * 2;
        if (byteIndex + 1 < pixelData.Length)
        {
            // 组合低位和高位字节
            ushort pixelValue = (ushort)((pixelData[byteIndex + 1] << 8) | pixelData[byteIndex]);
            _rawVolumeData[sliceOffset + i] = pixelValue;
        }
    }
}
```

## 窗宽窗位应用

`ApplyWindowLevelToVolumeData()` 将原始体素值转换为显示用的灰度值:

```csharp
private void ApplyWindowLevelToVolumeData(float center, float width)
{
    if (_rawVolumeData == null || _rawVolumeData.Length == 0)
        return;
        
    // 创建或重用显示数据数组
    if (_cachedVolumeData == null || _cachedVolumeData.Length != _rawVolumeData.Length)
    {
        _cachedVolumeData = new Color32[_rawVolumeData.Length];
    }
    
    // 计算窗宽窗位参数
    float lowValue = center - 0.5f * width;
    float highValue = center + 0.5f * width;
    float windowScale = 1.0f / width;
    
    // 批量转换所有体素
    for (int i = 0; i < _rawVolumeData.Length; i++)
    {
        float pixelValue = _rawVolumeData[i];
        float normalizedValue;
        
        // 应用窗宽窗位映射
        if (pixelValue <= lowValue)
            normalizedValue = 0f;
        else if (pixelValue >= highValue)
            normalizedValue = 1f;
        else
            normalizedValue = (pixelValue - lowValue) * windowScale;
            
        // 转换为Color32格式
        byte intensity = (byte)(normalizedValue * 255);
        _cachedVolumeData[i] = new Color32(intensity, intensity, intensity, 255);
    }
    
    // 标记缓存有效
    _volumeDataCached = true;
}
```

### 窗宽窗位映射原理

窗宽窗位映射公式:

```
normalizedValue = (pixelValue - lowValue) / width
其中:
- lowValue = center - width/2
- highValue = center + width/2
- 值域限制在[0, 1]之间
```

## 缓存管理方法

### 主缓存接口

`CacheVolumeData()` 是主要的缓存入口方法:

```csharp
public bool CacheVolumeData(float windowCenter, float windowWidth)
{
    // 如果已经有应用了窗宽窗位的缓存数据，直接返回
    if (_volumeDataCached && _cachedVolumeData != null)
        return true;
        
    // 确保原始数据已缓存
    if (!CacheRawVolumeData())
        return false;
        
    // 应用新的窗宽窗位
    ApplyWindowLevelToVolumeData(windowCenter, windowWidth);
    
    return _volumeDataCached;
}
```

该方法的执行流程:

1. **检查现有缓存**:如果已有有效的显示数据缓存，直接返回
2. **确保原始数据**:调用 `CacheRawVolumeData()` 解码所有切片
3. **应用窗宽窗位**:生成用于显示的Color32数组
4. **返回状态**:指示缓存是否成功

## 窗宽窗位变化处理

当用户调整窗宽窗位时，体素缓存需要重新应用映射:

```csharp
// 设置新的窗宽窗位
creator.SetWindowLevel(50.0f, 350.0f);
```

`SetWindowLevel()` 方法的内部处理:

```csharp
public void SetWindowLevel(float center, float width)
{
    _pendingWindowCenter = center;
    _pendingWindowWidth = width;
    _hasPendingWindowLevelChange = true;
    _lastChangeTime = Time.realtimeSinceStartup;
    
    // 启动延迟更新协程，避免频繁变化
    if (_delayedUpdateCoroutine == null && _coroutineRunner != null)
    {
        _delayedUpdateCoroutine = _coroutineRunner.StartCoroutine(DelayedWindowLevelUpdate());
    }
}

private IEnumerator DelayedWindowLevelUpdate()
{
    while (_hasPendingWindowLevelChange)
    {
        float elapsedTime = Time.realtimeSinceStartup - _lastChangeTime;
        
        if (elapsedTime >= _updateDelay) // 默认300ms延迟
        {
            // 应用待处理的窗宽窗位变化
            ApplyWindowLevelChanges(_pendingWindowCenter, _pendingWindowWidth);
            _hasPendingWindowLevelChange = false;
        }
        
        yield return new WaitForSeconds(0.1f);
    }
    
    _delayedUpdateCoroutine = null;
}
```

### 延迟更新机制

延迟更新防止滑块拖动时的频繁重计算:

- **延迟时间**:默认300ms，可调整
- **协程管理**:单例协程，避免重复启动
- **批量更新**:等待变化稳定后统一处理

## 全平面纹理更新

窗宽窗位应用后，需要更新所有显示的纹理:

```csharp
private void ApplyWindowLevelChanges(float center, float width)
{
    _lastWindowCenter = center;
    _lastWindowWidth = width;
    _textureCache.SetCurrentWindowLevelKey(center, width);
    
    // 重新应用窗宽窗位到体素数据
    if (_rawVolumeData != null && _rawVolumeData.Length > 0)
    {
        ApplyWindowLevelToVolumeData(center, width);
        
        // 通知窗宽窗位变化
        OnWindowLevelChanged?.Invoke(center, width);
        
        // 更新所有平面的纹理
        if (_dicomSeries != null)
        {
            int axialIndex = GetCurrentIndex(DicomPlane.PlaneType.Axial);
            int sagittalIndex = GetCurrentIndex(DicomPlane.PlaneType.Sagittal);
            int coronalIndex = GetCurrentIndex(DicomPlane.PlaneType.Coronal);
            
            UpdateAllPlaneTextures(axialIndex, sagittalIndex, coronalIndex);
        }
    }
    else
    {
        // 清除现有缓存
        ClearVolumeCache();
    }
}
```

### 全平面更新实现

```csharp
public void UpdateAllPlaneTextures(int axialIndex, int sagittalIndex, int coronalIndex)
{
    // 更新当前索引
    _currentAxialIndex = axialIndex;
    _currentSagittalIndex = sagittalIndex;
    _currentCoronalIndex = coronalIndex;
    
    // 确保体素数据已缓存
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

## 缓存清理操作

### 部分清理

`ClearVolumeCache()` 只清理显示数据，保留原始数据:

```csharp
public void ClearVolumeCache()
{
    _cachedVolumeData = null;
    _volumeDataCached = false;
    // 保留 _rawVolumeData，避免重新解码
}
```

适用场景:
- 窗宽窗位频繁变化
- 内存压力不高
- 希望快速重新应用窗宽窗位

### 完全清理

`ClearAllCache()` 清理所有体素数据:

```csharp
public void ClearAllCache()
{
    _rawVolumeData = null;
    _cachedVolumeData = null;
    _volumeDataCached = false;
}
```

适用场景:
- 切换DICOM序列
- 内存压力较高
- 长时间不使用MPR功能

## 内存管理策略

### 内存占用估算

```csharp
public long EstimateVolumeMemoryUsage()
{
    if (_dicomSeries == null) return 0;
    
    Vector3Int dimensions = _dicomSeries.Dimensions;
    long voxelCount = (long)dimensions.x * dimensions.y * dimensions.z;
    
    long rawDataSize = voxelCount * sizeof(ushort);        // 原始数据
    long displayDataSize = voxelCount * sizeof(Color32);   // 显示数据
    
    return rawDataSize + displayDataSize;
}
```

### 平台适配

```csharp
public bool ShouldUseVolumeCache()
{
    long requiredMemory = EstimateVolumeMemoryUsage();
    
    #if UNITY_WSA && !UNITY_EDITOR
        // HoloLens平台，内存受限
        return requiredMemory < 64 * 1024 * 1024; // 64MB限制
    #elif UNITY_ANDROID || UNITY_IOS
        // 移动平台，中等限制
        return requiredMemory < 128 * 1024 * 1024; // 128MB限制
    #else
        // 桌面平台，较宽松限制
        return requiredMemory < 512 * 1024 * 1024; // 512MB限制
    #endif
}
```

### 动态启用/禁用

```csharp
public void ConfigureVolumeCache(bool forceEnable = false)
{
    if (forceEnable || ShouldUseVolumeCache())
    {
        // 启用体素缓存
        CacheVolumeData(_lastWindowCenter, _lastWindowWidth);
    }
    else
    {
        // 禁用体素缓存，使用回退算法
        ClearAllCache();
        Debug.Log("内存不足，禁用体素缓存，将使用回退算法");
    }
}
```

## 性能监控

### 缓存状态查询

```csharp
public bool IsVolumeCached => _volumeDataCached && _cachedVolumeData != null;
public bool IsRawDataCached => _rawVolumeData != null && _rawVolumeData.Length > 0;
public Vector3Int CachedDimensions => _cachedDimensions;
```

### 性能指标

```csharp
public void LogCacheStats()
{
    if (_enableDebugLog)
    {
        long rawSize = _rawVolumeData?.Length * sizeof(ushort) ?? 0;
        long displaySize = _cachedVolumeData?.Length * sizeof(Color32) ?? 0;
        
        Debug.Log($"体素缓存状态: " +
                 $"原始数据={rawSize / (1024 * 1024)}MB, " +
                 $"显示数据={displaySize / (1024 * 1024)}MB, " +
                 $"维度={_cachedDimensions}");
    }
}
```

## 使用建议

### 最佳实践

```csharp
// 1. 应用启动时预缓存（如果内存允许）
void Start()
{
    if (ShouldUseVolumeCache())
    {
        creator.CacheVolumeData(defaultCenter, defaultWidth);
    }
}

// 2. 窗宽窗位变化时延迟更新
void OnWindowLevelSliderChanged(float center, float width)
{
    creator.SetWindowLevel(center, width);
    // 内部会自动延迟更新
}

// 3. 切换序列时清理缓存
void LoadNewSeries()
{
    creator.ClearAllCache();
    // 加载新序列...
}
```

### 错误处理

```csharp
public bool SafeCacheVolumeData(float center, float width)
{
    try
    {
        return CacheVolumeData(center, width);
    }
    catch (OutOfMemoryException)
    {
        Debug.LogWarning("内存不足，无法缓存体素数据");
        ClearAllCache();
        return false;
    }
    catch (Exception ex)
    {
        Debug.LogError($"缓存体素数据失败: {ex.Message}");
        return false;
    }
}
```