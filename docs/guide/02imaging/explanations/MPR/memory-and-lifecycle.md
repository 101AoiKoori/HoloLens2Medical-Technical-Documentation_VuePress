# 内存监控与生命周期 

MPR 管理器通过定时检查系统内存压力并执行资源释放，保证应用在内存紧张的设备上稳定运行。

## 内存压力检测

在 `Update()` 中，如果启用 `enableMemoryMonitoring`，并且距离上次检测超过 `memoryMonitorInterval`，则调用 `CheckMemoryPressure()`。默认实现的 `IsSystemMemoryPressureHigh()` 总是返回 false，但开发者可以根据平台自行实现判断逻辑。

当检测到高内存压力时，`TrimCacheToEssential()` 会暂停队列处理，清空请求队列，只保留当前视图的纹理，然后重新添加高优先级请求。

## 资源释放

`ReleaseUnusedResources()` 会移除已完成的协程，调用 `Resources.UnloadUnusedAssets()` 和 `GC.Collect()` 释放 GPU 和托管资源。该方法在 `Update()` 中按 `resourceReleaseInterval` 定期执行。

## 生命周期方法

* **Awake/Initialize**：创建 `DicomTextureCache` 实例并设置缓存上限。
* **OnEnable/OnDisable**：启用或停用 MPR 管理器，分别设置 `_isShuttingDown` 标志。
* **OnDestroy**：停止所有协程，清空请求队列，释放缓存并解除事件订阅。

## 建议

* 在低内存设备上启用内存监控，并根据实际情况实现 `IsSystemMemoryPressureHigh()`。
* 调整 `memoryMonitorInterval` 和 `resourceReleaseInterval`，以在资源利用率和性能之间取得平衡。