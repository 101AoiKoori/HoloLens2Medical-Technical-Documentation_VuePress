---
title: 数据验证与体积信息 API
---
# 数据验证与体积信息 API

## 定义
在批量加载完成后，系统需要验证每个切片与整个序列的有效性，并设置统一的体积属性。`DicomSeriesLoader` 通过以下私有方法实现这些功能:

### IsValidDicomDataset
`IsValidDicomDataset(DicomDataset dataset)` 用于检查单个数据集是否包含有效像素数据。它会读取 `BitsAllocated`、`Rows`、`Columns` 等关键元数据，并确认存在 `PixelData` 标签。只有当像素位数为 8 或 16 且行列数大于 0 时返回真。方法还会比对帧数据长度与预期长度，如果不一致则警告并返回假。

### SetVolumeProperties
`SetVolumeProperties()` 根据序列中第一张切片的元数据设置整个体积的尺寸、间距和原点。它读取切片的宽、高和切片数量作为三维尺寸；从第一张切片的像素间距和厚度推导出体素间距；使用图像位置作为原点；最后调用 `targetSeries.SetVolumeProperties(...)` 保存这些信息。

### ValidateLoadedSeries
`ValidateLoadedSeries()` 用于检查整个序列的一致性。它确保每张切片都存在且尺寸一致，只有当所有切片宽高相同且不为零时返回真。

## 用法
这些方法由加载器内部调用，通常不需要直接在外部访问。如果需要在自定义流程中验证某个数据集或手动设置体积信息，可以参考以下示例:

```csharp
// 假设 dataset 来自某个 DicomFile
bool valid = IsValidDicomDataset(dataset);
if (!valid)
{
    Debug.LogWarning("无效数据集");
}
else
{
    // 添加到序列并在最后设置体积属性
    targetSeries.AddSlice(new DicomSlice(dataset.Clone(), path, pixelBytes));
    // ... 加载其他切片 ...
    SetVolumeProperties();
}
```

调用 `SetVolumeProperties` 后，可以通过 `targetSeries.Dimensions`、`Spacing` 和 `Origin` 获取体积信息，用于后续渲染或交互。在批量加载流程结束时，系统会自动调用 `ValidateLoadedSeries` 来确保数据一致。