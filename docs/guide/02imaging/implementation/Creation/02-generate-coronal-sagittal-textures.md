---
title: 生成冠状和矢状纹理
---
# 生成冠状和矢状纹理

本页介绍如何生成冠状面和矢状面纹理，包括快速路径和回退算法的实现细节。

## 矢状面纹理生成

矢状面纹理需要从多个轴向切片中重新采样像素:

```csharp
DicomTextureCreator creator = GetTextureCreator();

// 生成第128列的矢状面纹理
Texture2D sagittalTexture = creator.CreateSagittalTexture(128, 40.0f, 400.0f);

if (sagittalTexture != null)
{
    sagittalImage.texture = sagittalTexture;
}
```

### 生成流程详解

`CreateSagittalTexture()` 方法的执行步骤:

1. **索引和维度验证**:
   ```csharp
   int maxIndex = _coordinateMapper.GetSagittalDimension(_dicomSeries.Dimensions);
   if (_sliceManager.SliceCount == 0 || xIndex < 0 || xIndex >= maxIndex) 
       return null;
   ```

2. **缓存查询**:
   ```csharp
   string windowLevelKey = _textureCache.GetWindowLevelKey(windowCenter, windowWidth);
   string cacheKey = _textureCache.GetTextureCacheKey(DicomPlane.PlaneType.Sagittal, xIndex, windowLevelKey);
   
   Texture2D texture = _textureCache.GetTextureFromCache(DicomPlane.PlaneType.Sagittal, cacheKey);
   if (texture != null)
       return texture;
   ```

3. **计算纹理尺寸**:
   ```csharp
   var planeSizes = _coordinateMapper.CalculatePlaneDimensions(_dicomSeries.Dimensions);
   int width = planeSizes.sagittal.x;
   int height = planeSizes.sagittal.y;
   
   if (width <= 0 || height <= 0)
   {
       Debug.LogError($"无效的矢状面尺寸: {width}x{height}");
       return null;
   }
   ```

4. **选择生成策略**:
   ```csharp
   // 优先使用体素缓存快速路径
   if (!_volumeDataCached)
   {
       if (!CacheVolumeData(windowCenter, windowWidth))
       {
           // 回退到逐像素算法
           return FallbackCreateSagittalTexture(xIndex, windowCenter, windowWidth);
       }
   }
   ```

## 快速路径:体素缓存提取

当体素缓存可用时，使用快速提取算法:

```csharp
// 获取颜色缓冲区
Color32[] colors = GetColorBuffer($"sagittal_{width}x{height}", width * height);

// 计算基础坐标
Vector3Int baseCoord = _coordinateMapper.MapSagittalIndexToVolume(xIndex, _dicomSeries.Dimensions);

// 从体素缓存中高效提取
ExtractSagittalTextureFromVolume(baseCoord, width, height, colors);
```

### 体素提取实现

`ExtractSagittalTextureFromVolume()` 的核心逻辑:

```csharp
private void ExtractSagittalTextureFromVolume(Vector3Int baseCoord, int width, int height, Color32[] colors)
{
    var axesMapping = _coordinateMapper.GetCurrentAxesMapping();
    int sagittalAxis = axesMapping.sagittal;
    int[] remainingAxes = _coordinateMapper.GetRemainingAxes(sagittalAxis);
    
    // 批量归零颜色缓冲区
    for (int i = 0; i < colors.Length; i++)
    {
        colors[i] = new Color32(0, 0, 0, 255);
    }
    
    for (int y = 0; y < height; y++)
    {
        int rowOffset = y * width;
        
        for (int x = 0; x < width; x++)
        {
            // 计算体素坐标
            Vector3Int voxelCoord = new Vector3Int(baseCoord.x, baseCoord.y, baseCoord.z);
            voxelCoord[remainingAxes[0]] = x;
            voxelCoord[remainingAxes[1]] = y;
            
            // 计算线性索引
            int voxelIndex = voxelCoord.z * _cachedDimensions.x * _cachedDimensions.y +
                           voxelCoord.y * _cachedDimensions.x +
                           voxelCoord.x;
            
            // 边界检查并提取颜色
            if (voxelIndex >= 0 && voxelIndex < _cachedVolumeData.Length)
            {
                colors[rowOffset + x] = _cachedVolumeData[voxelIndex];
            }
        }
    }
}
```

## 回退路径:逐像素算法

当体素缓存不可用时，使用回退算法逐像素构建纹理:

```csharp
private Texture2D FallbackCreateSagittalTexture(int xIndex, float windowCenter, float windowWidth)
{
    // 计算纹理尺寸
    var planeSizes = _coordinateMapper.CalculatePlaneDimensions(_dicomSeries.Dimensions);
    int width = planeSizes.sagittal.x;
    int height = planeSizes.sagittal.y;
    
    Color32[] colors = GetColorBuffer($"sagittal_{width}x{height}", width * height);
    
    // 缓存切片纹理和像素数据
    Dictionary<int, Texture2D> textureCache = new Dictionary<int, Texture2D>();
    Dictionary<int, Color32[]> pixelsCache = new Dictionary<int, Color32[]>();
    
    var axesMapping = _coordinateMapper.GetCurrentAxesMapping();
    int[] remainingAxes = _coordinateMapper.GetRemainingAxes(axesMapping.sagittal);
    
    // 初始化颜色缓冲区
    for (int i = 0; i < colors.Length; i++)
    {
        colors[i] = new Color32(0, 0, 0, 255);
    }
    
    // 逐像素处理
    for (int y = 0; y < height; y++)
    {
        int rowOffset = y * width;
        
        for (int x = 0; x < width; x++)
        {
            // 计算对应的轴向切片索引
            Vector3Int voxelCoord = new Vector3Int();
            voxelCoord[axesMapping.sagittal] = xIndex;
            voxelCoord[remainingAxes[0]] = x;
            voxelCoord[remainingAxes[1]] = y;
            
            int axialIndex = voxelCoord[axesMapping.axial];
            
            if (axialIndex >= 0 && axialIndex < _sliceManager.SliceCount)
            {
                // 获取切片纹理（使用缓存）
                Texture2D tex = GetOrCreateSliceTexture(axialIndex, windowCenter, windowWidth, 
                                                       textureCache, pixelsCache);
                
                if (tex != null)
                {
                    // 映射到轴向切片上的像素坐标
                    Vector2Int pixelPos = _coordinateMapper.MapVoxelToAxialPixel(voxelCoord);
                    
                    if (IsValidPixelPosition(pixelPos, tex))
                    {
                        // 从缓存的像素数据中获取颜色
                        Color32[] pixelData = pixelsCache[axialIndex];
                        int pixelIndex = pixelPos.y * tex.width + pixelPos.x;
                        
                        if (pixelIndex >= 0 && pixelIndex < pixelData.Length)
                        {
                            colors[rowOffset + x] = pixelData[pixelIndex];
                        }
                    }
                }
            }
        }
    }
    
    // 创建最终纹理
    return CreateFinalTexture(colors, width, height, "Sagittal", xIndex, windowCenter, windowWidth);
}
```

### 切片纹理缓存

在回退算法中，缓存切片纹理避免重复生成:

```csharp
private Texture2D GetOrCreateSliceTexture(int axialIndex, float windowCenter, float windowWidth,
                                         Dictionary<int, Texture2D> textureCache,
                                         Dictionary<int, Color32[]> pixelsCache)
{
    if (!textureCache.TryGetValue(axialIndex, out Texture2D tex))
    {
        DicomSlice slice = _sliceManager.GetSlice(axialIndex);
        if (slice != null)
        {
            tex = slice.CreateTexture(windowCenter, windowWidth);
            textureCache[axialIndex] = tex;
            
            // 同时缓存像素数据
            if (tex != null)
            {
                Color32[] pixelData = tex.GetPixels32();
                pixelsCache[axialIndex] = pixelData;
            }
        }
    }
    
    return tex;
}
```

## 冠状面纹理生成

冠状面纹理的生成与矢状面类似，只是坐标轴不同:

```csharp
// 生成第80行的冠状面纹理
Texture2D coronalTexture = creator.CreateCoronalTexture(80, 40.0f, 400.0f);
```

### 关键差异

1. **维度计算**:
   ```csharp
   int maxIndex = _coordinateMapper.GetCoronalDimension(_dicomSeries.Dimensions);
   ```

2. **坐标映射**:
   ```csharp
   Vector3Int baseCoord = _coordinateMapper.MapCoronalIndexToVolume(yIndex, _dicomSeries.Dimensions);
   ```

3. **缓存键前缀**:
   ```csharp
   Color32[] colors = GetColorBuffer($"coronal_{width}x{height}", width * height);
   ```

## 异步版本

提供协程版本用于异步生成:

```csharp
// 异步生成矢状面纹理
StartCoroutine(creator.CreateSagittalTextureCoroutine(128, 40.0f, 400.0f, (texture) =>
{
    if (texture != null)
    {
        sagittalImage.texture = texture;
    }
}));

// 异步生成冠状面纹理
StartCoroutine(creator.CreateCoronalTextureCoroutine(80, 40.0f, 400.0f, (texture) =>
{
    if (texture != null)
    {
        coronalImage.texture = texture;
    }
}));
```

### 协程实现要点

```csharp
public IEnumerator CreateSagittalTextureCoroutine(int xIndex, float windowCenter, float windowWidth, 
                                                 Action<Texture2D> onComplete)
{
    // 验证参数
    int maxIndex = _coordinateMapper.GetSagittalDimension(_dicomSeries.Dimensions);
    if (_sliceManager.SliceCount == 0 || xIndex < 0 || xIndex >= maxIndex)
    {
        onComplete?.Invoke(null);
        yield break;
    }
    
    // 检查缓存
    string cacheKey = _textureCache.GetTextureCacheKey(DicomPlane.PlaneType.Sagittal, xIndex, windowLevelKey);
    Texture2D texture = _textureCache.GetTextureFromCache(DicomPlane.PlaneType.Sagittal, cacheKey);
    
    if (texture != null)
    {
        onComplete?.Invoke(texture);
        yield break;
    }
    
    // 检查处理状态，避免重复生成
    string processingKey = $"Sagittal_{xIndex}_{windowCenter}_{windowWidth}";
    if (_processingTextures.Contains(processingKey))
    {
        // 等待处理完成
        while (_processingTextures.Contains(processingKey))
        {
            yield return null;
        }
        
        // 重新查询缓存
        texture = _textureCache.GetTextureFromCache(DicomPlane.PlaneType.Sagittal, cacheKey);
        onComplete?.Invoke(texture);
        yield break;
    }
    
    // 标记正在处理
    _processingTextures.Add(processingKey);
    
    try
    {
        // 同步生成纹理
        texture = CreateSagittalTexture(xIndex, windowCenter, windowWidth);
        onComplete?.Invoke(texture);
    }
    finally
    {
        // 清理处理状态
        _processingTextures.Remove(processingKey);
    }
}
```

## 性能优化建议

### 优先使用体素缓存

```csharp
// 在应用启动时预缓存体素数据
public void PreCacheVolumeData()
{
    if (_rawVolumeData == null)
    {
        CacheVolumeData(_lastWindowCenter, _lastWindowWidth);
    }
}
```

### 智能预加载

```csharp
// 预加载相邻的矢状/冠状面
public void PreloadAdjacentPlanes(int sagittalIndex, int coronalIndex, int range = 2)
{
    for (int i = -range; i <= range; i++)
    {
        int sagIdx = sagittalIndex + i;
        int corIdx = coronalIndex + i;
        
        if (sagIdx >= 0 && sagIdx < maxSagittalIndex)
        {
            CreateSagittalTexture(sagIdx, _lastWindowCenter, _lastWindowWidth);
        }
        
        if (corIdx >= 0 && corIdx < maxCoronalIndex)
        {
            CreateCoronalTexture(corIdx, _lastWindowCenter, _lastWindowWidth);
        }
    }
}
```

冠状和矢状纹理生成比轴向复杂，正确使用体素缓存能显著提升性能。