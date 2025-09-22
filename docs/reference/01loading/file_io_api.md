---
title: 文件读取功能 API
---
# 文件读取功能 API

## 定义
DicomSeriesLoader 的文件读取模块负责从磁盘获取索引和切片数据。本模块使用 `UnityWebRequest` 来兼顾 UWP/StreamingAssets 环境。

### GetFullPath
`GetFullPath(string path)` 根据加载器的路径模式返回完整 URI。当使用绝对路径 (`useAbsolutePath=true`) 时，方法会将系统路径转换为 `file://` URI；否则它会基于 `Application.streamingAssetsPath` 拼接相对路径，并将反斜杠替换为正斜杠。

### ReadFileTextCoroutine
`ReadFileTextCoroutine(string filePath, Action<bool,string> callback)` 是一个协程，用于异步读取文本文件。它创建一个 GET 请求，如果失败则通过日志提示错误，并调用回调传递 `false`。读取成功时返回下载的字符串。

### ReadFileBytesCoroutine
`ReadFileBytesCoroutine(string filePath, Action<bool,byte[]> callback)` 与前者类似，不过返回字节数组。用于读取 DICOM 文件的二进制内容。

## 用法

```csharp
IEnumerator LoadJsonIndex()
{
    // 获取完整路径
    string indexPath = GetFullPath("dicom_index.json");
    string json = null;
    bool ok = false;

    // 通过协程读取文件
    yield return ReadFileTextCoroutine(indexPath, (success, content) =>
    {
        ok = success;
        json = content;
    });

    if (ok && !string.IsNullOrEmpty(json))
    {
        // 处理索引内容
        var paths = JSONIndexParser.Parse(json);
    }
    else
    {
        // 错误处理逻辑
        LogMessage("索引文件读取失败");
    }
}
```

使用 `ReadFileBytesCoroutine` 读取二进制数据的逻辑类似，只需将回调类型替换为 `(bool, byte[])` 并在内部处理 `byte[]` 内容即可。由于 `UnityWebRequest` 内置跨平台读取支持，此方法适用于 UWP 以及普通桌面项目。