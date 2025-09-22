---
title: 请求队列与内存管理
---

# 请求队列与内存管理

MPR 管理器内部维护一个请求队列，用于异步生成矢状和冠状切片的纹理，并定期检查内存压力以保障应用稳定。

## 请求队列

请求队列是一个优先级队列，内部会根据当前索引计算每个请求与当前视图的距离。例如，离当前索引越近的请求优先级越高。队列还有以下特点:

- **去重**:同一切片不会重复入队。
- **并发控制**:最多同时处理 `_maxConcurrentTasks` 个任务。
- **动态调整**:当索引改变时，会重新计算队列中所有请求的优先级。

队列的调度逻辑在 `ProcessQueueCoroutine()` 中实现，确保在后台生成纹理的同时不会阻塞主线程。

## CancelAllRequests

`void CancelAllRequests()`

清空请求队列，但不清除已经生成的纹理。若用户放弃当前操作或快速切换视图，可以调用此方法以避免生成无用的纹理。

## ClearAllTextures

`void ClearAllTextures()`

终止所有正在运行的协程，清空请求队列，并调用 `DicomTextureCache.ClearAllCaches()` 释放所有缓存。通常在加载新的序列或释放内存时调用。

## GetCachedTextureCount

`int GetCachedTextureCount(PlaneType plane)`

返回指定切面缓存中已生成纹理的数量。可用于监控内存压力并在必要时调整缓存大小或触发主动清理。

## 内存监控

MPR 管理器会定期检查系统内存压力。如果检测到内存不足，将调用 `DicomTextureCache` 的淘汰策略，仅保留当前切片的纹理，并暂停请求队列直至内存压力缓解。内存监控逻辑位于 `Memory.cs` 分部中。

```csharp
// 当检测到内存压力时，管理器会自动清理并暂停生成
```