---
title: 坐标映射与几何计算
---
# 坐标映射与几何计算

本页介绍DicomTextureCreator如何处理3D体素坐标到2D纹理像素的映射转换。

## 坐标系统概述

医学影像处理涉及多个坐标系统的转换:

- **体素坐标**:3D体积中的整数坐标 (x, y, z)
- **切片坐标**:2D切片中的像素坐标 (u, v)  
- **世界坐标**:物理空间中的真实坐标
- **纹理坐标**:Unity纹理中的像素位置

```csharp
// 坐标映射器依赖
private DicomCoordinateMapper _coordinateMapper;
```

## 平面维度计算

`CalculatePlaneDimensions()` 计算各平面的2D纹理尺寸:

```csharp
// 获取各平面的纹理尺寸
var planeSizes = _coordinateMapper.CalculatePlaneDimensions(_dicomSeries.Dimensions);

int axialWidth = planeSizes.axial.x;      // 轴向面宽度
int axialHeight = planeSizes.axial.y;     // 轴向面高度

int sagittalWidth = planeSizes.sagittal.x;   // 矢状面宽度  
int sagittalHeight = planeSizes.sagittal.y;  // 矢状面高度

int coronalWidth = planeSizes.coronal.x;     // 冠状面宽度
int coronalHeight = planeSizes.coronal.y;    // 冠状面高度
```

### 尺寸计算原理

```csharp
// 伪代码示例
public (Vector2Int axial, Vector2Int sagittal, Vector2Int coronal) CalculatePlaneDimensions(Vector3Int volumeDimensions)
{
    Vector2Int axial = new Vector2Int(volumeDimensions.x, volumeDimensions.y);
    Vector2Int sagittal = new Vector2Int(volumeDimensions.z, volumeDimensions.y);
    Vector2Int coronal = new Vector2Int(volumeDimensions.x, volumeDimensions.z);
    
    return (axial, sagittal, coronal);
}
```

典型的体积维度转换:
```
体积维度: 512 × 512 × 300 (width × height × slices)
├── 轴向面: 512 × 512 (原始切片尺寸)
├── 矢状面: 300 × 512 (slices × height)
└── 冠状面: 512 × 300 (width × slices)
```

## 切片索引映射

### 轴向切片映射

轴向切片直接对应z轴索引:

```csharp
public Texture2D GetAxialTexture(int index, float windowCenter, float windowWidth)
{
    // 轴向索引直接对应切片管理器中的索引
    if (index < 0 || index >= _sliceManager.SliceCount)
        return null;
        
    DicomSlice slice = _sliceManager.GetSlice(index);
    // ... 纹理生成逻辑
}
```

### 矢状面索引映射

矢状面索引对应x轴坐标:

```csharp
public Texture2D CreateSagittalTexture(int xIndex, float windowCenter, float windowWidth)
{
    // 验证x轴索引范围
    int maxIndex = _coordinateMapper.GetSagittalDimension(_dicomSeries.Dimensions);
    if (xIndex < 0 || xIndex >= maxIndex) 
        return null;
        
    // 映射到体素坐标
    Vector3Int baseCoord = _coordinateMapper.MapSagittalIndexToVolume(xIndex, _dicomSeries.Dimensions);
    // ... 纹理生成逻辑
}
```

### 冠状面索引映射

冠状面索引对应y轴坐标:

```csharp
public Texture2D CreateCoronalTexture(int yIndex, float windowCenter, float windowWidth)
{
    // 验证y轴索引范围
    int maxIndex = _coordinateMapper.GetCoronalDimension(_dicomSeries.Dimensions);
    if (yIndex < 0 || yIndex >= maxIndex) 
        return null;
        
    // 映射到体素坐标
    Vector3Int baseCoord = _coordinateMapper.MapCoronalIndexToVolume(yIndex, _dicomSeries.Dimensions);
    // ... 纹理生成逻辑
}
```

## 体素到纹理映射

### 矢状面体素提取

```csharp
private void ExtractSagittalTextureFromVolume(Vector3Int baseCoord, int width, int height, Color32[] colors)
{
    var axesMapping = _coordinateMapper.GetCurrentAxesMapping();
    int sagittalAxis = axesMapping.sagittal;  // 通常是x轴 (0)
    int[] remainingAxes = _coordinateMapper.GetRemainingAxes(sagittalAxis); // [y, z]
    
    for (int y = 0; y < height; y++)
    {
        int rowOffset = y * width;
        
        for (int x = 0; x < width; x++)
        {
            // 构建体素坐标
            Vector3Int voxelCoord = new Vector3Int(baseCoord.x, baseCoord.y, baseCoord.z);
            voxelCoord[remainingAxes[0]] = x;  // 映射到z轴
            voxelCoord[remainingAxes[1]] = y;  // 映射到y轴
            
            // 计算线性索引
            int voxelIndex = voxelCoord.z * _cachedDimensions.x * _cachedDimensions.y +
                           voxelCoord.y * _cachedDimensions.x +
                           voxelCoord.x;
            
            // 提取颜色值
            if (voxelIndex >= 0 && voxelIndex < _cachedVolumeData.Length)
            {
                colors[rowOffset + x] = _cachedVolumeData[voxelIndex];
            }
        }
    }
}
```

### 冠状面体素提取

```csharp
private void ExtractCoronalTextureFromVolume(Vector3Int baseCoord, int width, int height, Color32[] colors)
{
    var axesMapping = _coordinateMapper.GetCurrentAxesMapping();
    int coronalAxis = axesMapping.coronal;    // 通常是y轴 (1)
    int[] remainingAxes = _coordinateMapper.GetRemainingAxes(coronalAxis); // [x, z]
    
    for (int y = 0; y < height; y++)
    {
        int rowOffset = y * width;
        
        for (int x = 0; x < width; x++)
        {
            // 构建体素坐标
            Vector3Int voxelCoord = new Vector3Int(baseCoord.x, baseCoord.y, baseCoord.z);
            voxelCoord[remainingAxes[0]] = x;  // 映射到x轴
            voxelCoord[remainingAxes[1]] = y;  // 映射到z轴
            
            // 计算线性索引（Z-Y-X顺序）
            int voxelIndex = voxelCoord.z * _cachedDimensions.x * _cachedDimensions.y +
                           voxelCoord.y * _cachedDimensions.x +
                           voxelCoord.x;
            
            // 提取颜色值
            if (voxelIndex >= 0 && voxelIndex < _cachedVolumeData.Length)
            {
                colors[rowOffset + x] = _cachedVolumeData[voxelIndex];
            }
        }
    }
}
```

## 轴映射管理

### 当前轴映射获取

```csharp
// 获取当前的坐标轴映射
var axesMapping = _coordinateMapper.GetCurrentAxesMapping();

int axialAxis = axesMapping.axial;      // 轴向对应的轴（通常是z轴 = 2）
int sagittalAxis = axesMapping.sagittal; // 矢状对应的轴（通常是x轴 = 0）
int coronalAxis = axesMapping.coronal;   // 冠状对应的轴（通常是y轴 = 1）
```

### 剩余轴计算

```csharp
// 获取除指定轴外的其他两个轴
int[] remainingAxes = _coordinateMapper.GetRemainingAxes(sagittalAxis);
// 如果sagittalAxis=0，则返回[1, 2]（y轴和z轴）
```

## 回退算法的坐标映射

当体素缓存不可用时，使用回退算法逐像素映射:

```csharp
// 矢状面回退算法示例
for (int y = 0; y < height; y++)
{
    for (int x = 0; x < width; x++)
    {
        // 计算对应的体素坐标
        Vector3Int voxelCoord = new Vector3Int();
        voxelCoord[axesMapping.sagittal] = xIndex;     // 固定矢状索引
        voxelCoord[remainingAxes[0]] = x;              // 纹理x → 体积坐标
        voxelCoord[remainingAxes[1]] = y;              // 纹理y → 体积坐标
        
        // 获取对应的轴向切片索引
        int axialIndex = voxelCoord[axesMapping.axial];
        
        if (axialIndex >= 0 && axialIndex < _sliceManager.SliceCount)
        {
            // 映射到轴向切片的像素坐标
            Vector2Int pixelPos = _coordinateMapper.MapVoxelToAxialPixel(voxelCoord);
            
            // 从轴向切片获取像素值
            Color32 pixelColor = GetAxialPixel(axialIndex, pixelPos);
            colors[y * width + x] = pixelColor;
        }
    }
}
```

### 体素到轴向像素映射

```csharp
public Vector2Int MapVoxelToAxialPixel(Vector3Int voxelCoord)
{
    // 轴向切片通常使用x-y平面
    return new Vector2Int(voxelCoord.x, voxelCoord.y);
}
```

## 坐标验证与边界检查

### 索引范围验证

```csharp
public bool IsValidSliceIndex(DicomPlane.PlaneType planeType, int index)
{
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            return index >= 0 && index < _sliceManager.SliceCount;
            
        case DicomPlane.PlaneType.Sagittal:
            int maxSagittal = _coordinateMapper.GetSagittalDimension(_dicomSeries.Dimensions);
            return index >= 0 && index < maxSagittal;
            
        case DicomPlane.PlaneType.Coronal:
            int maxCoronal = _coordinateMapper.GetCoronalDimension(_dicomSeries.Dimensions);
            return index >= 0 && index < maxCoronal;
            
        default:
            return false;
    }
}
```

### 体素坐标验证

```csharp
public bool IsValidVoxelCoordinate(Vector3Int voxelCoord)
{
    Vector3Int dimensions = _dicomSeries.Dimensions;
    
    return voxelCoord.x >= 0 && voxelCoord.x < dimensions.x &&
           voxelCoord.y >= 0 && voxelCoord.y < dimensions.y &&
           voxelCoord.z >= 0 && voxelCoord.z < dimensions.z;
}
```

### 像素位置验证

```csharp
private bool IsValidPixelPosition(Vector2Int pixelPos, Texture2D texture)
{
    return pixelPos.x >= 0 && pixelPos.x < texture.width &&
           pixelPos.y >= 0 && pixelPos.y < texture.height;
}
```

## 性能优化建议

### 预计算坐标映射

```csharp
// 预计算轴映射，避免重复查询
private struct CachedAxesMapping
{
    public int axial;
    public int sagittal;
    public int coronal;
    public int[] sagittalRemaining;
    public int[] coronalRemaining;
}

private CachedAxesMapping _cachedMapping;

private void InitializeCachedMapping()
{
    var mapping = _coordinateMapper.GetCurrentAxesMapping();
    _cachedMapping = new CachedAxesMapping
    {
        axial = mapping.axial,
        sagittal = mapping.sagittal,
        coronal = mapping.coronal,
        sagittalRemaining = _coordinateMapper.GetRemainingAxes(mapping.sagittal),
        coronalRemaining = _coordinateMapper.GetRemainingAxes(mapping.coronal)
    };
}
```

### 批量坐标转换

```csharp
// 批量处理避免频繁的方法调用
private void BatchProcessVoxelCoordinates(Vector3Int baseCoord, int width, int height, 
                                         int[] remainingAxes, Action<Vector3Int, int> processor)
{
    for (int y = 0; y < height; y++)
    {
        for (int x = 0; x < width; x++)
        {
            Vector3Int voxelCoord = baseCoord;
            voxelCoord[remainingAxes[0]] = x;
            voxelCoord[remainingAxes[1]] = y;
            
            int linearIndex = y * width + x;
            processor(voxelCoord, linearIndex);
        }
    }
}
```

## 调试工具

### 坐标映射可视化

```csharp
#if UNITY_EDITOR
public void DebugDrawCoordinateMapping(int sagittalIndex, int coronalIndex)
{
    if (_enableDebugLog)
    {
        Vector3Int sagittalBase = _coordinateMapper.MapSagittalIndexToVolume(sagittalIndex, _dicomSeries.Dimensions);
        Vector3Int coronalBase = _coordinateMapper.MapCoronalIndexToVolume(coronalIndex, _dicomSeries.Dimensions);
        
        Debug.Log($"矢状面索引 {sagittalIndex} → 体素基坐标 {sagittalBase}");
        Debug.Log($"冠状面索引 {coronalIndex} → 体素基坐标 {coronalBase}");
        
        var planeSizes = _coordinateMapper.CalculatePlaneDimensions(_dicomSeries.Dimensions);
        Debug.Log($"纹理尺寸 - 矢状: {planeSizes.sagittal}, 冠状: {planeSizes.coronal}");
    }
}
#endif
```

正确的坐标映射是实现准确MPR重建的基础，理解各坐标系统间的转换关系对于开发和调试都至关重要。