# 使用绝对路径加载 DICOM 文件

在某些情况下，DICOM 数据可能不在 Unity 的 `StreamingAssets` 目录中，而位于外部磁盘或应用程序沙箱之外。加载器提供了 `useAbsolutePath` 选项来支持这种场景。

## 配置步骤

1. 在 `DicomSeriesLoader` 组件上勾选 **Use Absolute Path**。
2. 在 **Dicom Folder Path** 中输入包含 DICOM 文件的绝对目录。例如 `C:/MedicalData/Patient001`。
3. 在该目录下放置索引文件 `<目录名>_index.json`，手动维护切片路径顺序。相对于绝对目录的索引文件名由 `GetIndexFileName()` 推断得出。

## 工作原理

当启用绝对路径模式时，加载器在构造完整路径时直接使用提供的路径，并尝试将其转换为 URI，必要时自动添加 `file://` 前缀。与相对路径不同，自动索引生成功能不会在绝对路径模式下生效，因此必须手动提供索引文件。

## 注意事项

- 在 UWP 或 HoloLens 2 上访问外部目录需要相应的文件访问权限，建议将数据放入已获授权的目录或使用文件选择器获取路径。
- 由于绝对路径可能包含非英文字符或空格，建议使用 URI 编码形式，如 `file:///C:/医疗数据/series1`。
