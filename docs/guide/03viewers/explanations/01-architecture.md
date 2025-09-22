---
title: Viewers模块架构详解
---
# Viewers模块架构详解

> 命名空间:MedicalMR.DICOM.Viewers  
> 核心组件:MPRViewer及其五个部分类子模块

## 核心架构设计

### partial class设计模式的应用

MPRViewer采用partial class（部分类）架构，将复杂的三平面查看器功能拆分为五个职责明确的子模块:

- **Loader模块**:负责与DicomLoader协作，处理DICOM数据加载完成的回调
- **WindowLevel模块**:管理窗宽窗位的设置与平滑过渡
- **SliceControl模块**:维护三个平面的切片索引，处理切片导航
- **TextureUpdater模块**:协调纹理的生成、缓存和UI更新
- **Coroutine模块**:统一管理协程生命周期和内存监控

### 数据结构关系

#### 核心数据流向
```
DicomSeries → MPRTextureManager → RawImage
     ↓              ↓               ↓
切片数据 → 纹理生成与缓存 → UI显示
```

#### 索引状态管理
每个子模块维护自己的状态，通过主类MPRViewer进行协调:
- SliceControl维护三个平面的当前索引（axialIndex, sagittalIndex, coronalIndex）
- WindowLevel维护当前窗宽窗位值和目标值
- TextureUpdater监听纹理生成事件并更新UI

#### 事件驱动的松耦合设计
各模块通过事件进行通信，避免紧耦合:
- OnSliceChanged:切片索引变化时触发
- OnWindowLevelChanged:窗宽窗位变化时触发  
- OnDicomLoaded:DICOM数据加载完成时触发

### 生命周期管理

#### 初始化阶段（Awake/Start）
```csharp
Awake() {
    // 1. 实例化五个子模块
    loaderModule = new Loader(this);
    windowLevelModule = new WindowLevel(this);
    // ...
    
    // 2. 初始化组件依赖
    textureUpdaterModule.InitializeTextureManager();
    windowLevelModule.InitializeWindowLevel(windowCenter, windowWidth);
}
```

#### 运行时协调（Update）
主类在Update中协调各子模块的更新:
- 处理窗宽窗位的平滑过渡
- 执行内存监控检查

#### 资源释放（OnDestroy）
通过标志位isShuttingDown确保安全释放，防止资源竞争。

## 坐标系统原理

### 医学影像坐标转换
MPRViewer处理三种解剖平面的坐标映射:
- **轴向（Axial）**:直接使用DicomSeries.Slices的索引
- **矢状（Sagittal）**:通过GetSagittalDimension()获取Y轴维度
- **冠状（Coronal）**:通过GetCoronalDimension()获取Z轴维度

### 索引边界处理
所有索引设置都经过严格的边界检查:
```csharp
index = Mathf.Clamp(index, 0, totalSlices - 1);
```

### 同步机制设计
索引变化时同时更新:
1. 内部状态（sliceControlModule）
2. 纹理管理器状态（textureManager.SetCurrentIndices）
3. UI显示（textureUpdaterModule.UpdateTexture）
4. 事件通知（InvokeSliceChanged）