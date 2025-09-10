# 从绝对路径加载（PC/HL2）

> 目标：不放入 `StreamingAssets`，而是直接从磁盘绝对路径加载。

## 何时使用

* 医疗终端或外接盘已提供 DICOM 目录
* 不希望将数据打包进应用

## 配置步骤

1. 选中 `DICOM_Loader` 上的 **DicomSeriesLoader**
2. 勾选 **Use Absolute Path**
3. 在 **Dicom Folder Path** 中填入绝对路径，例如：

   * Windows：`D:/Hospital/Patient001/`（推荐使用正斜杠 `/`）
4. 运行 `StartLoading()` 流程

> **注意（UWP/HL2）**
> 绝对路径需确保 **应用有权限访问**。实际部署到设备时，强烈建议：
>
> * 将数据复制到应用的可访问目录（例如 `ApplicationData`）或使用文件选择器让用户授予访问权限
> * 或者继续走 **StreamingAssets** 方案，最稳定

> **路径规范**
>
> * 统一使用正斜杠 `/`，避免 `\\` 带来的转义问题
> * 目录末尾加 `/` 可读性更好