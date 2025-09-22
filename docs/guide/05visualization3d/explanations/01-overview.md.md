---
title: Visualization3D模块概述
---
# Visualization3D模块概述

Visualization3D模块隶属于`MedicalMR.DICOM.Visualization3D`命名空间，负责实现DICOM医学影像在3D空间中的多平面重建（Multi-Planar Reconstruction, MPR）可视化。该模块将2D医学影像数据转换为3D场景中的交互式平面，支持轴向、矢状和冠状三个解剖面的实时显示。

## 模块组成

该模块包含以下核心组件:

- **DicomSlice3DManager**:3D切片平面管理器，负责三个正交平面的统一管理和协调
- **DicomPlaneController**:单个切片平面控制器，处理平面的创建、纹理更新和交互控制
- **DicomTextureBridge**:纹理桥接器，实现2D UI与3D场景之间的纹理同步
- **MPRVisibilityController**:显隐控制器，管理多平面重建界面的可见性

## 技术特点

该模块采用以下技术实现:

- **协程安全机制**:所有异步操作均使用`CanStartCoroutine()`检查GameObject状态，避免在对象未激活时执行协程
- **多源纹理获取**:支持从MPRViewer的TextureManager、RawImage或DicomSeries直接获取纹理，提供多级回退机制
- **实时纹理转换**:将UI端的RenderTexture转换为3D场景可用的Texture2D，并进行灰度均衡处理
- **事件驱动同步**:通过事件机制实现2D UI与3D场景之间的状态同步

## 坐标系统

该模块采用医学影像标准坐标系:

- **轴向平面（Axial）**:水平切面，沿Y轴移动，旋转90°（X轴）+ 180°（Y轴）
- **矢状平面（Sagittal）**:左右分割面，沿X轴移动，绕Y轴旋转-90°
- **冠状平面（Coronal）**:前后分割面，沿Z轴移动，无需旋转

## 文档结构

本模块文档分为原理解读（explanations）和实现细节（implementation）两部分:

**explanations部分**:
- 3D可视化架构原理
- 多平面重建技术
- 纹理桥接机制

**implementation部分**:
- 部分类协调机制实现
- 协程安全管理策略
- 纹理转换算法细节
- 显隐控制实现方案