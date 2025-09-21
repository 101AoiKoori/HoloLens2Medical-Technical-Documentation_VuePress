---
title: 视觉调整与窗宽窗位
---

# 视觉调整与窗宽窗位

为了让医生或研究者更好地观察 DICOM 数据，必须提供灵活的视觉调整功能。本模块介绍如何调整窗宽窗位、透明度、颜色以及统一控制多个平面。

## 窗宽窗位

窗宽 (`WindowWidth`) 和窗位 (`WindowCenter`) 控制影像的对比度和亮度。它们通常与 CT 或 MRI 扫描的灰度范围相关。通过以下方法调整：

| 方法 | 说明 |
|----|----|
| **SetWindowLevel(float center, float width)** | `DicomPlaneController` 提供的接口。设置当前平面的窗位与窗宽，同时强制刷新纹理。 |
| **SetWindowLevel(float center, float width)** | `DicomSlice3DManager` 的重载，会同时更新三种平面的窗位和窗宽。 |

在调用后，平面将重新渲染并应用新的灰度映射。

## 透明度与颜色

透明度和颜色决定了平面的可视性和叠加效果。相关接口如下：

| 名称 | 作用 |
|----|----|
| **SetOpacity(float opacity)** | 控制单个平面的透明度，范围 0–1。调用后立即更新材质的 `_Opacity` 属性。 |
| **SetColor(Color color)** | 设置单个平面的基准颜色；不影响窗宽窗位映射。 |
| **SetPlanesOpacity(float opacity)** | `DicomSlice3DManager` 方法，统一设置所有平面的透明度。 |
| **SetPlanesSize(float size)** | 调整所有平面的大小。这会调用各控制器的 `UpdatePlaneSize()`。 |

## 使用方法

- 在单平面控制器上调用 `SetWindowLevel()` 或 `SetOpacity()` 可以针对单个平面定制显示效果。
- 如果需要整体调整所有平面，建议通过 `DicomSlice3DManager` 调用 `SetWindowLevel()` 或 `SetPlanesOpacity()` 等方法。这样可以保证三个平面保持一致的视觉风格。

## 使用示例

调节窗宽窗位并更新透明度的示例：

```csharp
// 调整单个轴向平面的窗宽窗位
axialController.SetWindowLevel(center: 40f, width: 350f);
// 设置颜色为淡蓝色，透明度为 0.5
axialController.SetColor(new Color(0.8f, 0.9f, 1f));
axialController.SetOpacity(0.5f);

// 统一调整所有平面
sliceManager.SetWindowLevel(center: 30f, width: 300f);
sliceManager.SetPlanesOpacity(0.6f);
sliceManager.SetPlanesSize(0.8f);
```

通过这些接口，可以让用户根据不同需求调整视觉参数，从而获得更清晰的解剖信息。
