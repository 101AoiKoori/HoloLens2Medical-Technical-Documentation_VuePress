---
title: 如何使用 DicomSlice3DManager
---

# 如何使用 DicomSlice3DManager

本指南介绍如何配置并使用 `DicomSlice3DManager` 管理三维切片平面。

## 快速开始

1. **添加组件**：在 Unity 场景中新建一个空对象并挂载 `DicomSlice3DManager`。
2. **设置数据源**：
   - **dicomSeries**：如果提前加载了 `DicomSeries`，可直接在检查器中赋值。
   - **mprViewer**：可选引用，如果项目使用了 2D MPRViewer，可赋值以同步切片索引。
   - **seriesLoader**：若采用异步加载，可指定 `DicomSeriesLoader`，管理器会在加载完成后自动接收数据。

3. **配置外观**：
   - **planeSize**：平面尺寸，默认 0.5。
   - **planeOpacity**：透明度，范围 0.1–1.0。
   - **planeMovementRange**：平面沿轴移动的范围，影响切片翻阅距离。
   - **dicomSliceShader** / **planesSharedMaterial**：可自定义着色器或材质。

4. **自动创建平面容器**：若未指定 `axialPlaneContainer`、`sagittalPlaneContainer`、`coronalPlaneContainer`，且 `autoCreatePlanes` 为 true，脚本会在 `planesParent` 下自动创建三个子对象。

5. **初始化**：在运行时，脚本会自动调用 `Initialize()`。也可以在所有引用准备好后手动调用。

## 调整参数

- **透明度**：使用 `SetPlanesOpacity(float opacity)` 同时调整所有平面的透明度。
- **尺寸**：使用 `SetPlanesSize(float size)` 统一调整平面大小。
- **窗位窗宽**：调用 `SetWindowLevel(center, width)` 同步调整三个平面的窗位和窗宽。
- **切片索引**：分别调用 `SetAxialSliceIndex(index)`、`SetSagittalSliceIndex(index)`、`SetCoronalSliceIndex(index)`，或在外部 UI 控件中绑定这些方法。

## 监听切片变化

`DicomSlice3DManager` 提供 `OnSliceChanged` 事件，当任一平面的索引变化时触发，可用于驱动 UI 更新或其他逻辑：

```csharp
sliceManager.OnSliceChanged += (planeType, sliceIndex) => {
    // 更新自定义 UI
};
```

若需要实时同步 UI 与 3D 端的索引，可在适当时机调用 `SyncWithMPRViewer()`。

## 处理延迟加载

- 若依赖的 `DicomSeries` 或 `MPRViewer` 在运行时才加载，管理器会通过 `WaitUntilReadyThenSetupPlanes()` 协程等待数据准备好。
- 可调节 `initializationDelay`、`textureCheckInterval` 和 `maxTextureCheckAttempts` 控制等待时间和重试次数。
- 当加载时间较长或不使用 MPRViewer 时，可将 `autoReconnect` 设置为 true，管理器会在 `Update()` 中定期检查数据并重新初始化。

## 调试建议

启用 `enableDebugLog` 可以在控制台输出初始化流程和索引同步的详细信息。若 3D 平面未显示纹理，请检查：

- `dicomSeries.Slices` 是否有数据。
- MPRViewer 是否正确生成了 RawImage 的纹理。
- 平面容器的缩放和位置是否合适。
