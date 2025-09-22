---
title: 数据结构关系原理
---

# 数据结构关系原理

Core模块中的数据结构形成了一个完整的医学影像数据模型，本文档解析各数据结构间的关系和设计原理。

## 核心数据结构层次

Core模块的数据结构按职责和依赖关系组织:

```
DicomSeries (协调者)
├── DicomMetadata (体积几何信息)
├── DicomSliceManager (切片集合管理)
│   └── List<DicomSlice> (切片实例集合)
│       ├── DicomDataset (DICOM原始数据)
│       ├── byte[] PixelData (像素数据)
│       └── Texture2D (渲染纹理)
├── DicomCoordinateMapper (坐标映射)
└── 引用Imaging模块组件
    ├── DicomTextureCache (纹理缓存)
    └── DicomTextureCreator (纹理创建)
```

## DicomSeries:系列协调者

DicomSeries作为顶层协调者，管理整个DICOM序列的状态和行为:

### 职责范围

**数据协调**:统一管理体积几何信息、切片集合和缓存系统。

**接口统一**:为外部模块提供一致的访问接口。

**生命周期管理**:协调所有子组件的创建、初始化和销毁。

### 设计模式应用

**门面模式**:隐藏内部复杂性，提供简化的外部接口。

**协调者模式**:减少组件间的直接依赖，集中管理交互逻辑。

**单例模式特征**:在Unity场景中作为MonoBehaviour单例存在。

## DicomMetadata:几何信息容器

DicomMetadata是纯数据容器，存储体积的空间几何信息:

### 核心属性

```csharp
public class DicomMetadata
{
    public Vector3Int Dimensions { get; private set; }  // 体素网格尺寸
    public Vector3 Spacing { get; private set; }        // 体素间距
    public Vector3 Origin { get; private set; }         // 原点坐标
    public Quaternion Orientation { get; private set; } // 方向四元数
    
    // 默认显示参数
    public float DefaultWindowCenter { get; private set; }
    public float DefaultWindowWidth { get; private set; }
}
```

### 几何信息的医学意义

**Dimensions (体素尺寸)**:
- 定义三维网格的大小，如(512, 512, 120)
- 决定了数据的分辨率和内存占用
- 影响坐标映射和纹理生成的计算

**Spacing (体素间距)**:
- 物理空间中相邻体素的距离，单位通常为毫米
- 影响测量工具的精度和3D渲染的比例
- 不同方向可能有不同间距（各向异性）

**Origin (原点坐标)**:
- 体积在病人坐标系中的起始位置
- 用于多序列数据的空间配准
- 影响3D可视化中的定位

**Orientation (方向四元数)**:
- 描述从病人坐标系到Unity坐标系的旋转
- 配合CoordinateMapper使用，处理复杂的方向映射

## DicomSlice:切片数据单元

DicomSlice代表单个DICOM图像切片，是数据处理的基本单位:

### 数据组织结构

```csharp
public class DicomSlice
{
    // DICOM原始数据
    public DicomDataset Dataset { get; private set; }
    public string FilePath { get; private set; }
    
    // 解析后的元数据
    public int InstanceNumber { get; private set; }
    public double SliceLocation { get; private set; }
    public Vector3 ImagePosition { get; private set; }
    public Vector2 PixelSpacing { get; private set; }
    
    // 像素数据（懒加载）
    public byte[] PixelData { get; private set; }
    public bool IsPixelDataDecoded { get; private set; }
    
    // 渲染纹理（缓存）
    public Texture2D Texture { get; private set; }
    
    // 序列中的位置
    public int SequenceIndex { get; set; }
}
```

### 懒加载设计原理

DicomSlice采用三层懒加载策略:

1. **元数据层**:构造时立即解析，开销小
2. **像素数据层**:首次访问时解码，内存占用大
3. **纹理层**:首次显示时创建，GPU资源宝贵

这种设计平衡了内存使用和访问性能。

### 排序和索引机制

DicomSlice实现了复合排序策略:

```csharp
public static int CompareByZPosition(DicomSlice a, DicomSlice b)
{
    // 优先级1:SliceLocation
    int sliceComparison = a.SliceLocation.CompareTo(b.SliceLocation);
    if (sliceComparison != 0) return sliceComparison;
    
    // 优先级2:ImagePosition.z
    int zPositionComparison = a.ImagePosition.z.CompareTo(b.ImagePosition.z);
    if (zPositionComparison != 0) return zPositionComparison;
    
    // 优先级3:InstanceNumber
    return a.InstanceNumber.CompareTo(b.InstanceNumber);
}
```

这确保了不同制造商和扫描协议的DICOM数据都能正确排序。

## DicomSliceManager:集合管理者

DicomSliceManager专门负责切片集合的管理操作:

### 集合操作设计

```csharp
public class DicomSliceManager
{
    private List<DicomSlice> _slices = new List<DicomSlice>();
    
    // 只读访问接口
    public IReadOnlyList<DicomSlice> Slices => _slices;
    
    // 集合操作方法
    public void AddSlice(DicomSlice slice);
    public DicomSlice GetSlice(int index);
    public void SortSlices();
    public void ReleaseSlices();
}
```

### 封装的安全性

**只读访问**:外部代码不能直接修改内部集合。

**索引安全**:GetSlice方法包含边界检查，返回null而非抛出异常。

**重复防护**:AddSlice自动检查重复，避免数据冗余。

## DicomCoordinateMapper:坐标映射系统

DicomCoordinateMapper处理DICOM坐标系与Unity坐标系的转换:

### 坐标系统抽象

```csharp
public class DicomCoordinateMapper
{
    // 方向向量
    private Vector3 rowDirection;
    private Vector3 columnDirection;
    private Vector3 normalDirection;
    
    // 轴映射
    private int axialAxis;      // 轴向平面对应的体素轴
    private int sagittalAxis;   // 矢状平面对应的体素轴
    private int coronalAxis;    // 冠状平面对应的体素轴
    
    // 轴符号
    private int[] axisSign = new int[3];  // 方向标志
}
```

### 映射算法的数学基础

**向量解析**:从ImageOrientationPatient提取行、列方向向量。

**法向量计算**:通过叉积得到切片法线方向。

**主轴判定**:基于向量分量大小确定解剖轴映射。

**符号计算**:处理坐标系方向差异。

## 数据结构间的协作关系

### 数据流向

```
DICOM文件 → DicomSlice(元数据解析)
            ↓
        DicomSliceManager(集合管理)
            ↓
        DicomCoordinateMapper(方向解析)
            ↓
        DicomTextureCreator(纹理生成)
            ↓
        DicomTextureCache(缓存管理)
```

### 依赖关系

**DicomSeries依赖**:所有其他组件，作为协调中心。

**DicomSlice依赖**:DicomDataset和FellowOak库，用于数据解析。

**DicomCoordinateMapper依赖**:DicomSlice提供方向信息。

**DicomTextureCreator依赖**:DicomSliceManager和DicomCoordinateMapper。

### 通信机制

**直接调用**:用于同步操作和数据访问。

**事件通知**:用于状态变更和异步通信。

**属性代理**:用于统一接口和访问控制。

## 内存模型和生命周期

### 内存占用分析

**DicomMetadata**:几十字节，常驻内存。

**DicomSlice元数据**:每切片约1KB，可接受常驻。

**DicomSlice像素数据**:每切片0.5-2MB，需要管理。

**Texture2D**:每纹理1-8MB，需要缓存策略。

### 生命周期管理

**创建阶段**:按需创建，避免预分配大对象。

**使用阶段**:智能缓存，平衡内存和性能。

**释放阶段**:分层释放，确保资源回收。

## 扩展性考虑

### 数据结构扩展点

**DicomSlice扩展**:支持多帧、彩色图像、压缩格式。

**DicomMetadata扩展**:支持更多几何信息、标注数据。

**DicomCoordinateMapper扩展**:支持特殊坐标系、用户定义映射。

### 接口稳定性

通过抽象和封装，内部数据结构可以演进而不影响外部接口:

- 使用只读属性暴露数据
- 通过方法而非直接字段访问
- 版本兼容的序列化支持

## 总结

Core模块的数据结构设计体现了以下原则:

1. **单一职责**:每个类专注于特定数据或功能
2. **层次清晰**:从原始数据到应用数据的逐层抽象
3. **懒加载**:按需分配资源，优化内存使用
4. **安全访问**:通过封装防止数据损坏
5. **扩展友好**:预留扩展点，支持功能增强

这种设计确保了医学影像数据的正确表示、高效访问和安全管理。