---
title: 渐进加载算法实现
---
# 渐进加载算法实现

> 深入解析MPRViewer的渐进加载机制与分阶段纹理生成策略

## 渐进加载流程控制

### ProcessSeriesProgressiveCoroutine核心实现
```csharp
public IEnumerator ProcessSeriesProgressiveCoroutine() {
    try {
        // 阶段1:轴向纹理生成（优先级最高）
        yield return CreateAxialTextureAndUpdateUI();
        
        // 阶段2:矢状纹理生成
        yield return CreateSagittalTextureAndUpdateUI();
        
        // 阶段3:冠状纹理生成
        yield return CreateCoronalTextureAndUpdateUI();
        
        // 完成标记
        viewer.isInitialized = true;
        viewer.InvokeDicomLoaded(viewer.loadedSeries.Slices.Count);
        
        // 启动后台预取
        viewer.sliceControlModule.StartBackgroundLoading();
        
    } catch (Exception ex) {
        Debug.LogError($"处理DICOM序列时出错: {ex.Message}");
    }
}
```

**渐进策略优势**:
- **首屏优化**:轴向切片最先显示，用户可立即开始浏览
- **分摊计算**:避免同时生成三个平面纹理的计算峰值
- **渐进反馈**:用户可以看到加载进度，提升体验

## 轴向纹理生成实现

### CreateAxialTextureAndUpdateUI详细实现
```csharp
private IEnumerator CreateAxialTextureAndUpdateUI() {
    bool axialComplete = false;
    Texture2D axialTexture = null;
    Exception processingError = null;
    
    // 1. 准备完成回调
    Action<Texture2D> onAxialComplete = (Texture2D texture) => {
        axialTexture = texture;
        axialComplete = true;
    };
    
    // 2. 安全创建协程
    IEnumerator coroutine = null;
    try {
        coroutine = viewer.loadedSeries.CreateAxialTextureCoroutine(
            viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Axial),
            viewer.windowLevelModule.CurrentWindowCenter,
            viewer.windowLevelModule.CurrentWindowWidth,
            onAxialComplete
        );
    } catch (Exception ex) {
        processingError = ex;
        Debug.LogError($"准备创建轴向纹理时出错: {ex.Message}");
    }
    
    // 3. 执行纹理生成
    if (processingError == null && coroutine != null) {
        yield return coroutine;
        
        // 4. 更新UI组件
        if (axialComplete && axialTexture != null && viewer.axialImage != null) {
            Texture oldTexture = viewer.axialImage.texture;
            viewer.axialImage.texture = axialTexture;
            viewer.axialImage.color = Color.white;
            
            // 5. 延迟销毁旧纹理
            if (oldTexture != null && oldTexture != axialTexture) {
                viewer.StartCoroutine(DelayedTextureDisposal(oldTexture));
            }
            
            // 6. 触发切片变化事件
            viewer.InvokeSliceChanged(
                DicomPlane.PlaneType.Axial,
                viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Axial),
                viewer.loadedSeries.Slices.Count
            );
        }
    }
}
```

**关键实现细节**:
- **异常隔离**:每个阶段都有独立的异常处理
- **回调机制**:使用Action回调确保纹理生成完成通知
- **内存安全**:旧纹理的延迟销毁避免渲染冲突
- **UI同步**:设置color为white确保纹理正确显示

## 矢状/冠状纹理生成实现

### CreateSagittalTextureAndUpdateUI实现
```csharp
private IEnumerator CreateSagittalTextureAndUpdateUI() {
    bool sagittalComplete = false;
    Texture2D sagittalTexture = null;
    Exception processingError = null;
    
    // 回调准备
    Action<Texture2D> onSagittalComplete = (Texture2D texture) => {
        sagittalTexture = texture;
        sagittalComplete = true;
    };
    
    // 协程创建
    IEnumerator coroutine = null;
    try {
        coroutine = viewer.loadedSeries.CreateSagittalTextureCoroutine(
            viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Sagittal),
            viewer.windowLevelModule.CurrentWindowCenter,
            viewer.windowLevelModule.CurrentWindowWidth,
            onSagittalComplete
        );
    } catch (Exception ex) {
        processingError = ex;
        Debug.LogError($"准备创建矢状面纹理时出错: {ex.Message}");
    }
    
    // 执行与UI更新（与轴向类似）
    if (processingError == null && coroutine != null) {
        yield return coroutine;
        
        if (sagittalComplete && sagittalTexture != null && viewer.sagittalImage != null) {
            // UI更新逻辑与轴向相同
            Texture oldTexture = viewer.sagittalImage.texture;
            viewer.sagittalImage.texture = sagittalTexture;
            viewer.sagittalImage.color = Color.white;
            
            if (oldTexture != null && oldTexture != sagittalTexture) {
                viewer.StartCoroutine(DelayedTextureDisposal(oldTexture));
            }
            
            viewer.InvokeSliceChanged(
                DicomPlane.PlaneType.Sagittal,
                viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Sagittal),
                viewer.loadedSeries.GetSagittalDimension()
            );
        }
    }
}
```

### CreateCoronalTextureAndUpdateUI实现
冠状面的实现与矢状面基本相同，主要区别:
```csharp
// 调用不同的协程方法
coroutine = viewer.loadedSeries.CreateCoronalTextureCoroutine(...);

// 使用不同的维度获取方法
viewer.loadedSeries.GetCoronalDimension()

// 绑定到对应的UI组件
viewer.coronalImage.texture = coronalTexture;
```

## 与直接模式的对比

### ProcessSeriesDirect实现
```csharp
public void ProcessSeriesDirect() {
    try {
        // 同时启动三个纹理生成协程
        viewer.coroutineModule.StartCoroutineTracked(CreateAxialTextureAndUpdateUI());
        viewer.coroutineModule.StartCoroutineTracked(CreateSagittalTextureAndUpdateUI());
        viewer.coroutineModule.StartCoroutineTracked(CreateCoronalTextureAndUpdateUI());
        
        // 立即标记为初始化完成
        viewer.isInitialized = true;
        viewer.InvokeDicomLoaded(viewer.loadedSeries.Slices.Count);
        viewer.sliceControlModule.StartBackgroundLoading();
        
    } catch (Exception ex) {
        Debug.LogError($"直接处理DICOM序列时出错: {ex.Message}");
    }
}
```

**模式选择对比**:

| 特性 | 渐进模式 | 直接模式 |
|------|----------|----------|
| 首屏时间 | 快（只需轴向完成） | 慢（需等待三个平面） |
| 内存峰值 | 低（分阶段生成） | 高（同时生成） |
| 用户体验 | 渐进反馈 | 一次性完成 |
| 适用场景 | 移动设备、大数据集 | 高性能设备、小数据集 |

## 错误恢复机制

### 单阶段失败的处理
```csharp
// 如果轴向纹理创建失败
if (processingError != null) {
    Debug.LogError($"轴向纹理创建失败: {processingError.Message}");
    
    // 策略1:使用默认纹理
    viewer.axialImage.texture = GetDefaultTexture();
    
    // 策略2:跳过该平面，继续其他平面
    // 不影响矢状/冠状面的生成
}
```

### 完整失败的回退策略
```csharp
// 在ProcessSeriesProgressiveCoroutine的catch块中
catch (Exception ex) {
    Debug.LogError($"渐进加载完全失败: {ex.Message}");
    
    // 回退到直接模式尝试
    try {
        ProcessSeriesDirect();
    } catch (Exception directEx) {
        Debug.LogError($"直接模式也失败: {directEx.Message}");
        // 最终错误处理
        viewer.coroutineModule.CancelAllOperations();
    }
}
```

## 性能优化策略

### 内存压力感知
```csharp
// 在每个阶段之间检查内存压力
yield return CreateAxialTextureAndUpdateUI();

if (viewer.coroutineModule.IsMemoryPressureHigh()) {
    // 等待内存压力缓解
    yield return new WaitForSeconds(1.0f);
    
    // 触发垃圾回收
    Resources.UnloadUnusedAssets();
    GC.Collect();
    
    yield return new WaitForSeconds(0.5f);
}

yield return CreateSagittalTextureAndUpdateUI();
```

### 分帧处理
```csharp
// 在纹理生成协程中插入让出执行权
yield return coroutine;  // DicomSeries的纹理生成协程

// 让出一帧，确保UI响应
yield return null;

// 继续UI更新
if (axialComplete && axialTexture != null) {
    // UI更新逻辑
}
```

### 优先级调度
```csharp
// 根据平面类型设置不同的处理优先级
public enum PlaneLoadingPriority {
    Axial = 0,      // 最高优先级
    Sagittal = 1,   // 中等优先级  
    Coronal = 2     // 最低优先级
}
```

## 用户交互响应

### 加载期间的交互处理
```csharp
// 在渐进加载过程中允许的操作
public void SetSliceIndex(DicomPlane.PlaneType planeType, int index) {
    // 即使在加载过程中也允许切片索引变更
    if (viewer.loadedSeries != null) {
        sliceControlModule.SetSliceIndex(planeType, index);
        
        // 如果对应平面已经加载完成，立即更新纹理
        if (IsPlaneLoaded(planeType)) {
            viewer.textureUpdaterModule.UpdateTexture(planeType);
        }
    }
}

private bool IsPlaneLoaded(DicomPlane.PlaneType planeType) {
    switch (planeType) {
        case DicomPlane.PlaneType.Axial:
            return viewer.axialImage?.texture != null;
        case DicomPlane.PlaneType.Sagittal:
            return viewer.sagittalImage?.texture != null;
        case DicomPlane.PlaneType.Coronal:
            return viewer.coronalImage?.texture != null;
        default:
            return false;
    }
}
```

### 加载进度反馈
```csharp
// 可以添加进度通知事件
public event Action<string, float> OnLoadingProgress;

// 在各个阶段调用
private void ReportProgress(string stage, float progress) {
    OnLoadingProgress?.Invoke(stage, progress);
}

// 在渐进加载中的使用
yield return CreateAxialTextureAndUpdateUI();
ReportProgress("轴向纹理", 0.33f);

yield return CreateSagittalTextureAndUpdateUI();
ReportProgress("矢状纹理", 0.66f);

yield return CreateCoronalTextureAndUpdateUI();
ReportProgress("加载完成", 1.0f);
```