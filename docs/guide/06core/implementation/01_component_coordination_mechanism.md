---
title: 组件协调机制实现
---

# 组件协调机制实现

本文档深入解析DicomSeries作为协调者管理各子组件生命周期的技术实现，展示部分类设计模式在实际项目中的应用。

## 组件初始化顺序与依赖关系

DicomSeries在Awake()方法中按特定顺序初始化所有子组件:

```csharp
private void InitializeComponents()
{
    // 1. 基础数据容器 - 无依赖
    _metadata = new DicomMetadata();
    
    // 2. 切片管理器 - 无依赖
    _sliceManager = new DicomSliceManager();
    
    // 3. 纹理缓存 - 仅依赖调试设置
    _textureCache = new DicomTextureCache(_enableDebugLog);
    
    // 4. 坐标映射器 - 无依赖，但需要DICOM数据初始化
    _coordinateMapper = new DicomCoordinateMapper();
    
    // 5. 纹理创建器 - 依赖所有前面的组件
    _textureCreator = new DicomTextureCreator(this, _sliceManager, 
                                             _textureCache, _coordinateMapper, 
                                             _enableDebugLog);
}
```

### 初始化顺序设计原理

1. **DicomMetadata**:作为纯数据容器最先初始化，为后续组件提供几何信息
2. **DicomSliceManager**:切片集合管理器，独立于其他组件
3. **DicomTextureCache**:纹理缓存系统，为纹理创建器提供存储服务
4. **DicomCoordinateMapper**:坐标映射器，需要在第一个切片加载时初始化方向信息
5. **DicomTextureCreator**:纹理创建器最后初始化，因为它需要引用所有其他组件

## 协调者模式的核心实现

DicomSeries通过属性访问器暴露子组件的功能，实现了门面模式:

```csharp
#region Property Accessors

// 几何信息代理 - 直接暴露DicomMetadata的属性
public Vector3Int Dimensions => _metadata.Dimensions;
public Vector3 Spacing => _metadata.Spacing;
public Vector3 Origin => _metadata.Origin;

// 窗位窗宽代理
public float DefaultWindowCenter => _metadata.DefaultWindowCenter;
public float DefaultWindowWidth => _metadata.DefaultWindowWidth;

// 切片集合只读视图 - 防止外部直接修改内部集合
public System.Collections.Generic.IReadOnlyList<DicomSlice> Slices => _sliceManager.Slices;

#endregion
```

### 协调操作的具体实现

**添加切片时的协调逻辑**:
```csharp
public void AddSlice(DicomSlice slice)
{
    // 1. 委托给切片管理器
    _sliceManager.AddSlice(slice);

    // 2. 首次添加时初始化坐标映射器
    if (_sliceManager.Slices.Count == 1 && slice.Dataset != null)
    {
        _coordinateMapper.InitializeFromDataset(slice.Dataset);
    }
}
```

**纹理获取时的协调逻辑**:
```csharp
public Texture2D GetAxialTexture(int index, float? windowCenter = null, float? windowWidth = null)
{
    // 处理默认值
    float effectiveWindowCenter = windowCenter ?? DefaultWindowCenter;
    float effectiveWindowWidth = windowWidth ?? DefaultWindowWidth;

    // 委托给纹理创建器，传递有效参数
    if (_textureCreator != null)
    {
        return _textureCreator.GetAxialTexture(index, effectiveWindowCenter, effectiveWindowWidth);
    }
    return null;
}
```

## 资源释放协调机制

DicomSeries在OnDestroy()中协调所有子组件的资源释放:

```csharp
public void ReleaseResources()
{
    // 1. 释放切片集合（最重要的内存占用）
    _sliceManager.ReleaseSlices();
    
    // 2. 清空纹理缓存（释放GPU内存）
    _textureCache.ClearAllCaches();

    // 3. 清理纹理创建器的特殊缓存
    if (_textureCreator != null)
    {
        _textureCreator.ClearVolumeCache();
        _textureCreator.Cleanup();
    }

    // 4. 强制垃圾回收
    System.GC.Collect();

    if (_enableDebugLog)
        Debug.Log("[DicomSeries] All resources released");
}
```

### 释放顺序的技术考虑

1. **切片优先**:切片包含最大的内存占用（像素数据和纹理）
2. **缓存清理**:确保GPU纹理被正确销毁
3. **特殊缓存**:TextureCreator的体素缓存需要单独清理
4. **垃圾回收**:手动触发GC确保内存及时释放

## 组件间通信机制

DicomSeries通过事件系统实现松耦合的组件通信:

```csharp
// 在DicomTextureCreator中定义的回调
public delegate void WindowLevelChangedCallback(float center, float width);
public event WindowLevelChangedCallback OnWindowLevelChanged;

public delegate void TextureUpdatedCallback(DicomPlane.PlaneType planeType, int index, Texture2D texture);
public event TextureUpdatedCallback OnTextureUpdated;
```

### 状态同步实现

当窗位窗宽改变时，协调者确保所有相关组件同步更新:

```csharp
// 在DicomTextureCreator中的实现
private void SetWindowLevel(float center, float width)
{
    _lastWindowCenter = center;
    _lastWindowWidth = width;
    
    // 通知所有监听者
    OnWindowLevelChanged?.Invoke(center, width);
}
```

## 错误处理和容错机制

协调者模式的关键是处理子组件的异常情况:

```csharp
public DicomSlice GetSlice(int index)
{
    // 安全委托，避免空引用
    return _sliceManager.GetSlice(index);
}

// 在DicomSliceManager中的安全实现
public DicomSlice GetSlice(int index)
{
    if (index >= 0 && index < _slices.Count)
        return _slices[index];
    return null; // 优雅返回null而非抛出异常
}
```

### 初始化失败的恢复机制

```csharp
private void InitializeComponents()
{
    try
    {
        // 组件初始化代码
    }
    catch (Exception ex)
    {
        Debug.LogError($"组件初始化失败: {ex.Message}");
        // 设置默认状态，确保对象仍然可用
        _metadata = new DicomMetadata();
        _sliceManager = new DicomSliceManager();
    }
}
```

## 性能优化考虑

### 懒加载协调

DicomSeries只在实际需要时创建纹理，避免内存浪费:

```csharp
public Texture2D CreateSagittalTexture(int xIndex, float? windowCenter = null, float? windowWidth = null)
{
    // 只有在调用时才创建，而非预加载
    if (_textureCreator != null)
    {
        return _textureCreator.CreateSagittalTexture(xIndex, effectiveWindowCenter, effectiveWindowWidth);
    }
    return null;
}
```

### 协程管理协调

对于耗时操作，协调者提供协程版本:

```csharp
public System.Collections.IEnumerator CreateSagittalTextureCoroutine(int xIndex, float windowCenter, float windowWidth, System.Action<Texture2D> onComplete)
{
    return _textureCreator.CreateSagittalTextureCoroutine(xIndex, windowCenter, windowWidth, onComplete);
}
```

这种设计将复杂的异步逻辑封装在TextureCreator内部，而协调者只负责接口转发。

## 总结

DicomSeries的协调者实现体现了以下关键设计原则:

1. **单一职责**:每个子组件专注于特定功能
2. **依赖注入**:通过构造函数注入依赖关系
3. **门面模式**:统一对外接口，隐藏内部复杂性
4. **生命周期管理**:协调所有组件的创建和销毁
5. **错误隔离**:子组件的错误不会影响整体功能

这种架构使得Core模块既保持了高内聚性，又具备了良好的可扩展性和可维护性。