# 调整窗宽窗位

医学图像的窗宽（Window Width, WW）和窗位（Window Center, WL）用于控制灰度显示范围。通过适当调整窗宽窗位，可以突出不同组织的对比度。UI 模块提供两个滑块用于调整这些参数。

## 配置滑块

1. 在 UI 面板中创建两个 MRTK3 `Slider`，并命名为 **WindowCenterSlider** 和 **WindowWidthSlider**。它们的默认取值范围为 0~1。
2. 在 `DicomUIController` 的 `windowCenterMin/Max` 和 `windowWidthMin/Max` 字段中设置实际的最小值和最大值。例如，窗位范围可设置为 -1000~3000，窗宽范围可设置为 1~4000。这些值会根据 DICOM 数据的灰度范围调整。
3. 启用 `autoFindUIElements` 时，确保滑块名称匹配以便自动查找。

## 调整步骤

1. **加载 DICOM 数据**：只有在加载完成后，窗宽窗位滑块才会被启用并同步初始值。
2. **调整窗位 (WL)**：拖动 `WindowCenterSlider` 时会触发 `OnWindowCenterSliderChanged(float value)`：
   - 脚本使用 `Mathf.Lerp(windowCenterMin, windowCenterMax, value)` 将归一化值映射到实际窗位。
   - 调用 `mprViewer.SetWindowLevel(center, currentWidth)` 更新显示。
   - 调用 `slice3DManager.SetWindowLevel(center, currentWidth)` 同步 3D 切片。
3. **调整窗宽 (WW)**：拖动 `WindowWidthSlider` 时会触发 `OnWindowWidthSliderChanged(float value)`：
   - 使用 `Mathf.Lerp(windowWidthMin, windowWidthMax, value)` 计算实际窗宽。
   - 使用当前窗位调用 `SetWindowLevel()` 更新窗宽。
4. **实时反馈**：当窗宽或窗位被其他脚本更改时，`MPRViewer` 会触发 `OnWindowLevelChanged(center, width)`。`DicomUIController` 在回调中使用 `Mathf.InverseLerp()` 将实际数值映射回滑块范围，更新 UI 值。

## 应用预设

如果需要预设几个常用的窗宽窗位组合（例如软组织、骨窗等），可以在 `DicomUIController` 中调用 `ApplyWindowPreset(center, width)` 方法。该方法会同时更新 `mprViewer` 和 `slice3DManager`，并在状态文本中提示当前的窗宽窗位设置。

## 注意事项

* 滑块采用归一化值保存 UI 状态，内部逻辑通过插值转换为实际窗宽和窗位。确保在设置 `windowCenterMin/Max`、`windowWidthMin/Max` 时选择合适的范围，以便滑动细腻且有效。
* 调整窗宽窗位时也会触发 3D 切片显示的更新，以保证 2D 和 3D 视图一致。若希望 3D 不随 2D 调整，需要在脚本中修改对应的同步逻辑。

通过 UI 滑块调整窗宽窗位，可以快速适应不同类型的影像需求，提高临床阅读的灵活性。
