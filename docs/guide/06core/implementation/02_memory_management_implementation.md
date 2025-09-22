---
title: 内存管理策略实现
---

# 内存管理策略实现

本文档深入解析Core模块中切片纹理的缓存、释放和垃圾回收优化的具体实现，涵盖GPU内存管理和托管堆优化。

## 切片纹理的内部缓存机制

DicomSlice内部实现了纹理缓存，避免重复创建相同参数的纹理:

```csharp
public class DicomSlice
{
    /// <summary>
    /// 生成的纹理（缓存）
    /// </summary>
    public Texture2D Texture { get; private set; }

    public Texture2D CreateTexture(float? customWindowCenter = null, float? customWindowWidth = null)
    {
        // 如果使用默认窗位窗宽且已有缓存纹理，直接返回
        if (Texture != null && !customWindowCenter.HasValue && !customWindowWidth.HasValue)
            return Texture;

        // ... 创建新纹理的逻辑 ...

        // 只有使用默认参数时才缓存纹理
        if (!customWindowCenter.HasValue && !customWindowWidth.HasValue)
        {
            Texture = texture;
        }

        return texture;
    }
}
```

### 缓存策略的内存影响

这种设计的优缺点:

**优点**:
- 避免重复计算窗位窗宽映射
- 减少GPU纹理创建/销毁开销
- 提高UI响应速度

**缺点**:
- 每个切片最多缓存一个纹理实例
- 自定义窗位窗宽的纹理不被缓存，避免内存无限增长

## 像素数据的生命周期管理

DicomSlice采用按需解码策略，优化内存使用:

```csharp
public bool DecodePixelData()
{
    // 检查是否已解码，避免重复工作
    if (IsPixelDataDecoded && PixelData != null && PixelData.Length > 0)
        return true;

    if (Dataset == null)
        return false;

    try
    {
        if (Dataset.Contains(DicomTag.PixelData))
        {
            DicomPixelData pixelData = DicomPixelData.Create(Dataset);
            FellowOakDicom.IO.Buffer.IByteBuffer buffer = pixelData.GetFrame(0);

            if (buffer != null && buffer.Size > 0)
            {
                // 创建托管字节数组保存像素数据
                PixelData = new byte[buffer.Size];
                System.Buffer.BlockCopy(buffer.Data, 0, PixelData, 0, (int)buffer.Size);
                IsPixelDataDecoded = true;
            }
        }
    }
    catch (Exception ex)
    {
        Debug.LogError($"Error decoding pixel data: {ex.Message}");
        IsPixelDataDecoded = false;
    }

    return IsPixelDataDecoded;
}
```

### 内存复制优化

使用`System.Buffer.BlockCopy`而非循环赋值，提高大数组复制性能:
- 原生代码实现，比C#循环快数倍
- 直接操作内存块，减少GC压力
- 对于512x512x2字节的切片，性能差异显著

## 纹理创建的内存安全实现

CreateTexture方法采用异常安全的资源管理:

```csharp
public Texture2D CreateTexture(float? customWindowCenter = null, float? customWindowWidth = null)
{
    // 确保像素数据已解码
    if (!IsPixelDataDecoded)
    {
        if (!DecodePixelData())
            return null;
    }

    Texture2D texture = new Texture2D(Width, Height, TextureFormat.RGBA32, false);
    
    try
    {
        // 获取位深度
        int bitsAllocated = Dataset.GetSingleValueOrDefault<int>(DicomTag.BitsAllocated, 16);
        
        // 创建颜色数组 - 在堆上分配大块内存
        UnityEngine.Color32[] colors = new UnityEngine.Color32[Width * Height];

        if (bitsAllocated == 8)
        {
            ProcessEightBitPixels(colors, effectiveWindowCenter, effectiveWindowWidth);
        }
        else if (bitsAllocated == 16)
        {
            ProcessSixteenBitPixels(colors, effectiveWindowCenter, effectiveWindowWidth);
        }

        // 上传到GPU
        texture.SetPixels32(colors);
        texture.Apply();

        // 成功后才缓存
        if (!customWindowCenter.HasValue && !customWindowWidth.HasValue)
        {
            Texture = texture;
        }

        return texture;
    }
    catch (Exception ex)
    {
        Debug.LogError($"Error creating texture: {ex.Message}");
        // 异常时销毁已创建的纹理，防止内存泄漏
        UnityEngine.Object.Destroy(texture);
        return null;
    }
}
```

### 16位像素处理的边界检查

对于大像素数组，严格的边界检查防止内存访问异常:

```csharp
private void ProcessSixteenBitPixels(Color32[] colors, float windowCenter, float windowWidth)
{
    int pixelCount = Width * Height;
    int requiredBytes = pixelCount * 2;

    // 检查像素数据长度
    if (PixelData.Length < requiredBytes)
    {
        Debug.LogError($"Pixel data length insufficient: need {requiredBytes} bytes, but only have {PixelData.Length} bytes");
        return;
    }

    for (int i = 0; i < pixelCount; i++)
    {
        int byteIndex = i * 2;

        // 双重边界检查，防止数组越界
        if (byteIndex + 1 >= PixelData.Length)
        {
            Debug.LogError($"Pixel data out of bounds: {byteIndex + 1} >= {PixelData.Length}");
            return;
        }

        // 小端序字节组合
        ushort value = (ushort)((PixelData[byteIndex + 1] << 8) | PixelData[byteIndex]);
        float normalized = ApplyWindowLevel(value, windowCenter, windowWidth);
        byte value8 = (byte)(normalized * 255);
        colors[i] = new UnityEngine.Color32(value8, value8, value8, 255);
    }
}
```

## 资源释放的分层实现

DicomSlice提供两个层次的资源释放:

```csharp
/// <summary>
/// 释放纹理资源（保留像素数据）
/// </summary>
public void ReleaseTexture()
{
    if (Texture != null)
    {
        UnityEngine.Object.Destroy(Texture);
        Texture = null;
    }
}

/// <summary>
/// 释放所有资源
/// </summary>
public void Dispose()
{
    ReleaseTexture();           // 首先释放GPU纹理
    PixelData = null;          // 清空托管数组引用
    IsPixelDataDecoded = false; // 重置解码标志
}
```

### 释放时机的优化策略

**ReleaseTexture的使用场景**:
- 窗位窗宽改变时，保留像素数据重新创建纹理
- 内存压力大但仍需要切片数据时
- 临时隐藏切片但可能重新显示时

**Dispose的使用场景**:
- 加载新序列前的完全清理
- 应用退出前的资源回收
- 长期不使用的切片的彻底清理

## 切片集合的批量内存管理

DicomSliceManager实现批量资源释放，提高效率:

```csharp
public void ReleaseSlices()
{
    foreach (var slice in _slices)
    {
        if (slice != null)
        {
            slice.Dispose(); // 调用每个切片的完全清理
        }
    }
    _slices.Clear(); // 清空集合，释放引用
}
```

### 遍历优化

使用foreach而非for循环:
- 编译器优化更好
- 避免索引边界检查开销
- 代码更清晰，减少错误

## 垃圾回收优化策略

DicomSeries在资源释放后主动触发GC:

```csharp
public void ReleaseResources()
{
    _sliceManager.ReleaseSlices();
    _textureCache.ClearAllCaches();

    if (_textureCreator != null)
    {
        _textureCreator.ClearVolumeCache();
        _textureCreator.Cleanup();
    }

    // 手动触发垃圾回收，确保大对象及时回收
    System.GC.Collect();

    if (_enableDebugLog)
        Debug.Log("[DicomSeries] All resources released");
}
```

### GC调用的技术考量

**为什么手动调用GC**:
- 医学影像数据量大，单个序列可能占用数百MB
- Unity的增量GC可能延迟大对象回收
- 在明确的清理点触发GC，避免运行时突然的GC暂停

**调用时机**:
- 序列切换时
- 应用暂停/恢复时
- 内存压力检测到时

## 内存泄漏防护机制

### Texture2D的正确销毁

Unity的纹理必须显式销毁，否则GPU内存泄漏:

```csharp
if (Texture != null)
{
    UnityEngine.Object.Destroy(Texture); // 销毁GPU纹理
    Texture = null;                       // 清空引用
}
```

### 异常情况下的资源清理

在CreateTexture的catch块中:

```csharp
catch (Exception ex)
{
    Debug.LogError($"Error creating texture: {ex.Message}");
    UnityEngine.Object.Destroy(texture); // 确保半成功的纹理被销毁
    return null;
}
```

这确保即使纹理创建过程中出现异常，已分配的GPU内存也会被正确释放。

## 内存使用监控

通过调试日志监控内存使用:

```csharp
if (_enableDebugLog)
{
    long memoryBefore = System.GC.GetTotalMemory(false);
    // ... 执行内存操作 ...
    long memoryAfter = System.GC.GetTotalMemory(false);
    Debug.Log($"内存变化: {(memoryAfter - memoryBefore) / 1024 / 1024} MB");
}
```

## 总结

Core模块的内存管理实现了以下关键特性:

1. **分层释放**:纹理、像素数据分别管理
2. **按需分配**:懒加载和缓存策略平衡内存和性能
3. **异常安全**:确保任何情况下都不会内存泄漏
4. **批量优化**:集合级别的高效资源管理
5. **GC协作**:主动配合垃圾回收器优化性能

这些策略确保了即使在处理大量医学影像数据时，应用也能保持稳定的内存使用模式。