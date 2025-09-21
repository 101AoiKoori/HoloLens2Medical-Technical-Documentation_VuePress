# 切片索引与预取策略

## 初始索引(重置逻辑)
- 轴向(Axial)：`Slices.Count / 2`。
- 矢状(Sagittal)：`GetSagittalDimension() / 2`。
- 冠状(Coronal)：`GetCoronalDimension() / 2`。

## 设置索引的规则
- `SetSliceIndex(plane, index)`：
  - 若未初始化或未加载或正在关闭 → 直接返回；
  - 对 `index` 进行 Clamp(0 ~ 总数-1)；
  - 写入后：
    - 更新 `MPRTextureManager.SetCurrentIndices(...)`；
    - 刷新当前平面的 `RawImage`；
    - 触发 `OnSliceChanged(plane, index, total)`；
    - 若允许后台加载，则异步预取邻近切片。

## 预取(相邻与分批)
- **邻域预取**：以当前索引为中心，`range=3`，两侧逐步请求纹理(逐帧让出执行权以避免卡顿)。
- **分批预取**：Axial/Sagittal/Coronal 采用批量尺寸(默认 3)分批请求，批与批之间可插入 `WaitForSeconds`，在内存压力偏高时自动增加等待。

## 背景加载开关
- `useBackgroundLoading` 置为 `true` 时生效；
- 建议配合 `useProgressiveLoading` 以加快首屏体验；
- HL2/移动平台建议保守配置批量大小与等待间隔。

## 进阶使用

- **调整预取范围**：`SliceControl` 默认的相邻预取范围为 3，可以在源码中修改 `preloadRange` 或将其暴露为公共字段。在内存充足时增大范围可减少跳跃切换时的等待，但会占用更多显存。
- **优化批量大小与间隔**：在后台加载协程中通过 `batchSize` 和 `waitInterval` 控制每批次加载的数量和等待时间。移动设备建议使用较小批量和较长间隔；桌面或 HoloLens 设备可适当增加批量提升流畅度。
- **线程安全考虑**：虽然 Unity 主线程处理大部分逻辑，但 `MPRTextureManager` 的请求与回调可能在不同协程中访问索引。保持索引存储在统一的数据结构中，并避免在协程回调中修改集合长度可降低出错风险。