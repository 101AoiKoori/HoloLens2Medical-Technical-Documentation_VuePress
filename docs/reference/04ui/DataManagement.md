# 数据加载与重置

## 原理解读

医学影像查看器首先需要加载 DICOM 数据才能显示切片。`DicomUIController` 提供了与数据加载和重置相关的一组方法，用于控制 `MPRViewer` 组件的行为。主要涉及以下几个部分：

* **加载按钮回调**：`OnLoadButtonClicked()` 在用户点击“加载”按钮时触发。它检查 `mprViewer` 是否存在，如存在则调用 `mprViewer.LoadDicomData()` 开始加载 DICOM 数据，并在状态文本中显示“正在加载DICOM数据...”。如果 `mprViewer` 为空，则提示未找到组件。

* **重置按钮回调**：`OnResetButtonClicked()` 在用户点击“重置”按钮时触发。该函数调用 `mprViewer.ResetView()` 复位当前查看器，并更新状态文本为“已重置查看器”。

* **加载完成处理**：当 `mprViewer` 内部成功加载 DICOM 数据时，会触发 `OnDicomLoaded` 事件。`DicomUIController` 在 `ConnectMPRViewerEvents()` 中将此事件绑定到 `HandleDicomLoaded(int sliceCount)`。该方法会启用所有 UI 控件、更新状态文本并调用 `UpdateAllSliders()` 刷新滑块。若 `slice3DManager` 还未加载系列数据，则通过 `slice3DManager.SetDicomSeries(...)` 让三维切片管理器获得同一数据集。

* **设置 MPRViewer**：`SetMPRViewer(MPRViewer viewer)` 用于指定当前控制器所操作的 MPRViewer 实例。它会先断开旧实例的事件，再连接新实例的 `OnDicomLoaded`、`OnWindowLevelChanged` 和 `OnSliceChanged` 事件。

## 操作指南

1. **准备组件**：在 Unity 场景中，确保存在 `MPRViewer`、`DicomUIController` 和相应的加载、重置按钮。可以通过拖拽方式在 Inspector 中把按钮赋值给 `loadButton` 和 `resetButton`。若 `autoFindUIElements` 为真，控制器会自动查找这些组件。

2. **绑定视图**：在运行时脚本中，调用 `DicomUIController.SetMPRViewer(myMprViewer)` 将需要加载数据的 `MPRViewer` 实例关联到 UI 控制器。

3. **加载数据**：用户点击“加载”按钮后，`OnLoadButtonClicked()` 会调用 `mprViewer.LoadDicomData()`。加载过程异步完成，控制器会将所有滑块和重置按钮设为不可用，直到接收到 `OnDicomLoaded` 事件。

4. **加载完成**：当数据加载完成时，`HandleDicomLoaded(sliceCount)` 会启用控件、刷新滑块并更新提示文字，显示加载的切片数量。

5. **重置查看器**：用户点击“重置”按钮时，`OnResetButtonClicked()` 会调用 `mprViewer.ResetView()`。这将切片索引重置到初始状态，窗位/窗宽回到默认值，并更新状态文本。

6. **处理预设窗位**（可选）：有时需要在加载完成后快速应用特定的窗位和窗宽组合。`ApplyWindowPreset(float center, float width)` 方法会调用 `mprViewer.SetWindowLevel(center, width)` 同时设置窗位与窗宽，并更新三维切片。

### 示例伪代码

```csharp
public class DataLoaderExample : MonoBehaviour
{
    public DicomUIController ui;
    public MPRViewer viewer;

    void Start()
    {
        ui.SetMPRViewer(viewer);    // 绑定 MPRViewer
        ui.EnableControls(false);    // 初始禁用控件
        ui.UpdateStatus("就绪，点击加载数据");
    }

    // 用户点击加载按钮时触发
    public void OnLoad()
    {
        // 控制器会自行处理加载过程
    }

    // 用户点击重置按钮时触发
    public void OnReset()
    {
        // 调用 ResetView 并重置状态
    }
}
```

通过上述步骤，即可完成 DICOM 数据的加载、重置及加载完成后的 UI 更新。