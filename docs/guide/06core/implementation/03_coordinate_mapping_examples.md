---
title: 坐标映射实例
---

# 坐标映射实例

**目标:** 使用 `DicomCoordinateMapper` 查询不同解剖平面的切片数量，并在矢状/冠状平面索引、三维体素坐标和二维像素坐标之间进行转换。这些操作常用于实现 MPR(多平面重建)界面中的滑条联动和交叉定位。

## 前置条件

- 已经初始化一个 `DicomSeries` 并添加了至少一张切片。
- `DicomCoordinateMapper` 已经通过调用 `InitializeFromDataset()` 完成方向解析。该初始化通常在添加第一张切片时由框架完成；如果你手动创建映射器，需要在使用前显式调用。

## 步骤

1. **获取映射器并初始化方向**

   如果你在切片加载逻辑外另行创建 `DicomCoordinateMapper`，需要手动初始化它:

   ```csharp
   using MedicalMR.DICOM.Core;

   // 在添加第一个切片后
   DicomCoordinateMapper mapper = new DicomCoordinateMapper();
   mapper.InitializeFromDataset(series.Slices[0].Dataset);
   ```

   > **提示:** 如果你通过 `DicomSeries` 的 API 加载切片，框架可能自动初始化 `mapper`。确认 `GetCurrentAxesMapping()` 返回的映射与你的期待一致即可。

2. **查询各平面的切片数量**

   体积尺寸记录在 `series.Dimensions`。映射器根据轴映射返回每个平面可用的切片数:

   ```csharp
   Vector3Int dims       = series.Dimensions;
   int axialCount        = mapper.GetAxialDimension(dims);
   int sagittalCount     = mapper.GetSagittalDimension(dims);
   int coronalCount      = mapper.GetCoronalDimension(dims);

   Debug.Log($"Axial slices: {axialCount}, Sagittal slices: {sagittalCount}, Coronal slices: {coronalCount}");
   ```

3. **将矢状平面索引转换为体素坐标**

   UI 滑条通常返回一个整数索引。使用 `MapSagittalIndexToVolume()` 将其转换为体素坐标:

   ```csharp
   int sagIndex      = 10; // 来自 UI 滑条或其他输入
   Vector3Int sagVoxel = mapper.MapSagittalIndexToVolume(sagIndex, dims);
   Debug.Log($"Sagittal index {sagIndex} maps to voxel {sagVoxel}");
   ```

   此函数会根据矢状轴符号决定是否反转索引，并将索引写入对应轴。

4. **将冠状平面索引转换为体素坐标**

   类似地，将冠状索引转换:

   ```csharp
   int corIndex = 5;
   Vector3Int corVoxel = mapper.MapCoronalIndexToVolume(corIndex, dims);
   ```

5. **从体素坐标得到轴向平面的像素位置**

   当你有一个体素坐标(例如来自三维光标或交叉线交点)，可以获取它在轴向纹理中的像素位置:

   ```csharp
   Vector2Int axialPixel = mapper.MapVoxelToAxialPixel(sagVoxel);
   Debug.Log($"Voxel {sagVoxel} is at axial pixel {axialPixel}");
   ```

6. **在任意平面上获取像素坐标**

   使用通用函数 `GetCoordinatesInPlane()` 可在指定平面上获得像素坐标。例如:

   ```csharp
   using MedicalMR.DICOM.Core;

   Vector2Int sagPixel = mapper.GetCoordinatesInPlane(sagVoxel, DicomPlane.PlaneType.Sagittal);
   Vector2Int corPixel  = mapper.GetCoordinatesInPlane(corVoxel, DicomPlane.PlaneType.Coronal);
   ```

   这样可以在 UI 中突出显示选中的体素在不同平面中的位置。

## 结果

- 你可以查询每个解剖平面可以显示多少张切片，用于设置滑条范围。
- 可以将 UI 索引转换为三维体素坐标，再映射到二维纹理坐标，实现多平面联动。
- 这些映射函数考虑了 DICOM 文件的方向信息，不论扫描方向如何变化，都可以正确同步 UI 和数据。
