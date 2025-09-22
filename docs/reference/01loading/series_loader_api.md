---
title: DicomSeriesLoader API
---
# DicomSeriesLoader API

## 定义
`DicomSeriesLoader` 是 Loading 模块的核心加载器，负责批量读取并组装完整的 DICOM 序列。它继承自 `DicomLoader` 并实现 `StartLoading` 和 `StopLoading` 方法。除了继承的字段，它还持有一个目标序列 `targetSeries`（用于存储切片）、一个协程句柄 `loadingCoroutine` 和从索引解析得到的文件列表 `dicomFilePaths`。

## 用法
调用 `StartLoading()` 开始加载流程:该方法会检查是否已有加载任务，初始化目标序列和状态，然后启动内部协程。外部可以在订阅的事件中更新 UI 或处理结果。使用 `StopLoading()` 可以取消正在进行的加载任务，停止协程并释放资源。

## 使用示例

```csharp
public class DemoScript : MonoBehaviour
{
    public DicomSeriesLoader loader;

    void Start()
    {
        // 订阅事件
        loader.OnLoadingStatusChanged.AddListener(OnStatus);
        loader.OnLoadingComplete.AddListener(OnComplete);
        loader.OnLoadingFailed.AddListener(OnFailed);

        // 开始加载
        loader.StartLoading();
    }

    void OnStatus(float progress, string status)
    {
        Debug.Log($"进度: {progress:P0}, 状态: {status}");
    }

    void OnComplete(object data, Vector3Int dims, Vector3 spacing, Vector3 origin)
    {
        var series = (DicomSeries)data;
        Debug.Log($"加载完成，共 {series.Slices.Count} 张切片");
    }

    void OnFailed(string error)
    {
        Debug.LogError($"加载失败: {error}");
    }

    // 可以通过 UI 调用停止
    public void CancelLoading()
    {
        loader.StopLoading();
    }
}
```

在 Unity 场景中挂载 `DicomSeriesLoader` 组件，并指定 `dicomFolderPath` 与 `useAbsolutePath`，即可通过上述方式加载 DICOM 序列。加载过程会自动处理索引文件、读取切片并填充到 `targetSeries` 中。