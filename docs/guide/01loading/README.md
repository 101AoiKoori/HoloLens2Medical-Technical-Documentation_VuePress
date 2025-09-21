# Loading 模块概述

Loading 模块负责将磁盘中的 DICOM 文件批量读取、解析，并组织为 Unity 中可用的 `DicomSeries` 对象。它是项目中承上启下的关键层：一方面依赖 **Core** 模块的数据结构(`DicomSlice`、`DicomMetadata` 等)，另一方面为上层的 **Imaging / UI / Viewers** 提供完整的序列数据。

与单个切片的处理不同，Loading 模块强调 **流程化加载** 与 **状态管理**，确保在 HoloLens2/UWP 环境下能够稳定、渐进地完成大量医学影像的导入。

## 主要职责

Loading 模块围绕以下核心类与功能展开：

* **DicomLoader(抽象基类)**
  定义统一的加载接口，提供事件机制：

  * `OnLoadingStatusChanged`(进度/状态变更)
  * `OnLoadingComplete`(加载完成，返回序列与体积信息)
  * `OnLoadingFailed`(加载失败)
    所有具体加载器都继承自该类。

* **DicomSeriesLoader(具体实现)**
  执行批量加载逻辑：

  * 读取或生成 JSON 索引文件，获取切片路径列表
  * 使用 `UnityWebRequest` 逐个读取文件数据
  * 调用 FO-DICOM 解析 `DicomDataset` 并提取像素数据
  * 创建 `DicomSlice` 并添加到目标 `DicomSeries`
  * 最终调用 `SortSlices()`、`SetVolumeProperties()`、`ValidateLoadedSeries()` 完成体积初始化

* **JSONIndexParser**
  将索引文件的 JSON 内容解析为切片路径列表；若索引缺失，Loader 会自动生成。

* **日志与状态子模块**
  封装了统一的 `LogMessage` 输出，结合进度更新方法 `UpdateProgress`，在加载过程中不断通知外部 UI。
  
## 实现思路 
* DicomSeriesLoader使用部分类（partial class）的设计模式。
- DicomSeriesLoader 主类：协调和对外接口
- DicomSeriesLoader.Indexing：索引文件处理
- DicomSeriesLoader.FileIO：文件读取功能
- DicomSeriesLoader.Loader：核心加载协程
- DicomSeriesLoader.PixelData：像素数据提取
- DicomSeriesLoader.Validation：数据验证
- DicomSeriesLoader.Status：状态管理和日志

## 与其他模块的关系

* **Core 模块**：Loading 模块高度依赖 Core 的数据结构。加载到的 `DicomSlice` 与体积元数据(`DicomMetadata`)直接存储在目标 `DicomSeries` 中。
* **Imaging 模块**：Imaging 依赖 Loading 的输出，在切片解码、窗位/窗宽调整前必须确保序列已经加载完成。
* **UI 模块**：通过监听 `OnLoadingStatusChanged`、`OnLoadingComplete`，可以驱动进度条、提示文本等界面元素。
* **Viewers / Visualization3D 模块**：需要在序列加载完成后才能正确显示三视图或体绘制。

## 文档结构

本目录下的文档同样分为「原理说明」和「最小实现」两部分：

### Explanations 设计原理与实现思路

* [文件读取与路径解析](./explanations/file_io.html)
* [JSON 索引文件处理机制](./explanations/index_file.html)
* [Loading 模块架构与流程概览](./explanations/loader_architecture.html)
* [DICOM 序列加载流程](./explanations/loading_process.html)
* [像素数据提取原理](./explanations/pixel_data.html)
* [进度更新、事件与日志机制](./explanations/progress_and_logging.html)
* [数据验证与体积信息推导](./explanations/validation_and_volume.html)

### implementation 按功能划分的最小实现示例

* [基本DICOM序列加载](./implementation/01_basic_loading.md.html)
* [进度监控与状态显示](./implementation/02_progress_monitoring.html)
* [索引文件管理](./implementation/03_index_file_management.html)
* [错误处理与异常管理](./implementation/04_error_handling.html)
* [绝对路径加载](./implementation/05_absolute_path_loading.html)
* [体积数据访问与使用](./implementation/06_volume_data_access.html)

>建议首先阅读 **explanations** 下的原理文档，理解加载流程如何分层实现；随后在 **implementation** 中运行最小示例，验证 DICOM 数据能否在 Unity 场景中被正确加载。
---
* [返回首页](../README.md)