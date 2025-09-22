---
title: 索引文件处理 API
---
# 索引文件处理 API

## 定义
为了高效批量加载切片，`DicomSeriesLoader` 使用 JSON 索引文件列出所有 DICOM 相对路径。当索引不存在时，加载器可自动生成。

### GetIndexFileName
该私有方法根据 `dicomFolderPath` 构造索引文件名。如果路径为默认值 "DICOM" 则返回 `dicom_index.json`，否则使用目录名作为前缀生成 `<folder>_index.json`。

### LoadIndexFileCoroutine
`LoadIndexFileCoroutine()` 是一个协程，用于加载并解析索引文件。它根据路径模式获取完整 URI，并调用 `ReadFileTextCoroutine` 读取文件内容。若读取失败或内容为空，则自动调用 `GenerateJsonIndexFallback` 生成索引。读取成功后，协程去除 UTF‑8 BOM 并使用 `JSONIndexParser.Parse` 解析出文件路径列表。

### GenerateJsonIndexFallback
当索引缺失时，`GenerateJsonIndexFallback(string indexFilePath)` 会扫描指定数据集目录下的所有 DICOM 文件并生成一个新的 JSON 索引。它遍历目录，把非 `.meta` 文件的相对路径写入一个简单的 JSON 结构中。随后将该内容写入磁盘并重新读取，最终解析出路径列表。

## 用法

索引加载是 `StartLoading()` 流程的一部分，无需显式调用。如需手动读取索引，可以通过如下方式:

```csharp
IEnumerator ReadDicomIndex()
{
    // 获取索引文件名
    string name = GetIndexFileName();
    // 构造完整URI
    string path = useAbsolutePath ? GetFullPath(Path.Combine(dicomFolderPath, name))
                                  : GetFullPath(name);
    // 读取并解析
    string content = null;
    bool ok = false;
    yield return ReadFileTextCoroutine(path, (success, text) =>
    {
        ok = success;
        content = text;
    });
    if (!ok || string.IsNullOrEmpty(content))
    {
        // 如果索引不存在，手动生成
        yield return GenerateJsonIndexFallback(path);
    }
    else
    {
        dicomFilePaths = JSONIndexParser.Parse(content);
    }
}
```

在实际使用中，推荐让加载器自己处理索引文件。你只需确保 `dicomFolderPath` 指向包含 DICOM 文件的目录即可。