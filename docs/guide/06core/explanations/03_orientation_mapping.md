---
title: 坐标系与方向映射
---

# 坐标系与方向映射

在医学影像中，同一副身体扫描可以从不同的解剖平面查看：**轴向**(Axial，头顶‑脚底切片)、**矢状**(Sagittal，左‑右切片)和 **冠状**(Coronal，前‑后切片)。DICOM 文件通过 `ImageOrientationPatient` 标签描述图像的行方向和列方向向量，这两个向量定义了图像在病人坐标系中的朝向。但 Unity 的体素索引和屏幕坐标与病人坐标系不同步，需要一个映射器来桥接。

`DicomCoordinateMapper` 的职责就是读取方向向量并推断出三维网格坐标轴(X/Y/Z)与解剖平面之间的对应关系，同时提供在不同平面之间转换索引和坐标的方法。下面将详细讲解其原理。

## 从数据集解析方向

DICOM 标准规定 `ImageOrientationPatient` 包含 6 个浮点数：前 3 个是图像行方向向量，后 3 个是列方向向量，二者构成一个正交矩阵。`DicomCoordinateMapper.InitializeFromDataset()` 执行以下步骤：

1. **提取向量**：从数据集读取 `ImageOrientationPatient` 标签中的 6 个数，分别组成行向量 r 和列向量 c。如果标签缺失或解析失败，将采用默认方向(X→Sagittal，Y→Coronal，Z→Axial)。
2. **归一化**：对 r 和 c 进行单位化，确保长度为 1，避免由于 DICOM 文件的数值误差产生拉伸。
3. **计算法向量**：通过叉积 n = r × c 计算法向量，它指出切片法线的方向，也即轴向平面的朝向。

这三个向量共同构成了一个右手坐标系 {r, c, n}。如果 DICOM 标签中行/列向量编码不规范(例如顺序错误或出现反转)，结果可能不符合右手系；此时映射器仍然会尝试通过判断符号来推断轴向的正负方向，但显示效果可能颠倒。

## 判定轴向/矢状/冠状轴

病人坐标系的三个基轴分别对应身体的左右 (X\_pat)、前后 (Y\_pat) 和脚头 (Z\_pat)。然而 Unity 体素索引轴(即 `Vector3Int` 的 x/y/z)与病人坐标系不一定一致。映射器需要判断：

1. **哪个坐标轴是轴向索引？** 通过比较法向量 n 在三个轴向的绝对值大小，最大的那一个就是轴向平面对应的体素轴。例如若 |n.z| 最大，则体素的 z 方向对应轴向切片。
2. **矢状与冠状轴**：从剩余两个方向中，优先选择行向量 r 投影更大的轴作为矢状轴，另一个自然就是冠状轴。这一过程同样考虑向量的符号，记录在内部的符号表中，用于后续坐标转换。
3. **轴符号**：行向量和列向量的符号决定了 Unity 体素坐标与病人坐标的方向是否一致。例如如果矢状轴与行向量相反，则后续映射应将索引求反 index = size - 1 - index。

该算法允许在没有先验知识的情况下，将任意方向的 DICOM 切片映射到统一的体素索引系统。若 `ImageOrientationPatient` 不含任何方向信息，则以默认映射代替：X→Sagittal，Y→Coronal，Z→Axial。

## 坐标转换函数

有了上述轴映射和符号表，`DicomCoordinateMapper` 提供了一系列实用方法：

- **`GetCurrentAxesMapping()`**：返回一个三元组 (axialAxis, sagittalAxis, coronalAxis)，各值分别为 0、1 或 2，表示体素索引的 x/y/z 轴归属于哪个解剖平面。
- **`GetAxialDimension(dims)`**、`GetSagittalDimension(dims)`、`GetCoronalDimension(dims)`：根据体积尺寸 `dims`，结合内部符号，计算在每个解剖平面上能获取多少张切片。
- **`MapSagittalIndexToVolume(index, dims)`**、`MapCoronalIndexToVolume(index, dims)`：将平面索引(例如 UI 滑条位置)转换为三维体素坐标。方法根据轴符号决定是否反转索引并将其写入对应轴。
- **`GetCoordinatesInPlane(voxelCoord, planeType)`**：将指定体素坐标投影到某个平面上的二维像素坐标。常用于 MPR 视图中从三维坐标获取对应的二维屏幕坐标。
- **`MapVoxelToAxialPixel(voxelCoord)`**：一个快捷方法，将体素坐标直接映射到轴向平面的像素坐标。

这些函数的组合，使 UI 控件可以在不同平面之间互相跳转。例如在矢状面上拖动滑块时，可以先使用 `MapSagittalIndexToVolume` 得到三维体素坐标，再用 `GetCoordinatesInPlane` 将其投影到轴向平面，从而更新三视图的交叉线位置。

## 使用建议

* **初始化时机**：在加载第一个切片时就应调用 `InitializeFromDataset(dataset)`，否则坐标映射器将使用默认方向，可能导致索引不正确。
* **一次性使用**：方向解析后通常不需要重新初始化，除非加载了不同方向的序列。
* **错误处理**：如果 `ImageOrientationPatient` 数据不完整，映射器会采用默认轴映射。你可以在 UI 中提示用户验证图像方向。

## 进一步阅读

请参考如何文档 [坐标映射示例](/guide/06core/implementation/03_coordinate_mapping_examples.md) 了解如何在代码中调用这些方法，并观察它们在真实场景中的作用。
