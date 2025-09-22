---
title: Core 模块 · 总览
---

# Core 模块概述

Core 模块是整个 **HoloLens2Medical** 项目的基础层，隶属于命名空间 `MedicalMR.DICOM.Core`。它定义了医学影像数据的表示方式，并提供了理解 DICOM 数据、管理切片、坐标映射和纹理生成的核心算法。

**重要更正**:根据实际代码分析，DicomSeries 实际上是组件协调者，在 Awake() 中初始化多个子组件，而非简单的数据容器。

## 主要职责

Core 模块围绕 DicomSeries 协调者展开，管理五个核心组件:

- **DicomSeries**:主协调者，在 Awake() 中初始化所有子组件，统一管理生命周期
- **DicomMetadata**:纯数据容器，存储体积几何信息与显示默认值
- **DicomSlice**:代表单个 DICOM 切片，支持懒加载解码和纹理缓存机制
- **DicomSliceManager**:切片集合管理器，提供添加、排序、索引访问和资源释放
- **DicomCoordinateMapper**:通过解析 ImageOrientationPatient 实现坐标系转换
- **DicomPlane**:解剖平面类型枚举及工具函数

## 架构设计特点

### 协调者模式
DicomSeries 作为中心协调者，按依赖关系顺序初始化组件:
```
基础层:DicomMetadata → 管理层:DicomSliceManager → 
服务层:DicomTextureCache → 计算层:DicomCoordinateMapper → 
应用层:DicomTextureCreator
```

### 内存管理策略
- **切片级缓存**:默认窗位窗宽纹理的内部缓存
- **懒加载机制**:像素数据按需解码，纹理按需创建
- **分层释放**:纹理、像素数据和元数据的独立释放
- **异常安全**:确保资源不会泄漏

### 坐标变换算法
- **ImageOrientationPatient解析**:提取行向量和列向量
- **法向量计算**:通过叉积确定切片法线方向
- **主轴判定**:基于向量分量大小自动确定解剖轴映射
- **索引映射**:在平面索引和三维坐标间双向转换

## 与其他模块的关系

- **Loading模块**:使用 Core 的切片管理和元数据存储，在第一个切片时初始化坐标映射
- **Imaging模块**:扩展 Core 的纹理处理能力，DicomTextureCreator 和 DicomTextureCache 实际位于此模块
- **Viewers模块**:通过坐标映射将用户操作转换为体素索引，实现多平面同步
- **Visualization3D模块**:利用几何信息在世界坐标系中放置体数据

## 文档结构（重构版）

本目录下的文档按「原理说明」和「技术实现」重新组织:

### Explanations 设计原理与架构思路

  * [核心架构设计原理](./explanations/01_core_architecture_design.html) - 协调者模式、门面模式和事件驱动设计
  * [数据结构关系原理](./explanations/02_data_structure_relationships.html) - 各组件间的依赖和协作关系
  * [坐标系统与方向映射原理](./explanations/03_coordinate_system_principles.html) - DICOM坐标系到Unity坐标系的映射算法
  * [切片数据解码与纹理生成原理](./explanations/04_slice_data_texture_generation.html) - 像素解码、窗位窗宽映射和纹理创建流程

### Implementation 技术实现细节

  * [组件协调机制实现](./implementation/01_component_coordination_mechanism.html) - DicomSeries的协调者模式具体实现
  * [内存管理策略实现](./implementation/02_memory_management_implementation.html) - 切片纹理缓存、释放和GC优化
  * [坐标变换算法实现](./implementation/03_coordinate_transformation_algorithm.html) - ImageOrientationPatient解析的数学实现
  * [性能优化策略实现](./implementation/04_performance_optimization_strategies.html) - 懒加载、资源池、批处理等优化技术

## 要点说明

### 纠正的技术认知

1. **DicomSeries角色**:从简单数据容器更正为组件协调者
2. **初始化时机**:坐标映射器在添加第一个切片时初始化，而非构造时
3. **纹理缓存机制**:DicomSlice有内部纹理缓存，支持自定义窗宽窗位
4. **切片排序算法**:使用 SliceLocation、ImagePosition.z、InstanceNumber 的组合比较

### 强化的实现细节

1. **组件生命周期管理**:详细解析 Awake() 中的初始化顺序和依赖关系
2. **内存优化技巧**:懒加载、资源池、批处理和 GC 优化的具体实现
3. **坐标变换的数学基础**:向量解析、法向量计算和轴判定的算法原理
4. **性能监控和调试**:错误处理、容错机制和性能测量的实现策略

### 技术深度提升

- 从 API 使用说明转向技术实现细节
- 包含完整的代码示例和数学推导
- 解释关键决策的技术原因和性能影响
- 提供扩展方向和优化建议

---
<<<<<<< HEAD
* [返回首页](../README.html)
=======
* [返回首页](../README.md)
>>>>>>> c4737bdd0404c0340c81630a55b6ae3f2354818c
