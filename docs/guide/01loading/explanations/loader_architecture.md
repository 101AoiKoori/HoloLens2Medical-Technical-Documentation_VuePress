# Loading 模块架构与流程概览

## 模块设计思路

Loading 模块是整个 DICOM 加载流程的协调者，它集成了索引解析、文件读取、像素提取、数据集验证、切片管理、体积属性设置以及状态通知等多个子系统。在调用者看来，它只暴露了两个主要接口：`StartLoading()` 用于启动加载任务，`StopLoading()` 用于取消正在进行的加载任务。这些接口隐藏了底层的协程与资源管理细节，使得外部代码只需要关心启动和结束即可。

## 核心组成

Loading 模块由以下子功能组成：

- **索引解析**：通过 `LoadIndexFileCoroutine()` 读取或生成 JSON 索引文件，获得所有 DICOM 文件的相对路径列表。索引文件缺失时会自动扫描目录生成一个简单列表。
- **文件读取**：利用 `UnityWebRequest` 在协程中异步读取文本或二进制文件。可同时支持 StreamingAssets 下的相对路径和系统级的绝对路径。
- **DICOM 解析**：使用 FellowOakDicom 库打开二进制数据，验证数据集有效性，并提取第一帧像素数据。验证逻辑检查像素尺寸、位深和帧长度，确保每个数据集都能正确解码。
- **切片管理**：每个有效的 DICOM 文件都会转换为 `DicomSlice` 对象，并添加到目标 `DicomSeries` 容器；加载完成后会按位置排序切片。
- **体积属性设置**：根据第一张切片推导体积尺寸、像素间距和原点。
- **状态与事件**：通过基类的 `UpdateProgress()` 同步进度，并触发 `OnLoadingStatusChanged`、`OnLoadingComplete` 和 `OnLoadingFailed` 事件供 UI 层订阅。额外的 `OnLogMessage` 事件用于收集调试信息。

## 流程概述

1. 调用 `StartLoading()`：初始化 `DicomSeries` 对象、重置状态，并启动内部协程。
2. **读取索引**：协程首先调用 `LoadIndexFileCoroutine()` 读取索引文件，如果失败则尝试自动生成，并在生成失败时终止加载。
3. **逐个加载切片**：遍历索引列表，依次读取每个文件的二进制数据，解析为 `DicomDataset`，验证有效性，提取像素数据，然后生成 `DicomSlice` 并添加到目标序列。每隔数个切片更新一次进度。
4. **结果整理**：全部切片加载完成后，检查是否至少加载了一张切片；如果没有则视为失败。否则，对切片列表进行排序并设置体积属性。
5. **验证与结束**：调用 `ValidateLoadedSeries()` 检查所有切片尺寸是否一致。验证通过则触发完成事件，否则触发失败事件。
6. **清理与取消**：在任何阶段，调用 `StopLoading()` 可以取消加载并释放资源。

## 基类继承结构
DicomSeriesLoader 继承自 DicomLoader 抽象基类，获得：
- 统一的事件接口（OnLoadingComplete, OnLoadingFailed, OnLoadingStatusChanged）
- 基础的状态管理（isLoading, loadingProgress, loadingStatus）
- 抽象方法约束（StartLoading, StopLoading）