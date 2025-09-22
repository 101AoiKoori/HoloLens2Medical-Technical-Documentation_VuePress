---
title: 纹理转换算法细节
---

# 纹理转换算法细节

## RenderTexture到Texture2D转换流程

DicomTextureBridge的核心功能是将MPRViewer中的RenderTexture转换为3D场景可用的Texture2D。这个转换过程涉及GPU到CPU的数据传输和格式处理。

### 转换算法实现

```csharp
private Texture2D CreateCompatibleTexture(Texture sourceTexture, DicomPlane.PlaneType planeType)
{
    if (sourceTexture == null) return null;
    
    try
    {
        // 第一步:创建临时RenderTexture
        RenderTexture tempRT = RenderTexture.GetTemporary(
            sourceTexture.width,
            sourceTexture.height,
            0,                              // 深度缓冲区位数
            RenderTextureFormat.ARGB32);    // 32位ARGB格式
        
        // 第二步:GPU内存复制
        Graphics.Blit(sourceTexture, tempRT);
        
        // 第三步:创建目标Texture2D
        Texture2D newTexture = new Texture2D(
            sourceTexture.width,
            sourceTexture.height,
            TextureFormat.RGBA32,   // 32位RGBA格式
            false);                 // 不生成Mipmap
        
        // 设置纹理属性
        newTexture.name = $"DICOM_{planeType}_{Time.frameCount}";
        newTexture.filterMode = textureFilterMode;
        newTexture.wrapMode = TextureWrapMode.Clamp;
        
        // 第四步:CPU读取像素数据
        RenderTexture previous = RenderTexture.active;
        RenderTexture.active = tempRT;
        
        newTexture.ReadPixels(new Rect(0, 0, tempRT.width, tempRT.height), 0, 0);
        
        // 第五步:灰度均衡处理
        Color[] pixels = newTexture.GetPixels();
        for (int i = 0; i < pixels.Length; i++)
        {
            // 将最大值分配给所有通道以保留信息
            float grayValue = Mathf.Max(pixels[i].r, Mathf.Max(pixels[i].g, pixels[i].b));
            pixels[i] = new Color(grayValue, grayValue, grayValue, 1.0f);
        }
        newTexture.SetPixels(pixels);
        
        // 第六步:应用更改并清理资源
        newTexture.Apply();
        RenderTexture.active = previous;
        RenderTexture.ReleaseTemporary(tempRT);
        
        return newTexture;
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"创建兼容纹理时出错: {ex.Message}");
        return null;
    }
}
```

### 关键实现细节

**内存管理策略**:
- 使用`RenderTexture.GetTemporary()`获取临时纹理，Unity会自动复用内存池
- 立即使用`RenderTexture.ReleaseTemporary()`释放临时资源
- 恢复之前的`RenderTexture.active`状态，避免影响其他渲染操作

**格式选择考虑**:
- 临时RenderTexture使用ARGB32格式，确保完整的颜色信息
- 目标Texture2D使用RGBA32格式，与Unity材质系统兼容
- 禁用Mipmap生成，减少内存占用和处理时间

## 灰度均衡算法

### 医学影像特殊处理

医学影像通常为灰度图像，但在UI渲染过程中可能出现通道不均衡的情况。灰度均衡确保图像在3D场景中正确显示:

```csharp
// 灰度均衡处理的数学原理
for (int i = 0; i < pixels.Length; i++)
{
    Color originalPixel = pixels[i];
    
    // 计算最大通道值作为灰度值
    float grayValue = Mathf.Max(originalPixel.r, 
                               Mathf.Max(originalPixel.g, originalPixel.b));
    
    // 将灰度值应用到所有颜色通道
    pixels[i] = new Color(grayValue, grayValue, grayValue, 1.0f);
}
```

**处理效果**:
- 保留最高强度的像素信息
- 确保R、G、B三通道一致性
- Alpha通道固定为1.0，保证完全不透明

### 性能优化考虑

**批量处理策略**:
```csharp
// 使用GetPixels()一次性获取所有像素
Color[] pixels = newTexture.GetPixels();

// 批量处理像素数据
for (int i = 0; i < pixels.Length; i++)
{
    // 处理逻辑
}

// 使用SetPixels()一次性写回所有像素
newTexture.SetPixels(pixels);
```

这比逐像素调用GetPixel/SetPixel快数十倍。

## 异步转换机制

### 协程化处理流程

```csharp
private IEnumerator ConvertTextureCoroutine(Texture sourceTexture, 
                                          DicomPlane.PlaneType planeType, 
                                          System.Action<Texture2D> callback)
{
    if (sourceTexture == null)
    {
        callback?.Invoke(null);
        yield break;
    }
    
    // 执行CPU密集的纹理转换
    Texture2D convertedTexture = CreateCompatibleTexture(sourceTexture, planeType);
    
    // 等待一帧确保纹理处理完成
    yield return null;
    
    // 通过回调返回结果
    callback?.Invoke(convertedTexture);
}
```

**异步设计的优势**:
- 避免阻塞主线程，保持游戏帧率稳定
- `yield return null`确保Unity有机会处理其他系统
- 回调机制实现松耦合的结果处理

### 并发控制实现

```csharp
// 防止同一平面的并发转换
public void ConvertAndUpdateAxialTexture()
{
    if (isProcessingAxial || axialRawImage == null || 
        axialRawImage.texture == null || !CanStartCoroutine()) 
        return;
    
    isProcessingAxial = true;
    SafeStartCoroutine(ConvertTextureCoroutine(
        axialRawImage.texture,
        DicomPlane.PlaneType.Axial,
        (texture) => {
            convertedAxialTexture = texture;
            if (sliceManager != null && sliceManager.AxialPlane != null)
            {
                sliceManager.AxialPlane.SetTexture(texture);
            }
            isProcessingAxial = false; // 重置标志
        }
    ), "轴向纹理转换");
}
```

**并发控制策略**:
- 每个平面使用独立的处理标志（`isProcessingAxial`等）
- 在协程开始前设置标志，在回调中重置标志
- 支持三个平面同时进行不同的转换操作

## 纹理缓存机制

### 转换结果缓存

```csharp
// 缓存转换后的纹理
private Texture2D convertedAxialTexture;
private Texture2D convertedSagittalTexture;
private Texture2D convertedCoronalTexture;

// 纹理变化检测
if (axialRawImage != null && axialRawImage.texture != null)
{
    Texture currentTexture = axialRawImage.texture;
    if (convertedAxialTexture == null || currentTexture != convertedAxialTexture)
    {
        ConvertAndUpdateAxialTexture();
    }
}
```

**缓存优化**:
- 避免重复转换相同的源纹理
- 通过引用比较快速检测纹理变化
- 减少不必要的CPU和GPU资源消耗

### 资源清理机制

```csharp
private void CleanupTextures()
{
    if (convertedAxialTexture != null)
    {
        Destroy(convertedAxialTexture);
        convertedAxialTexture = null;
    }
    
    if (convertedSagittalTexture != null)
    {
        Destroy(convertedSagittalTexture);
        convertedSagittalTexture = null;
    }
    
    if (convertedCoronalTexture != null)
    {
        Destroy(convertedCoronalTexture);
        convertedCoronalTexture = null;
    }
}
```

在`OnDestroy()`中调用清理方法，确保不会发生内存泄漏。

## 错误处理与降级策略

### 转换失败处理

```csharp
try
{
    // 纹理转换逻辑
    Texture2D convertedTexture = CreateCompatibleTexture(sourceTexture, planeType);
    return convertedTexture;
}
catch (System.Exception ex)
{
    Debug.LogError($"创建兼容纹理时出错: {ex.Message}");
    
    // 降级策略:返回null，让调用方处理
    return null;
}
```

**错误恢复机制**:
- Try-catch包装所有转换操作
- 详细的错误日志记录便于调试
- 返回null而非抛出异常，保持系统稳定性
- 调用方检查null并采用备用纹理获取方案