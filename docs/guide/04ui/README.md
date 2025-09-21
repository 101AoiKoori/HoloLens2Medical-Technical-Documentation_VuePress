# UI 模块概述

本章节介绍 **UI 模块** 在医疗 MR 项目中的作用。UI 模块负责向用户提供友好的交互界面，以控制 DICOM 多平面重建（MPR）查看器和 3D 切片管理器。通过按键、滑块等控件，用户可以加载 DICOM 数据集、浏览不同方向的切片、调整窗宽窗位、切换三维切片和平面外框的显示状态，并在需要时重置视图。

在 [配置脚本] 中，模块文档由两部分构成：

* **原理解读**（`explanations`）：详细介绍各个脚本的设计思想和实现机制，帮助开发者理解背后的原理。配置脚本会将该目录下的 Markdown 文件生成一个名为“原理解读”的折叠组。
* **操作指南**（`how‑to`）：提供面向使用者的操作流程，例如如何加载数据或调整窗口级别。该目录下的文件会被整理到“操作指南”折叠组中。

本文档包含以下内容：

1. **原理解读**：
   - [UI 总览](./explanations/01-overview.html)  — UI 模块在系统中的定位与组件关系。
   - [DicomUIController](./explanations/02-dicom-ui-controller.html) — 主控制器的内部结构、事件绑定与生命周期。
   - [MPRVisibilityController](./explanations/03-mpr-visibility-controller.html) — 三维平面与包围盒显隐控制器的原理。

2. **操作指南**：
   - [加载 DICOM 数据](./how‑to/01-load-dicom-data.html) — 使用 Load 按钮加载数据集的方法。
   - [重置视图](./how‑to/02-reset-view.html) — 恢复所有窗口和切片为初始状态。
   - [调整切片索引](./how‑to/03-adjust-slice.html) — 通过滑块浏览轴向、矢状和冠状切片。
   - [调整窗宽窗位](./how‑to/04-adjust-window-level.html) — 改变窗口中心和宽度以优化灰度显示。
   - [切换显隐](./how‑to/05-toggle-visibility.html) — 显示或隐藏三维切片平面以及外框。
   - [自动绑定 UI 元素](./how‑to/06-bind-ui-elements.html) — 使用自动查找功能配置控件。

---
* [返回首页](../README.md)