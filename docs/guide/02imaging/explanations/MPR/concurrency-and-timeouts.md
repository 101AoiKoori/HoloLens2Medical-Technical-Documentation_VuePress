# 并发与超时控制 

在 MPR 中，过多的并发生成任务会占用大量 CPU/GPU 资源，而过少则导致响应迟缓。通过合理配置并发数量和超时策略，可以保证体验与资源之间的平衡。

## 最大并发任务数

参数 `maxConcurrentTasks` 决定同时允许多少个纹理生成任务并行运行。`ProcessQueueCoroutine` 会检查 `_activeTaskCount`，如果达到了上限，则暂时等待再处理下一批请求。

建议将 `maxConcurrentTasks` 设置为 2–4，根据设备性能适当调整。

## 请求超时

在请求队列中，如果非当前切片的请求等待超过 30 秒，则会被丢弃。此规则避免长时间无法满足的请求占用队列位置。

## 协程管理

创建纹理的协程在执行完毕后通过 `CompleteRequest()` 归还并减少 `_activeTaskCount`。`CleanupCompletedCoroutines()` 会定期清除已完成或已停止的协程引用，防止列表膨胀。

在切换 DICOM 序列或关闭场景时，调用 `ClearAllTextures()` 或 `CleanupResources()` 会停止所有协程并清空队列，确保不存在悬挂任务。