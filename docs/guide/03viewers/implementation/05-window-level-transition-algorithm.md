---
title: 窗宽窗位过渡算法实现
---
# 窗宽窗位过渡算法实现

> 深入解析WindowLevel模块的平滑过渡算法与实时纹理更新机制

## 双模式控制机制

### SetWindowLevel统一入口实现
```csharp
public void SetWindowLevel(float center, float width) {
    // 1. 前置条件检查
    if (!viewer.isInitialized || viewer.loadedSeries == null || viewer.isShuttingDown) 
        return;
    
    // 2. 避免无效更新（浮点数精度比较）
    if (Mathf.Approximately(targetCenter, center) && 
        Mathf.Approximately(targetWidth, width)) 
        return;
    
    // 3. 设置目标值
    targetCenter = center;
    targetWidth = width;
    
    // 4. 模式选择
    if (viewer.useSmoothedWindowLevelChanges) {
        // 平滑模式:启动过渡状态
        isChanging = true;
        // 过渡处理由主类Update循环驱动
    } else {
        // 立即模式:直接应用
        ApplyWindowLevel(center, width);
    }
}
```

**设计要点**:
- **状态保护**:多重前置检查确保操作安全性
- **精度处理**:使用Mathf.Approximately避免浮点精度问题
- **模式切换**:通过配置标志控制过渡行为

## 平滑过渡算法实现

### UpdateWindowLevelTransition核心算法
```csharp
public void UpdateWindowLevelTransition() {
    if (!isChanging) return;
    
    // 1. 时间增量计算
    float deltaTime = Time.deltaTime;
    
    // 2. 分别插值窗位和窗宽
    currentCenter = Mathf.Lerp(currentCenter, targetCenter, 
                              deltaTime * viewer.windowCenterChangeSpeed);
    currentWidth = Mathf.Lerp(currentWidth, targetWidth, 
                             deltaTime * viewer.windowWidthChangeSpeed);
    
    // 3. 应用当前插值结果
    ApplyWindowLevel(currentCenter, currentWidth);
    
    // 4. 检查过渡完成条件
    bool centerComplete = Mathf.Approximately(currentCenter, targetCenter);
    bool widthComplete = Mathf.Approximately(currentWidth, targetWidth);
    
    if (centerComplete && widthComplete) {
        // 5. 精确对齐并结束过渡
        isChanging = false;
        ApplyWindowLevel(targetCenter, targetWidth);
    }
}
```

**算法特性分析**:
- **独立插值**:窗位和窗宽使用不同的插值速度
- **帧率无关**:基于deltaTime的插值确保不同帧率下一致的过渡效果
- **精确收敛**:过渡结束时强制对齐目标值，避免"永远接近"问题

### 插值速度参数设计
```csharp
[SerializeField] private float windowCenterChangeSpeed = 0.25f;
[SerializeField] private float windowWidthChangeSpeed = 0.5f;
```

**参数调优指南**:
- **窗位速度(0.25f)**:较慢，因为用户对窗位变化更敏感
- **窗宽速度(0.5f)**:较快，窗宽变化对视觉影响相对较小
- **取值范围**:0.1f-2.0f，值越大过渡越快

### 自适应速度调整
```csharp
private float GetAdaptiveChangeSpeed(float baseSpeed, float currentValue, float targetValue) {
    float difference = Mathf.Abs(targetValue - currentValue);
    
    // 差异大时加速，差异小时减速
    if (difference > 1000f) {
        return baseSpeed * 2.0f;  // 大差异时加速
    } else if (difference < 100f) {
        return baseSpeed * 0.5f;  // 小差异时减速，更精细
    }
    
    return baseSpeed;
}

// 在UpdateWindowLevelTransition中使用
float adaptiveCenterSpeed = GetAdaptiveChangeSpeed(viewer.windowCenterChangeSpeed, 
                                                  currentCenter, targetCenter);
float adaptiveWidthSpeed = GetAdaptiveChangeSpeed(viewer.windowWidthChangeSpeed, 
                                                 currentWidth, targetWidth);

currentCenter = Mathf.Lerp(currentCenter, targetCenter, 
                          deltaTime * adaptiveCenterSpeed);
currentWidth = Mathf.Lerp(currentWidth, targetWidth, 
                         deltaTime * adaptiveWidthSpeed);
```

## 实时纹理更新机制

### ApplyWindowLevel详细实现
```csharp
private void ApplyWindowLevel(float center, float width) {
    // 1. 更新内部状态
    currentCenter = center;
    currentWidth = width;
    targetCenter = center;
    targetWidth = width;
    
    // 2. 同步纹理管理器状态
    if (viewer.textureManager != null) {
        viewer.textureManager.SetWindowLevel(center, width);
    }
    
    // 3. 批量更新当前显示的三个切片
    DicomTextureCreator textureCreator = viewer.textureUpdaterModule.GetTextureCreator();
    if (textureCreator != null) {
        // 获取当前索引
        int axialIndex = viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Axial);
        int sagittalIndex = viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Sagittal);
        int coronalIndex = viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Coronal);
        
        // 更新三个平面的当前切片纹理
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Axial, 
                                           axialIndex, center, width);
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Sagittal, 
                                           sagittalIndex, center, width);
        textureCreator.UpdateTextureForSlice(DicomPlane.PlaneType.Coronal, 
                                           coronalIndex, center, width);
    }
    
    // 4. 触发外部事件通知
    viewer.InvokeWindowLevelChanged(center, width);
}
```

**批量更新优势**:
- **性能优化**:一次调用更新三个平面，避免分散更新
- **状态一致**:确保三个平面使用相同的窗宽窗位值
- **事件统一**:单次事件通知而非三次分别通知

## 外部事件同步处理

### HandleWindowLevelChanged实现
```csharp
public void HandleWindowLevelChanged(float newCenter, float newWidth) {
    // 同步外部变化到内部状态
    currentCenter = newCenter;
    currentWidth = newWidth;
    targetCenter = newCenter;
    targetWidth = newWidth;
    
    // 停止当前的过渡动画
    isChanging = false;
    
    // 可选:记录外部变化来源
    if (viewer.enableDebugLog) {
        Debug.Log($"外部窗宽窗位变化: Center={newCenter}, Width={newWidth}");
    }
}
```

**事件同步的必要性**:
- DicomTextureCreator可能因其他原因改变窗宽窗位
- 确保UI显示与实际渲染状态一致
- 避免内部状态与外部状态不同步

## 性能优化策略

### 更新频率控制
```csharp
private float lastUpdateTime = 0f;
private const float MIN_UPDATE_INTERVAL = 0.016f;  // 约60FPS

public void UpdateWindowLevelTransition() {
    if (!isChanging) return;
    
    float currentTime = Time.realtimeSinceStartup;
    if (currentTime - lastUpdateTime < MIN_UPDATE_INTERVAL) {
        return;  // 限制更新频率
    }
    lastUpdateTime = currentTime;
    
    // 执行插值和更新逻辑...
}
```

### 变化阈值优化
```csharp
private const float CHANGE_THRESHOLD = 0.1f;

public void UpdateWindowLevelTransition() {
    if (!isChanging) return;
    
    float oldCenter = currentCenter;
    float oldWidth = currentWidth;
    
    // 执行插值
    currentCenter = Mathf.Lerp(currentCenter, targetCenter, deltaTime * speed);
    currentWidth = Mathf.Lerp(currentWidth, targetWidth, deltaTime * speed);
    
    // 检查变化是否显著
    bool significantChange = Mathf.Abs(currentCenter - oldCenter) > CHANGE_THRESHOLD ||
                           Mathf.Abs(currentWidth - oldWidth) > CHANGE_THRESHOLD;
    
    if (significantChange) {
        ApplyWindowLevel(currentCenter, currentWidth);
    }
}
```

## 边界处理与验证

### 数值范围限制
```csharp
public void SetWindowLevel(float center, float width) {
    // 输入验证和边界限制
    center = Mathf.Clamp(center, -2000f, 4000f);  // CT典型范围
    width = Mathf.Clamp(width, 1f, 4000f);        // 避免除零错误
    
    // 继续执行设置逻辑...
}
```

### 窗宽窗位合理性检查
```csharp
private bool IsWindowLevelValid(float center, float width) {
    // 基本范围检查
    if (width <= 0) return false;
    if (float.IsNaN(center) || float.IsNaN(width)) return false;
    if (float.IsInfinity(center) || float.IsInfinity(width)) return false;
    
    // 医学影像合理性检查
    if (width > 10000f) return false;  // 过大的窗宽通常不合理
    if (Mathf.Abs(center) > 5000f) return false;  // 过大的窗位通常不合理
    
    return true;
}
```

## 用户交互优化

### 交互模式检测
```csharp
private enum InteractionMode {
    Idle,           // 空闲状态
    SliderDragging, // 滑块拖动中
    ButtonClick,    // 按钮点击
    Gesture        // 手势操作
}

private InteractionMode currentInteractionMode = InteractionMode.Idle;

public void SetWindowLevel(float center, float width, InteractionMode mode = InteractionMode.Idle) {
    currentInteractionMode = mode;
    
    // 根据交互模式调整过渡行为
    switch (mode) {
        case InteractionMode.SliderDragging:
            // 拖动时使用平滑过渡
            viewer.useSmoothedWindowLevelChanges = true;
            break;
            
        case InteractionMode.ButtonClick:
            // 按钮点击时立即应用
            viewer.useSmoothedWindowLevelChanges = false;
            break;
            
        case InteractionMode.Gesture:
            // 手势操作时使用快速过渡
            windowCenterChangeSpeed *= 2.0f;
            windowWidthChangeSpeed *= 2.0f;
            break;
    }
    
    // 执行设置逻辑...
}
```

### 预设值快速应用
```csharp
public void ApplyWindowLevelPreset(WindowLevelPreset preset) {
    // 预设值直接应用，无需过渡
    bool oldSmoothMode = viewer.useSmoothedWindowLevelChanges;
    viewer.useSmoothedWindowLevelChanges = false;
    
    SetWindowLevel(preset.Center, preset.Width);
    
    // 恢复原有模式
    viewer.useSmoothedWindowLevelChanges = oldSmoothMode;
    
    // 记录预设应用
    Debug.Log($"应用窗宽窗位预设: {preset.Name} (C:{preset.Center}, W:{preset.Width})");
}

[System.Serializable]
public class WindowLevelPreset {
    public string Name;
    public float Center;
    public float Width;
    
    // 常用预设
    public static readonly WindowLevelPreset BoneWindow = 
        new WindowLevelPreset { Name = "骨窗", Center = 400, Width = 1000 };
    public static readonly WindowLevelPreset SoftTissueWindow = 
        new WindowLevelPreset { Name = "软组织窗", Center = 40, Width = 400 };
}
```

## 协程安全与状态保护

### 过渡状态的协程安全
```csharp
public void UpdateWindowLevelTransition() {
    // 检查组件状态
    if (viewer.isShuttingDown || !viewer.isInitialized) {
        isChanging = false;
        return;
    }
    
    if (!isChanging) return;
    
    // 执行过渡逻辑...
}
```

### 并发设置保护
```csharp
private bool isApplyingWindowLevel = false;

private void ApplyWindowLevel(float center, float width) {
    if (isApplyingWindowLevel) return;  // 防止递归调用
    
    isApplyingWindowLevel = true;
    try {
        // 执行应用逻辑...
    } finally {
        isApplyingWindowLevel = false;
    }
}
```