# Imaging 模块概览

Imaging 模块是医学影像渲染的核心。它整合了 DICOM 数据的解码、三维到二维的纹理生成、缓存管理以及多平面重建 (MPR) 的调度。

本模块被划分为三个子模块，各自负责不同职责：

* **Cache 模块**：负责管理不同切面纹理的缓存。它提供 LRU / 混合策略淘汰机制、内存上限控制和窗口宽窗位相关的键管理，以及线程安全的增删查接口。
* **Creation 模块**：负责从 DICOM 序列生成纹理，涵盖轴向、冠状和矢状三种切面以及体数据的缓存与窗宽窗位应用。它优先利用体素缓存进行快速提取，并在必要时回退到逐像素计算。
* **MPR 模块**：充当调度中心，维护请求队列并根据优先级调度纹理生成。它协调 Creation 与 Cache，并在运行时动态监控内存压力、限制并发、清理资源。

# Cache 模块概览

Cache 模块负责在有限内存中高效存储和复用各平面 (Axial / Coronal / Sagittal) 的 `Texture2D`。它解决以下问题：

* 多切面同时展示时的内存占用；
* 频繁切换切片时的加载延迟；
* 在窗宽窗位改变时快速失效旧缓存；
* 在高内存压力下主动淘汰并释放资源。

核心类 `DicomTextureCache` 通过多组字典和 LRU 链表维护缓存，并提供线程安全的添加、查询、淘汰与清理接口。其内部结构、淘汰策略和内存管理在原理解读页中详细介绍。

## 原理解读

| 页面 | 内容简述 |
|---|---|
| [architecture](explanations/Cache/architecture.html) | 介绍缓存的数据结构、窗口宽窗位键和引用计数等内部设计。 |
| [eviction-and-lru](explanations/Cache/eviction-and-lru.html) | 深入解析 LRU 与混合淘汰策略的权重计算、紧急清理及选择锁定机制。 |
| [memory-management](explanations/Cache/memory-management.html) | 讨论内存上限、内存压力监控及释放流程。 |

## 操作指南

| 页面 | 任务简述 |
|---|---|
| [clear-cache](implementation/Cache/clear-cache.html) | 如何选择性或完全清理缓存。 |
| [set-cache-limits](implementation/Cache/set-cache-limits.html) | 配置每个切面的缓存数量和内存上限。 |
| [retrieve-and-store-textures](implementation/Cache/retrieve-and-store-textures.html) | 正确地从缓存获取、更新 LRU、标记活跃/可见纹理，并存入新的纹理。 |
| [manage-window-level](implementation/Cache/manage-window-level.html) | 管理窗宽窗位键，确保不同 WL/WW 下的纹理互不干扰。 |

阅读顺序建议：先了解缓存架构，再根据需要查阅淘汰策略和内存管理，最后参考操作指南中的具体任务。


# Creation 模块概览

Creation 模块负责将 DICOM 序列转换为 Unity 的 `Texture2D`，涵盖三种切面（轴向、矢状和冠状）和三维体素缓存。本模块既提供快速批量生成的路径，也包含在体数据未准备好的情况下的回退算法。

**关键职能**：

* 从 `DicomSeries` 读取切片，通过 `DicomSlice` 创建单切片纹理。
* 维护 `_rawVolumeData` 和 `_cachedVolumeData`，利用体素缓存快速提取矢状/冠状面。
* 在窗宽窗位改变时重新应用灰阶映射，并更新所有平面纹理。
* 提供缓冲区对象池减少 GC 压力。

本模块分为以下文档：

## 原理解读

| 页面 | 内容简述 |
|---|---|
| [overview](explanations/Cache/overview.html) | 描述模块的整体流程、依赖关系和事件机制。 |
| [axial-generation](explanations/Cache/axial-generation.html) | 解释如何生成轴向纹理及批量预加载。 |
| [coronal-sagittal-generation](explanations/Cache/coronal-sagittal-generation.html) | 分析冠状和矢状面纹理的快速提取与回退逻辑。 |
| [volume-caching](explanations/Cache/volume-caching.html) | 讨论体素缓存的构建、窗宽窗位应用及同步更新。 |
| [buffer-pool](explanations/Cache/buffer-pool.html) | 介绍颜色缓冲池的作用与实现。 |

## 操作指南

| 页面 | 任务简述 |
|---|---|
| [generate-axial-texture](implementation/Cache/generate-axial-texture.html) | 获取单个轴向纹理并响应纹理更新事件。 |
| [generate-coronal-sagittal-texture](implementation/Cache/generate-coronal-sagittal-texture.html) | 生成冠状和矢状面纹理，包括优先使用体素缓存和回退方法。 |
| [preload-axial-textures](implementation/Cache/preload-axial-textures.html) | 批量预加载轴向纹理以提高滚动流畅度。 |
| [cache-volume-data](implementation/Cache/cache-volume-data.html) | 缓存原始体素数据并应用窗宽窗位，供横截面快速提取。 |
| [set-window-level](implementation/Cache/set-window-level.html) | 设置窗宽窗位并通知界面刷新。 |


# MPR 模块概览

多平面重建 (MPR) 模块提供了一个统一的纹理请求调度器，用于协调纹理生成、缓存复用和内存管理。在用户交互过程中，它确保所需纹理按优先级生成，并在内存受限时主动释放不必要的资源。

核心类 `MPRTextureManager` 继承自 `MonoBehaviour`，通过协程调度异步任务并提供可在 Inspector 中配置的参数：

* **maxAxialTextureCount / maxSagittalTextureCount / maxCoronalTextureCount**：每个切面的最大缓存数量。
* **maxConcurrentTasks**：同时处理的最大纹理创建任务数。
* **memoryMonitorInterval / resourceReleaseInterval**：内存检测和资源释放的时间间隔。

MPR 模块负责的流程包括：请求排序、优先级计算、同步/异步纹理创建、缓存写入、超时处理以及内存监控。详细机制请参见下文的原理解读页面。

## 原理解读

| 页面 | 内容简述 |
|---|---|
| [overview](explanations/Cache/overview.html) | 描述 MPR 管理器的作用、主要字段与生命周期。 |
| [request-queue-and-priority](explanations/Cache/request-queue-and-priority.html) | 解释请求队列的结构和优先级计算方法。 |
| [texture-creation-pipeline](explanations/Cache/texture-creation-pipeline.html) | 展示同步与异步纹理生成的流程。 |
| [memory-and-lifecycle](explanations/Cache/memory-and-lifecycle.html) | 探讨内存监控、资源释放与组件生命周期。 |
| [concurrency-and-timeouts](explanations/Cache/concurrency-and-timeouts.html) | 分析最大并发任务限制、超时机制与协程管理。 |

## 操作指南

| 页面 | 任务简述 |
|---|---|
| [get-texture](implementation/Cache/get-texture.html) | 使用 MPRTextureManager 获取纹理；当缓存未命中时根据优先级异步创建。 |
| [set-dicom-series](implementation/Cache/set-dicom-series.html) | 设置新的 DicomSeries 并重置状态。 |
| [set-window-level-and-indices](implementation/Cache/set-window-level-and-indices.html) | 更新当前窗宽窗位和切片索引以调整优先级。 |
| [manage-requests](implementation/Cache/manage-requests.html) | 清空请求队列、取消任务、限制并发等操作。 |
| [memory-optimization](implementation/Cache/memory-optimization.html) | 调整内存检测和资源释放参数以优化运行时性能。 |
---
* [返回首页](../README.md)