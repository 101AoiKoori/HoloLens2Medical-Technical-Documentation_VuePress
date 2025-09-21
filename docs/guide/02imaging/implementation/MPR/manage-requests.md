# 管理请求队列 

在某些情况下，你可能需要手动清理队列或限制并发，例如当用户快速切换序列或进入新的场景时。

## 清空请求

调用 `mpr.CancelAllRequests()` 清空 `_requestQueue` 和 `_pendingRequests`，不影响当前正在处理的任务。

若要连同缓存一起清理，可调用 `mpr.ClearAllTextures()`，该方法会停止所有协程、清空缓存并强制释放资源。

## 调整并发

在 Inspector 中修改 `maxConcurrentTasks`，或在脚本中直接设置。较大的并发数可以提高生成速度，但会占用更多计算资源。

## 暂停与恢复队列

在高内存压力或需要立刻响应用户操作时，可以暂时停止处理队列并清空它：

```csharp
// 停止当前所有请求并清空队列
mpr.CancelAllRequests();
// 可选：清空缓存并停止协程
mpr.ClearAllTextures();
```

之后可以通过 `GetTexture()` 再次触发请求。