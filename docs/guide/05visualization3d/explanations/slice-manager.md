---
title: DicomSlice3DManager 原理解读
---

# DicomSlice3DManager 原理解读

`DicomSlice3DManager` 是视觉模块的核心管理器，用于协调轴向 (Axial)、矢状 (Sagittal)、冠状 (Coronal) 三个切片平面在 3D 空间中的创建和显示。该组件既可以通过 `autoCreatePlanes` 自动创建平面，也可以绑定预设好的子物体作为平面容器。

## 初始化流程

1. **查找依赖**：在 `Initialize()` 中，管理器会查找 `DicomSeriesLoader`、`MPRViewer` 等依赖，并尝试获取 `MPRViewer` 的 `TextureManager`。
2. **创建平面容器和控制器**：调用 `CreatePlaneContainers()` 和 `CreatePlaneControllers()` 创建或绑定三个平面，并为每个平面添加 `DicomPlaneController` 组件，设置初始颜色、大小、透明度和着色器。
3. **等待数据准备**：在 DICOM 数据和 MPRViewer 纹理尚未准备好时，管理器会使用协程 (`WaitUntilReadyThenSetupPlanes`) 定时检查依赖是否准备好，并在超时后回退到仅使用 `DicomSeries` 生成纹理。
4. **初始化平面位置和纹理**：一旦数据可用，调用 `InitializePlanesPositions()` 将各平面索引设置到各自维度的中间值，并通过 `ForceUpdateAllTextures()` 强制刷新纹理。

管理器内部维护多个协程，并使用 `CanStartCoroutine()` 和 `SafeStartCoroutine()` 保护协程启动，避免在物体未激活或组件禁用的情况下执行。

## 与 DicomSeriesLoader 和 MPRViewer 的交互

- **加载 DICOM 数据**：当 `DicomSeriesLoader` 完成加载时，事件 `OnLoadingComplete` 会触发 `HandleDicomLoadingComplete()`，更新 `dicomSeries` 引用并标记数据就绪。
- **监听 MPRViewer**：若项目启用了 MPRViewer，管理器会等待其 RawImage 纹理准备好，再初始化平面，以避免在 UI 尚未渲染出切片时读取空纹理。通过 `WaitForMPRViewerTextures()` 利用反射检查 `axialImage`、`sagittalImage`、`coronalImage` 是否已设置了 `texture`。

## 平面控制与参数同步

`DicomSlice3DManager` 提供一系列接口用于统一控制三个平面：

- **SetPlanesOpacity(float)**：调整所有平面的透明度。
- **SetPlanesSize(float)**：统一更改平面大小并调用各控制器的 `UpdatePlaneSize()`。
- **SetWindowLevel(center, width)**：同步窗位窗宽到三个平面。
- **SetAxialSliceIndex(int)**、`SetSagittalSliceIndex(int)`、`SetCoronalSliceIndex(int)`：分别设置各平面当前索引。
- **SyncWithMPRViewer()**：从 MPRViewer 获取当前索引并同步到 3D 平面，确保 UI 和 3D 切片一致。

此外，管理器会订阅每个平面的 `OnSliceIndexChanged` 事件，并在索引变化时调用 `mprViewer.SetSliceIndex()` 同步 UI 端的切片。

## 自动恢复与调试

为了适应运行时的动态变化，管理器支持自动重新连接 (`autoReconnect`)。在 `Update()` 中，会检查是否需要重新查找加载器或数据源，保证在后续加载 DICOM 数据时仍然可以初始化平面。通过 `enableDebugLog` 可以输出更多调试信息，方便追踪初始化过程。
