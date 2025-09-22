---
title: 窗宽窗位管理机制
---
# 窗宽窗位管理机制

> 窗宽(WindowWidth)与窗位(WindowCenter)的双模式管理与平滑过渡实现

## 双状态管理设计

### 当前值与目标值分离
WindowLevel模块维护四个核心状态值:
```csharp
private float currentCenter;    // 当前窗位值
private float currentWidth;     // 当前窗宽值  
private float targetCenter;     // 目标窗位值
private float targetWidth;      // 目标窗宽值
```

这种设计支持:
- **立即模式**:current直接等于target
- **平滑模式**:current逐渐向target插值

### 过渡状态管理
```csharp
private bool isChanging = false;           // 是否正在过渡
private Coroutine transitionCoroutine;     // 过渡协程引用
```

## 两种更新模式

### 平滑模式实现
```csharp
SetWindowLevel(float center, float width) {
    // 1. 前置检查
    if (!viewer.isInitialized || viewer.loadedSeries == null || viewer.isShuttingDown) 
        return;
    
    // 2. 避免无效更新
    if (Mathf.Approximately(targetCenter, center) && 
        Mathf.Approximately(targetWidth, width)) 
        return;
    
    // 3. 设置目标值
    targetCenter = center;
    targetWidth = width;
    
    // 4. 启动平滑过渡
    if (viewer.useSmoothedWindowLevelChanges) {
        isChanging = true;
        // 平滑过渡由主类的Update循环驱动
    } else {
        // 立即模式
        ApplyWindowLevel(center, width);
    }
}
```

### 平滑过渡算法
在主类的Update中每帧调用:
```csharp
UpdateWindowLevelTransition() {
    if (!isChanging) return;
    
    // 插值计算
    float deltaTime = Time.deltaTime;
    currentCenter = Mathf.Lerp(currentCenter, targetCenter, 
                              deltaTime * viewer.windowCenterChangeSpeed);
    currentWidth = Mathf.Lerp(currentWidth, targetWidth, 
                             deltaTime * viewer.windowWidthChangeSpeed);
    
    // 应用当前值
    ApplyWindowLevel(currentCenter, currentWidth);
    
    // 检查过渡完成
    bool centerComplete = Mathf.Approximately(currentCenter, targetCenter);
    bool widthComplete = Mathf.Approximately(currentWidth, targetWidth);
    
    if (centerComplete && widthComplete) {
        // 精确对齐并结束过渡
        isChanging = false;
        ApplyWindowLevel(targetCenter, targetWidth);
    }
}
```

### 立即模式实现
```csharp
ApplyWindowLevel(float center, float width) {
    currentCenter = center;
    currentWidth = width;
    targetCenter = center;
    targetWidth = width;
    
    // 1. 更新纹理管理器
    if (viewer.textureManager != null) {
        viewer.textureManager.SetWindowLevel(center, width);
    }
    
    // 2. 通知纹理创建器重新生成当前索引的纹理
    DicomTextureCreator textureCreator = viewer.textureUpdaterModule.GetTextureCreator();
    if (textureCreator != null) {
        // 更新当前显示的三个切片
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Axial, 
            viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Axial), center, width);
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Sagittal, 
            viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Sagittal), center, width);
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Coronal, 
            viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Coronal), center, width);
    }
    
    // 3. 触发外部事件
    viewer.InvokeWindowLevelChanged(center, width);
}
```

## 参数配置与调优

### 速度参数设计
```csharp
[SerializeField] private float windowCenterChangeSpeed = 0.25f;
[SerializeField] private float windowWidthChangeSpeed = 0.5f;
```

**调优建议**:
- **窗位速度**:通常比窗宽慢，因为用户对窗位变化更敏感
- **设备适配**:低性能设备可提高速度减少过渡时间
- **交互场景**:滑块拖动时用慢速度，按钮点击用快速度

### 平滑模式开关
```csharp
[SerializeField] private bool useSmoothedWindowLevelChanges = true;
```

**使用场景**:
- **开启**:用户拖动滑块时，提供平滑的视觉体验
- **关闭**:程序设置预设值时，需要立即响应

## 事件处理机制

### 外部事件处理
WindowLevel模块可响应来自DicomTextureCreator的窗宽窗位变化通知:
```csharp
HandleWindowLevelChanged(float newCenter, float newWidth) {
    // 同步外部变化到内部状态
    currentCenter = newCenter;
    currentWidth = newWidth;
    targetCenter = newCenter;
    targetWidth = newWidth;
    isChanging = false;
}
```

### 事件触发时机
ApplyWindowLevel执行时触发OnWindowLevelChanged事件，通知:
- UI组件更新滑块位置
- 其他监听器同步状态
- 日志记录和调试信息

## 边界处理与验证

### 数值范围验证
虽然代码中没有明确的范围限制，但建议在实际应用中添加:
```csharp
// 建议的边界检查
center = Mathf.Clamp(center, -2000f, 4000f);  // CT典型范围
width = Mathf.Clamp(width, 1f, 4000f);        // 避免除零错误
```

### 状态一致性保护
- **初始化检查**:未初始化时忽略设置操作
- **关闭状态检查**:关闭过程中停止所有窗宽窗位操作
- **数据有效性**:loadedSeries为空时不执行更新

## 性能优化策略

### 避免频繁更新
```csharp
if (Mathf.Approximately(targetCenter, center) && 
    Mathf.Approximately(targetWidth, width)) 
    return;
```

通过浮点数近似比较避免无意义的微小变化更新。

### 批量纹理更新
ApplyWindowLevel一次调用更新三个平面的当前切片，避免分散的多次纹理重新生成。

### 过渡完成优化
过渡结束时执行精确对齐，避免因浮点精度问题导致的"永远接近但不相等"情况。