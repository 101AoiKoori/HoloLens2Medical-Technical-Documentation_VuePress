---
title: 切片的添加排序与释放
---

# 切片的添加、排序与释放

**目标：** 展示如何创建 `DicomSlice`、将其加入 `DicomSeries`、在加载完成后按正确顺序排序，并在使用完毕后释放资源。

## 前置条件

- 已经使用 `SetVolumeProperties` 初始化了一个 `DicomSeries`。
- 已经通过 FO‑DICOM 或其它库读取一个或多个 DICOM 文件，并能够创建 `DicomSlice` 对象。

## 步骤

1. **创建 `DicomSlice` 实例**  
   首先读取 DICOM 文件到 `DicomDataset`。可以按需传入像素数据，若不传入则稍后解码：

   ```csharp
   using FellowOakDicom;
   using MedicalMR.DICOM.Core;

   // 打开 DICOM 文件
   DicomDataset dataset = DicomFile.Open("path/to/file.dcm").Dataset;

   // 若不想立即解码像素，可以传入 null，让切片在需要时自行解码
   byte[] pixelData = null;

   // 构造切片
   DicomSlice slice = new DicomSlice(dataset, "path/to/file.dcm", pixelData);
   ```

   > **提示：** 你可以在循环中读取多个文件并创建多个切片。

2. **向序列添加切片**  
   调用 `AddSlice()` 将切片加入 `DicomSeries` 的内部列表：

   ```csharp
   series.AddSlice(slice);
   ```

   如果传入 `null` 或重复切片，管理器会自动忽略。

3. **重复添加直到加载完成**  
   当所有切片都加载完毕后，应调用 `SortSlices()` 对其按解剖顺序进行排序：

   ```csharp
   series.SortSlices();
   ```

   `SortSlices` 将根据切片的 `SliceLocation`、`ImagePositionPatient.z` 和 `InstanceNumber` 依次比较并重新排列列表，并将每个切片的 `SequenceIndex` 更新为其在排序后的位置。

4. **访问切片**  
   排序后，你可以通过索引访问特定切片，例如获取第一张切片：

   ```csharp
   DicomSlice firstSlice = series.GetSlice(0);
   Debug.Log($"First slice instance number: {firstSlice.InstanceNumber}");
   ```

   也可以遍历 `series.Slices` 列表来创建纹理或收集统计信息。

5. **释放资源**  
   当序列不再需要时，调用 `ReleaseResources()` 释放所有切片占用的纹理和像素数据：

   ```csharp
   series.ReleaseResources();
   ```

   该方法会遍历内部切片，调用其 `Dispose()` 以释放 GPU 纹理和托管堆中的像素缓冲，然后将切片列表清空。

   > **提示：** 如果仅需要释放纹理而保留像素缓冲，用于以后重新创建纹理，可以单独调用每个切片的 `ReleaseTexture()`；然而在绝大多数情况下，调用 `Dispose()` 即可满足需求。

## 结果

- 切片集合被正确地加入并排序，其顺序符合病人的解剖方向。
- 通过索引可随机访问切片，方便与 UI 控件绑定。
- 资源释放后，内存得到回收，为下次加载序列腾出空间。
