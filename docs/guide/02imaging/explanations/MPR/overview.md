---
title: MPR 管理器概述 
---
# MPR 管理器概述 

`MPRTextureManager` 充当整个 Imaging 模块的调度器。它维护纹理请求队列、当前窗宽窗位、当前切片索引以及资源监控计时器。

## 主要字段

* **请求队列与状态**:`_requestQueue` 存放待处理的 `TextureRequest`，`_pendingRequests` 用于快速查重，`_activeCoroutines` 跟踪正在执行的协程数量。
* **缓存引用**:通过 `_textureCache` 持有 Cache 模块的实例，实现生成后自动写入缓存。
* **当前状态**:`_currentWindowCenter`、`_currentWindowWidth` 记录窗宽窗位；`_currentAxialIndex` 等记录当前三平面的切片索引。
* **内存监控**:`enableMemoryMonitoring` 控制是否启用内存压力检测；`memoryMonitorInterval` 和 `resourceReleaseInterval` 控制检测和释放频率。

## 生命周期

MPR 管理器在 `Awake()` 中调用 `Initialize()` 初始化缓存；在 `Update()` 中定期检查内存并释放资源；在 `OnDisable()` 和 `OnDestroy()` 中停止协程并清理资源。这些生命周期方法确保在场景切换时释放所有资源，避免内存泄漏。

## 职责划分

* **纹理请求管理**:通过请求队列和优先级排序，决定哪些纹理应当先生成。
* **纹理创建流程**:根据请求类型选择同步或异步生成纹理，生成完成后写入缓存并触发事件。
* **内存与并发控制**:限制同时生成纹理的数量 (`maxConcurrentTasks`)，在内存压力较大时暂停队列并清理缓存。
* **DICOM 序列管理**:在调用 `SetDicomSeries()` 时重置状态并同步窗口键。