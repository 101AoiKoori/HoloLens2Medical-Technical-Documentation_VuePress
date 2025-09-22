---
title: 滑块映射算法
---
# 滑块映射算法

UI模块的滑块映射算法负责在归一化的UI值（0~1）与实际的DICOM数值之间进行双向转换。本节深入分析切片索引映射和窗宽窗位映射的数学算法和实现细节。

## 切片索引映射算法

### 归一化值到索引的转换

切片滑块使用离散索引映射，需要将连续的归一化值转换为离散的切片索引:

```csharp
private void OnPlaneSliderChanged(DicomPlane.PlaneType planeType, float normalizedValue)
{
    if (isUpdatingUI || mprViewer == null) return;

    // 获取切片总数
    int totalSlices = mprViewer.GetSliceCount(planeType);
    if (totalSlices <= 1) return;

    // 核心映射算法
    int newIndex = Mathf.RoundToInt(normalizedValue * (totalSlices - 1));
    
    // 边界保护
    newIndex = Mathf.Clamp(newIndex, 0, totalSlices - 1);

    // 应用新索引
    mprViewer.SetSliceIndex(planeType, newIndex);
    SynchronizeSliceIndex(planeType, newIndex);
}
```

### 映射算法数学原理

切片索引映射使用以下数学公式:

**正向映射（归一化值 → 索引）:**
```
index = round(normalizedValue × (totalSlices - 1))
index = clamp(index, 0, totalSlices - 1)
```

**反向映射（索引 → 归一化值）:**
```
normalizedValue = index / (totalSlices - 1)
```

### 边界条件处理

算法需要处理多种边界条件:

```csharp
private int ConvertNormalizedToIndex(float normalizedValue, int totalSlices)
{
    // 处理无效输入
    if (totalSlices <= 0) return 0;
    if (totalSlices == 1) return 0;

    // 处理边界值
    if (normalizedValue <= 0.0f) return 0;
    if (normalizedValue >= 1.0f) return totalSlices - 1;

    // 正常映射
    float exactIndex = normalizedValue * (totalSlices - 1);
    int roundedIndex = Mathf.RoundToInt(exactIndex);

    // 最终边界检查
    return Mathf.Clamp(roundedIndex, 0, totalSlices - 1);
}

private float ConvertIndexToNormalized(int index, int totalSlices)
{
    // 处理无效输入
    if (totalSlices <= 1) return 0.0f;

    // 边界检查
    index = Mathf.Clamp(index, 0, totalSlices - 1);

    // 计算归一化值
    return (float)index / (totalSlices - 1);
}
```

### 精度优化策略

为了提高用户体验，系统实现了精度优化:

```csharp
private void UpdateSliceSliderWithPrecision(DicomPlane.PlaneType planeType, int sliceIndex, int totalSlices)
{
    Slider targetSlider = GetSliderForPlaneType(planeType);
    if (targetSlider == null || totalSlices <= 1) return;

    // 计算精确的归一化值
    float exactNormalizedValue = (float)sliceIndex / (totalSlices - 1);
    
    // 应用最小步长约束
    float minStep = 1.0f / (totalSlices - 1);
    float quantizedValue = Mathf.Round(exactNormalizedValue / minStep) * minStep;
    
    // 更新滑块值
    targetSlider.Value = quantizedValue;
}
```

## 窗宽窗位映射算法

### 线性插值映射实现

窗宽窗位使用连续值映射，采用线性插值算法:

```csharp
private void OnWindowCenterSliderChanged(float normalizedValue)
{
    if (isUpdatingUI || mprViewer == null) return;

    // 线性插值计算实际窗位
    float center = Mathf.Lerp(windowCenterMin, windowCenterMax, normalizedValue);
    float width = mprViewer.GetWindowWidth();

    // 应用窗宽窗位
    UpdateWindowLevelAcrossComponents(center, width);
}

private void OnWindowWidthSliderChanged(float normalizedValue)
{
    if (isUpdatingUI || mprViewer == null) return;

    // 线性插值计算实际窗宽
    float center = mprViewer.GetWindowCenter();
    float width = Mathf.Lerp(windowWidthMin, windowWidthMax, normalizedValue);

    // 应用窗宽窗位
    UpdateWindowLevelAcrossComponents(center, width);
}
```

### 反向插值算法

数据模型变化时需要反向计算归一化值:

```csharp
private void HandleWindowLevelChanged(float center, float width)
{
    if (isUpdatingUI) return;

    isUpdatingUI = true;
    try
    {
        // 反向线性插值计算归一化值
        float normalizedCenter = Mathf.InverseLerp(windowCenterMin, windowCenterMax, center);
        float normalizedWidth = Mathf.InverseLerp(windowWidthMin, windowWidthMax, width);

        // 更新滑块值
        if (windowCenterSlider != null)
        {
            windowCenterSlider.Value = normalizedCenter;
        }
        
        if (windowWidthSlider != null)
        {
            windowWidthSlider.Value = normalizedWidth;
        }
    }
    finally
    {
        isUpdatingUI = false;
    }
}
```

### 映射范围动态调整

系统支持运行时调整映射范围:

```csharp
public void SetWindowCenterRange(float min, float max)
{
    if (min >= max)
    {
        Debug.LogError("窗位范围无效:最小值必须小于最大值");
        return;
    }

    windowCenterMin = min;
    windowCenterMax = max;

    // 重新计算当前滑块值
    if (mprViewer != null && windowCenterSlider != null)
    {
        float currentCenter = mprViewer.GetWindowCenter();
        float normalizedValue = Mathf.InverseLerp(min, max, currentCenter);
        
        isUpdatingUI = true;
        windowCenterSlider.Value = normalizedValue;
        isUpdatingUI = false;
    }
}

public void SetWindowWidthRange(float min, float max)
{
    if (min >= max || min <= 0)
    {
        Debug.LogError("窗宽范围无效:最小值必须大于0且小于最大值");
        return;
    }

    windowWidthMin = min;
    windowWidthMax = max;

    // 重新计算当前滑块值
    if (mprViewer != null && windowWidthSlider != null)
    {
        float currentWidth = mprViewer.GetWindowWidth();
        float normalizedValue = Mathf.InverseLerp(min, max, currentWidth);
        
        isUpdatingUI = true;
        windowWidthSlider.Value = normalizedValue;
        isUpdatingUI = false;
    }
}
```

## 高级映射功能

### 非线性映射支持

对于某些特殊需求，系统支持非线性映射:

```csharp
public enum MappingCurveType
{
    Linear,
    Exponential,
    Logarithmic,
    SmoothStep
}

private float ApplyMappingCurve(float normalizedValue, MappingCurveType curveType)
{
    switch (curveType)
    {
        case MappingCurveType.Linear:
            return normalizedValue;
            
        case MappingCurveType.Exponential:
            return normalizedValue * normalizedValue;
            
        case MappingCurveType.Logarithmic:
            return Mathf.Sqrt(normalizedValue);
            
        case MappingCurveType.SmoothStep:
            return normalizedValue * normalizedValue * (3.0f - 2.0f * normalizedValue);
            
        default:
            return normalizedValue;
    }
}

private float ReverseMappingCurve(float curvedValue, MappingCurveType curveType)
{
    switch (curveType)
    {
        case MappingCurveType.Linear:
            return curvedValue;
            
        case MappingCurveType.Exponential:
            return Mathf.Sqrt(curvedValue);
            
        case MappingCurveType.Logarithmic:
            return curvedValue * curvedValue;
            
        case MappingCurveType.SmoothStep:
            // SmoothStep的反函数需要数值求解
            return InverseSmoothStep(curvedValue);
            
        default:
            return curvedValue;
    }
}
```

### 自适应范围调整

系统能根据DICOM数据自动调整映射范围:

```csharp
private void AutoAdjustWindowLevelRanges(DicomSeries series)
{
    if (series == null) return;

    // 分析像素值分布
    var pixelStats = AnalyzePixelValueDistribution(series);
    
    // 基于统计信息调整窗位范围
    float centerMargin = (pixelStats.max - pixelStats.min) * 0.1f;
    SetWindowCenterRange(pixelStats.min - centerMargin, pixelStats.max + centerMargin);
    
    // 基于数据范围调整窗宽范围
    float maxWidth = pixelStats.max - pixelStats.min;
    SetWindowWidthRange(1.0f, maxWidth * 2.0f);
    
    Debug.Log($"自动调整映射范围:窗位[{windowCenterMin}, {windowCenterMax}], 窗宽[{windowWidthMin}, {windowWidthMax}]");
}

private struct PixelStatistics
{
    public float min;
    public float max;
    public float mean;
    public float stdDev;
}

private PixelStatistics AnalyzePixelValueDistribution(DicomSeries series)
{
    var stats = new PixelStatistics();
    
    float sum = 0;
    float sumSquares = 0;
    int totalPixels = 0;
    
    stats.min = float.MaxValue;
    stats.max = float.MinValue;
    
    // 遍历部分切片获取统计信息（性能优化）
    int sampleCount = Mathf.Min(series.SliceCount, 10);
    int step = Mathf.Max(1, series.SliceCount / sampleCount);
    
    for (int i = 0; i < series.SliceCount; i += step)
    {
        var slice = series.GetSlice(i);
        if (slice?.PixelData == null) continue;
        
        var pixelData = slice.PixelData;
        for (int j = 0; j < pixelData.Length; j++)
        {
            float value = pixelData[j];
            
            stats.min = Mathf.Min(stats.min, value);
            stats.max = Mathf.Max(stats.max, value);
            
            sum += value;
            sumSquares += value * value;
            totalPixels++;
        }
    }
    
    if (totalPixels > 0)
    {
        stats.mean = sum / totalPixels;
        stats.stdDev = Mathf.Sqrt((sumSquares / totalPixels) - (stats.mean * stats.mean));
    }
    
    return stats;
}
```

## 精度和性能优化

### 量化误差最小化

系统实现量化误差最小化算法:

```csharp
private float MinimizeQuantizationError(float targetValue, float minValue, float maxValue, int quantizationLevels)
{
    if (quantizationLevels <= 1) return minValue;
    
    // 计算量化步长
    float step = (maxValue - minValue) / (quantizationLevels - 1);
    
    // 找到最近的量化级别
    float normalizedTarget = (targetValue - minValue) / (maxValue - minValue);
    int closestLevel = Mathf.RoundToInt(normalizedTarget * (quantizationLevels - 1));
    
    // 计算量化后的值
    float quantizedValue = minValue + closestLevel * step;
    
    return quantizedValue;
}
```

### 缓存优化策略

对于频繁的映射计算，系统实现了结果缓存:

```csharp
private Dictionary<(float, int), int> indexMappingCache = new Dictionary<(float, int), int>();
private Dictionary<(int, int), float> normalizedMappingCache = new Dictionary<(int, int), float>();

private int GetCachedIndex(float normalizedValue, int totalSlices)
{
    var key = (normalizedValue, totalSlices);
    
    if (indexMappingCache.TryGetValue(key, out int cachedIndex))
    {
        return cachedIndex;
    }
    
    int computedIndex = ConvertNormalizedToIndex(normalizedValue, totalSlices);
    
    // 限制缓存大小
    if (indexMappingCache.Count > 1000)
    {
        indexMappingCache.Clear();
    }
    
    indexMappingCache[key] = computedIndex;
    return computedIndex;
}

private void ClearMappingCache()
{
    indexMappingCache.Clear();
    normalizedMappingCache.Clear();
}
```