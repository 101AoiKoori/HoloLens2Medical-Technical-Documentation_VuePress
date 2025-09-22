---
title: 多平面管理器使用
---

# 多平面管理器使用

当需要同时观察三个互相垂直的切片时，可以使用 `DicomSlice3DManager` 统一创建和管理三个 `DicomPlaneController`。本模块介绍如何使用管理器进行初始化、更新参数和同步索引。

## 定义与职责

`DicomSlice3DManager` 负责:

1. **加载数据**:通过 `DicomSeriesLoader` 或直接设置 `dicomSeries`，在数据准备好后初始化切片平面。
2. **创建平面**:根据 `autoCreatePlanes` 设置创建或绑定轴向、矢状和冠状平面的容器，并添加 `DicomPlaneController`。
3. **统一控制**:提供方法一次调整三个平面的大小、透明度、窗宽窗位和切片索引。
4. **事件传递**:在任意平面的切片索引变化时触发 `OnSliceChanged` 事件，并在需要时同步到 2D MPRViewer。

## 核心方法

| 方法 | 描述 |
|----|----|
| **Initialize()** | 查找依赖（加载器、MPRViewer），创建平面容器和控制器，等待数据准备好并初始化平面。 |
| **SetDicomSeries(DicomSeries series)** | 设置新的 DICOM 数据源；在数据有效时重新初始化平面。 |
| **SetMPRViewer(MPRViewer viewer)** | 更新 MPRViewer 引用；此后管理器会优先从 MPRViewer 获取纹理并同步索引。 |
| **SetPlanesOpacity(float opacity)** | 一次调整三个平面的透明度。 |
| **SetPlanesSize(float size)** | 一次调整三个平面的大小。 |
| **SetWindowLevel(float center, float width)** | 设置所有平面的窗位与窗宽。 |
| **SetAxialSliceIndex(int index)** 等 | 单独设置某个方向平面的切片索引。 |
| **ForceUpdateAllTextures()** | 强制刷新所有平面的纹理，通常在窗位窗宽变化或数据更新后调用。 |
| **SyncWithMPRViewer()** | 从 MPRViewer 获取当前切片索引并同步至所有 3D 平面。 |

管理器还提供 `autoReconnect` 选项，在运行时重新寻找数据源并初始化平面，适用于动态加载场景。通过 `enableDebugLog` 可输出调试信息，帮助定位初始化过程中的问题。

## 使用方法

1. 在场景中新建一个对象，并添加 `DicomSlice3DManager` 组件。
2. 设置 `dicomSeries`、`mprViewer` 或 `seriesLoader` 引用。若在运行时加载，请确保组件的 `autoReconnect` 设置为 `true`。此时管理器会在 `Start()` 内或调用 `Initialize()` 时自动查找资源。
3. 调整外观参数，如 `planeSize`、`planeOpacity`、`planeMovementRange` 和 `dicomSliceShader`。这些值将在创建平面时应用。
4. （可选）订阅 `OnSliceChanged` 事件，以便在用户导航切片时更新自定义 UI 或其他逻辑。

## 使用示例

下面示例展示了如何创建管理器并绑定数据源:

```csharp
// 创建管理器
GameObject managerGO = new GameObject("SliceManager");
var manager = managerGO.AddComponent<DicomSlice3DManager>();
// 指定异步加载器
manager.seriesLoader = loader;
// 指定 MPRViewer 以同步索引
manager.mprViewer = mprViewer;
// 调整平面外观
manager.planeSize = 0.6f;
manager.planeOpacity = 0.8f;
manager.planeMovementRange = 0.4f;
// 初始化管理器
manager.Initialize();
// 订阅切片变化事件
manager.OnSliceChanged += (planeType, index) => {
    Debug.Log($"平面 {planeType} 切片已更新到 {index}");
};
// 加载 DICOM 数据（异步）
loader.LoadFromDirectory("/path/to/dicom");
// 等待加载完成后，管理器会自动创建和显示三个平面
```

通过管理器，可以大幅简化多平面显示和同步的代码量，提高程序的可维护性。
