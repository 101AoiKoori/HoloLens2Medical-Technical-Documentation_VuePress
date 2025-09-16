# 窗位(Center)与窗宽(Width)的应用与平滑过渡

## 两种模式
- **平滑模式**(默认)：逐帧 Lerp(`windowCenterChangeSpeed/windowWidthChangeSpeed`)，每帧应用并更新三平面当前索引的纹理；
- **立即模式**：直接写入并广播更新。

## 推荐使用方式
- 拨动滑块时启用平滑模式，交互更稳；
- 单击“重置/预设”时用立即模式，避免长时间过渡。

## 统一的更新路径
- `SetWindowLevel(center, width)` →
  - 平滑：`SmoothWindowLevelTransition()` 持续调用 `ApplyWindowLevel`；
  - 立即：直接 `ApplyWindowLevel(center, width)`；
- `ApplyWindowLevel` 负责：
  - 写入 `MPRTextureManager.SetWindowLevel(center, width)`；
  - 通知 `DicomTextureCreator` 全平面“当前索引”纹理更新；
  - 触发对外事件 `OnWindowLevelChanged(center, width)`。

## 边界与注意事项
- `isInitialized/loadedSeries` 未就绪时设置将被忽略；
- 目标值与当前目标值几乎相等会被直接跳过(减少无效刷新)；
- 过渡结束时自动对齐到目标值，避免“永远接近”。

## 高级技巧

- **典型范围**：CT 图像窗宽窗位通常在 (width≈1000–4000, center≈-1000–1000)，MR 图像通常在较小范围 (width≈200–1000, center≈0–500)。根据数据类型设置滑块的 min/max 范围可以提升交互体验。
- **限制极值**：在应用窗位/窗宽前，可对传入值进行 Clamp，避免出现负值或过大值导致图像全黑或全白。
- **双维度手势**：在 MRTK3 中可以使用 `Slider2D` 或自定义手势识别，用横轴控制 `WindowCenter`，纵轴控制 `WindowWidth`，在 `OnValueChanged` 回调中调用 `SetWindowLevel()` 同步更新。
- **自定义平滑速度**：`windowCenterChangeSpeed` 和 `windowWidthChangeSpeed` 可在 Inspector 中调节，数值越小过渡越慢。不要将其设为 0，否则会一直停留在初值。

> (截图占位)![窗宽窗位操作示意](./images/placeholder-windowlevel.png)