---
title: 体积数据访问与使用
---
# 体积数据访问与使用

加载完成后，需要访问DicomSeries中的体积数据进行后续处理。本文介绍如何正确获取和使用加载结果中的各种数据。

## 基本数据访问

### 1. 获取加载结果

```csharp
using UnityEngine;
using MedicalMR.DICOM.Loading;
using MedicalMR.DICOM.Core;

public class VolumeDataAccessor : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    private DicomSeries loadedSeries;
    
    void Start()
    {
        loader.OnLoadingComplete.AddListener(OnDataLoaded);
        loader.StartLoading();
    }
    
    private void OnDataLoaded(object result, Vector3Int dimensions, 
                              Vector3 spacing, Vector3 origin)
    {
        // 获取DicomSeries对象
        loadedSeries = result as DicomSeries;
        
        if (loadedSeries != null)
        {
            Debug.Log("体积数据加载完成，开始访问数据...");
            AccessVolumeProperties(dimensions, spacing, origin);
            AccessSliceData();
        }
    }
    
    private void AccessVolumeProperties(Vector3Int dimensions, 
                                       Vector3 spacing, Vector3 origin)
    {
        // 体积几何信息
        Debug.Log($"体积尺寸: {dimensions.x} x {dimensions.y} x {dimensions.z}");
        Debug.Log($"体素间距: {spacing.x:F2} x {spacing.y:F2} x {spacing.z:F2} mm");
        Debug.Log($"体积原点: ({origin.x:F2}, {origin.y:F2}, {origin.z:F2})");
        
        // 计算体积的物理尺寸
        Vector3 physicalSize = new Vector3(
            dimensions.x * spacing.x,
            dimensions.y * spacing.y, 
            dimensions.z * spacing.z
        );
        Debug.Log($"物理尺寸: {physicalSize.x:F1} x {physicalSize.y:F1} x {physicalSize.z:F1} mm");
        
        // 通过DicomSeries属性访问（等效方式）
        Debug.Log($"验证 - Series尺寸: {loadedSeries.Dimensions}");
        Debug.Log($"验证 - Series间距: {loadedSeries.Spacing}");
        Debug.Log($"验证 - Series原点: {loadedSeries.Origin}");
    }
}
```

### 2. 访问切片数据

```csharp
public class SliceDataAccessor : MonoBehaviour
{
    private DicomSeries series;
    
    public void AccessSliceData()
    {
        if (series == null) return;
        
        // 获取切片集合（只读访问）
        var slices = series.Slices;
        Debug.Log($"总切片数: {slices.Count}");
        
        // 访问单个切片
        for (int i = 0; i < slices.Count; i++)
        {
            DicomSlice slice = series.GetSlice(i);
            if (slice != null)
            {
                LogSliceInfo(slice, i);
                
                // 只处理前几张切片以避免日志过多
                if (i >= 3) break;
            }
        }
        
        // 访问特定位置的切片
        AccessSpecificSlices();
    }
    
    private void LogSliceInfo(DicomSlice slice, int index)
    {
        Debug.Log($"切片 {index}:");
        Debug.Log($"  尺寸: {slice.Width} x {slice.Height}");
        Debug.Log($"  位置: {slice.ImagePosition}");
        Debug.Log($"  像素间距: {slice.PixelSpacing}");
        Debug.Log($"  切片厚度: {slice.SliceThickness:F2} mm");
        Debug.Log($"  序列索引: {slice.SequenceIndex}");
        Debug.Log($"  文件路径: {slice.FilePath}");
        
        // 像素数据信息
        if (slice.PixelData != null)
        {
            Debug.Log($"  像素数据大小: {slice.PixelData.Length} 字节");
        }
    }
    
    private void AccessSpecificSlices()
    {
        int sliceCount = series.Slices.Count;
        
        // 访问第一张切片
        DicomSlice firstSlice = series.GetSlice(0);
        Debug.Log($"第一张切片位置: {firstSlice?.ImagePosition}");
        
        // 访问中间切片
        DicomSlice middleSlice = series.GetSlice(sliceCount / 2);
        Debug.Log($"中间切片位置: {middleSlice?.ImagePosition}");
        
        // 访问最后一张切片
        DicomSlice lastSlice = series.GetSlice(sliceCount - 1);
        Debug.Log($"最后切片位置: {lastSlice?.ImagePosition}");
    }
}
```

## 纹理数据获取

### 1. 轴向切片纹理

```csharp
public class AxialTextureAccessor : MonoBehaviour
{
    [SerializeField] private DicomSeries series;
    [SerializeField] private UnityEngine.UI.RawImage displayImage;
    
    [Header("窗位窗宽设置")]
    [SerializeField] private float windowCenter = 1500f;
    [SerializeField] private float windowWidth = 2000f;
    
    private int currentSliceIndex = 0;
    
    public void DisplayAxialSlice(int sliceIndex)
    {
        if (series == null || sliceIndex < 0 || sliceIndex >= series.Slices.Count)
        {
            Debug.LogWarning($"无效的切片索引: {sliceIndex}");
            return;
        }
        
        currentSliceIndex = sliceIndex;
        
        // 获取轴向切片纹理
        Texture2D axialTexture = series.GetAxialTexture(sliceIndex, windowCenter, windowWidth);
        
        if (axialTexture != null)
        {
            displayImage.texture = axialTexture;
            Debug.Log($"显示轴向切片 {sliceIndex}, 纹理尺寸: {axialTexture.width} x {axialTexture.height}");
        }
        else
        {
            Debug.LogError($"无法获取切片 {sliceIndex} 的纹理");
        }
    }
    
    public void NextSlice()
    {
        int nextIndex = currentSliceIndex + 1;
        if (nextIndex < series.Slices.Count)
        {
            DisplayAxialSlice(nextIndex);
        }
    }
    
    public void PreviousSlice()
    {
        int prevIndex = currentSliceIndex - 1;
        if (prevIndex >= 0)
        {
            DisplayAxialSlice(prevIndex);
        }
    }
    
    public void UpdateWindowLevel(float newCenter, float newWidth)
    {
        windowCenter = newCenter;
        windowWidth = newWidth;
        
        // 重新生成当前切片纹理
        DisplayAxialSlice(currentSliceIndex);
    }
}
```

### 2. 矢状面和冠状面纹理

```csharp
public class MultiPlanarTextureAccessor : MonoBehaviour
{
    [SerializeField] private DicomSeries series;
    [SerializeField] private UnityEngine.UI.RawImage sagittalImage;
    [SerializeField] private UnityEngine.UI.RawImage coronalImage;
    
    [Header("切片位置")]
    [SerializeField] private int sagittalIndex = 256; // X轴索引
    [SerializeField] private int coronalIndex = 256;  // Y轴索引
    
    public void GenerateSagittalTexture()
    {
        if (series == null) return;
        
        Debug.Log($"生成矢状面纹理，X索引: {sagittalIndex}");
        
        Texture2D sagittalTexture = series.CreateSagittalTexture(
            sagittalIndex, windowCenter, windowWidth);
            
        if (sagittalTexture != null)
        {
            sagittalImage.texture = sagittalTexture;
            Debug.Log($"矢状面纹理生成完成: {sagittalTexture.width} x {sagittalTexture.height}");
        }
    }
    
    public void GenerateCoronalTexture()
    {
        if (series == null) return;
        
        Debug.Log($"生成冠状面纹理，Y索引: {coronalIndex}");
        
        Texture2D coronalTexture = series.CreateCoronalTexture(
            coronalIndex, windowCenter, windowWidth);
            
        if (coronalTexture != null)
        {
            coronalImage.texture = coronalTexture;
            Debug.Log($"冠状面纹理生成完成: {coronalTexture.width} x {coronalTexture.height}");
        }
    }
    
    // 异步生成纹理
    public void GenerateSagittalTextureAsync()
    {
        if (series == null) return;
        
        StartCoroutine(series.CreateSagittalTextureCoroutine(
            sagittalIndex, windowCenter, windowWidth, OnSagittalTextureComplete));
    }
    
    private void OnSagittalTextureComplete(Texture2D texture)
    {
        if (texture != null)
        {
            sagittalImage.texture = texture;
            Debug.Log("异步矢状面纹理生成完成");
        }
    }
}
```

## 窗位窗宽处理

### 1. 动态调整窗位窗宽

```csharp
public class WindowLevelController : MonoBehaviour
{
    [SerializeField] private DicomSeries series;
    [SerializeField] private UnityEngine.UI.RawImage targetImage;
    [SerializeField] private UnityEngine.UI.Slider centerSlider;
    [SerializeField] private UnityEngine.UI.Slider widthSlider;
    
    private int currentSliceIndex = 0;
    private float currentCenter;
    private float currentWidth;
    
    void Start()
    {
        // 使用默认窗位窗宽
        currentCenter = series.DefaultWindowCenter;
        currentWidth = series.DefaultWindowWidth;
        
        // 初始化滑块
        centerSlider.value = currentCenter;
        widthSlider.value = currentWidth;
        
        // 绑定滑块事件
        centerSlider.onValueChanged.AddListener(OnWindowCenterChanged);
        widthSlider.onValueChanged.AddListener(OnWindowWidthChanged);
        
        Debug.Log($"默认窗位: {currentCenter}, 默认窗宽: {currentWidth}");
    }
    
    private void OnWindowCenterChanged(float newCenter)
    {
        currentCenter = newCenter;
        RefreshTexture();
    }
    
    private void OnWindowWidthChanged(float newWidth)
    {
        currentWidth = newWidth;
        RefreshTexture();
    }
    
    private void RefreshTexture()
    {
        Texture2D texture = series.GetAxialTexture(
            currentSliceIndex, currentCenter, currentWidth);
            
        if (texture != null)
        {
            targetImage.texture = texture;
        }
    }
    
    // 预设窗位窗宽配置
    public void ApplyPresetWindowLevel(string presetName)
    {
        switch (presetName.ToLower())
        {
            case "lung":
                SetWindowLevel(-600, 1200);
                break;
            case "bone":
                SetWindowLevel(400, 1000);
                break;
            case "soft_tissue":
                SetWindowLevel(40, 400);
                break;
            case "brain":
                SetWindowLevel(40, 80);
                break;
            default:
                SetWindowLevel(series.DefaultWindowCenter, series.DefaultWindowWidth);
                break;
        }
    }
    
    private void SetWindowLevel(float center, float width)
    {
        currentCenter = center;
        currentWidth = width;
        
        centerSlider.value = center;
        widthSlider.value = width;
        
        RefreshTexture();
        
        Debug.Log($"应用窗位窗宽: 中心={center}, 宽度={width}");
    }
}
```

## 体积数据分析

### 1. 体积统计信息

```csharp
public class VolumeStatisticsAnalyzer : MonoBehaviour
{
    public void AnalyzeVolumeStatistics(DicomSeries series)
    {
        if (series == null) return;
        
        Debug.Log("=== 体积统计分析 ===");
        
        // 基本信息
        var dimensions = series.Dimensions;
        var spacing = series.Spacing;
        
        Debug.Log($"体积尺寸: {dimensions}");
        Debug.Log($"体素间距: {spacing}");
        
        // 计算体积大小
        float volumeInMM3 = dimensions.x * dimensions.y * dimensions.z * 
                           spacing.x * spacing.y * spacing.z;
        float volumeInML = volumeInMM3 / 1000f; // 转换为毫升
        
        Debug.Log($"体积大小: {volumeInML:F2} mL");
        
        // 内存使用估算
        long pixelDataSize = 0;
        foreach (var slice in series.Slices)
        {
            if (slice.PixelData != null)
            {
                pixelDataSize += slice.PixelData.Length;
            }
        }
        
        float memoryUsageMB = pixelDataSize / (1024f * 1024f);
        Debug.Log($"像素数据内存使用: {memoryUsageMB:F2} MB");
        
        // 切片间距分析
        AnalyzeSliceSpacing(series);
    }
    
    private void AnalyzeSliceSpacing(DicomSeries series)
    {
        if (series.Slices.Count < 2) return;
        
        Debug.Log("=== 切片间距分析 ===");
        
        List<float> spacings = new List<float>();
        
        for (int i = 1; i < series.Slices.Count; i++)
        {
            Vector3 pos1 = series.GetSlice(i - 1).ImagePosition;
            Vector3 pos2 = series.GetSlice(i).ImagePosition;
            
            float spacing = Vector3.Distance(pos1, pos2);
            spacings.Add(spacing);
        }
        
        if (spacings.Count > 0)
        {
            float minSpacing = spacings.Min();
            float maxSpacing = spacings.Max();
            float avgSpacing = spacings.Average();
            
            Debug.Log($"切片间距 - 最小: {minSpacing:F2}mm, 最大: {maxSpacing:F2}mm, 平均: {avgSpacing:F2}mm");
            
            // 检查间距一致性
            float spacingVariation = maxSpacing - minSpacing;
            if (spacingVariation > 0.1f) // 0.1mm容差
            {
                Debug.LogWarning($"切片间距不一致，变化范围: {spacingVariation:F2}mm");
            }
            else
            {
                Debug.Log("切片间距一致");
            }
        }
    }
}
```

### 2. 数据完整性检查

```csharp
public class DataIntegrityChecker : MonoBehaviour
{
    public bool CheckDataIntegrity(DicomSeries series)
    {
        if (series == null)
        {
            Debug.LogError("DicomSeries为空");
            return false;
        }
        
        Debug.Log("=== 数据完整性检查 ===");
        
        bool isValid = true;
        
        // 检查切片数量
        if (series.Slices.Count == 0)
        {
            Debug.LogError("没有加载任何切片");
            return false;
        }
        
        Debug.Log($"切片数量: {series.Slices.Count}");
        
        // 检查切片尺寸一致性
        isValid &= CheckSliceDimensionsConsistency(series);
        
        // 检查像素数据完整性
        isValid &= CheckPixelDataIntegrity(series);
        
        // 检查元数据完整性
        isValid &= CheckMetadataIntegrity(series);
        
        Debug.Log($"数据完整性检查结果: {(isValid ? "通过" : "失败")}");
        return isValid;
    }
    
    private bool CheckSliceDimensionsConsistency(DicomSeries series)
    {
        if (series.Slices.Count == 0) return false;
        
        int baseWidth = series.GetSlice(0).Width;
        int baseHeight = series.GetSlice(0).Height;
        
        for (int i = 1; i < series.Slices.Count; i++)
        {
            var slice = series.GetSlice(i);
            if (slice.Width != baseWidth || slice.Height != baseHeight)
            {
                Debug.LogError($"切片 {i} 尺寸不一致: {slice.Width}x{slice.Height} vs {baseWidth}x{baseHeight}");
                return false;
            }
        }
        
        Debug.Log($"所有切片尺寸一致: {baseWidth} x {baseHeight}");
        return true;
    }
    
    private bool CheckPixelDataIntegrity(DicomSeries series)
    {
        int nullPixelDataCount = 0;
        int emptyPixelDataCount = 0;
        
        foreach (var slice in series.Slices)
        {
            if (slice.PixelData == null)
            {
                nullPixelDataCount++;
            }
            else if (slice.PixelData.Length == 0)
            {
                emptyPixelDataCount++;
            }
        }
        
        if (nullPixelDataCount > 0)
        {
            Debug.LogError($"{nullPixelDataCount} 个切片的像素数据为null");
        }
        
        if (emptyPixelDataCount > 0)
        {
            Debug.LogError($"{emptyPixelDataCount} 个切片的像素数据为空");
        }
        
        bool pixelDataValid = nullPixelDataCount == 0 && emptyPixelDataCount == 0;
        Debug.Log($"像素数据完整性: {(pixelDataValid ? "完整" : "有缺失")}");
        
        return pixelDataValid;
    }
    
    private bool CheckMetadataIntegrity(DicomSeries series)
    {
        var dimensions = series.Dimensions;
        var spacing = series.Spacing;
        var origin = series.Origin;
        
        bool dimensionsValid = dimensions.x > 0 && dimensions.y > 0 && dimensions.z > 0;
        bool spacingValid = spacing.x > 0 && spacing.y > 0 && spacing.z > 0;
        
        Debug.Log($"体积尺寸有效性: {dimensionsValid}");
        Debug.Log($"体素间距有效性: {spacingValid}");
        Debug.Log($"体积原点: {origin}");
        
        return dimensionsValid && spacingValid;
    }
}
```

## 资源管理

### 1. 内存监控

```csharp
public class VolumeMemoryMonitor : MonoBehaviour
{
    [SerializeField] private bool enableMonitoring = true;
    [SerializeField] private float monitorInterval = 5f;
    
    private DicomSeries monitoredSeries;
    
    void Start()
    {
        if (enableMonitoring)
        {
            InvokeRepeating(nameof(MonitorMemoryUsage), 1f, monitorInterval);
        }
    }
    
    public void SetMonitoredSeries(DicomSeries series)
    {
        monitoredSeries = series;
    }
    
    private void MonitorMemoryUsage()
    {
        if (monitoredSeries == null) return;
        
        long totalMemory = System.GC.GetTotalMemory(false);
        float memoryMB = totalMemory / (1024f * 1024f);
        
        Debug.Log($"当前内存使用: {memoryMB:F1} MB");
        
        // 计算DicomSeries占用的内存
        long seriesMemory = CalculateSeriesMemoryUsage(monitoredSeries);
        float seriesMemoryMB = seriesMemory / (1024f * 1024f);
        
        Debug.Log($"DicomSeries内存占用: {seriesMemoryMB:F1} MB");
        
        // 内存压力检测
        if (memoryMB > 1000f) // 1GB阈值
        {
            Debug.LogWarning("内存使用过高，建议执行清理");
            
            if (memoryMB > 1500f) // 1.5GB强制清理
            {
                Debug.LogError("内存压力过大，执行强制垃圾回收");
                System.GC.Collect();
            }
        }
    }
    
    private long CalculateSeriesMemoryUsage(DicomSeries series)
    {
        long totalSize = 0;
        
        foreach (var slice in series.Slices)
        {
            if (slice.PixelData != null)
            {
                totalSize += slice.PixelData.Length;
            }
        }
        
        return totalSize;
    }
}
```

这些功能确保了体积数据的正确访问和有效使用，为后续的医学影像处理和可视化提供了坚实的基础。