# JSONIndexParser API

## 定义
`JSONIndexParser` 是一个内部帮助类，用于将索引文件中的 JSON 内容解析为 DICOM 文件的相对路径列表。索引文件通常包含一个 `slices` 数组，每个元素包含 `path` 字段。

### Parse
`Parse(string jsonContent)` 接受 JSON 字符串并返回一个字符串列表。方法逻辑如下：

1. 如果输入为空返回 `null`。
2. 调用 `JsonUtility.FromJson` 将内容反序列化为内部结构 `IndexData`。
3. 遍历 `IndexData.slices`，对每个非空条目提取其 `path` 字段并添加到结果列表。
4. 若解析失败抛出异常，则记录错误并返回 `null`。

## 用法

该解析器在 `LoadIndexFileCoroutine` 中被隐式调用，通常不需要单独使用。如需手动解析索引内容，可以直接调用：

```csharp
string json = File.ReadAllText("path/to/dicom_index.json");
List<string> relativePaths = JSONIndexParser.Parse(json);
if (relativePaths == null)
{
    Debug.LogError("解析索引文件失败");
}
else
{
    foreach (var path in relativePaths)
    {
        Debug.Log("切片路径: " + path);
    }
}
```

请确保索引文件的 JSON 结构正确，例如：

```json
{
  "slices": [
    { "path": "DICOM/001.dcm" },
    { "path": "DICOM/002.dcm" }
  ]
}
```

解析器仅关注 `path` 字段，对其他属性会忽略。