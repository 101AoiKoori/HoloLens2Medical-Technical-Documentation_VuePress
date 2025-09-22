---
title: 生成轴向纹理
---
# 生成轴向纹理

本页详细说明如何通过DicomTextureCreator生成轴向纹理，包括单个纹理获取和批量预加载。

## 获取单个轴向纹理

轴向纹理是从原始DICOM切片直接生成的，是最快速的纹理类型:

```csharp
DicomTextureCreator creator = GetTextureCreator();

// 获取第25张轴向切片，窗位40，窗宽400
Texture2D axialTexture = creator.GetAxialTexture(25, 40.0f, 400.0f);

if (axialTexture != null)
{
    // 设置到UI组件
    rawImage.texture = axialTexture;
}
else
{
    Debug.LogWarning("无法生成轴向纹理，检查索引是否有效");
}
```

### 生成流程详解

`GetAxialTexture()` 方法执行以下步骤:

1. **索引验证**:
   ```csharp
   if (_sliceManager.SliceCount == 0 || index < 0 || index >= _sliceManager.SliceCount)
       return null;
   ```

2. **缓存查询**:
   ```csharp
   string windowLevelKey = _textureCache.GetWindowLevelKey(windowCenter, windowWidth);
   string cacheKey = _textureCache.GetTextureCacheKey(DicomPlane.PlaneType.Axial, index, windowLevelKey);
   
   Texture2D texture = _textureCache.GetTextureFromCache(DicomPlane.PlaneType.Axial, cacheKey);
   if (texture != null)
       return texture; // 缓存命中，直接返回
   ```

3. **获取DICOM切片**:
   ```csharp
   DicomSlice slice = _sliceManager.GetSlice(index);
   if (slice == null) return null;
   ```

4. **生成纹理**:
   ```csharp
   texture = slice.CreateTexture(windowCenter, windowWidth);
   ```

5. **存储和通知**:
   ```csharp
   if (texture != null)
   {
       texture.name = $"Axial_{index}_{windowCenter}_{windowWidth}";
       _textureCache.AddTextureToCache(DicomPlane.PlaneType.Axial, cacheKey, texture);
       
       // 触发纹理更新事件
       OnTextureUpdated?.Invoke(DicomPlane.PlaneType.Axial, index, texture);
   }
   ```

## 同步批量预加载

`PreloadAxialTextures()` 方法可同步加载指定范围的轴向纹理:

```csharp
// 预加载第30到50张切片
creator.PreloadAxialTextures(40.0f, 400.0f, 30, 50);
```

该方法内部实现:

```csharp
public void PreloadAxialTextures(float windowCenter, float windowWidth, int startIndex, int endIndex)
{
    startIndex = Mathf.Clamp(startIndex, 0, _sliceManager.SliceCount - 1);
    endIndex = Mathf.Clamp(endIndex, startIndex, _sliceManager.SliceCount - 1);
    
    for (int i = startIndex; i <= endIndex; i++)
    {
        string windowLevelKey = _textureCache.GetWindowLevelKey(windowCenter, windowWidth);
        string cacheKey = _textureCache.GetTextureCacheKey(DicomPlane.PlaneType.Axial, i, windowLevelKey);
        
        // 跳过已缓存的纹理
        if (_textureCache.HasTextureInCache(DicomPlane.PlaneType.Axial, cacheKey))
            continue;
            
        // 生成新纹理
        GetAxialTexture(i, windowCenter, windowWidth);
    }
}
```

### 使用建议

- **小范围预加载**:适用于预加载10-20张切片
- **缓存检查**:自动跳过已存在的纹理，避免重复生成
- **索引修正**:自动修正超出范围的索引值

## 异步批量预加载

对于大量切片的预加载，使用协程版本避免阻塞主线程:

```csharp
// 启动异步预加载所有轴向纹理
StartCoroutine(creator.PreloadAxialTexturesCoroutine(40.0f, 400.0f));
```

协程实现的关键特点:

```csharp
public IEnumerator PreloadAxialTexturesCoroutine(float windowCenter, float windowWidth)
{
    int batchSize = 10; // 每批处理10张
    int totalSlices = _sliceManager.SliceCount;
    
    for (int start = 0; start < totalSlices; start += batchSize)
    {
        int end = Mathf.Min(start + batchSize - 1, totalSlices - 1);
        
        // 同步处理一批纹理
        PreloadAxialTextures(windowCenter, windowWidth, start, end);
        
        // 等待下一帧，避免阻塞
        yield return null;
    }
}
```

### 分批策略

- **批量大小**:默认每批10张纹理
- **帧间等待**:每批之间等待一帧
- **响应性**:保持UI流畅响应
- **内存管理**:配合缓存淘汰机制工作

## 纹理更新事件

订阅 `OnTextureUpdated` 事件以响应纹理生成完成:

```csharp
// 订阅纹理更新事件
creator.OnTextureUpdated += (planeType, index, texture) =>
{
    if (planeType == DicomPlane.PlaneType.Axial)
    {
        Debug.Log($"轴向纹理 {index} 已生成完成");
        
        // 如果是当前显示的切片，更新UI
        if (index == currentAxialIndex)
        {
            axialImage.texture = texture;
        }
    }
};
```

### 事件参数

- **planeType**:纹理平面类型（Axial/Sagittal/Coronal）
- **index**:切片索引
- **texture**:生成的纹理对象

## 内存优化建议

### 预加载策略

```csharp
// 基于当前索引的智能预加载
public void SmartPreloadAroundIndex(int currentIndex, int range = 5)
{
    int startIndex = Mathf.Max(0, currentIndex - range);
    int endIndex = Mathf.Min(_sliceManager.SliceCount - 1, currentIndex + range);
    
    creator.PreloadAxialTextures(_currentWindowCenter, _currentWindowWidth, 
                                startIndex, endIndex);
}
```

### 缓存管理

```csharp
// 定期清理远离当前索引的纹理
public void CleanupDistantTextures(int currentIndex, int keepRange = 10)
{
    // 让缓存系统自动处理淘汰
    // 或者手动移除距离当前索引较远的纹理
}
```

## 错误处理

```csharp
public Texture2D SafeGetAxialTexture(int index, float center, float width)
{
    try
    {
        if (index < 0 || index >= _sliceManager.SliceCount)
        {
            Debug.LogWarning($"轴向索引 {index} 超出范围 [0, {_sliceManager.SliceCount - 1}]");
            return null;
        }
        
        return creator.GetAxialTexture(index, center, width);
    }
    catch (Exception ex)
    {
        Debug.LogError($"生成轴向纹理时发生错误: {ex.Message}");
        return null;
    }
}
```

轴向纹理生成是最基础和高效的操作，正确使用缓存和预加载机制可以显著提升用户体验。