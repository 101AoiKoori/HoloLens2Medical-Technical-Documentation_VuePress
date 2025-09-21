# 数据验证与体积信息推导

## 功能思路

在将切片加入序列后，必须确认每个数据集的基本属性一致，以保证体积数据的正确性；同时需要根据切片的元数据推导整体体积的尺寸、体素间距和原点。加载器通过 `IsValidDicomDataset()`、`ValidateLoadedSeries()` 和 `SetVolumeProperties()` 完成这些工作。

## 原理拆解

1. **单文件验证**：
   - 检查像素存在、行列数大于零、位深为 8 或 16 位。
   - 计算期望的像素字节数 (`宽 × 高 × 位深 / 8`) 与实际帧大小比较，若不匹配则认为数据集无效并输出警告。
2. **序列验证**：
   - 加载完成后检查至少有一张切片。
   - 遍历所有切片，比较宽度和高度是否一致，若发现不一致则返回 false 并记录警告。
3. **体积属性推导**：
   - 以第一张切片为参考，设置体积尺寸为 `(宽, 高, 切片数量)`。
   - 像素间距来自 DICOM Tag `PixelSpacing` (x,y) 与 `SliceThickness` (z)。
   - 原点使用 `ImagePosition`。
   - 将这些属性传递给 `DicomSeries.SetVolumeProperties()`，加载器会在日志中输出结果。

## 像素数据长度验证
验证算法检查实际帧大小是否匹配预期：
```csharp
int expectedSize = px.Width * px.Height * bitsAllocated / 8;
if (px.GetFrame(0).Size != expectedSize) {
    // 数据长度不匹配，可能文件损坏
    return false;
}
```
## 使用建议

- 如果应用中某些切片的尺寸不一致，应先在工具链中裁剪或重采样它们，确保统一的体积几何。
- 在基于这些元数据进行体渲染时，请注意空间单位的换算(例如毫米与米的转换)。
