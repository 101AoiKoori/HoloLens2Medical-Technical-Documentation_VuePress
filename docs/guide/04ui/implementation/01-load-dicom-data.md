# 加载 DICOM 数据

本指南介绍如何通过 UI 模块加载 DICOM 数据集。该操作通常由 `LoadButton` 触发，在加载完成前 UI 控件会被禁用以防止误操作。

## 前提条件

1. 场景中存在已配置好的 `MPRViewer`，负责解析并显示 DICOM 系列。
2. `DicomUIController` 脚本挂载在 UI 面板上，且 `loadButton` 引用了合适的 `PressableButton`。
3. 如果使用自动查找模式，则确保按钮节点命名为 **LoadButton**，或者手动拖拽引用到 `loadButton` 字段。

## 操作步骤

1. **初始化 UI**：运行应用后，`DicomUIController` 会在 `Start()` 中禁用所有滑块和按钮，并在状态文本中提示“就绪，点击加载按钮加载 DICOM 数据”。
2. **点击 Load 按钮**：用户点击按钮后，`OnLoadButtonClicked()` 会调用 `MPRViewer.LoadDicomData()` 并更新状态为“正在加载 DICOM 数据...”。这会打开文件选择器或自动加载预定义路径下的 DICOM 文件（取决于 `MPRViewer` 的实现）。
3. **等待加载完成**：加载过程是异步的，完成后 `MPRViewer` 会触发 `OnDicomLoaded(int sliceCount)` 事件。UI 控制器收到此事件后会：
   - 启用所有滑块和按钮，使其可以调整切片或窗宽窗位。
   - 调用 `UpdateAllSliders()` 为每个平面计算合适的滑块值并启用或禁用某些滑块（例如当某方向只有一张切片时禁用对应滑块）。
   - 在状态文本中显示“DICOM 数据加载完成，共 *N* 张切片”。
   - 如果 `DicomSlice3DManager` 还未关联 DICOM 序列，则通过 `slice3DManager.SetDicomSeries(mprViewer.GetLoadedSeries())` 同步数据。

加载完成后，用户即可使用其它功能如浏览切片、调整窗宽窗位或控制三维平面的显隐。
