# DicomUIController 原理解读

`DicomUIController` 是 UI 模块中最核心的脚本，它负责管理界面上的所有控件并与数据查看器和 3D 切片管理器进行通信。以下内容详细解释其内部结构和工作原理。

## 字段与配置

* **UI 元素引用**：脚本声明了一系列 `[SerializeField]` 的字段来引用界面上的按钮与滑块，例如 `loadButton`、`resetButton`、`axialSlider`、`windowCenterSlider` 等。若启用 `autoFindUIElements`，这些引用会在运行时自动通过名称查找获得。
* **可视化控制器**：`visibilityController` 引用一个 `MPRVisibilityController` 实例，用于控制三维切片和平面外框的显隐。
* **3D 管理器**：`slice3DManager` 为 `DicomSlice3DManager`，用来同步 3D 切片索引和窗宽窗位。
* **窗宽窗位范围**：`windowCenterMin/Max` 与 `windowWidthMin/Max` 定义了窗位和窗宽的取值范围；滑块提供 0~1 的归一化值，通过线性插值映射到实际范围。
* **内部状态**：`mprViewer` 缓存当前的 `MPRViewer`；`isUpdatingUI` 用于防止 UI 回调与事件回调互相触发导致递归。

## 生命周期流程

1. **Start()**：
   - 如果 `autoFindUIElements` 为真，则调用 `FindUIElements()` 遍历指定的 `uiParent`（或当前节点）寻找命名匹配的控件。
   - 通过 `FindMPRViewer()` 获取场景中的 `MPRViewer` 实例。
   - 调用 `ConnectAllEvents()` 将按钮、滑块与对应事件处理器绑定，并订阅 `MPRViewer` 的事件。
   - 调用 `EnableControls(false)` 禁用所有可交互控件；更新状态提示为“就绪，点击加载按钮加载 DICOM 数据”。
2. **OnDestroy()**：在对象销毁时调用 `DisconnectAllEvents()`，确保事件解除绑定，防止悬挂引用。

## 查找方法

* **FindUIElements()** 会从给定父节点向下递归搜索带有指定名称的组件，例如查找名为 `AxialSlider` 的 `Slider`。若传入 `autoFindUIElements` 参数为真而某字段为空，则自动填充。
* **FindMPRViewer()** 在场景中查找 `MPRViewer`，若未找到则记录警告。这样脚本可以在场景内灵活摆放，无需手动拖拽引用。

## 事件绑定

`ConnectAllEvents()` 将事件分为三个部分绑定：

* **按钮事件**：
  - Load 按钮绑定 `OnLoadButtonClicked()`，调用 `mprViewer.LoadDicomData()` 并显示“正在加载 DICOM 数据...”信息。
  - Reset 按钮绑定 `OnResetButtonClicked()`，调用 `mprViewer.ResetView()` 并更新状态。
  - 显隐按钮直接调用 `visibilityController.TogglePlanesVisibility()` 或 `ToggleBoundingVisibility()` 切换平面或包围盒的可见性。

* **滑块事件**：
  - 三个平面滑块在值更新时调用 `OnPlaneSliderChanged(planeType, newValue)`，根据归一化的 `newValue` 计算新的索引并调用 `mprViewer.SetSliceIndex()`，随后同步 `slice3DManager` 的索引。
  - 窗位滑块更新时调用 `OnWindowCenterSliderChanged(value)`，通过 `Mathf.Lerp(windowCenterMin, windowCenterMax, value)` 计算实际中心值并更新 `mprViewer` 与 `slice3DManager`。
  - 窗宽滑块更新时调用 `OnWindowWidthSliderChanged(value)`，通过插值计算实际宽度并更新窗口级别。

* **MPRViewer 事件**：
  - `OnDicomLoaded` 事件在加载完 DICOM 数据后触发。UI 控制器启用控件、显示切片数量并调用 `UpdateAllSliders()` 初始化滑块位置，同时将加载的系列传递给 `slice3DManager`。
  - `OnWindowLevelChanged` 事件在窗宽窗位被其它脚本更改时触发；通过 `Mathf.InverseLerp()` 将实际数值映射回滑块值，保持 UI 与数据同步。
  - `OnSliceChanged` 事件在任意平面索引改变时触发；根据索引值更新对应滑块的归一化值，防止 UI 与 Viewer 状态不一致。

## 事件处理逻辑

### 加载与重置
`OnLoadButtonClicked()` 首先检查是否存在 `mprViewer`，随后调用 `LoadDicomData()` 启动加载流程，并在 UI 上显示进度信息。当 `MPRViewer` 完成加载时，会自动回调 `HandleDicomLoaded()`。

`OnResetButtonClicked()` 直接调用 `ResetView()` 恢复初始视图。该方法会重置所有切片索引和窗宽窗位，并通过回调更新 UI。

### 切片滑块
在 `OnPlaneSliderChanged()` 中，程序计算当前平面的总切片数，并根据归一化值计算目标索引：

```csharp
int newIndex = Mathf.RoundToInt(normalizedValue * (totalSlices - 1));
mprViewer.SetSliceIndex(planeType, newIndex);
```

然后根据平面类型调用 `slice3DManager.SetAxialSliceIndex()` 等方法同步三维视图。函数中使用 `isUpdatingUI` 标志避免在 UI 更新过程中再触发回调。

### 窗宽窗位滑块
`OnWindowCenterSliderChanged()` 通过线性插值计算新的窗口中心：

```csharp
float center = Mathf.Lerp(windowCenterMin, windowCenterMax, value);
mprViewer.SetWindowLevel(center, currentWidth);

// 同步 3D 显示
slice3DManager.SetWindowLevel(center, currentWidth);
```

`OnWindowWidthSliderChanged()` 类似，通过插值计算新的窗口宽度并保持中心不变。对窗口级别的任何更改都会同步到 3D 切片管理器。

### MPRViewer 事件处理
* **HandleDicomLoaded(int sliceCount)**：启用所有控件、更新状态文本并初始化滑块值；若 3D 管理器尚未设置数据，则通过 `SetDicomSeries()` 指定当前系列。
* **HandleWindowLevelChanged(float center, float width)**：将实际值转换为 0~1 的滑块值后更新滑块，保持 UI 与 MPRViewer 一致。
* **HandleSliceChanged(DicomPlane.PlaneType planeType, int sliceIndex, int totalSlices)**：根据切片索引更新对应的滑块值。

## 工具与公共方法

* **UpdateAllSliders()**：根据当前 MPRViewer 状态一次性刷新所有滑块的取值和启用状态，并更新窗宽窗位滑块。此方法可在数据加载完成或复位时调用。
* **SetMPRViewer(MPRViewer viewer)**：允许在运行时替换 MPRViewer 的引用；会自动断开旧事件并重新绑定新对象的事件。
* **UpdateStatus(string)**：更新状态文本，用于展示加载进度或其它提示。
* **EnableControls(bool)**：统一启用或禁用所有滑块和按钮，常在数据加载前后调用。

通过上述设计，`DicomUIController` 将 UI 逻辑与数据处理逻辑解耦，并确保 UI 状态与底层数据同步，防止事件冲突和反馈循环。
