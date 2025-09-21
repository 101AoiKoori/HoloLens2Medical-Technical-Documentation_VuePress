# 数据与控制流程(从“加载”到“显示”)

本文按时间顺序梳理一次完整的交互流程，帮助你快速定位问题。

## 0. 前置
- 场景存在 `MPRViewer`，已绑定三个 `RawImage`。
- 项目已准备好一套 DICOM 序列(`DicomSeries` 可被构建)。

## 1. 触发加载
- 调用 `LoadDicomData()`。
- `Loader.StartLoading()`：
  1) 取消并释放历史协程与纹理；
  2) 通过 `DicomLoader` 启动加载；
  3) 进入等待回调状态。

## 2. 加载完成回调
- `OnLoadingComplete(resultData, dimensions, spacing, origin)`：
  - 校验 `resultData` 类型并设置到 `loadedSeries`；
  - `SliceControl.ResetSliceIndices()` 将三平面索引置为居中；
  - 配置 `MPRTextureManager`：绑定序列与当前索引、当前窗宽窗位；
  - 根据配置：
    - **渐进模式**(推荐)：`ProcessSeriesProgressiveCoroutine()`；
    - **直接模式**：`ProcessSeriesDirect()`。

## 3. 纹理生成与绑定
- **轴向优先**：先生成当前轴向切片纹理 → 绑定到 `axialImage`。
- **矢状/冠状**：使用 `DicomSeries` 提供的协程生成 → 成功后再绑定对应 `RawImage`。
- 若启用后台加载：`SliceControl.StartBackgroundLoading()` 在当前索引附近分批预取纹理。

## 4. 交互驱动的更新
- **用户拨动滑块** → `SetSliceIndex(plane, index)`：
  - Clamp 索引、写入当前值、刷新 UI、触发 `OnSliceChanged`；
  - 若开启后台加载，则预取附近切片的纹理。
- **用户调窗宽/窗位** → `SetWindowLevel(center, width)`：
  - 平滑模式：逐帧 Lerp 到目标值；立即模式：直接应用；
  - 统一通过 `TextureCreator` 与 `TextureManager` 通知三平面重渲染当前索引。

## 5. 复位/退出
- `ResetView()`：
  - 停止协程，恢复序列默认窗宽/窗位与中位索引；
  - 刷新三平面纹理；
  - `Resources.UnloadUnusedAssets()` 以回收显存；
  - 控制台提示“视图已重置”。

## 常见检查点
- `isInitialized/loadedSeries/isShuttingDown` 三个开关在多数接口中都会做早退判断；
- 轴向纹理未出 → 矢状/冠状通常不会继续(渐进模式下尤为明显)；
- `RawImage` 未绑定或引用丢失时，更新会被跳过。

## 附加补充

- **加载进度反馈**：若需要显示进度条，可以订阅 `DicomLoader.OnProgressChanged`(或相关事件)并更新 UI。例如在进度回调中更新 `Slider.value` 或 `Text` 显示百分比，不要在回调里做耗时操作。
- **渐进 vs 直接模式**：通过 `useProgressiveLoading` 切换模式。渐进模式会分步生成纹理，优先显示轴向首帧并逐步渲染矢状/冠状，适合 HL2 等低功耗设备；直接模式一次性创建全部纹理，占用内存较高但加载速度快。
- **协程时序**：`ProcessSeriesProgressiveCoroutine` 在每次生成纹理后通过 `yield return null;` 让出执行权，保证界面响应。不要在主线程进行耗时计算或 I/O。
- **资源释放**：调用 `ResetView()` 或加载新序列时，会执行 `ReleaseAllResources()` 和 `Resources.UnloadUnusedAssets()`，这可能导致短暂卡顿。建议在用户交互间隙或切换场景前调用释放。