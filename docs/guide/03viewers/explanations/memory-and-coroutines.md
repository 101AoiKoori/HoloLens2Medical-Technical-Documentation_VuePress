# 内存与协程管理(资源释放、压力检测)

## 目标
- 统一追踪由查看器发起的协程，支持“一键取消”；
- 在切换序列/复位/退出时安全释放纹理资源，尽量降低显存占用；
- 定时进行(简化的)内存压力检测，必要时触发 `UnloadUnusedAssets()` 与 GC。

## 能力清单
- **StartCoroutineTracked**：启动并登记协程；
- **CancelAllOperations**：停止登记的全部协程，并通知 `MPRTextureManager.CancelAllRequests()`；
- **ReleaseAllResources**：断开三平面 `RawImage.texture` 的引用，尝试销毁旧纹理；
- **UpdateMemoryMonitoring**：按 `memoryCheckInterval` 触发检查；
- **IsMemoryPressureHigh**：当前为简化实现(可替换为设备指标/可用内存阈值)。

## 实战建议
- 在 **加载新序列** 之前，总是先取消历史协程并释放纹理；
- 在 **切换场景/销毁对象** 时调用释放，避免内存泄露；
- 如有更严格的性能目标，可实现：
  - 按“使用计数”或“上次访问时间”回收缓存；
  - 大纹理分片/压缩；
  - 动态调整预取批量与等待间隔。

## 自定义监控与阈值

- **实现 IsMemoryPressureHigh**：可以使用 `SystemInfo.systemMemorySize` 或 `UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong()` 获取当前内存使用量，与自定义阈值比较。例如当占用超过 70% 时返回 `true`，触发更激进的资源释放。
- **避免频繁卸载**：`Resources.UnloadUnusedAssets()` 会阻塞主线程并清理未引用资源。建议仅在切换序列或场景时调用，不要在每次切片更新后立即卸载。
- **监控日志**：在开发阶段，可以在 `UpdateMemoryMonitoring` 中打印当前加载的纹理数量、协程数量和内存指标，以便动态调整预取批量和间隔。