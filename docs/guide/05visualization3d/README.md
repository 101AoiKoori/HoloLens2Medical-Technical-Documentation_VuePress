---
title: Visualization3D模块概述
---

# Visualization3D模块概述

Visualization3D模块隶属于`MedicalMR.DICOM.Visualization3D`命名空间，负责实现DICOM医学影像在3D空间中的多平面重建（Multi-Planar Reconstruction, MPR）可视化。该模块将2D医学影像数据转换为3D场景中的交互式平面，支持轴向、矢状和冠状三个解剖面的实时显示。

## 核心组件

该模块包含四个核心组件:

### DicomSlice3DManager
3D切片平面管理器，负责三个正交平面的统一管理和协调。采用延迟初始化和协程安全机制，支持自动创建平面容器或绑定预设对象。管理器实现了复杂的状态同步逻辑，确保与DicomSeriesLoader和MPRViewer的正确集成。

### DicomPlaneController  
单个切片平面控制器，处理平面的创建、纹理更新和交互控制。支持多级纹理获取机制（TextureManager缓存、RawImage反射、DicomSeries直接生成），实现了协程安全的异步纹理更新和智能重试策略。

### DicomTextureBridge
纹理桥接器，实现2D UI与3D场景之间的纹理同步。通过反射机制获取MPRViewer内部的RawImage组件，将RenderTexture转换为3D可用的Texture2D，并执行医学影像专用的灰度均衡处理。

### MPRVisibilityController
显隐控制器，管理多平面重建界面的统一可见性控制。采用组件级显隐策略（控制Renderer和Collider的enabled状态），避免影响GameObject生命周期，支持MRTK3包围盒集成。

## 技术架构

### 坐标系统转换
- **医学坐标系**:基于患者方位的LPS坐标系（Left-Posterior-Superior）
- **Unity坐标系**:左手坐标系，通过DicomCoordinateMapper实现转换
- **平面朝向**:轴向面（90°X + 180°Y旋转）、矢状面（-90°Y旋转）、冠状面（默认朝向）

### 协程安全机制
所有组件实现了完整的协程安全管理:
- `CanStartCoroutine()`:检查GameObject和组件状态
- `SafeStartCoroutine()`:安全的协程启动包装器
- 活动协程追踪和批量清理机制
- 运行时状态监控和优雅降级处理

### 纹理转换流程
1. GPU内存复制:使用Graphics.Blit将RenderTexture复制到临时缓冲区
2. CPU读取:通过ReadPixels获取像素数据
3. 灰度均衡:确保医学影像的R、G、B通道一致性
4. 资源管理:自动释放临时RenderTexture和内存清理

## 集成特性

### 多源数据支持
- DicomSeriesLoader的异步加载集成
- MPRViewer的UI同步和纹理共享
- 支持运行时动态数据源切换

### 事件驱动同步
- 双向数据绑定:2D UI ↔ 3D场景
- 防递归事件处理机制
- 实时状态一致性保证

### MRTK3兼容性
- PressableButton集成
- Bounds Control显隐管理
- 语音命令和手势识别支持

## 文档结构

本模块文档分为原理解读（explanations）和实现细节（implementation）两部分:

**explanations部分**:
- 3D可视化架构原理