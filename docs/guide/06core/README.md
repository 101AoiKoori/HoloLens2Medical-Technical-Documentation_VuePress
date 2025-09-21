---
title: Core 模块 · 总览
---

# Core 模块概述

Core 模块是整个 **HoloLens2Medical** 项目的基础层，它定义了对医学影像数据的表示方式，并提供了理解 DICOM 数据、管理切片、坐标映射和纹理生成的核心算法。其它模块(加载、成像、界面、可视化等)均以 Core 提供的数据结构和工具为出发点。因此，理解 Core 的设计对于后续功能的扩展和维护至关重要。

## 主要职责

Core 模块围绕几个关键类展开：

- **DicomMetadata**：存储体积的几何信息与显示默认值，包括体素网格尺寸(`Dimensions`)、体素间距(`Spacing`)、原点坐标(`Origin`)、方向四元数(`Orientation`)以及默认窗位和窗宽。该类只是一个数据容器，没有复杂逻辑，但它为解析像素数据提供了统一的几何参照。
- **DicomSlice**：代表一张 DICOM 图像切片，负责从数据集提取元数据和像素数据，支持按需解码 `PixelData`、缓存窗位/窗宽设置，并创建 Unity `Texture2D`。切片还实现了 `IDisposable`，释放纹理和像素数据以节省内存。
- **DicomSliceManager**：维护一个切片列表，并提供添加、排序、索引访问和资源释放的操作。它抽象了切片集合的生命周期，使得 `DicomSeries` 更专注于序列级的逻辑。
- **DicomCoordinateMapper**：通过解析 DICOM 标签 `ImageOrientationPatient` 中的行、列方向向量，推断轴向(Axial)、矢状(Sagittal)和冠状(Coronal)三个解剖平面与体素坐标轴的对应关系，并提供在一维索引、三维体素坐标和二维平面像素坐标之间转换的方法。
- **DicomPlane**：一个简单的枚举，定义了三种解剖平面类型以及常用的工具函数。

## 与其他模块的关系

- **加载模块** 依赖 Core 提供的 `DicomSlice` 和 `DicomSliceManager` 来组织切片，利用 `DicomMetadata` 存储读取到的几何信息，并在完成加载后调用 `SortSlices()` 保证切片顺序。
- **成像模块**(Imaging)在解析像素数据或应用窗位窗宽时直接使用 `DicomSlice` 中的解码和纹理创建函数。
- **界面模块**(UI)和 **视图模块**(Viewers)通过 `DicomCoordinateMapper` 将用户操作(如滑条位置或鼠标点击)映射为体素索引，进而查询或显示对应的切片。
- **三维可视化模块**(Visualization3D)可能利用 `DicomMetadata` 提供的间距和方向信息在世界坐标系中放置体数据，并通过切片类生成体绘制所需的纹理。

## 文档结构

本目录下的文档按「原理说明」和「最小实现」分为两个模块：

### Explanations 设计原理与实现思路

  * [元数据与几何属性解析](./explanations/01_volume_properties.html)
  * [切片集合管理原理](./explanations/02_slice_management.html)
  * [坐标系与方向映射](./explanations/03_orientation_mapping.html)
  * [像素数据解码与纹理生成](./explanations/04_slice_data_and_texture.html)

### implementation 按功能划分的最小实现示例

  * [设置体积属性](./implementation/01_set_volume_properties.html)
  * [切片的添加、排序与释放](./implementation/02_manage_slices.html)
  * [坐标映射实例](./implementation/03_coordinate_mapping_examples.html)
  * [从切片生成纹理并显示](./implementation/04_create_texture_from_slice.html)

---
* [返回首页](../README.md)
