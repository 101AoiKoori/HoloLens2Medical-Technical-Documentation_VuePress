---
title: Creation 模块整体流程 
---
# Creation 模块整体流程 

`DicomTextureCreator` 是纹理生产工厂。它依赖四个主要对象:

* **`DicomSeries`**:包含一组 DICOM 切片及其元数据。
* **`DicomSliceManager`**:负责顺序读取和管理单个 `DicomSlice`。
* **`DicomTextureCache`**:缓存生成的纹理，以便重复使用。
* **`DicomCoordinateMapper`**:将三维体素坐标映射到不同切面。

构造函数接收这些依赖并初始化窗宽窗位。它还保存一个 `MonoBehaviour` 引用，用于启动协程。

### 工作流程概述

1. **生成轴向纹理**:通过 `DicomSlice.CreateTexture()` 直接解码切片并应用当前窗宽窗位。
2. **缓存体素数据**:在生成矢状或冠状面时，首先调用 `CacheVolumeData()` 构建 `_rawVolumeData`，然后利用 `ApplyWindowLevelToVolumeData()` 将其转换为灰阶值。
3. **快速提取切面**:使用 `ExtractCoronalTextureFromVolume()` / `ExtractSagittalTextureFromVolume()` 从 `_cachedVolumeData` 中批量拷贝像素。若体素缓存不可用，回退到逐像素算法。
4. **使用缓存**:在创建纹理前检查 `DicomTextureCache` 是否已缓存该键，如果命中则直接返回。
5. **事件通知**:生成成功后，通过 `OnTextureUpdated` 事件通知 UI 更新。

### 事件与延迟更新

* `OnWindowLevelChanged`:当窗宽窗位更新且体素缓存存在时触发，通过回调参数传递新的中心和宽度。。
* `OnTextureUpdated`:每次生成新的纹理后触发，传递平面类型、索引和纹理实例。

### 协程与异步

大多数生成操作都可以在协程中运行，例如 `PreloadAxialTexturesCoroutine` 分批加载切片以避免阻塞。延迟更新窗宽窗位同样通过协程实现，确保频繁操作时不会反复刷新。