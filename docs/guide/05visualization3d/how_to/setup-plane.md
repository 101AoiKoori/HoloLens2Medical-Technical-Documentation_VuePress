---
title: 如何使用 DicomPlaneController
---

# 如何使用 DicomPlaneController

本指南介绍如何在项目中使用 `DicomPlaneController` 来创建和控制单个 DICOM 切片平面。

## 准备工作

1. **挂载脚本**：在 Unity 场景中创建一个空对象或用于显示切片的容器，在其上添加 `DicomPlaneController` 组件。
2. **配置属性**：
   - **planeType**：选择 Axial、Sagittal 或 Coronal，决定平面朝向。
   - **dicomSeries**：指定要显示的 `DicomSeries`。
   - **mprViewer**：如果需要与 UI 端同步显示，可赋值场景中的 `MPRViewer`。
   - **dicomSliceShader**：可留空，脚本会自动查找合适的着色器。
   - **planeSize**：控制平面大小，默认 0.5。
   - **planeOpacity**：控制透明度，范围 0.1–1.0。
   - **movementRange**：平面沿轴移动的最大距离，影响切片翻阅范围。

3. **初始化**：在脚本的 `Start()` 中会自动调用 `Initialize()`；也可以在设置好属性后手动调用 `Initialize()`。

## 调整窗口和色彩

- **亮度对比度**：调用 `SetWindowLevel(center, width)` 调整窗位（亮度）和窗宽（对比度）。
- **颜色与透明度**：
  - 使用 `SetColor(Color)` 改变平面颜色，可用于给不同平面着色。
  - 使用 `SetOpacity(float)` 调整透明度。

## 切换切片

- 使用 `SetSliceIndex(int index)` 设置当前切片序号。索引范围为 0 到 `GetTotalSliceCount() - 1`。
- 可使用 `GetCurrentSliceIndex()` 获取当前索引。
- 调用 `ForceUpdateTexture()` 强制重新加载纹理，通常在数据或窗位改变后使用。

## 事件监听

`DicomPlaneController` 提供 `OnSliceIndexChanged` 事件。当切片索引变化时会触发回调，可用于同步其他组件。例如：

```csharp
planeController.OnSliceIndexChanged += (type, index) => {
    Debug.Log($"平面 {type} 的切片索引变为 {index}");
};
```

## 调试建议

- 若切片显示异常，请确认 `dicomSeries` 已正确加载并且 `DicomPlaneController` 所在的 `GameObject` 已激活。
- 若与 `MPRViewer` 同步失败，可尝试设置更大的 `movementRange` 或在 `Update()` 中调用 `ForceUpdateTexture()`。
