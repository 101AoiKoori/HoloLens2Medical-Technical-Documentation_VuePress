---
title: 部分类协调机制实现
---
# 部分类协调机制实现

> 深入解析MPRViewer的partial class设计与五个子模块的协调实现

## 模块实例化与初始化顺序

### Awake阶段的精确顺序
```csharp
private void Awake() {
    // 1. 子模块实例化（构造函数调用）
    loaderModule = new Loader(this);
    windowLevelModule = new WindowLevel(this);
    sliceControlModule = new SliceControl(this);
    textureUpdaterModule = new TextureUpdater(this);
    coroutineModule = new Coroutine(this);

    // 2. 依赖组件初始化
    textureUpdaterModule.InitializeTextureManager();
    
    // 3. 状态初始化
    windowLevelModule.InitializeWindowLevel(windowCenter, windowWidth);
    
    // 4. 监控系统启动
    coroutineModule.InitializeMemoryMonitoring();
}
```

**初始化依赖关系**:
- TextureUpdater必须先初始化MPRTextureManager组件
- WindowLevel需要设置初始的窗宽窗位值
- Coroutine模块最后启动内存监控计时器

### Start阶段的外部组件绑定
```csharp
private void Start() {
    loaderModule.InitializeDicomLoader();
}
```

InitializeDicomLoader实现:
```csharp
public void InitializeDicomLoader() {
    // 获取或添加DicomLoader组件
    viewer.dicomLoader = viewer.GetComponent<DicomLoader>();
    if (viewer.dicomLoader == null) {
        viewer.dicomLoader = viewer.gameObject.AddComponent<DicomSeriesLoader>();
    }
    
    // 重置事件绑定
    viewer.dicomLoader.OnLoadingComplete.RemoveAllListeners();
    viewer.dicomLoader.OnLoadingComplete.AddListener(OnLoadingComplete);
    viewer.dicomLoader.OnLoadingFailed.RemoveAllListeners();
    viewer.dicomLoader.OnLoadingFailed.AddListener(msg => 
        Debug.LogError($"DICOM加载失败: {msg}"));
}
```

## 跨模块状态同步机制

### 状态变化的传播路径
以切片索引变更为例:
```
SliceControl.SetSliceIndex() 
    ↓
更新内部索引变量 
    ↓
textureManager.SetCurrentIndices() 
    ↓
textureUpdaterModule.UpdateTexture() 
    ↓
InvokeSliceChanged()事件
    ↓
后台预取触发
```

### 具体实现细节
```csharp
public void SetSliceIndex(DicomPlane.PlaneType planeType, int index) {
    // 前置检查省略...
    
    // 1. 更新模块内部状态
    switch (planeType) {
        case DicomPlane.PlaneType.Axial:
            axialIndex = index;
            break;
        case DicomPlane.PlaneType.Sagittal:
            sagittalIndex = index;
            break;
        case DicomPlane.PlaneType.Coronal:
            coronalIndex = index;
            break;
    }
    
    // 2. 同步到纹理管理器
    if (viewer.textureManager != null) {
        viewer.textureManager.SetCurrentIndices(axialIndex, sagittalIndex, coronalIndex);
    }
    
    // 3. 触发UI更新
    viewer.textureUpdaterModule.UpdateTexture(planeType);
    
    // 4. 对外事件通知
    viewer.InvokeSliceChanged(planeType, index, totalSlices);
    
    // 5. 触发其他模块响应
    if (viewer.useBackgroundLoading) {
        viewer.coroutineModule.StartCoroutineTracked(
            LoadAdjacentSlicesCoroutine(planeType, index, 3));
    }
}
```

## 事件驱动的模块通信

### 事件注册与注销模式
```csharp
// OnEnable中注册事件
private void OnEnable() {
    isShuttingDown = false;
    textureUpdaterModule.RegisterEvents();
}

// OnDisable中注销事件
private void OnDisable() {
    textureUpdaterModule.UnregisterEvents();
    coroutineModule.CancelAllOperations();
}
```

TextureUpdater的事件管理:
```csharp
public void RegisterEvents() {
    if (viewer.textureManager != null) {
        viewer.textureManager.OnTextureCreated += HandleTextureCreated;
    }
    
    DicomTextureCreator textureCreator = GetTextureCreator();
    if (textureCreator != null) {
        textureCreator.OnTextureUpdated += HandleTextureUpdated;
        textureCreator.OnWindowLevelChanged += viewer.windowLevelModule.HandleWindowLevelChanged;
    }
}

public void UnregisterEvents() {
    if (viewer.textureManager != null) {
        viewer.textureManager.OnTextureCreated -= HandleTextureCreated;
    }
    // 注意:DicomTextureCreator的事件注销需要在其他地方处理
}
```

### 事件处理的线程安全性
```csharp
private void HandleTextureCreated(DicomPlane.PlaneType planeType, int index) {
    if (viewer.isShuttingDown) return;  // 关闭状态保护
    
    int currentIndex = viewer.sliceControlModule.GetCurrentIndex(planeType);
    if (index == currentIndex) {
        UpdateTexture(planeType);
    }
}
```

## 生命周期协调管理

### Update循环中的协调
```csharp
private void Update() {
    if (isShuttingDown) return;
    
    // 1. 窗宽窗位平滑过渡
    if (useSmoothedWindowLevelChanges && windowLevelModule.IsWindowLevelChanging) {
        windowLevelModule.UpdateWindowLevelTransition();
    }
    
    // 2. 内存监控
    if (enableMemoryMonitoring) {
        coroutineModule.UpdateMemoryMonitoring();
    }
}
```

**设计原则**:
- 每个模块只更新自己负责的状态
- 主类负责协调各模块的执行时机
- 通过标志位控制模块间的交互

### 关闭时的协调顺序
```csharp
private void OnDestroy() {
    isShuttingDown = true;                    // 1. 设置关闭标志
    coroutineModule.CancelAllOperations();    // 2. 取消所有协程
    coroutineModule.ReleaseAllResources();    // 3. 释放资源
}
```

关闭标志的传播效果:
- 阻止新协程启动
- 跳过事件处理
- 避免状态更新冲突

## 错误处理的协调机制

### 分层错误处理
```csharp
// Loader模块的错误处理
private void OnLoadingComplete(object resultData, Vector3Int dimensions, Vector3 spacing, Vector3 origin) {
    if (viewer.isShuttingDown) return;
    
    if (resultData is DicomSeries series) {
        // 正常处理流程
    } else {
        Debug.LogError($"不支持的DICOM数据类型: {resultData.GetType().Name}");
        // 错误状态下的清理工作
        viewer.coroutineModule.CancelAllOperations();
    }
}
```

### 异常传播控制
```csharp
// TextureUpdater中的异常处理
try {
    coroutine = viewer.loadedSeries.CreateAxialTextureCoroutine(...);
} catch (Exception ex) {
    processingError = ex;
    Debug.LogError($"准备创建轴向纹理时出错: {ex.Message}");
    // 不向上传播，本模块内处理
}
```

## 性能优化的协调策略

### 避免递归更新
```csharp
// 防止UI更新时触发无限递归
private bool isUpdatingUI = false;

public void UpdateSliderValues() {
    if (isUpdatingUI) return;
    isUpdatingUI = true;
    try {
        // 更新滑块值
        axialSlider.SetValueWithoutNotify(currentIndex);
    } finally {
        isUpdatingUI = false;
    }
}
```

### 批量状态同步
```csharp
// WindowLevel模块的批量更新
ApplyWindowLevel(float center, float width) {
    // 1. 更新纹理管理器状态
    viewer.textureManager.SetWindowLevel(center, width);
    
    // 2. 批量更新三个平面的当前切片
    DicomTextureCreator textureCreator = GetTextureCreator();
    if (textureCreator != null) {
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Axial, ...);
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Sagittal, ...);
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Coronal, ...);
    }
    
    // 3. 统一触发事件
    viewer.InvokeWindowLevelChanged(center, width);
}
```

## 反射机制的协调应用

### 访问DicomSeries内部组件
```csharp
public DicomTextureCreator GetTextureCreator() {
    if (viewer.loadedSeries != null) {
        Type seriesType = viewer.loadedSeries.GetType();
        FieldInfo field = seriesType.GetField("_textureCreator", 
            BindingFlags.NonPublic | BindingFlags.Instance);
        if (field != null) {
            return field.GetValue(viewer.loadedSeries) as DicomTextureCreator;
        }
    }
    return null;
}
```

**使用场景**:
- DicomSeries的_textureCreator字段为私有
- TextureUpdater需要访问其事件进行绑定
- 通过反射获取而不修改Core模块接口