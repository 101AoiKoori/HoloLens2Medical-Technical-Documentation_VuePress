---
title: 索引文件管理
---
# 索引文件管理

索引文件是Loading模块的关键组件，用于指定加载哪些DICOM文件以及加载顺序。本文介绍索引文件的创建、管理和使用方法。

## 索引文件命名规则

根据`GetIndexFileName()`方法的实现，索引文件命名遵循以下规则:

```csharp
// 如果文件夹路径是"DICOM"
string indexFileName = "dicom_index.json";

// 如果是其他文件夹名称，如"CT_Series"
string indexFileName = "ct_series_index.json"; // 转换为小写
```

## 手动创建索引文件

### 1. 基本JSON格式

在`StreamingAssets`目录下创建索引文件:

```json
{
  "slices": [
    { "path": "DICOM/slice001.dcm" },
    { "path": "DICOM/slice002.dcm" },
    { "path": "DICOM/slice003.dcm" }
  ]
}
```

### 2. 不同目录结构的索引

如果DICOM文件分布在子目录中:

```json
{
  "slices": [
    { "path": "DICOM/series1/image001.dcm" },
    { "path": "DICOM/series1/image002.dcm" },
    { "path": "DICOM/series2/image001.dcm" }
  ]
}
```

### 3. 自定义加载顺序

索引文件中的顺序即为加载顺序，可以手动调整:

```json
{
  "slices": [
    { "path": "DICOM/slice100.dcm" },
    { "path": "DICOM/slice050.dcm" },
    { "path": "DICOM/slice001.dcm" }
  ]
}
```

## 自动生成索引

### 1. 生成条件

当满足以下条件时，系统会自动生成索引:
- 索引文件不存在
- 使用相对路径模式 (`useAbsolutePath = false`)
- StreamingAssets目录下存在对应的DICOM文件夹

### 2. 生成过程

```csharp
// 自动生成的代码逻辑示例
private void GenerateIndexExample()
{
    string dicomDir = Path.Combine(Application.streamingAssetsPath, "DICOM");
    string[] files = Directory.GetFiles(dicomDir);
    
    var sliceList = new List<string>();
    foreach (var file in files)
    {
        string name = Path.GetFileName(file);
        if (!name.EndsWith(".meta")) // 排除Unity元文件
        {
            sliceList.Add($"DICOM/{name}");
        }
    }
    
    // 生成JSON格式的索引文件
    string jsonContent = CreateJsonIndex(sliceList);
    File.WriteAllText(indexPath, jsonContent);
}
```

### 3. 生成示例

对于包含以下文件的目录:
```
StreamingAssets/DICOM/
├── image001.dcm
├── image002.dcm
├── image003.dcm
└── image001.dcm.meta (Unity元文件，会被忽略)
```

自动生成的索引文件:
```json
{
  "slices": [
    { "path": "DICOM/image001.dcm" },
    { "path": "DICOM/image002.dcm" },
    { "path": "DICOM/image003.dcm" }
  ]
}
```

## 绝对路径模式的索引

### 1. 配置绝对路径

```csharp
public class AbsolutePathExample : MonoBehaviour
{
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        
        // 启用绝对路径模式
        loader.useAbsolutePath = true;
        loader.dicomFolderPath = @"C:\MedicalData\Patient001";
        
        loader.StartLoading();
    }
}
```

### 2. 绝对路径索引文件

将索引文件放在同一绝对目录下:

```
C:\MedicalData\Patient001\
├── patient001_index.json
├── slice001.dcm
├── slice002.dcm
└── slice003.dcm
```

索引文件内容使用相对于该目录的路径:
```json
{
  "slices": [
    { "path": "slice001.dcm" },
    { "path": "slice002.dcm" },
    { "path": "slice003.dcm" }
  ]
}
```

## 索引验证和调试

### 1. 验证索引内容

```csharp
public class IndexValidator : MonoBehaviour
{
    [SerializeField] private string indexFilePath = "dicom_index.json";
    
    [ContextMenu("验证索引文件")]
    void ValidateIndex()
    {
        string fullPath = Path.Combine(Application.streamingAssetsPath, indexFilePath);
        
        if (!File.Exists(fullPath))
        {
            Debug.LogError($"索引文件不存在: {fullPath}");
            return;
        }
        
        string content = File.ReadAllText(fullPath);
        var paths = JSONIndexParser.Parse(content);
        
        if (paths == null)
        {
            Debug.LogError("索引文件解析失败");
            return;
        }
        
        Debug.Log($"索引文件有效，包含 {paths.Count} 个文件路径");
        
        // 验证每个文件是否存在
        foreach (string path in paths)
        {
            string filePath = Path.Combine(Application.streamingAssetsPath, path);
            if (!File.Exists(filePath))
                Debug.LogWarning($"文件不存在: {path}");
        }
    }
}
```

### 2. UTF-8 BOM处理

代码会自动处理UTF-8 BOM字符:

```csharp
// 在LoadIndexFileCoroutine中的处理逻辑
if (jsonContent.Length > 0 && jsonContent[0] == '\uFEFF')
{
    jsonContent = jsonContent.Substring(1); // 移除BOM
}
```

这确保了从不同编辑器保存的JSON文件都能正确解析。

## 最佳实践

1. **手动维护顺序**: 对于医学影像，建议手动创建索引以确保切片按正确的解剖顺序加载
2. **版本控制**: 将索引文件纳入版本控制，确保团队使用相同的加载配置
3. **路径一致性**: 保持索引中的路径格式一致，避免混用正斜杠和反斜杠
4. **编码格式**: 使用UTF-8编码保存索引文件，避免字符编码问题