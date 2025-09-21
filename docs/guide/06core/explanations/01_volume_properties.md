---
title: 体积属性与元数据解析
---

# 体积属性与元数据解析

在 DICOM 序列中，每张切片都属于一个更大的三维体。若想正确解释像素数据，我们必须知道体素网格的 **尺寸**、**间距**、**原点** 和 **方向**。Core 模块通过 `DicomMetadata` 类集中存储这些几何信息，并提供了设置默认窗位和窗宽的能力。理解这些元数据的含义，有助于开发者在加载或显示数据时做出正确的假设。

## 关键字段解释

- **Dimensions(尺寸)**：一个 `Vector3Int`，表示体素网格在 X、Y、Z 三个方向的离散数量。例如 `(256, 256, 64)` 表示图像的宽和高各有 256 个体素，总共有 64 张切片。请注意，体素的顺序由切片管理器决定，维度本身不保证排序。
- **Spacing(间距)**：一个 `Vector3`，描述相邻体素之间在物理空间中的距离，通常以毫米为单位。`Spacing.x` 和 `Spacing.y` 对应同一张切片内像素的尺寸，`Spacing.z` 表示相邻切片之间的厚度或距离。
- **Origin(原点)**：一个 `Vector3`，指定体积第 0 个体素在病人坐标系或世界坐标系中的位置。根据 DICOM 标准，原点通常在影像的某个角或外推而得；在程序中，它用于将体数据定位到世界空间。
- **Orientation(方向四元数)**：一个 `Quaternion`，描述从病人坐标系到 Unity 世界坐标系的旋转。目前的大部分操作(例如坐标映射)直接从 `ImageOrientationPatient` 标签中提取方向矩阵，但该四元数字段允许你在没有 `ImageOrientationPatient` 时手动指定整体旋转。
- **DefaultWindowCenter / DefaultWindowWidth(默认窗位/窗宽)**：窗位和窗宽用于将 16 位灰度值映射到 8 位显示强度；`DicomMetadata` 提供合理的初始值，后续可以通过界面动态调整。

## 设置体积属性

调用 `DicomSeries.SetVolumeProperties(dimensions, spacing, origin, orientation)` 即可一次性保存上述所有字段。方法实现非常简单：它将输入参数直接赋值给 `DicomMetadata` 对应字段。这也意味着：

* **调用时机**：请在向序列添加任何切片之前设置体积属性。这保证了随后的切片加载和坐标映射都有一致的几何参照。如果晚于加载切片再设置，将不会自动更新已有切片的空间信息。
* **参数校验**：方法不会检查传入值的有效性，例如维度是否为正数、间距是否为零、四元数是否正规化。因此，需要调用者自己确保这些数据来自可靠的 DICOM 标记(如 `PixelSpacing`、`SliceThickness`、`ImagePositionPatient`)。
* **与 DICOM 数据的关系**：多数 DICOM 文件包含 `PixelSpacing`、`SliceThickness` 和 `ImagePositionPatient` 等标签，可用于构建这些参数；`Orientation` 在绝大多数情况下使用单位四元数或从图像方向矩阵派生。若 DICOM 本身缺失方向信息，可采用默认方向或手动设置。

## 默认窗位和窗宽

医学影像通常存储为 12 或 16 位灰度，而普通显示设备只能处理 8 位通道。为了直观显示不同组织，需要选择一个合适的窗口中心(窗位)和窗口宽度。`DicomMetadata` 将默认值保存在 `DefaultWindowCenter` 和 `DefaultWindowWidth` 中，这些值可能来自 DICOM 文件中的 `WindowCenter`、`WindowWidth` 标签，或者由加载逻辑设定。创建纹理时，若不传入自定义窗位/窗宽，则使用这些默认值。理解这一点能帮助你在调节对比度和亮度时写出更灵活的代码。

## 使用场景示例

* **初始化新的序列**：当读取索引文件后，先调用 `SetVolumeProperties` 来设定体积的几何参数，再按顺序向 `DicomSeries` 添加切片。
* **切换数据集**：如果用户选择加载另一套影像，可以重新调用 `SetVolumeProperties` 更新尺寸、间距和原点，从而为新的切片加载提供正确的基准。
* **调整窗位窗宽的初值**：在某些情况下你可能希望修改默认窗位/窗宽来适配特定类型的影像，例如骨窗和软组织窗。

## 进一步阅读

查看如何文档 [设置体积属性](/guide/core/how_to/01_set_volume_properties.md)，了解在 Unity 中如何通过简单脚本应用这些参数。
