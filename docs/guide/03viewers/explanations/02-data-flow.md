---
title: 数据与控制流程详解
---
# 数据与控制流程详解

> 从DICOM加载到三平面显示的完整数据流分析

## 加载流程时序

### 1. 初始化准备阶段
```
Awake → 子模块实例化 → Start → DicomLoader绑定
```

### 2. 加载触发阶段
```csharp
LoadDicomData() → Loader.StartLoading() → DicomLoader.StartLoading()
```

关键步骤:
- 取消历史协程:`coroutineModule.CancelAllOperations()`
- 释放旧资源:`coroutineModule.ReleaseAllResources()`
- 重置初始化状态:`isInitialized = false`

### 3. 数据处理阶段

#### 加载完成回调处理
```csharp
OnLoadingComplete(resultData, dimensions, spacing, origin) {
    // 1. 类型验证
    if (resultData is DicomSeries series) {
        loadedSeries = series;
        
        // 2. 重置索引到中位值
        sliceControlModule.ResetSliceIndices();
        
        // 3. 配置纹理管理器
        textureManager.SetDicomSeries(series);
        textureManager.SetWindowLevel(...);
        textureManager.SetCurrentIndices(...);
        
        // 4. 选择处理模式
        if (useProgressiveLoading) {
            // 渐进模式:先轴向，后矢状/冠状
            StartCoroutineTracked(ProcessSeriesProgressiveCoroutine());
        } else {
            // 直接模式:同时处理三个平面
            ProcessSeriesDirect();
        }
    }
}
```

## 纹理生成与更新流程

### 渐进加载实现
```csharp
ProcessSeriesProgressiveCoroutine() {
    // 阶段1:创建轴向纹理并更新UI
    yield return CreateAxialTextureAndUpdateUI();
    
    // 阶段2:创建矢状纹理并更新UI  
    yield return CreateSagittalTextureAndUpdateUI();
    
    // 阶段3:创建冠状纹理并更新UI
    yield return CreateCoronalTextureAndUpdateUI();
    
    // 完成:标记初始化完成，启动后台加载
    isInitialized = true;
    InvokeDicomLoaded(loadedSeries.Slices.Count);
    sliceControlModule.StartBackgroundLoading();
}
```

### 纹理更新机制
每个平面的纹理创建遵循统一模式:
1. 准备回调和错误处理
2. 调用DicomSeries的协程方法
3. 等待纹理生成完成
4. 更新RawImage并释放旧纹理
5. 触发切片变化事件

## 交互响应流程

### 切片索引变更
```
用户操作 → SetSliceIndex → 边界检查 → 状态更新 → 纹理刷新 → 事件通知 → 后台预取
```

详细实现:
```csharp
SetSliceIndex(planeType, index) {
    // 1. 前置检查
    if (!isInitialized || loadedSeries == null || isShuttingDown) return;
    
    // 2. 边界处理
    index = Mathf.Clamp(index, 0, totalSlices - 1);
    
    // 3. 状态同步
    switch (planeType) {
        case Axial: axialIndex = index; break;
        // ...
    }
    textureManager.SetCurrentIndices(axialIndex, sagittalIndex, coronalIndex);
    
    // 4. UI更新
    textureUpdaterModule.UpdateTexture(planeType);
    
    // 5. 事件通知
    InvokeSliceChanged(planeType, index, totalSlices);
    
    // 6. 预取优化
    if (useBackgroundLoading) {
        StartCoroutineTracked(LoadAdjacentSlicesCoroutine(planeType, index, 3));
    }
}
```

### 窗宽窗位调整
```
SetWindowLevel → 模式判断 → 平滑/立即更新 → 纹理重新生成 → UI刷新
```

#### 平滑模式实现
```csharp
SmoothWindowLevelTransition() {
    // 逐帧插值到目标值
    currentCenter = Mathf.Lerp(currentCenter, targetCenter, Time.deltaTime * changeSpeed);
    currentWidth = Mathf.Lerp(currentWidth, targetWidth, Time.deltaTime * changeSpeed);
    
    // 应用新值
    ApplyWindowLevel(currentCenter, currentWidth);
    
    // 检查完成条件
    if (IsTransitionComplete()) {
        isChanging = false;
        ApplyWindowLevel(targetCenter, targetWidth); // 精确对齐
    }
}
```

## 后台加载策略

### 相邻切片预取
基于当前索引，向两侧扩展预取范围:
```csharp
LoadAdjacentSlicesCoroutine(planeType, centerIndex, range) {
    for (int offset = 1; offset <= range; offset++) {
        int index1 = centerIndex - offset;  // 向前预取
        int index2 = centerIndex + offset;  // 向后预取
        
        // 边界检查后请求纹理
        if (index1 >= 0) textureManager.GetTexture(planeType, index1);
        if (index2 < totalSlices) textureManager.GetTexture(planeType, index2);
        
        yield return null; // 逐帧让出执行权
    }
}
```

### 批量后台加载
系统性地对三个平面进行批量预取:
- 轴向优先:先加载轴向切片（主要浏览方向）
- 分批处理:每批3张，批间插入等待
- 内存感知:检测到内存压力时增加等待时间

## 错误处理与容错

### 协程异常处理
所有纹理生成都包含异常捕获:
```csharp
try {
    coroutine = loadedSeries.CreateAxialTextureCoroutine(...);
} catch (Exception ex) {
    processingError = ex;
    Debug.LogError($"准备创建轴向纹理时出错: {ex.Message}");
}
```

### 状态一致性保护
- isShuttingDown标志防止关闭时的资源竞争
- isInitialized标志确保操作在正确时机执行
- 多重边界检查防止索引越界