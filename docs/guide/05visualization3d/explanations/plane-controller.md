---
title: DicomPlaneController 原理解读
---

# DicomPlaneController 原理解读

`DicomPlaneController` 负责单个切片平面的创建、渲染和交互控制。它可绑定在一个 `GameObject` 上，根据 `planeType` 生成或绑定一个 Quad 作为切片平面，并根据不同的平面类型调整朝向。

## 平面类型和朝向

| 平面类型 | 对应解剖面 | Quad 的旋转 |
|---------|-----------|-------------|
| **Axial** | 轴向（水平面） | 绕 X 轴旋转 90°、Y 轴旋转 180° |
| **Sagittal** | 矢状（左右分割） | 绕 Y 轴旋转 -90° |
| **Coronal** | 冠状（前后分割） | 无需旋转 |

初始化时，脚本根据 `planeSize` 设置平面的缩放，并将平面放置到父物体中心。

## 材质与窗宽窗位

切片的着色器优先使用 `Custom/DicomSliceShader`，如果项目未包含该着色器则回退到 `Unlit/Transparent` 或 `Transparent/Diffuse`。  
材质暴露以下属性用于调整亮度和对比度：

- `_WindowCenter`：窗位，调整影像亮度。
- `_WindowWidth`：窗宽，调整影像对比度。
- `_Opacity`：整体透明度。
- `_Color`：平面颜色，可用于着色或叠加不同平面颜色。

脚本提供 `SetWindowLevel(center, width)`、`SetColor(color)` 和 `SetOpacity(opacity)` 方法在运行时调整这些参数。

## 纹理来源与更新流程

每当设置切片索引或者 DICOM 数据准备就绪后，`DicomPlaneController` 会通过协程异步更新纹理。它按照如下优先级尝试获取纹理：

1. **MPRViewer 的 TextureManager**：如果 `mprViewer` 存在且已缓存 TextureManager，优先从中获取对应平面和索引的纹理。
2. **MPRViewer RawImage**：通过反射获取 MPRViewer 内部的 RawImage（如 `axialImage`），读取其 Texture2D。
3. **DicomSeries**：直接使用 `DicomSeries` 创建切片纹理，包括 `GetAxialTexture`、`CreateSagittalTexture` 和 `CreateCoronalTexture`。

当从任一来源获取到纹理后，会设置纹理的过滤模式与 wrap 模式，并赋值到材质的 `mainTexture`，同时通过 `currentTexture` 缓存以避免重复设置。

为了提升健壮性，脚本在协程启动前通过 `CanStartCoroutine()` 检查 `GameObject` 是否处于激活状态；若未激活则暂存索引并推迟更新。当纹理更新完成后触发 `OnSliceIndexChanged` 事件，以便外部同步状态。

## 平面位置与切片索引

在 3D 场景中，三个切片平面需要沿不同轴移动以展示不同层面。`SetSliceIndex(int index)` 方法会根据总切片数将索引归一化到 `[0, 1]` 区间，然后根据 `planeType` 在限定的 `movementRange` 内沿某轴移动：

- **Axial**：沿 Y 轴移动。
- **Sagittal**：沿 X 轴移动。
- **Coronal**：沿 Z 轴移动。

这种移动方式使 3D 空间中三个平面交错显示，从而模拟 DICOM 体数据的翻阅。
