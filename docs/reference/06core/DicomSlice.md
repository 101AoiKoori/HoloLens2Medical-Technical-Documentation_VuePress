---
title: DicomSlice API
---

# DicomSlice

`DicomSlice` 表示一张 DICOM 图像切片。它封装了 DICOM 数据集、提取的图像元数据、像素数据以及生成的纹理，并提供解码和窗位/窗宽映射的功能。

## 类定义

```csharp
public class DicomSlice
{
    // 构造函数:加载切片，pixelData 可选
    public DicomSlice(DicomDataset dataset, string filePath, byte[] pixelData);

    // DICOM 数据集
    public DicomDataset Dataset { get; }
    // DICOM 文件路径
    public string FilePath { get; }
    // 排序后在序列中的索引，由切片管理器更新
    public int SequenceIndex { get; set; }
    // 实例号
    public int InstanceNumber { get; }
    // 切片位置（DICOM 中的 SliceLocation）
    public double SliceLocation { get; }
    // 图像在病人坐标系中的位置
    public Vector3 ImagePosition { get; }
    // 单像素的物理尺寸 (X, Y)
    public Vector2 PixelSpacing { get; }
    // 切片厚度
    public float SliceThickness { get; }
    // 图像宽度 (像素)
    public int Width { get; }
    // 图像高度 (像素)
    public int Height { get; }
    // 原始像素数据（字节数组）
    public byte[] PixelData { get; private set; }
    // 窗位与窗宽，默认从 DICOM 标签提取
    public float WindowCenter { get; set; }
    public float WindowWidth  { get; set; }
    // 是否已解码像素数据
    public bool IsPixelDataDecoded { get; }
    // 缓存的纹理
    public Texture2D Texture { get; set; }

    // 解码像素数据
    public bool DecodePixelData();
    // 根据窗位/窗宽创建纹理
    public Texture2D CreateTexture(float? customWindowCenter = null, float? customWindowWidth = null);
    // 释放纹理
    public void ReleaseTexture();
    // 释放像素数据和纹理
    public void Dispose();

    // 静态比较器:按切片位置和实例号排序
    public static int CompareByZPosition(DicomSlice a, DicomSlice b);
}
```

## 用法说明

- **构造切片**:提供 `DicomDataset` 和文件路径以及可选的已解码像素数据。构造函数会调用内部方法 `ExtractBasicInformation()` 自动提取实例号、切片位置、图像尺寸、窗位/窗宽等。
- **解码像素数据**:调用 `DecodePixelData()` 从 `PixelData` 标签读取第一帧像素。若切片已经解码或提供了外部像素数据，方法返回 `true` 而不会重新读取。
- **创建纹理**:调用 `CreateTexture()` 将像素数据映射到灰度纹理，可传入自定义的窗位 (`customWindowCenter`) 和窗宽 (`customWindowWidth`)。如果未传入这些参数，则使用切片自身的 `WindowCenter` 和 `WindowWidth`。首次调用默认参数时，生成的纹理会被缓存，下次调用直接返回以节省资源。
- **释放资源**:`ReleaseTexture()` 仅销毁缓存纹理；`Dispose()` 同时释放纹理和像素数据并重置解码状态。请在切片不再需要时调用，以避免显存泄漏。
- **比较器**:`CompareByZPosition` 作为静态方法用于对切片集合排序，先比较 `SliceLocation`，若相等则比较 `ImagePosition.z`，再比较 `InstanceNumber`。通常不直接调用，而由 `DicomSliceManager.SortSlices()` 使用。

## 使用示例（伪代码）

```csharp
// 创建一个切片
DicomDataset dataset = DicomFile.Open("path/to/file.dcm").Dataset;
DicomSlice slice = new DicomSlice(dataset, "path/to/file.dcm", pixelData: null);

// 解码像素数据（懒加载，可省略）
if (!slice.IsPixelDataDecoded)
{
    bool success = slice.DecodePixelData();
    if (!success)
    {
        Debug.LogError("Failed to decode pixel data");
    }
}

// 创建灰度纹理并显示
float customCenter = 40f;
float customWidth  = 400f;
Texture2D texture = slice.CreateTexture(customCenter, customWidth);
rawImage.texture  = texture;

// 释放资源
slice.ReleaseTexture(); // 若之后还需要重新创建纹理，可以只释放纹理
// 或
slice.Dispose();       // 同时释放像素缓冲
```
