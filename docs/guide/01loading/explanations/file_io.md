# 文件读取与路径解析

## 功能思路

加载器需要同时支持运行在 UWP 平台的 `StreamingAssets` 目录和系统级的绝对路径。为此，模块提供 `GetFullPath()` 方法 ，GetFullPath() 方法会自动处理URI转换，包括异常处理机制，根据 `useAbsolutePath` 标志自动拼接正确的 URI。随后，通过 `UnityWebRequest` 读取文本或二进制文件，以适应不同平台的异步 `I/O`。

## 原理拆解

1. **路径构造**：
   - 当 `useAbsolutePath` 为 `false` 时，假定 `dicomFolderPath` 是相对于 `StreamingAssets` 的子目录。加载器使用 `Application.streamingAssetsPath` 与目录名拼接出完整路径，并统一使用正斜杠。
   - 当为 `true` 时，认为传入的路径已经是系统绝对路径。方法尝试将其转换为 URI；如果失败则手动添加 `file://` 前缀。
2. **文件读取**：

* `ReadFileTextCoroutine(string filePath, Action<bool, string> callback)`
   - 使用 UnityWebRequest.Get() 读取文本文件
   - 固定10秒超时时间
   - 通过回调返回成功状态和文件内容

* `ReadFileBytesCoroutine(string filePath, Action<bool, byte[]> callback)`  
   - 读取二进制DICOM文件数据
   - 同样的超时和错误处理机制
   - 返回字节数组供DICOM解析使用

3. **超时与错误**：每个请求都有 `FILE_REQUEST_TIMEOUT = 10` 秒的固定超时时间，读取失败时会通过 `LogMessage()` 输出错误提示。

## 使用建议

- 在 UWP/HoloLens 平台上建议使用相对路径模式，将数据放置在 `StreamingAssets` 目录下，以避免文件访问权限问题。
- 当使用绝对路径时，请确保应用具有对该目录的读取权限，并提前准备好索引文件；加载器不会自动扫描绝对目录生成索引。
