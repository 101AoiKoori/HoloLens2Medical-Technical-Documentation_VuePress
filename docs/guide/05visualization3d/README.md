---
title: visualization3d 模块概述
---

# visualization3d 模块概述

`visualization3d` 模块用于在 Unity 中基于 DICOM 数据实现多平面重建（Multi‑Planar Reconstruction, MPR）的三维可视化。它结合 2D UI 端的切片显示和 3D 场景中的平面，帮助医疗影像应用浏览和交互三维体数据。

## 组成

该模块主要由以下三个脚本组成：

- **DicomPlaneController**：控制单个切片平面的创建、材质设置、纹理更新及交互。
- **DicomSlice3DManager**：统一管理轴向、矢状和冠状三个切片平面，负责初始化、参数同步和事件派发。
- **DicomTextureBridge**：监听 MPRViewer 的 RawImage 纹理变化，将 UI 端的纹理转换为可用于 3D 平面的 Texture2D，并同步到 DicomSlice3DManager。

下面的文档分别从原理和操作指南两方面介绍这些组件的使用。
