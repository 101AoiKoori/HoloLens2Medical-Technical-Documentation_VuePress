# 一键复位视图(索引与窗宽窗位)

> 目标：把三平面索引回到中位，并恢复序列默认窗宽窗位。

## 步骤
```csharp
// 恢复：默认窗宽窗位、三平面索引、纹理刷新与闲置回收
viewer.ResetView();
```
## 说明
- 复位时会取消仍在运行的协程，避免资源竞争；
- 会调用 `Resources.UnloadUnusedAssets()` 尝试释放未被引用的纹理；
- 控制台会输出“视图已重置”。

## 附加说明

- **恢复预设**：`ResetView()` 会调用 `DicomSeries.GetDefaultWindowLevel()` 获取序列的默认窗位/窗宽，并将索引置中。如果希望复位到自定义值，可以在复位后立即调用 `SetWindowLevel()` 和 `SetSliceIndex()` 以覆盖默认。
- **多次调用**：重复调用 `ResetView()` 没有副作用。当当前未加载序列时，复位调用会被忽略以避免异常。
- **UI 状态同步**：复位后记得更新滑块位置和窗位窗宽滑块的数值，可在 `OnSliceChanged` 和 `OnWindowLevelChanged` 回调中响应并调用 `SetValueWithoutNotify()`。