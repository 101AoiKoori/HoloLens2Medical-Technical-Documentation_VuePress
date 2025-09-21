# 文件读取与路径解析

## 功能思路

加载器需要同时支持运行在 UWP 平台的 `StreamingAssets` 目录和系统级的绝对路径。为此，模块提供 `GetFullPath()` 方法，根据 `useAbsolutePath` 标志自动拼接正确的 URI。随后，通过 `UnityWebRequest` 读取文本或二进制文件，以适应不同平台的异步 I/O。

## 原理拆解

1. **路径构造**：
   - 当 `useAbsolutePath` 为 `false` 时，假定 `dicomFolderPath` 是相对于 `StreamingAssets` 的子目录。加载器使用 `Application.streamingAssetsPath` 与目录名拼接出完整路径，并统一使用正斜杠。
   - 当为 `true` 时，认为传入的路径已经是系统绝对路径。方法尝试将其转换为 URI；如果失败则手动添加 `file://` 前缀。
2. **文件读取**：
   - `ReadFileTextCoroutine()` 通过 `UnityWebRequest.Get()` 请求文本文件，设置超时时间并等待请求完成。成功时回调返回字符串，失败时记录错误并返回 false。
   - `ReadFileBytesCoroutine()` 类似地读取二进制数据，返回字节数组。
3. **超时与错误**：每个请求都有 10 秒超时阈值，读取失败时会通过 `LogMessage()` 输出错误提示。

## 使用建议

- 在 UWP/HoloLens 平台上建议使用相对路径模式，将数据放置在 `StreamingAssets` 目录下，以避免文件访问权限问题。
- 当使用绝对路径时，请确保应用具有对该目录的读取权限，并提前准备好索引文件；加载器不会自动扫描绝对目录生成索引。
