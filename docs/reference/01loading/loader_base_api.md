---
title: DicomLoader 抽象加载器 API
---
# DicomLoader 抽象加载器 API

## 定义
`DicomLoader` 是所有 DICOM 加载器的抽象基类。它定义了统一的字段、事件和接口，用于管理加载流程的状态并向外部发送通知。主要字段包括数据集路径 `dicomFolderPath`、是否使用绝对路径 `useAbsolutePath` 和详细日志开关 `verboseLogging`。加载状态字段如 `isLoading`、`loadingProgress` 和 `loadingStatus` 用于记录当前进度。基类内部还维护 `lastProgressTime` 和 `timeoutThreshold` 用于超时控制。

## 事件
`DicomLoader` 定义了三个统一的事件供外部订阅:

- **OnLoadingComplete**:加载完成事件，携带加载结果对象和体积信息。
- **OnLoadingStatusChanged**:进度更新事件，携带当前进度百分比和状态描述。
- **OnLoadingFailed**:加载失败事件，携带错误信息。

通过订阅这些事件可以在 UI 中更新进度条、提示文本或处理错误。

## 抽象方法
派生类必须实现两项抽象方法:

- `StartLoading()`:开始加载流程。
- `StopLoading()`:停止加载流程并清理资源。

## 受保护的状态管理方法
基类提供了用于统一更新和通知的受保护方法:

- `UpdateProgress(float progress, string status)`:更新进度值并触发 `OnLoadingStatusChanged`，同时写入日志。
- `CompleteLoading(object resultData, Vector3Int dimensions, Vector3 spacing, Vector3 origin)`:加载成功时调用，设置状态为“加载完成”并触发 `OnLoadingComplete`。
- `FailLoading(string errorMessage)`:加载失败时调用，重置状态并触发 `OnLoadingFailed`。

## 用法
创建自定义加载器时继承 `DicomLoader`，实现自己的加载逻辑:

```csharp
public class MyDicomLoader : DicomLoader
{
    // 必须重写开始方法
    public override void StartLoading()
    {
        // 初始化状态
        isLoading = true;
        UpdateProgress(0f, "准备加载");

        try
        {
            // ... 执行自定义加载流程 ...
            object result = /* 加载结果 */;
            Vector3Int dims = /* 尺寸 */;
            Vector3 spacing = /* 间距 */;
            Vector3 origin = /* 原点 */;
            CompleteLoading(result, dims, spacing, origin);
        }
        catch (Exception ex)
        {
            // 捕获异常并通过 FailLoading 通知外部
            FailLoading(ex.Message);
        }
    }

    // 必须重写停止方法
    public override void StopLoading()
    {
        // 实现资源清理和状态重置
        isLoading = false;
    }
}
```

## 备注
基类的受保护方法只能在派生类内部调用，外部代码应通过事件获取加载进度和结果。`CompleteLoading` 和 `FailLoading` 会自动重置状态并触发相应事件，因此请勿重复调用。