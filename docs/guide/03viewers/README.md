# Viewers (MPRViewer) 模块指南

> 这是 HoloLens2Medical 工程中三平面浏览功能的官方文档索引。该模块封装了三平面纹理展示、切片导航、窗位/窗宽调节、后台加载和资源管理等功能。文档采用 VuePress 结构，你可以在此快速找到对应教程、原理讲解和 API 参考。

## 模块简介
MPRViewer 旨在提供一个便于扩展的三平面医学影像浏览器，帮助开发者在 HoloLens 2 / UWP 平台上快速构建 DICOM 数据的交互式展示。模块使用 partial class 拆分逻辑，区分加载、切片、窗宽窗位、纹理更新与协程管理等子系统，并通过事件暴露接口。

## 快速上手
1. 在 Unity 场景中添加 `MPRViewer` 组件，绑定三个 `RawImage` 用于显示 Axial/ Sagittal/ Coronal 切片。
2. 调用 `LoadDicomData()` 启动加载流程。推荐启用 `useProgressiveLoading` 以快速显示轴向首帧。
3. 使用滑块或手势控制索引和窗宽窗位。常用接口包括：
   - `SetSliceIndex(DicomPlane.PlaneType plane, int index)`
   - `SetWindowLevel(float center, float width)`
   - `ResetView()`

## 文档目录
- **原理拆解(explanations)**
  - [架构总览](./explanations/architecture.md)：了解模块拆分、生命周期及事件。
  - [数据与控制流程](./explanations/data-flow.md)：梳理从加载到显示的时序。
  - [切片索引与预取](./explanations/slice-indexing.md)：解释索引计算与后台预取策略。
  - [窗位与窗宽](./explanations/window-level.md)：讲解调整窗位窗宽的模式与边界。
  - [内存与协程](./explanations/memory-and-coroutines.md)：概述资源释放、协程追踪与内存监测。

- **操作流程(how_to)**
  - [挂载与配置 MPRViewer](./how_to/setup-mprviewer.md)：详解组件添加和 Inspector 参数。
  - [加载 DICOM 序列](./how_to/load-dicom-series.md)：介绍最小加载流程及回调。
  - [切片导航](./how_to/navigate-slices.md)：指导滑块/手势绑定到索引切换。
  - [调整窗位窗宽](./how_to/change-windowlevel.md)：演示使用滑块调整窗位/窗宽。
  - [一键复位](./how_to/reset-view.md)：讲述恢复默认状态的步骤。
  - [渐进与后台加载](./how_to/background-loading.md)：如何开启渐进模式与后台预取。
  - [故障排查](./how_to/troubleshooting.md)：汇总常见问题及修复建议。

## 推荐流程
阅读顺序建议先浏览“架构总览”，再按需深入“数据与控制流程”，最后根据具体需求查阅操作流程和 API 参考。本模块文档保持简洁、实用，目的是让开发者迅速理解半成品的实现细节并完成后续完善。


---
* [返回首页](../README.md)