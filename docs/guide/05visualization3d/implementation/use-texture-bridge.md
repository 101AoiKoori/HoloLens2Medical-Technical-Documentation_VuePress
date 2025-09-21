---
title: 如何使用 DicomTextureBridge
---

# 如何使用 DicomTextureBridge

`DicomTextureBridge` 用于在 2D UI 的 MPRViewer 与 3D 切片平面之间同步纹理。本指南介绍如何配置该组件。

## 基本步骤

1. **添加组件**：在场景中创建一个空对象或复用已有对象，挂载 `DicomTextureBridge` 组件。
2. **指定引用**：
   - **mprViewer**：赋值场景中的 `MPRViewer` 组件；如果留空，脚本会自动查找。
   - **dicomSeries**：可留空，脚本会从 `MPRViewer` 获取已加载的 `DicomSeries`。
   - **sliceManager**：赋值 `DicomSlice3DManager`，用于将转换后的纹理传递到 3D 平面。
3. **初始化**：在 `Start()` 中会自动调用 `Initialize()`；也可以在代码中手动调用。

## 调整选项

- **textureFilterMode**：指定生成的 Texture2D 的过滤模式，默认 `Bilinear`，可根据需求设置为 `Point` 等。
- **enableLogging**：勾选后会输出调试信息，有助于定位纹理转换问题。

## 使用场景

- **在 UI 控件切换切片时更新 3D 平面**：`DicomTextureBridge` 会监听 `MPRViewer.OnSliceChanged` 事件，并实时转换新的 RawImage 纹理，同步到对应的平面控制器。
- **调整窗位窗宽后更新纹理**：当医生调节窗宽窗位时，脚本会重新转换所有纹理，确保 3D 端显示一致。
- **DICOM 加载完成后初始化**：在 `OnDicomLoaded` 事件中，脚本会重新查找 RawImage，并延迟更新纹理以等待 MPRViewer 完全生成 RenderTexture。

## 注意事项

- 确保 `DicomTextureBridge` 与 `DicomSlice3DManager` 在同一场景中；否则转换后的纹理无法传递给平面。
- 如果使用了多个 MPRViewer，请确保每个桥接组件绑定正确的 `sliceManager`。
- 在批量更新纹理时可以调用 `ConvertAndUpdateAllTextures()`，该方法会依次更新三个平面的纹理。
