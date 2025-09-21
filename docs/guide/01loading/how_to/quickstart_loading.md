# 快速开始：加载 DICOM 序列

本节演示如何在 Unity 中快速使用 `DicomSeriesLoader` 加载一组 DICOM 文件，并监听加载状态。

## 步骤 1：准备场景

1. 在场景层级中新建一个空物体 `GameObject`，命名为 **DicomLoader**。
2. 在该物体上添加 `DicomSeriesLoader` 组件。组件暴露了若干参数：
   - **Dicom Folder Path**：相对于 `StreamingAssets` 的目录名，例如 `DICOM`。如果使用绝对路径，请勾选 `Use Absolute Path` 并输入完整路径。
   - **Verbose Logging**：是否输出详细调试信息。
   - **Log Progress**：是否在控制台输出进度。

## 步骤 2：编写控制脚本

创建一个 C# 脚本并绑定到同一个物体，用于启动加载并订阅事件：

```csharp
using UnityEngine;
using MedicalMR.DICOM.Loading;

public class DicomLoaderController : MonoBehaviour
{
    public DicomSeriesLoader loader;

    void Start()
    {
        // 订阅事件
        loader.OnLoadingStatusChanged.AddListener(OnStatus);
        loader.OnLoadingComplete.AddListener(OnComplete);
        loader.OnLoadingFailed.AddListener(OnFailed);
        loader.OnLogMessage += OnLog;
        // 开始加载
        loader.StartLoading();
    }

    private void OnStatus(float progress, string status)
    {
        Debug.Log($"进度: {progress:P0}, 状态: {status}");
    }

    private void OnComplete(object result, Vector3Int dims, Vector3 spacing, Vector3 origin)
    {
        Debug.Log($"加载完成: 尺寸={dims}, 间距={spacing}, 原点={origin}");
    }

    private void OnFailed(string error)
    {
        Debug.LogError($"加载失败: {error}");
    }

    private void OnLog(string message)
    {
        Debug.Log(message);
    }
}
```

## 步骤 3：运行并观察

点击运行后，加载器会自动读取索引并逐个加载切片。您可以在控制台看到进度更新和日志，加载完成后会打印体积尺寸、像素间距和原点信息。若出现错误，将触发 `OnLoadingFailed` 并输出错误信息。
