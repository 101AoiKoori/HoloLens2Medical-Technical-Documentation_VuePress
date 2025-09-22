---
title: 进度更新、事件与日志机制
---
# 进度更新、事件与日志机制

## 功能思路

加载过程是异步的，需要向用户界面或上层代码报告进度状态并在完成或失败时传递结果。Loading 模块继承自 `DicomLoader`，通过事件和日志系统实现这一目标。

## 原理拆解

1. **进度更新**:基类 `UpdateProgress()` 接受一个 0‑1 范围的浮点数和状态描述，更新内部字段并触发 `OnLoadingStatusChanged` 事件。子类会在合适的时机调用此方法，并根据 `verboseLogging` 和 `logProgress` 决定是否输出日志。
2. **完成与失败**:当加载协程结束时，调用 `CompleteLoading()` 或 `FailLoading()`。`CompleteLoading()` 会重置状态、将进度设为 1.0，并通过 `OnLoadingComplete` 事件传递加载结果、体积尺寸、体素间距和原点。`FailLoading()` 会重置状态并通过 `OnLoadingFailed` 事件传递错误信息。
3. **日志系统**:子类 `DicomSeriesLoader` 定义了 `OnLogMessage` 事件和 `LogMessage()` 方法用于输出调试信息。开发者可以订阅该事件，将消息显示在 UI 或保存到文件。
4. **取消加载**:调用 `StopLoading()` 会停止协程、释放资源，并更新状态为“已取消”。此时不会触发完成或失败事件，但可以通过日志得到提示。

## 使用建议

- 在 UI 中订阅 `OnLoadingStatusChanged` 事件实时更新进度条和文字状态。
- 在订阅 `OnLoadingComplete` 事件时记得释放订阅者，防止重复回调。
- 如果需要详细调试信息，可启用 `verboseLogging` 和 `logProgress`，然后订阅 `OnLogMessage` 将信息输出到控制台或日志窗口。

