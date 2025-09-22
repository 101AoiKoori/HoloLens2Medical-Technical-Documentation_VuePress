---
title: UI 模块总览
---
# UI 模块总览

UI 模块是医疗 MR 应用中连接用户与底层图像处理逻辑的重要桥梁。它以 MRTK3 提供的按键和滑块为基础，封装了加载数据、浏览切片、调整窗宽窗位和显隐三维平面的全部交互。该模块隶属于 `MedicalMR.DICOM.UI` 命名空间，主要由两个脚本组成:

| 组件                  | 功能概述                                                     |
|----------------------|------------------------------------------------------------|
| **DicomUIController** | 管理 UI 面板，绑定按钮和滑块事件，调用 MPRViewer 与 3D 切片管理器。 |
| **MPRVisibilityController** | 控制三维切面和平面包围盒的显隐状态，采用组件级控制避免破坏对象生命周期。 |

## 模块架构设计

### MRTK3集成策略
UI模块采用MRTK3的PressableButton和Slider组件作为基础交互控件。DicomUIController通过事件监听器模式与MRTK3控件集成，支持手势操作、语音命令和眼动追踪等多模态交互。

### 自动化发现机制
系统采用递归搜索算法自动查找UI元素，通过名称匹配的容错处理减少手动配置工作。查找算法支持模糊匹配和层级遍历，提高脚本的复用性。

### 事件驱动架构
模块间通过松耦合的事件系统通信，DicomUIController订阅MPRViewer的数据加载、切片变更和窗宽窗位变更事件，实现UI与数据模型的实时同步。

## 模块职责

* **加载与重置**:通过 Load 按钮触发 `MPRViewer.LoadDicomData()` 加载 DICOM 数据；通过 Reset 按钮调用 `MPRViewer.ResetView()` 重置视图。
* **切片浏览**:三个滑块分别对应轴向、矢状和冠状平面；滑动可改变当前索引，同时同步更新 3D 切片显示。
* **窗宽窗位调节**:窗宽（Width）和窗位（Center）滑块通过归一化映射到实际的数值范围，调用 `SetWindowLevel()` 更新 2D 与 3D 显示。
* **显隐控制**:按钮通过 `MPRVisibilityController` 控制三维切片平面及包围盒的显示与隐藏；采用组件级开关而不是GameObject激活状态控制。
* **状态反馈与禁用**:`UpdateStatus()` 方法在 UI 上输出提示信息；`EnableControls()` 在数据加载前禁用滑块和按钮，避免误操作。

## 工作流程

1. **初始化阶段**:在 Unity 的 `Start()` 生命周期方法中，`DicomUIController` 根据 `autoFindUIElements` 配置自动查找或使用手动引用的 UI 控件。接着查找并缓存 `MPRViewer`、`DicomSlice3DManager` 和 `MPRVisibilityController` 的引用。然后连接所有按钮、滑块和 MPRViewer 的事件，并禁用控件等待数据加载。

2. **数据加载**:用户点击 Load 按钮时，调用 `MPRViewer.LoadDicomData()`。加载过程是异步的，完成后会触发 `OnDicomLoaded` 事件。UI 控制器接收到事件后启用所有控件、更新滑块范围，并将 DICOM 系列传递给 3D 切片管理器。

3. **交互操作**:
   * 用户通过滑块调整切片索引，`OnPlaneSliderChanged()` 根据归一化值计算实际索引并调用 `SetSliceIndex()` 更新 2D 和 3D 切片。
   * 调整窗宽窗位时，归一化值经 `Mathf.Lerp()` 映射到设定的范围，随即更新 2D 和 3D 窗口级别。
   * 点击显隐按钮通过 `MPRVisibilityController` 切换三维平面或包围盒的显示状态。

4. **状态同步**:Reset 按钮会复位所有窗口级别和切片索引，同时同步更新滑块值。MPRViewer 的事件回调保证 UI 与实际显示保持一致，使用 `isUpdatingUI` 标志防止递归更新。

## 防递归机制

UI模块实现了完善的防递归机制来避免事件循环:

* **isUpdatingUI标志**:在UI更新过程中设置此标志，防止事件回调触发新的UI更新
* **SetValueWithoutNotify**:MRTK3滑块支持的静默值更新，避免触发事件监听器
* **事件解绑策略**:在OnDestroy中完整清理所有事件监听器，防止悬挂引用
