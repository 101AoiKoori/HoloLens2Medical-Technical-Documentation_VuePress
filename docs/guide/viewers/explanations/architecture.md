# Viewers 模块架构总览(MPRViewer)

> 适用范围：HoloLens2Medical 工程中的三平面浏览(Axial/ Sagittal/ Coronal)。本文解释 **MPRViewer** 的分层、职责与事件机制，帮助后续开发者理解代码组织并安全扩展。

## 目标与定位
- 提供一个能在 Unity 场景中直接使用的 **三平面医学影像浏览器**。
- 与 Loading/Imaging/Core 模块解耦，关注 **UI 纹理展示、切片导航、窗位窗宽、后台加载、内存管理**。
- 文档定位为“半成品工程说明”，便于下一位维护者快速接手与改造。

## 类与子模块拆分
MPRViewer 采用 **partial class** 将功能拆分为五个内部子模块：

- **Loader**：与 `DicomLoader`/`DicomSeriesLoader` 对接，接收加载完成回调，设置 `DicomSeries` 与初始索引，并触发三平面纹理生成(可渐进)。
- **SliceControl**：维护三平面当前索引(轴向/矢状/冠状)，提供 `SetSliceIndex/GetCurrentIndex/GetTotalSlices`，并在变更时通知 UI 与后台预取。
- **WindowLevel**：管理窗位(WindowCenter)与窗宽(WindowWidth)，支持平滑过渡与立即应用两种模式，统一向纹理生成端广播更新。
- **TextureUpdater**：与 `MPRTextureManager`/`DicomTextureCreator` 协作，生成/缓存/更新三平面 `Texture2D` 并绑定到 `RawImage`。
- **Coroutine**：统一管理所有协程、纹理资源释放与(简化的)内存压力检测，提供“取消全部”“按需卸载”。

> (截图占位)![MPRViewer 模块关系图](./images/placeholder-architecture.png)

## 关键引用与外部依赖
- UI：三个 `RawImage`(`axialImage/sagittalImage/coronalImage`)。
- 数据：`DicomSeries`(包含 `Slices` 及按索引生成三平面纹理的协程)。
- 纹理管理：`MPRTextureManager`(缓存/索引/键值生成、批量取消请求等)。
- 事件：`OnDicomLoaded / OnSliceChanged / OnWindowLevelChanged`(外部可订阅)。

## 生命周期钩子(Awake/Start/Enable/Disable/Destroy)
- **Awake**：实例化各子模块；初始化 `MPRTextureManager`；设置初始窗位窗宽；开启内存监测计时。
- **Start**：初始化 DICOM 加载器(从组件上获取或自动挂载 `DicomSeriesLoader`)。
- **OnEnable/OnDisable**：注册/注销纹理事件；禁用时取消所有协程。
- **OnDestroy**：标记关闭、取消协程并释放纹理资源。

> (截图占位)![Inspector 基本引用](./images/placeholder-inspector.png)

## 事件与对外接口(最小集合)
- **加载**：`LoadDicomData()` → 内部调用 Loader.StartLoading()。
- **切片**：`SetSliceIndex(plane, index)` / `GetSliceIndex(plane)` / `GetSliceCount(plane)`。
- **窗宽/窗位**：`SetWindowLevel(center, width)` / `GetWindowCenter()` / `GetWindowWidth()`。
- **复位**：`ResetView()`(重设窗位窗宽/索引，刷新三平面纹理，释放闲置资源)。
- **事件**：`OnDicomLoaded(int sliceCount)`、`OnSliceChanged(plane, index, total)`、`OnWindowLevelChanged(center, width)`。

## 可扩展边界(建议)
- Texture 缓存策略：替换为 LRU/两级缓存以降低内存峰值。
- 后台加载策略：根据设备内存与 FPS 动态调整批量尺寸与间隔。
- UWP/HL2 路径与权限：与 Loading 模块统一定义 StreamingAssets/沙盒策略。

> (截图占位)![UI 三平面示意](./images/placeholder-3planes.png)

## 实现细节与技巧

- **partial class 的优势**：将复杂功能拆分到多个 `.cs` 文件有助于版本控制和代码可读性，但你仍然可以在同一类中共享字段和方法。这一拆分方式在 Unity 中非常实用。
- **事件注册与注销**：在 `Awake`/`OnEnable` 中订阅 `OnSliceChanged`、`OnWindowLevelChanged` 等事件，在 `OnDisable`/`OnDestroy` 中对应注销，避免内存泄露。
- **UI 组件绑定**：务必在 Inspector 中绑定所有 `RawImage` 引用。若你想使用 `MeshRenderer` 或 3D 材质来展示切片，可在 `TextureUpdater` 中改为设置 `Material.mainTexture`。
- **命名规范**：保持场景对象、脚本和命名空间一致，例如 `MPRViewer.SliceControl` 对应脚本 `MPRViewer.SliceControl.cs`，便于查找和维护。