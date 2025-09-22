---
title: 状态与日志 API
---
# 状态与日志 API

## 定义
加载器需要在加载过程中及时记录日志并更新状态。`DicomSeriesLoader` 提供了额外的事件和覆盖方法以实现这一需求。

### OnLogMessage
`OnLogMessage` 是一个事件，当内部调用 `LogMessage` 输出日志时触发。订阅此事件可以在 UI 层显示实时日志信息。

### LogMessage
`LogMessage(string message)` 将指定的信息包装为带前缀的日志，若启用了详细日志设置 (`verboseLogging`) 则在控制台输出，同时通过 `OnLogMessage` 事件分发。

### UpdateProgress（覆盖）
`DicomSeriesLoader` 覆盖了基类的 `UpdateProgress` 方法。在调用基类方法更新内部状态后，如果设置了 `logProgress` 为真，则另外输出一条进度日志。这样既保持基类行为，又能控制是否输出冗余的进度信息。

### FailLoading（覆盖）
覆盖的 `FailLoading` 方法在调用基类 `FailLoading` 重置状态并触发事件后，会通过日志系统输出失败消息。

### CompleteLoading（覆盖）
覆盖的 `CompleteLoading` 方法在基类处理完成事件后，通过日志记录加载完毕的详细信息。

## 用法

```csharp
void Awake()
{
    // 订阅日志事件
    loader.OnLogMessage += (msg) =>
    {
        Debug.Log(msg);
    };
    // 仅当需要控制台输出详细进度时启用
    loader.verboseLogging = true;
    loader.logProgress = true;
}
```

当你想在界面上显示进度信息时，可以订阅 `OnLoadingStatusChanged` 和 `OnLogMessage` 两个事件。`UpdateProgress` 内部会自动调用基类实现并触发事件，无需手动调用。

覆盖后的 `FailLoading` 和 `CompleteLoading` 方法在内部被加载器调用，外部无需直接访问。只需订阅 `OnLoadingFailed` 和 `OnLoadingComplete` 即可接收通知。