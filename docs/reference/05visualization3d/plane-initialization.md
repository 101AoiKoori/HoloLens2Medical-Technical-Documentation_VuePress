---
title: 切片平面初始化与创建
---

# 切片平面初始化与创建

本模块介绍如何创建和初始化 DICOM 切片平面。通过合理配置平面参数，可以在场景中生成符合解剖面方向的 Quad，并为后续的切片导航和渲染打下基础。

## 定义

切片平面由 `DicomPlaneController` 组件控制。每个平面对应一个解剖面:

| 属性名 | 说明 |
|-------|------|
| **planeType** | 平面类型，枚举值 `Axial`、`Sagittal` 或 `Coronal`，决定平面朝向。 |
| **planeObject** | 渲染切片的 Quad。如果未设置，`Initialize()` 会自动创建一个 `PrimitiveType.Quad`。 |
| **planeSize** | 控制平面在 X/Y 方向的缩放，默认 `0.5f`，值越大，平面越大。 |
| **planeColor** | 平面颜色，可用于区分不同方向的切片。 |
| **planeOpacity** | 材质透明度，范围 0.1–1.0，影响切片可视程度。 |
| **movementRange** | 沿轴移动的范围，用于控制切片翻页时平面移动的距离。 |
| **dicomSeries** | 要渲染的 `DicomSeries`，在初始化前必须赋值或由管理器设置。 |
| **mprViewer** | 可选。如果指定，该平面优先从 MPRViewer 获取纹理，以保持与 UI 端同步。 |

初始化过程会根据 `planeType` 调整 Quad 的旋转:轴向平面绕 X 轴 90° 和 Y 轴 180°，矢状平面绕 Y 轴 -90°，冠状平面不旋转。然后将其缩放至 `planeSize` 并放置到父物体中心。

## 使用方法

1. 在场景中创建一个空对象或容器。添加 `DicomPlaneController` 组件。
2. 设置解剖面类型 (`planeType`) 和数据源 (`dicomSeries`)。
3. （可选）设置 `mprViewer` 以同步纹理，调整平面的 `planeSize`、`planeColor`、`planeOpacity` 与 `movementRange`。
4. 调用 `Initialize()`（通常在 `Start()` 中自动执行），平面会自动创建并应用材质。

## 使用示例

下面是创建一个矢状平面并设置其大小和颜色的伪代码示例:

```csharp
// 创建一个用于承载切片的对象
GameObject sagittalGO = new GameObject("SagittalPlane");
// 添加控制器并配置参数
var controller = sagittalGO.AddComponent<DicomPlaneController>();
controller.planeType = DicomPlane.PlaneType.Sagittal;
controller.dicomSeries = dicomSeries;
controller.planeSize = 0.7f;           // 调整平面大小
controller.planeColor = new Color(1f, 0.9f, 0.9f, 1f); // 淡粉色调
controller.planeOpacity = 0.9f;
// 初始化平面，会自动创建 Quad 并设置朝向
controller.Initialize();
```

通过这些步骤即可在场景中生成并初始化一个切片平面，为后续的切片控制和视觉调整奠定基础。
