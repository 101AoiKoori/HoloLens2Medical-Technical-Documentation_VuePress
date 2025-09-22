---
title: Imaging 模块概览
---
# Imaging 模块概览

Imaging 模块是医学影像渲染的核心。它整合了 DICOM 数据的解码、三维到二维的纹理生成、缓存管理以及多平面重建 (MPR) 的调度。

本模块被划分为三个子模块，各自负责不同职责:

* **Cache 模块**:负责管理不同切面纹理的缓存。它提供 LRU / 混合策略淘汰机制、内存上限控制和窗口宽窗位相关的键管理，以及线程安全的增删查接口。
* **Creation 模块**:负责从 DICOM 序列生成纹理，涵盖轴向、冠状和矢状三种切面以及体数据的缓存与窗宽窗位应用。它优先利用体素缓存进行快速提取，并在必要时回退到逐像素计算。
* **MPR 模块**:充当调度中心，维护请求队列并根据优先级调度纹理生成。它协调 Creation 与 Cache，并在运行时动态监控内存压力、限制并发、清理资源。

# Cache 模块概览

Cache 模块负责在有限内存中高效存储和复用各平面 (Axial / Coronal / Sagittal) 的 `Texture2D`。它解决以下问题:

* 多切面同时展示时的内存占用；
* 频繁切换切片时的加载延迟；
* 在窗宽窗位改变时快速失效旧缓存；
* 在高内存压力下主动淘汰并释放资源。

核心类 `DicomTextureCache` 通过多组字典和 LRU 链表维护缓存，并提供线程安全的添加、查询、淘汰与清理接口。其内部结构、淘汰策略和内存管理在原理解读页中详细介绍。

## 原理解读

| 页面 | 内容简述 |
|---|---|
| [缓存架构设计](explanations/Cache/architecture.html) | 介绍缓存的数据结构、窗口宽窗位键和引用计数等内部设计。 |
| [缓存淘汰与LRU策略](explanations/Cache/eviction-and-lru.html) | 深入解析 LRU 与混合淘汰策略的权重计算、紧急清理及选择锁定机制。 |
| [内存与资源管理](explanations/Cache/memory-management.html) | 讨论内存上限、内存压力监控及释放流程。 |

## 实现细节

| 页面 | 任务简述 |
|---|---|
| [清理缓存](implementation/Cache/01-clear-cache.html) | 完全清理缓存的实现步骤、内部清理机制和自动修剪逻辑。 |
| [配置缓存限制](implementation/Cache/02-set-cache-limits.html) | 缓存大小设置方法、内存限制计算规则和平台推荐配置。 |
| [纹理存取操作](implementation/Cache/03-retrieve-and-store-textures.html) | 获取纹理的完整流程、存储纹理的详细步骤和纹理状态管理。 |
| [窗宽窗位键管理](implementation/Cache/04-manage-window-level.html) | 窗位键生成和管理、缓存键结构解析和窗位变化处理机制。 |
| [缓存淘汰策略实现](implementation/Cache/05-eviction-strategies.html) | 平衡淘汰算法详解、紧急清理机制和LRU链表管理。 |
| [内存监控与压力管理](implementation/Cache/06-memory-monitoring.html) | 内存压力检测机制、选择锁保护机制和自适应清理策略。 |

阅读顺序建议:先了解缓存架构，再根据需要查阅淘汰策略和内存管理，最后参考实现细节中的具体任务。

# Creation 模块概览

Creation 模块负责将 DICOM 序列转换为 Unity 的 `Texture2D`，涵盖三种切面（轴向、矢状和冠状）和三维体素缓存。本模块既提供快速批量生成的路径，也包含在体数据未准备好的情况下的回退算法。

**关键职能**:

* 从 `DicomSeries` 读取切片，通过 `DicomSlice` 创建单切片纹理。
* 维护 `_rawVolumeData` 和 `_cachedVolumeData`，利用体素缓存快速提取矢状/冠状面。
* 在窗宽窗位改变时重新应用灰阶映射，并更新所有平面纹理。
* 提供缓冲区对象池减少 GC 压力。

## 原理解读

| 页面 | 内容简述 |
|---|---|
| [Creation模块整体流程](explanations/Creation/overview.html) | 描述模块的整体流程、依赖关系和事件机制。 |
| [轴向纹理生成](explanations/Creation/axial-generation.html) | 解释如何生成轴向纹理及批量预加载。 |
| [冠状和矢状纹理生成](explanations/Creation/coronal-sagittal-generation.html) | 分析冠状和矢状面纹理的快速提取与回退逻辑。 |
| [体素缓存与窗宽窗位](explanations/Creation/volume-caching.html) | 讨论体素缓存的构建、窗宽窗位应用及同步更新。 |
| [缓冲区池与性能优化](explanations/Creation/buffer-pool.html) | 介绍颜色缓冲池的作用与实现。 |

## 实现细节

| 页面 | 任务简述 |
|---|---|
| [生成轴向纹理](implementation/Creation/01-generate-axial-textures.html) | 单个轴向纹理获取流程、同步和异步批量预加载、纹理更新事件处理。 |
| [生成冠状和矢状纹理](implementation/Creation/02-generate-coronal-sagittal-textures.html) | 快速路径和回退算法实现、异步协程版本、性能优化策略。 |
| [体素数据缓存](implementation/Creation/03-volume-data-caching.html) | 原始体素数据缓存、窗宽窗位应用机制、缓存管理方法。 |
| [缓冲区池管理](implementation/Creation/04-buffer-pool-management.html) | 缓冲区池机制、获取和归还缓冲区、池大小管理策略。 |
| [窗宽窗位管理](implementation/Creation/05-window-level-management.html) | 延迟更新机制、事件通知系统、预设窗宽窗位和参数验证。 |
| [坐标映射与几何计算](implementation/Creation/06-coordinate-mapping.html) | 多坐标系统转换、平面维度计算、体素到纹理映射。 |

# MPR 模块概览

多平面重建 (MPR) 模块提供了一个统一的纹理请求调度器，用于协调纹理生成、缓存复用和内存管理。在用户交互过程中，它确保所需纹理按优先级生成，并在内存受限时主动释放不必要的资源。

核心类 `MPRTextureManager` 继承自 `MonoBehaviour`，通过协程调度异步任务并提供可在 Inspector 中配置的参数:

* **maxAxialTextureCount / maxSagittalTextureCount / maxCoronalTextureCount**:每个切面的最大缓存数量。
* **maxConcurrentTasks**:同时处理的最大纹理创建任务数。
* **memoryMonitorInterval / resourceReleaseInterval**:内存检测和资源释放的时间间隔。

MPR 模块负责的流程包括:请求排序、优先级计算、同步/异步纹理创建、缓存写入、超时处理以及内存监控。

## 原理解读

| 页面 | 内容简述 |
|---|---|
| [MPR管理器概述](explanations/MPR/overview.html) | 描述 MPR 管理器的作用、主要字段与生命周期。 |
| [请求队列与优先级调度](explanations/MPR/request-queue-and-priority.html) | 解释请求队列的结构和优先级计算方法。 |
| [纹理创建流水线](explanations/MPR/texture-creation-pipeline.html) | 展示同步与异步纹理生成的流程。 |
| [内存监控与生命周期](explanations/MPR/memory-and-lifecycle.html) | 探讨内存监控、资源释放与组件生命周期。 |
| [并发与超时控制](explanations/MPR/concurrency-and-timeouts.html) | 分析最大并发任务限制、超时机制与协程管理。 |

## 实现细节

| 页面 | 任务简述 |
|---|---|
| [纹理请求管理](implementation/MPR/01-texture-request-management.html) | 获取纹理接口和流程、请求队列机制、优先级计算策略。 |
| [生命周期管理](implementation/MPR/02-lifecycle-management.html) | 完整的Unity生命周期处理、DICOM序列管理、协程管理和清理。 |
| [异步纹理创建](implementation/MPR/03-asynchronous-texture-creation.html) | 同步和异步创建策略、并发控制机制、超时和错误处理。 |
| [内存优化与压力管理](implementation/MPR/04-memory-optimization.html) | 内存监控机制、压力检测和响应、缓存修剪策略。 |
| [配置与调优](implementation/MPR/05-configuration-and-tuning.html) | 基础配置参数、平台特定配置、性能调优策略。 |

## 模块协作关系

三个子模块相互协作，形成完整的医学影像渲染管道:

```
MPRTextureManager (调度器)
    ↓ 请求纹理
DicomTextureCreator (生成器)  
    ↓ 生成纹理          ↘ 查询/存储
DicomTextureCache (缓存器) ←──┘
```

- **MPR** 作为总调度器，接收用户请求并管理优先级队列
- **Creation** 负责实际的纹理生成工作，支持多种生成策略
- **Cache** 提供高效的纹理存储和复用，减少重复计算

## 使用建议

1. **新手入门**:建议按 Cache → Creation → MPR 的顺序阅读原理解读部分
2. **实现参考**:需要具体实现时，直接查阅对应的实现细节文档
3. **性能调优**:重点关注各模块的内存管理和性能优化相关文档
4. **问题排查**:参考生命周期管理和错误处理相关内容

---
* [返回首页](../README.md)