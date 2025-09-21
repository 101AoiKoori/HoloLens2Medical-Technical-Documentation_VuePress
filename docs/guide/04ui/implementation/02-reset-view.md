# 重置视图

在浏览 DICOM 数据或调整窗宽窗位的过程中，有时需要恢复到初始状态。`DicomUIController` 提供了一个 Reset 按钮用于执行这一操作。

## 操作步骤

1. **确保已有加载数据**：重置操作通常在加载 DICOM 数据后使用，否则不会有可显示的内容。
2. **点击 Reset 按钮**：按下 `resetButton` 后会触发 `OnResetButtonClicked()`，该方法检查 `MPRViewer` 是否存在，然后调用 `mprViewer.ResetView()`。
3. **等待回调更新**：`ResetView()` 会重置以下内容：
   - 切片索引：所有平面的索引被设置为中间位置或初始值，并通过 `OnSliceChanged` 事件回调更新对应滑块。
   - 窗宽窗位：重新设置为默认值，并通过 `OnWindowLevelChanged` 回调同步窗口滑块。
4. **用户反馈**：重置完成后，状态文本会更新为“已重置查看器”。UI 控件会根据 MPRViewer 的新状态自动调整。

重置操作是同步的，因此通常会立即生效。如果希望自定义重置逻辑，可在 `MPRViewer` 中实现不同的 `ResetView()` 行为。
