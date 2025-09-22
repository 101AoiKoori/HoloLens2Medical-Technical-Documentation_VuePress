---
title: 核心架构设计原理
---

# 核心架构设计原理

Core模块采用协调者模式设计，DicomSeries作为主协调者管理多个专门的子组件。本文档解析这种架构设计的原理和优势。

## 协调者模式的设计理念

DicomSeries作为组件协调者，负责统一管理五个核心子组件的生命周期和交互:

- **DicomMetadata**:纯数据容器，存储体积几何信息
- **DicomSliceManager**:切片集合管理器，处理切片的添加、排序和访问
- **DicomTextureCache**:纹理缓存系统（来自Imaging模块）
- **DicomCoordinateMapper**:坐标映射器，处理DICOM坐标系转换
- **DicomTextureCreator**:纹理创建器（来自Imaging模块），负责多平面重建

### 架构优势

**单一职责原则**:每个组件专注于特定功能领域，职责清晰分离。

**松耦合设计**:组件间通过协调者通信，避免直接依赖关系。

**集中管理**:统一的初始化、配置和资源释放流程。

## 组件初始化的分层设计

DicomSeries在Awake()中按依赖关系顺序初始化组件:

```
基础层:DicomMetadata（数据容器）
     ↓
管理层:DicomSliceManager（集合管理）
     ↓
服务层:DicomTextureCache（缓存服务）
     ↓
计算层:DicomCoordinateMapper（坐标转换）
     ↓
应用层:DicomTextureCreator（纹理生成，依赖所有前层组件）
```

这种分层初始化确保了:
- 无依赖组件先初始化
- 依赖关系自底向上建立
- 避免循环依赖问题

## 门面模式的统一接口

DicomSeries通过属性访问器提供统一的对外接口:

```csharp
// 几何信息代理
public Vector3Int Dimensions => _metadata.Dimensions;
public Vector3 Spacing => _metadata.Spacing;
public Vector3 Origin => _metadata.Origin;

// 窗位窗宽代理
public float DefaultWindowCenter => _metadata.DefaultWindowCenter;
public float DefaultWindowWidth => _metadata.DefaultWindowWidth;

// 切片集合只读访问
public IReadOnlyList<DicomSlice> Slices => _sliceManager.Slices;
```

### 封装的技术优势

**接口稳定性**:外部代码不直接访问子组件，内部重构不影响外部接口。

**访问控制**:通过只读属性控制数据修改权限。

**职责委托**:将具体操作委托给专门的子组件处理。

## 生命周期管理机制

### 统一的资源释放

协调者在OnDestroy()中按特定顺序释放所有子组件资源:

1. **切片数据释放**:最大内存占用项优先释放
2. **纹理缓存清理**:GPU内存回收
3. **特殊缓存清理**:体素数据等额外缓存
4. **强制垃圾回收**:确保内存及时释放

### 初始化时机控制

**延迟初始化**:坐标映射器在第一个切片添加时初始化，确保有有效的DICOM数据。

**条件初始化**:只有在实际需要时才创建复杂对象，避免内存浪费。

## 事件驱动的组件通信

Core模块使用事件系统实现组件间的松耦合通信:

### 窗位窗宽变更通知

```csharp
public delegate void WindowLevelChangedCallback(float center, float width);
public event WindowLevelChangedCallback OnWindowLevelChanged;
```

当窗位窗宽改变时，所有相关组件都会收到通知并更新状态。

### 纹理更新事件

```csharp
public delegate void TextureUpdatedCallback(DicomPlane.PlaneType planeType, int index, Texture2D texture);
public event TextureUpdatedCallback OnTextureUpdated;
```

纹理创建完成后，自动通知UI和可视化组件进行更新。

## 错误处理的分层策略

### 组件级错误隔离

每个子组件负责处理自己的异常，不影响其他组件:

```csharp
public DicomSlice GetSlice(int index)
{
    // 安全委托，返回null而非抛出异常
    return _sliceManager.GetSlice(index);
}
```

### 协调者级错误恢复

协调者提供整体的错误恢复机制:

```csharp
private void InitializeComponents()
{
    try
    {
        // 正常初始化流程
    }
    catch (Exception ex)
    {
        Debug.LogError($"组件初始化失败: {ex.Message}");
        // 设置最小可用状态
        EnsureMinimalViableState();
    }
}
```

## 性能优化的架构考虑

### 懒加载协调

协调者只在实际需要时创建资源密集型对象:

- 像素数据按需解码
- 纹理按需创建
- 坐标映射按需初始化

### 缓存策略协调

多层缓存系统协同工作:

- **切片级缓存**:默认窗位窗宽的纹理
- **系统级缓存**:多种窗位窗宽的纹理池
- **体素缓存**:原始和处理后的体数据

### 内存压力协调

协调者监控整体内存使用，协调各组件的资源释放:

```csharp
public void ReleaseResources()
{
    // 按内存占用大小顺序释放
    _sliceManager.ReleaseSlices();          // 最大占用
    _textureCache.ClearAllCaches();         // GPU内存
    _textureCreator.ClearVolumeCache();     // 体数据缓存
    System.GC.Collect();                    // 强制回收
}
```

## 扩展性设计

### 组件替换能力

通过接口抽象，可以轻松替换特定组件的实现:

- 不同的缓存策略实现
- 不同的坐标映射算法
- 不同的纹理生成方法

### 功能模块化

新功能可以作为独立组件添加，而不影响现有架构:

- 体绘制模块
- 测量工具模块
- 图像增强模块

## 与其他模块的协作

Core模块作为基础设施，为其他模块提供服务:

**Loading模块**:使用Core的切片管理和元数据存储功能。

**Imaging模块**:扩展Core的纹理处理能力，提供高级图像处理功能。

**Viewers模块**:使用Core的数据结构和坐标映射功能构建用户界面。

**Visualization3D模块**:利用Core的几何信息和纹理功能实现三维可视化。

## 总结

Core模块的架构设计体现了现代软件工程的最佳实践:

1. **分层设计**:清晰的依赖层次和职责分离
2. **协调者模式**:统一管理复杂的组件交互
3. **事件驱动**:松耦合的组件通信机制
4. **容错性**:多层次的错误处理和恢复
5. **性能优化**:资源管理和缓存策略的协调
6. **可扩展性**:模块化设计支持功能扩展

这种架构确保了Core模块既能满足当前的功能需求，又具备良好的可维护性和扩展性。