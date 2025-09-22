---
title: 窗位窗宽模块 API
---
# 窗位窗宽模块 API

## 定义

### SetWindowLevel(float center, float width)

- **功能**:调整当前视图的窗位 (`center`) 和窗宽 (`width`)，改变图像灰度映射。
- **参数**:
  - `center`:窗位数值。
  - `width`:窗宽数值。
- **返回值**:无。
- **说明**:若开启了 `useSmoothedWindowLevelChanges`，函数将通过协程平滑过渡到目标值；否则立即应用。调用后会触发 `OnWindowLevelChanged` 事件。

### GetWindowCenter() / GetWindowWidth()

- **功能**:获取当前窗位或窗宽的数值。
- **返回值**:`float` 类型的窗位或窗宽。
- **说明**:可用于在 UI 控件中显示当前值或作为设定新的值时的参考。

### OnWindowLevelChanged

- **类型**:事件 (event)。
- **声明**:`event void WindowLevelChangedEventHandler(float center, float width)`。
- **功能**:当窗位或窗宽发生变化时触发。
- **参数**:新的 `center` 和 `width` 值。
- **说明**:订阅此事件可同步 UI 滑块值或执行其他响应逻辑。

### 控制平滑过渡的属性

- **useSmoothedWindowLevelChanges** (`bool`):是否启用平滑过渡。启用后会在多帧内缓慢接近目标值，默认 `true`。
- **windowCenterChangeSpeed** (`float`):平滑模式下窗位变化的速度，数值越小变化越慢。
- **windowWidthChangeSpeed** (`float`):平滑模式下窗宽变化的速度。

## 用法

1. 在 UI 中设置两个滑块分别控制窗位和窗宽，将滑块回调中调用 `SetWindowLevel()` 更新值。
2. 可以监听 `OnWindowLevelChanged`，以同步滑块位置或更新状态文本，避免递归调用。
3. 根据不同数据类型（CT/MR 等）合理设置滑块的取值范围，避免过大或过小导致全白或全黑。

## 示例（伪代码）

```csharp
// 假设 viewer 为 MPRViewer 实例

// 窗位滑块值变化时
centerSlider.onValueChanged.AddListener(value => {
    float width = viewer.GetWindowWidth();
    viewer.SetWindowLevel(value, width);
});

// 窗宽滑块值变化时
widthSlider.onValueChanged.AddListener(value => {
    float center = viewer.GetWindowCenter();
    viewer.SetWindowLevel(center, value);
});

// 订阅窗位窗宽变化事件
viewer.OnWindowLevelChanged += (float c, float w) => {
    // 同步滑块不触发再次调用
    centerSlider.SetValueWithoutNotify(c);
    widthSlider.SetValueWithoutNotify(w);
    Debug.Log($"窗位窗宽已更新: {c}, {w}");
};
```

> 建议根据 DICOM 序列类型调整滑块的取值范围。例如 CT 图像常见窗宽在 1000–4000 之间，窗位在 -1000 到 1000 之间；MR 图像窗宽通常小于 1000。关闭 `useSmoothedWindowLevelChanges` 可立即应用窗位窗宽更改。