# 配置 JSON 索引文件

要使加载器正确加载切片，需要提供一个包含切片路径的 JSON 索引文件。本节介绍如何创建和使用该文件。

## 创建索引文件

1. 在 `StreamingAssets/<Dicom Folder Path>` 目录下创建一个文本文件，命名为 `dicom_index.json`(如果目录不叫 DICOM，则使用 `<目录名>_index.json`)【166205801724849†L14-L27】。
2. 按如下格式列出所有切片的相对路径：

   ```json
   {
     "slices": [
       { "path": "DICOM/001.dcm" },
       { "path": "DICOM/002.dcm" }
     ]
   }
   ```

   路径区分大小写，顺序即为加载顺序。

## 自动生成索引

如果不提供索引文件，加载器会在相对路径模式下扫描目录并生成一个索引【166205801724849†L70-L100】。生成逻辑只扫描顶层文件，并排除 `.meta` 文件。生成后的索引保存在 `StreamingAssets` 根目录下，并以推断出的文件名命名【166205801724849†L104-L130】。

当 `useAbsolutePath` 为 `true` 时不会自动生成索引，因此您需要手动创建文件并放在同一绝对目录。

## 在代码中指定路径

您可以在脚本中修改加载器的 `dicomFolderPath`，例如：

```csharp
loader.dicomFolderPath = "MyDicom";
loader.useAbsolutePath = false;
```

如果需要从绝对路径加载：

```csharp
loader.dicomFolderPath = "C:/Data/CTSeries";
loader.useAbsolutePath = true;
```

## 验证索引

手动编辑索引后可以运行加载器查看控制台日志，若解析为空或文件路径错误，将在加载初期提示错误【166205801724849†L50-L66】。

![索引配置示意图](./images/placeholder.png)
