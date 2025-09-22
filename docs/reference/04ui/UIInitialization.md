# UI 初始化与事件绑定

## 原理解读

为了让用户界面正常工作，需要在脚本启动时查找并初始化各种控件、绑定事件，并根据状态启用或禁用相应的组件。`DicomUIController` 提供了一套流程来完成这些任务。

* **自动查找 UI 元素**:在 `Start()` 方法中，如果 `autoFindUIElements` 为真，控制器会调用 `FindUIElements()` 从当前对象或指定的 `uiParent` 下查找 `PressableButton`、`Slider`、`TextMeshProUGUI` 等组件。该方法利用递归搜索找到名称匹配的子物体。这样避免了在 Inspector 中逐一拖拽。

* **查找 MPRViewer**:`FindMPRViewer()` 会在场景中查找 `MPRViewer` 组件并赋值给 `mprViewer`。若找不到则打印警告。

* **绑定全部事件**:`ConnectAllEvents()` 用于统一绑定按钮、滑块和 `MPRViewer` 的事件，内部依次调用:
  * `ConnectButtonEvents()`:绑定加载、重置、显隐按钮的 `OnClicked` 事件。
  * `ConnectSliderEvents()`:绑定切片滑块和窗位/窗宽滑块的 `OnValueUpdated` 事件。
  * `ConnectMPRViewerEvents()`:绑定 `mprViewer` 的 `OnDicomLoaded`、`OnWindowLevelChanged` 和 `OnSliceChanged` 事件。

* **禁用控件**:在加载数据之前，调用 `EnableControls(false)` 禁用所有滑块和重置/显隐按钮，防止误操作。

* **更新状态文本**:`UpdateStatus(string status)` 将状态字符串赋值给 `statusText.text`，用于提示用户当前步骤，例如“就绪，点击加载按钮加载DICOM数据”。

* **事件解绑**:在对象销毁 (`OnDestroy()`) 或需要重新绑定时调用 `DisconnectAllEvents()`，依次调用 `DisconnectButtonEvents()`、`DisconnectSliderEvents()` 和 `DisconnectMPRViewerEvents()` 移除监听器，避免引用悬挂。

## 操作指南

1. **配置自动查找**:若希望控制器自动在层级中查找 UI 元素，可将 `autoFindUIElements` 设为 `true`，并在 `uiParent` 字段中指定 UI 根节点。控制器将在启动时递归搜索并赋值。

2. **手动赋值**:如果不使用自动查找，可以在 Inspector 中手动将 `loadButton`、`resetButton`、各滑块以及 `statusText` 拖拽到对应字段。此时建议将 `autoFindUIElements` 设为 `false`，避免重复查找。

3. **绑定 MPRViewer**:在运行时脚本中调用 `SetMPRViewer(myMprViewer)` 指定用于显示影像的 `MPRViewer`。此函数会断开旧的事件并连接新的事件。

4. **初始化流程**:在 `Start()` 中通常执行以下顺序:
   * 查找 UI 元素 (`FindUIElements()`，可自动执行)。
   * 查找或设置 `MPRViewer` (`FindMPRViewer()` 或 `SetMPRViewer()`)。
   * 调用 `ConnectAllEvents()` 绑定按钮、滑块和 MPRViewer 的事件。
   * 调用 `EnableControls(false)` 禁用控件。
   * 调用 `UpdateStatus()` 显示提示文字，如“就绪，点击加载按钮加载DICOM数据”。

5. **在销毁时解绑**:为避免在对象销毁后仍触发回调，应该在 `OnDestroy()` 中调用 `DisconnectAllEvents()`。

### 示例伪代码

```csharp
public class UIInitExample : MonoBehaviour
{
    public DicomUIController ui;
    public MPRViewer viewer;
    public Transform uiRoot;

    void Start()
    {
        // 自动查找 UI 元素
        ui.uiParent = uiRoot;
        ui.autoFindUIElements = true;
        // 设置 MPRViewer
        ui.SetMPRViewer(viewer);
        // 初始化
        ui.EnableControls(false);
        ui.UpdateStatus("就绪，点击加载按钮加载DICOM数据");
    }

    void OnDestroy()
    {
        ui.DisconnectAllEvents();
    }
}
```

通过合理配置和调用这些初始化与绑定函数，可以确保 UI 控件正确地链接到逻辑层，提供稳定可靠的用户体验。