---
title: DicomCoordinateMapper API
---

# DicomCoordinateMapper

`DicomCoordinateMapper` 用于解析 DICOM 中的方向矩阵并提供病人坐标系、体素索引和平面坐标之间的转换。它将从 `ImageOrientationPatient` 标签中提取的行/列向量转化为解剖平面的轴映射（轴向、矢状、冠状），并根据方向确定索引的正负方向。

## 类定义

下面列出了主要公开方法和属性，内部变量和辅助函数已省略:

```csharp
public class DicomCoordinateMapper
{
    // 构造函数:默认初始化为 Identity 方向
    public DicomCoordinateMapper();

    // 初始化:设置为默认方向（X→Sagittal，Y→Coronal，Z→Axial）
    public void Initialize();

    // 从 DICOM 数据集解析方向矩阵。如果缺失，则使用默认方向
    public void InitializeFromDataset(DicomDataset dataset);

    // 返回当前轴映射 (axialAxis, sagittalAxis, coronalAxis)
    public (int axial, int sagittal, int coronal) GetCurrentAxesMapping();

    // 返回轴符号数组 [signX, signY, signZ]
    public int[] GetAxisSigns();

    // 依据当前轴映射获取轴向/矢状/冠状平面的切片数量
    public int GetAxialDimension(Vector3Int dims);
    public int GetSagittalDimension(Vector3Int dims);
    public int GetCoronalDimension(Vector3Int dims);

    // 计算三种平面各自的宽×高
    public (Vector2Int axial, Vector2Int sagittal, Vector2Int coronal) CalculatePlaneDimensions(Vector3Int dims);

    // 将矢状索引转换为体素坐标
    public Vector3Int MapSagittalIndexToVolume(int sagittalIndex, Vector3Int dims);

    // 将冠状索引转换为体素坐标
    public Vector3Int MapCoronalIndexToVolume(int coronalIndex, Vector3Int dims);

    // 将体素坐标投影到指定平面上
    public Vector2Int GetCoordinatesInPlane(Vector3Int volumeCoord, DicomPlane.PlaneType planeType);

    // 将体素坐标映射到轴向平面像素位置
    public Vector2Int MapVoxelToAxialPixel(Vector3Int voxelCoord);

    // 根据平面坐标和基础体素坐标计算轴向索引（交叉线定位）
    public int MapPlaneCoordToAxialIndex(Vector3Int baseCoord, Vector2Int planeCoord, DicomPlane.PlaneType planeType);

    // 打印方向信息到日志（调试用）
    public void LogOrientationInfo();
}
```

## 用法说明

- **初始化方向**:在加载第一张切片后，调用 `InitializeFromDataset(dataset)` 解析 `ImageOrientationPatient` 数据。如果数据集不含此标签，则自动使用默认方向。初始化只需调用一次。
- **获取轴映射与切片数**:通过 `GetCurrentAxesMapping()` 获取解剖平面与体素轴 (0:x, 1:y, 2:z) 的对应关系；再通过 `GetSagittalDimension(dims)` 等方法得到每个平面的切片数以设置 UI 滑条范围。
- **索引与坐标转换**:使用 `MapSagittalIndexToVolume()` 或 `MapCoronalIndexToVolume()` 将平面索引映射为体素坐标（`Vector3Int`）。再使用 `GetCoordinatesInPlane(volumeCoord, planeType)` 或 `MapVoxelToAxialPixel()` 将体素坐标转为平面内的像素坐标，用于在纹理上标记位置。
- **交叉线定位**:当用户在某个平面上拖动鼠标时，可以通过 `MapPlaneCoordToAxialIndex(baseCoord, planeCoord, planeType)` 计算出轴向切片索引，实现多平面联动。
- **调试信息**:调用 `LogOrientationInfo()` 可在控制台打印当前方向向量、轴映射和符号信息，方便调试不同设备或序列。

## 使用示例（伪代码）

```csharp
// 初始化方向解析
DicomCoordinateMapper mapper = new DicomCoordinateMapper();
mapper.InitializeFromDataset(firstSlice.Dataset);

// 查询平面切片数量
Vector3Int dims = series.Dimensions;
int numSagittal = mapper.GetSagittalDimension(dims);
int numCoronal  = mapper.GetCoronalDimension(dims);

// 将 UI 滑条索引映射为体素坐标
int sagIdx = uiSagittalSliderValue;
Vector3Int voxelCoord = mapper.MapSagittalIndexToVolume(sagIdx, dims);

// 在轴向纹理上显示该体素的像素位置
Vector2Int pixel = mapper.MapVoxelToAxialPixel(voxelCoord);
DrawCrosshair(pixel);

// 反向映射:用户在矢状平面点击图片
Vector2Int sagPlaneCoord = new Vector2Int(xInSagittalImage, yInSagittalImage);
int axialIndex = mapper.MapPlaneCoordToAxialIndex(voxelCoord, sagPlaneCoord, DicomPlane.PlaneType.Sagittal);

// 刷新轴向切片显示
rawImage.texture = series.GetAxialTexture(axialIndex);
```
