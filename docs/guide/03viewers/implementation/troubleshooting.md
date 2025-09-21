# 故障排查(常见问题与最小修复路径)

## 现象：没有任何纹理显示
- 检查三张 `RawImage` 是否已绑定到 MPRViewer。
- 确认 `DicomLoader` 的数据源是否可读(UWP/HL2 路径权限)。
- 控制台是否有“DICOM加载失败”或类型不支持的报错。

## 现象：只显示轴向，矢状/冠状迟迟不出现
- 若开启了渐进模式，这是正常行为；
- 请确认 `CreateSagittalTextureCoroutine/CreateCoronalTextureCoroutine` 能正常返回；
- 也可切换到直接模式进行对比。

## 现象：滑动切片没有变化
- 查看是否已 `LoadDicomData()` 并 `isInitialized == true`；
- `SetSliceIndex` 早退条件：未初始化 / 未加载 / 正在关闭。

## 现象：调窗宽窗位没有反应
- 同样检查初始化与早退条件；
- 两个滑块是否只更新了其中一个值(需成对传入 `center/width`)。

## 现象：内存/显存快速增长
- 在切换序列前调用取消与释放；
- 检查是否存在其他对旧纹理的引用(RawImage 未清空或其他脚本保留引用)；
- 在低内存设备上降低后台批量、加大等待。

## 现象：图像显示旋转或翻转方向错误
- 某些 DICOM 数据的坐标系不一致，导致纹理方向不正确。可以在 `TextureUpdater` 中修改 `Texture2D` 的像素顺序(例如使用 `FlipVertically()` 或 `Rotate90()`)，或在 `RawImage` 上调整 `RectTransform` 的 Rotation 属性。
- 如果只有某一平面翻转，请检查 `MPRTextureManager` 在创建该平面纹理时的索引顺序，确保轴向/矢状/冠状索引正确。

## 现象：加载新数据时旧数据未清除
- 在调用 `LoadDicomData()` 之前，请先调用 `CancelAllOperations()` 和 `ReleaseAllResources()`，确保旧的协程停止并释放旧纹理。
- 检查是否有其他脚本或 UI 持有对旧 `Texture2D` 的引用，如 RawImage 未清空或对象未销毁，导致内存无法释放。

## 现象：切片切换时 FPS 降低或卡顿
- 调整后台加载批量和间隔，以减小每帧的负担。在低性能设备上适当降低批量或增加间隔能提升交互流畅度。
- 使用 `Profiler` 查看是否有其他脚本占用大量 CPU/GPU。切片渲染部分可通过降低解码分辨率或使用纹理压缩优化。