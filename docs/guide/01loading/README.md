---
title: Loading 模块概述
---
# Loading 模块概述
Loading 模块负责将磁盘中的 DICOM 文件批量读取、解析，并组织为 Unity 中可用的 `DicomSeries` 对象。它是项目中承上启下的关键层:一方面依赖 **Core** 模块的数据结构(`DicomSlice`、`DicomMetadata` 等)，另一方面为上层的 **Imaging / UI / Viewers** 提供完整的序列数据。

与单个切片的处理不同，Loading 模块强调 **流程化加载** 与 **状态管理**，确保在 HoloLens2/UWP 环境下能够稳定、渐进地完成大量医学影像的导入。

## 核心架构

### 抽象基类 DicomLoader
定义统一的加载接口和事件系统:
- `OnLoadingStatusChanged` - 进度和状态变更通知
- `OnLoadingComplete` - 加载完成，返回序列与体积信息  
- `OnLoadingFailed` - 加载失败错误处理
- `StartLoading()` / `StopLoading()` - 抽象方法约束

### 具体实现 DicomSeriesLoader
采用**部分类（partial class）**设计模式，将功能模块化:

- **主类** - 协调各模块，提供对外接口
- **Indexing模块** - JSON索引文件的读取、解析和自动生成
- **FileIO模块** - 基于UnityWebRequest的文件读取，支持相对/绝对路径
- **Loader模块** - 核心加载协程，管理整个批量加载流程
- **PixelData模块** - DICOM像素数据提取和验证
- **Validation模块** - 数据集验证和体积属性推导
- **Status模块** - 统一的日志输出和进度状态管理

### 关键组件

**JSONIndexParser**  
轻量级JSON解析器，将索引文件转换为切片路径列表。支持UTF-8 BOM字符自动处理。

**文件读取协程**  
- `ReadFileTextCoroutine()` - 异步读取索引文件
- `ReadFileBytesCoroutine()` - 异步读取DICOM二进制数据
- 统一的10秒超时控制和错误处理

## 加载流程

Loading模块按以下阶段执行:

1. **初始化**（0%-5%）- 准备DicomSeries，清理资源
2. **索引处理**（5%-20%）- 读取或生成JSON索引文件
3. **批量加载**（40%-90%）- 逐个处理DICOM文件
   - 文件读取 → DICOM解析 → 像素提取 → 切片创建
   - 每5个文件更新一次进度
4. **数据整理**（90%-95%）- 切片排序和体积属性设置
5. **验证完成**（95%-100%）- 数据一致性检查

## 与其他模块的关系

**Core 模块依赖**  
直接使用Core模块的`DicomSeries`、`DicomSlice`等数据结构，加载完成的数据无缝集成到Core的管理体系中。

**为上层模块服务**  
- **Imaging模块** - 需要完整的序列数据进行纹理创建和缓存管理
- **UI模块** - 通过事件系统获取加载进度和状态更新
- **Viewers模块** - 依赖加载完成的体积数据进行三视图显示
- **Visualization3D模块** - 使用体积属性进行3D渲染

## 支持特性

- **双路径模式** - StreamingAssets相对路径和系统绝对路径
- **自动索引生成** - 相对路径模式下可自动扫描生成索引
- **协程安全** - 完整的异步加载，不阻塞主线程
- **内存管理** - 自动垃圾回收和资源清理
- **错误恢复** - 单文件失败不影响整体加载进程
- **进度监控** - 详细的加载进度和状态反馈

## 文档结构

### Explanations（设计原理与实现思路）

- [Loading 模块架构与流程概览](./explanations/loader_architecture.html)
- [DICOM 序列加载流程](./explanations/loading_process.html)  
- [JSON 索引文件处理机制](./explanations/index_file.html)
- [文件读取与路径解析](./explanations/file_io.html)
- [像素数据提取原理](./explanations/pixel_data.html)
- [进度更新、事件与日志机制](./explanations/progress_and_logging.html)
- [数据验证与体积信息推导](./explanations/validation_and_volume.html)

### Implementation（实现细节与使用示例）

- [基本DICOM序列加载](./implementation/01_basic_loading.html)
- [进度监控与状态显示](./implementation/02_progress_monitoring.html)
- [索引文件管理](./implementation/03_index_file_management.html)
- [错误处理与异常管理](./implementation/04_error_handling.html)
- [绝对路径加载](./implementation/05_absolute_path_loading.html)
- [体积数据访问与使用](./implementation/06_volume_data_access.html)

## 快速开始

1. **基础配置** - 将DICOM文件放入`StreamingAssets/DICOM`目录
2. **添加组件** - 在GameObject上添加`DicomSeriesLoader`组件
3. **订阅事件** - 监听`OnLoadingComplete`获取加载结果
4. **启动加载** - 调用`StartLoading()`开始处理

```csharp
loader.OnLoadingComplete.AddListener((result, dims, spacing, origin) => {
    DicomSeries series = result as DicomSeries;
    Debug.Log($"加载完成:{series.Slices.Count}张切片");
});
loader.StartLoading();
```

> **建议阅读顺序**:先阅读 **explanations** 了解设计原理，再通过 **implementation** 掌握具体使用方法。

---
[返回首页](../README.md)