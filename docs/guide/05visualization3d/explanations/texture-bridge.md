---
title: DicomTextureBridge 原理解读
---

# DicomTextureBridge 原理解读

`DicomTextureBridge` 用于桥接 2D UI 中的 MPRViewer 和 3D 切片平面之间的纹理数据。当 MPRViewer 使用 RawImage 显示切片时，该脚本实时监听切片变化和窗宽窗位变化，将 RawImage 的纹理转换为 `Texture2D` 并同步到 `DicomSlice3DManager`。

## 寻找 RawImage

在 `Initialize()` 中，脚本通过反射从 `MPRViewer` 中获取三个私有字段：

- `axialImage`、`sagittalImage`、`coronalImage`：对应三种解剖面在 UI 中的 RawImage 组件。

若没有提供 `mprViewer` 引用，脚本会自动查找场景中的 MPRViewer；如果没有 `DicomSlice3DManager`，也会查找并绑定它。

## 事件监听与纹理更新

`DicomTextureBridge` 注册了 MPRViewer 的以下事件：

- **OnSliceChanged**：当 UI 切片索引变化时，会调用 `ConvertAndUpdateXxxTexture()` 将新的 RawImage 纹理转换为适用于 3D 的纹理。
- **OnDicomLoaded**：在 DICOM 数据加载完成后重新查找 RawImage，并延迟更新纹理，确保 MPRViewer 已生成 RenderTexture。
- **OnWindowLevelChanged**：当窗位窗宽调整时，重新转换所有纹理，以保持 3D 平面的显示一致。

脚本还启动了一个长时间运行的协程 `MonitorTextureChanges()`，定期检查 RawImage 的 `texture` 是否发生变化。如果发现变化则触发转换，避免 UI 更新时 3D 显示不同步。

## 纹理转换过程

RawImage 在 UI 中通常使用 RenderTexture 类型。为了在 3D 平面中使用，脚本执行如下转换：

1. 使用 `Graphics.Blit()` 将源纹理复制到临时 `RenderTexture`。
2. 创建一个新的 `Texture2D`，尺寸与源纹理一致，并设置过滤模式 (`textureFilterMode`) 和包裹模式为 Clamp。
3. 将 `RenderTexture` 中的像素拷贝到 `Texture2D`。
4. 遍历像素数组，将每个像素的最大 RGB 分量赋值给 R、G、B 通道，实现灰度均衡。
5. 调用 `Apply()` 应用修改，并释放临时资源。

转换完成后，通过回调函数将新的 Texture2D 设置到对应的平面控制器中，例如：

```csharp
sliceManager.AxialPlane.SetTexture(convertedAxialTexture);
```

同时缓存 `convertedAxialTexture`、`convertedSagittalTexture` 和 `convertedCoronalTexture`，避免重复转换。

## 优化与安全措施

- 在每次启动协程或响应事件前，使用 `CanStartCoroutine()` 检查脚本所在的 `GameObject` 是否处于激活状态，防止在禁用状态下执行多余的操作。
- 使用标志 `isProcessingAxial`、`isProcessingSagittal`、`isProcessingCoronal` 避免对同一平面同时发起多个转换协程。
- 可通过 `enableLogging` 开启调试日志，帮助排查纹理转换问题。
