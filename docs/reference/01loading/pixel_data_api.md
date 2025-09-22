---
title: 像素数据提取 API
---
# 像素数据提取 API

## 定义
在加载序列的过程中，需要从每个 `DicomDataset` 提取像素数据才能构建切片。`ExtractPixelData(DicomDataset dataset)` 方法从数据集读取第一帧像素数据并返回字节数组。若数据集为空或不包含像素数据标签则返回 `null`。

方法内部调用 `DicomPixelData.Create(dataset)`，然后获取第一帧并使用 `Buffer.BlockCopy` 将数据复制到新的数组中。如果发生异常或帧数据为空，则返回 `null` 并通过日志提示。

## 用法

该方法为私有内部工具，通常在 `LoadSeriesCoroutine` 中使用。自定义加载器可以参考以下伪代码:

```csharp
byte[] pixelBytes = ExtractPixelData(dataset);
if (pixelBytes == null || pixelBytes.Length == 0)
{
    LogMessage("像素数据为空");
    // 跳过或处理异常情况
}
else
{
    // 使用 pixelBytes 构建 DicomSlice
    var slice = new DicomSlice(dataset.Clone(), relativePath, pixelBytes);
    targetSeries.AddSlice(slice);
}
```

由于使用 FO‑DICOM 库，提取像素数据前必须确保数据集仍在 `using` 语句块内，避免在流关闭后访问 `PixelData` 引发异常。