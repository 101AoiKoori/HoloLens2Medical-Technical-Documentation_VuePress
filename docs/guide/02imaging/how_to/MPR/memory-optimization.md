# 内存优化与资源释放 

本页提供优化建议，帮助你在内存受限设备上更好地使用 MPR 管理器。

## 调整监控间隔

* `memoryMonitorInterval`：内存压力检测间隔，默认为 5 秒。缩短该值会更频繁地检查系统内存，但可能增加开销。
* `resourceReleaseInterval`：资源释放间隔，默认为 30 秒。缩短该值会更频繁地调用 `Resources.UnloadUnusedAssets()` 和 `GC.Collect()`，但也可能引起卡顿。

根据设备性能进行调整，可以在 Inspector 中修改，或在运行时通过脚本设置。

## 启用/禁用内存监控

如果你希望完全手动控制缓存，可以关闭 `enableMemoryMonitoring`，然后根据应用逻辑自行调用 `TrimCacheToEssential()` 和 `ReleaseUnusedResources()`。

## 清理策略

* 在切换患者数据或长时间不需要 MPR 功能时，调用 `ClearAllTextures()` 彻底释放缓存。
* 当检测到高内存压力时，`CheckMemoryPressure()` 会自动暂停队列、清理缓存并重新排队当前切片。

## 建议

* 在 HoloLens 等低内存设备上，建议保持较短的监控和释放间隔（如 2 秒和 10 秒），并降低 `maxConcurrentTasks`。
* 在 PC 等高性能设备上，可以适当延长间隔并提高并发，以获得更平滑的体验。