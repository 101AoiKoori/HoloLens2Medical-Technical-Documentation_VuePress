---
title: DicomSliceManager API
---

# DicomSliceManager

`DicomSliceManager` 是 Core 模块用来管理一组 `DicomSlice` 对象的类。它负责维护内部切片列表，并提供添加、排序、访问和释放的方法。

## 类定义

```csharp
public class DicomSliceManager
{
    // 只读视图：获取所有切片
    public IReadOnlyList<DicomSlice> Slices { get; }
    // 当前切片数量
    public int SliceCount { get; }

    // 构造函数
    public DicomSliceManager();

    // 添加一个切片（忽略 null 和重复项）
    public void AddSlice(DicomSlice slice);

    // 清空内部切片列表，不释放资源
    public void ClearSlices();

    // 按序号获取切片，越界返回 null
    public DicomSlice GetSlice(int index);

    // 根据切片位置信息排序，并更新每个切片的 SequenceIndex
    public void SortSlices();

    // 释放所有切片资源并清空列表
    public void ReleaseSlices();
}
```

## 用法说明

- **添加切片**：在加载 DICOM 文件时，为每个文件创建一个 `DicomSlice` 实例，并通过 `AddSlice` 加入序列。方法会忽略 `null` 和已存在的切片。
- **排序切片**：当所有切片加载完毕后，调用 `SortSlices()` 将它们按切片位置（Z 坐标）排序，并更新每个切片的 `SequenceIndex`。
- **获取切片**：使用 `GetSlice(index)` 按索引访问切片。请确保索引在 0 到 `SliceCount - 1` 的范围内。
- **释放资源**：调用 `ReleaseSlices()` 会遍历列表中的所有切片，调用其 `Dispose()` 方法释放纹理和像素数据，然后清空列表。建议在销毁场景或重新加载数据前调用。

## 使用示例（伪代码）

```csharp
var manager = new DicomSliceManager();

// 添加切片
foreach (string filePath in dicomFiles)
{
    var dataset = DicomFile.Open(filePath).Dataset;
    var slice   = new DicomSlice(dataset, filePath, pixelData: null);
    manager.AddSlice(slice);
}

// 排序切片
manager.SortSlices();

// 访问切片
var firstSlice = manager.GetSlice(0);
Debug.Log($"First slice location: {firstSlice.SliceLocation}");

// 释放资源
manager.ReleaseSlices();
```
