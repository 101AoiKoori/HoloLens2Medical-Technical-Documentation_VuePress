---
title: 纹理协调机制实现
---
# 纹理协调机制实现

> 深入解析TextureUpdater模块的纹理生成协调、事件处理与UI同步机制

## 纹理管理器初始化

### InitializeTextureManager实现
```csharp
public void InitializeTextureManager() {
    // 1. 获取或添加MPRTextureManager组件
    viewer.textureManager = viewer.GetComponent<MPRTextureManager>();
    if (viewer.textureManager == null) {
        viewer.textureManager = viewer.gameObject.AddComponent<MPRTextureManager>();
    }
    
    // 2. 配置纹理管理器参数
    if (viewer.textureManager != null) {
        viewer.textureManager.SetDebugMode(viewer.enableDebugLog);
        viewer.textureManager.SetMemoryManagement(viewer.enableMemoryMonitoring);
    }
}
```

**组件依赖管理**:
- 确保MPRTextureManager组件存在
- 支持运行时动态添加组件
- 传递配置参数给纹理管理器

## 事件注册与注销机制

### RegisterEvents详细实现
```csharp
public void RegisterEvents() {
    // 1. 注册纹理管理器事件
    if (viewer.textureManager != null) {
        viewer.textureManager.OnTextureCreated += HandleTextureCreated;
        viewer.textureManager.OnTextureLoadFailed += HandleTextureLoadFailed;
        viewer.textureManager.OnCacheUpdated += HandleCacheUpdated;
    }
    
    // 2. 获取并注册DicomTextureCreator事件
    DicomTextureCreator textureCreator = GetTextureCreator();
    if (textureCreator != null) {
        textureCreator.OnTextureUpdated += HandleTextureUpdated;
        textureCreator.OnWindowLevelChanged += viewer.windowLevelModule.HandleWindowLevelChanged;
        textureCreator.OnTextureGenerationProgress += HandleTextureProgress;
    }
}

public void UnregisterEvents() {
    // 1. 注销纹理管理器事件
    if (viewer.textureManager != null) {
        viewer.textureManager.OnTextureCreated -= HandleTextureCreated;
        viewer.textureManager.OnTextureLoadFailed -= HandleTextureLoadFailed;
        viewer.textureManager.OnCacheUpdated -= HandleCacheUpdated;
    }
    
    // 2. 注销DicomTextureCreator事件
    DicomTextureCreator textureCreator = GetTextureCreator();
    if (textureCreator != null) {
        textureCreator.OnTextureUpdated -= HandleTextureUpdated;
        textureCreator.OnWindowLevelChanged -= viewer.windowLevelModule.HandleWindowLevelChanged;
        textureCreator.OnTextureGenerationProgress -= HandleTextureProgress;
    }
}
```

**事件安全性考虑**:
- 空引用检查防止异常
- 对称注册/注销避免内存泄露
- 多重事件绑定支持不同数据源

## 纹理生成事件处理

### HandleTextureCreated核心逻辑
```csharp
private void HandleTextureCreated(DicomPlane.PlaneType planeType, int index) {
    if (viewer.isShuttingDown) return;
    
    // 1. 检查是否为当前显示的切片
    int currentIndex = viewer.sliceControlModule.GetCurrentIndex(planeType);
    if (index == currentIndex) {
        // 2. 立即更新对应的UI组件
        UpdateTexture(planeType);
        
        // 3. 记录纹理生成完成
        if (viewer.enableDebugLog) {
            Debug.Log($"{planeType}平面切片{index}纹理生成完成");
        }
    }
    
    // 4. 更新预取统计
    UpdatePreloadStatistics(planeType, index, true);
}

private void HandleTextureLoadFailed(DicomPlane.PlaneType planeType, int index, string error) {
    Debug.LogError($"{planeType}平面切片{index}纹理加载失败: {error}");
    
    // 错误恢复策略
    if (index == viewer.sliceControlModule.GetCurrentIndex(planeType)) {
        // 当前切片加载失败，尝试重新生成
        StartCoroutine(RetryTextureGeneration(planeType, index));
    }
    
    UpdatePreloadStatistics(planeType, index, false);
}
```

### HandleTextureUpdated实现
```csharp
private void HandleTextureUpdated(DicomPlane.PlaneType planeType, int index, Texture2D texture) {
    if (!viewer.isInitialized || viewer.isShuttingDown) return;
    
    // 1. 检查是否为当前切片
    bool isCurrentSlice = false;
    switch (planeType) {
        case DicomPlane.PlaneType.Axial:
            isCurrentSlice = (index == viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Axial));
            break;
        case DicomPlane.PlaneType.Sagittal:
            isCurrentSlice = (index == viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Sagittal));
            break;
        case DicomPlane.PlaneType.Coronal:
            isCurrentSlice = (index == viewer.sliceControlModule.GetCurrentIndex(DicomPlane.PlaneType.Coronal));
            break;
    }
    
    // 2. 如果是当前切片，立即更新UI
    if (isCurrentSlice) {
        UpdateTextureToUI(planeType, texture);
    }
    
    // 3. 缓存纹理以备后用
    CacheTextureForLaterUse(planeType, index, texture);
}
```

## UI纹理更新机制

### UpdateTexture统一接口
```csharp
public void UpdateTexture(DicomPlane.PlaneType planeType) {
    if (!viewer.isInitialized || viewer.isShuttingDown) return;
    
    // 1. 获取当前索引
    int currentIndex = viewer.sliceControlModule.GetCurrentIndex(planeType);
    
    // 2. 从纹理管理器获取纹理
    if (viewer.textureManager != null) {
        Texture2D texture = viewer.textureManager.GetTexture(planeType, currentIndex);
        
        if (texture != null) {
            // 3. 立即更新UI
            UpdateTextureToUI(planeType, texture);
        } else {
            // 4. 纹理不存在，请求异步生成
            RequestTextureGeneration(planeType, currentIndex);
        }
    }
}

private void UpdateTextureToUI(DicomPlane.PlaneType planeType, Texture2D texture) {
    RawImage targetImage = GetTargetRawImage(planeType);
    if (targetImage != null) {
        // 保存旧纹理引用
        Texture oldTexture = targetImage.texture;
        
        // 设置新纹理
        targetImage.texture = texture;
        targetImage.color = Color.white;
        
        // 延迟销毁旧纹理
        if (oldTexture != null && oldTexture != texture) {
            viewer.StartCoroutine(DelayedTextureDisposal(oldTexture));
        }
    }
}
```

### GetTargetRawImage辅助方法
```csharp
private RawImage GetTargetRawImage(DicomPlane.PlaneType planeType) {
    switch (planeType) {
        case DicomPlane.PlaneType.Axial:
            return viewer.axialImage;
        case DicomPlane.PlaneType.Sagittal:
            return viewer.sagittalImage;
        case DicomPlane.PlaneType.Coronal:
            return viewer.coronalImage;
        default:
            return null;
    }
}
```

## 反射访问DicomTextureCreator

### GetTextureCreator实现详解
```csharp
public DicomTextureCreator GetTextureCreator() {
    if (viewer.loadedSeries != null) {
        // 1. 获取DicomSeries的类型信息
        Type seriesType = viewer.loadedSeries.GetType();
        
        // 2. 查找私有字段_textureCreator
        FieldInfo field = seriesType.GetField("_textureCreator", 
            BindingFlags.NonPublic | BindingFlags.Instance);
        
        if (field != null) {
            // 3. 获取字段值并转换类型
            return field.GetValue(viewer.loadedSeries) as DicomTextureCreator;
        }
        
        // 4. 如果找不到私有字段，尝试属性访问
        PropertyInfo property = seriesType.GetProperty("TextureCreator", 
            BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
        
        if (property != null) {
            return property.GetValue(viewer.loadedSeries) as DicomTextureCreator;
        }
    }
    
    return null;
}
```

**反射使用的原因**:
- DicomSeries的_textureCreator字段为私有
- 避免修改Core模块的公共接口
- 保持模块间的松耦合设计

## 纹理引用安全检查

### IsTextureUsedElsewhere实现
```csharp
public bool IsTextureUsedElsewhere(Texture texture) {
    if (texture == null) return false;
    
    // 1. 检查三个主要RawImage组件
    if (viewer.axialImage != null && viewer.axialImage.texture == texture) 
        return true;
    if (viewer.sagittalImage != null && viewer.sagittalImage.texture == texture) 
        return true;
    if (viewer.coronalImage != null && viewer.coronalImage.texture == texture) 
        return true;
    
    // 2. 检查纹理管理器缓存
    if (viewer.textureManager != null && viewer.textureManager.IsTextureCached(texture))
        return true;
    
    // 3. 扩展检查:3D可视化组件
    var visualization3D = viewer.GetComponent<DicomSlice3DManager>();
    if (visualization3D != null && visualization3D.IsTextureInUse(texture))
        return true;
    
    // 4. 检查材质球引用
    if (IsTextureInMaterials(texture))
        return true;
    
    return false;
}

private bool IsTextureInMaterials(Texture texture) {
    // 检查场景中所有材质是否使用了该纹理
    var renderers = FindObjectsOfType<Renderer>();
    foreach (var renderer in renderers) {
        if (renderer.material != null && renderer.material.mainTexture == texture) {
            return true;
        }
    }
    return false;
}
```

## 延迟销毁机制

### DelayedTextureDisposal协程实现
```csharp
private IEnumerator DelayedTextureDisposal(Texture oldTexture) {
    // 1. 等待当前帧结束，确保GPU渲染完成
    yield return new WaitForEndOfFrame();
    
    // 2. 再次检查纹理引用状态
    if (oldTexture != null && !IsTextureUsedElsewhere(oldTexture)) {
        // 3. 记录销毁信息（调试用）
        if (viewer.enableDebugLog) {
            Debug.Log($"销毁纹理: {oldTexture.name} ({oldTexture.width}x{oldTexture.height})");
        }
        
        // 4. 安全销毁纹理
        UnityEngine.Object.Destroy(oldTexture);
        
        // 5. 更新内存统计
        UpdateMemoryStatistics(-GetTextureMemorySize(oldTexture));
    }
}

private long GetTextureMemorySize(Texture texture) {
    if (texture == null) return 0;
    
    // 估算纹理内存占用 (width * height * bytesPerPixel)
    return texture.width * texture.height * 4;  // 假设RGBA32格式
}
```

## 纹理生成协调

### RequestTextureGeneration实现
```csharp
private void RequestTextureGeneration(DicomPlane.PlaneType planeType, int index) {
    if (viewer.textureManager != null) {
        // 1. 设置高优先级请求（当前显示切片）
        viewer.textureManager.RequestTexture(planeType, index, 
            priority: TextureRequestPriority.High);
        
        // 2. 显示加载指示器
        ShowLoadingIndicator(planeType, true);
        
        // 3. 记录请求时间用于性能分析
        RecordTextureRequest(planeType, index, Time.realtimeSinceStartup);
    }
}

private void ShowLoadingIndicator(DicomPlane.PlaneType planeType, bool show) {
    RawImage targetImage = GetTargetRawImage(planeType);
    if (targetImage != null) {
        if (show) {
            // 显示加载占位图
            targetImage.texture = GetLoadingTexture();
            targetImage.color = new Color(1f, 1f, 1f, 0.5f);  // 半透明效果
        } else {
            targetImage.color = Color.white;  // 恢复正常显示
        }
    }
}
```

### ProcessSeriesDirect实现
```csharp
public void ProcessSeriesDirect() {
    try {
        // 1. 同时启动三个纹理生成协程
        viewer.coroutineModule.StartCoroutineTracked(CreateAxialTextureAndUpdateUI());
        viewer.coroutineModule.StartCoroutineTracked(CreateSagittalTextureAndUpdateUI());
        viewer.coroutineModule.StartCoroutineTracked(CreateCoronalTextureAndUpdateUI());
        
        // 2. 立即标记为初始化完成
        viewer.isInitialized = true;
        viewer.InvokeDicomLoaded(viewer.loadedSeries.Slices.Count);
        
        // 3. 启动后台预取
        viewer.sliceControlModule.StartBackgroundLoading();
        
    } catch (Exception ex) {
        Debug.LogError($"直接处理DICOM序列时出错: {ex.Message}");
        
        // 错误恢复:清理状态并通知用户
        viewer.coroutineModule.CancelAllOperations();
        viewer.isInitialized = false;
    }
}
```

## 性能监控与统计

### 纹理操作统计
```csharp
private struct TextureOperationStats {
    public int TotalRequests;
    public int SuccessfulLoads;
    public int FailedLoads;
    public float AverageLoadTime;
    public long TotalMemoryUsed;
}

private TextureOperationStats operationStats;

private void UpdatePreloadStatistics(DicomPlane.PlaneType planeType, int index, bool success) {
    operationStats.TotalRequests++;
    
    if (success) {
        operationStats.SuccessfulLoads++;
        
        // 计算加载时间
        float requestTime = GetRequestTime(planeType, index);
        if (requestTime > 0) {
            float loadTime = Time.realtimeSinceStartup - requestTime;
            operationStats.AverageLoadTime = 
                (operationStats.AverageLoadTime * (operationStats.SuccessfulLoads - 1) + loadTime) / 
                operationStats.SuccessfulLoads;
        }
    } else {
        operationStats.FailedLoads++;
    }
}

public void LogTextureStatistics() {
    float successRate = operationStats.TotalRequests > 0 ? 
        (float)operationStats.SuccessfulLoads / operationStats.TotalRequests : 0;
    
    Debug.Log($"纹理操作统计 - 成功率: {successRate:P2}, " +
              $"平均加载时间: {operationStats.AverageLoadTime:F2}ms, " +
              $"总内存使用: {operationStats.TotalMemoryUsed / 1024 / 1024:F1}MB");
}
```

## 错误恢复机制

### RetryTextureGeneration实现
```csharp
private IEnumerator RetryTextureGeneration(DicomPlane.PlaneType planeType, int index, int maxRetries = 3) {
    for (int attempt = 1; attempt <= maxRetries; attempt++) {
        Debug.Log($"重试生成{planeType}平面切片{index}纹理，第{attempt}次尝试");
        
        // 等待一段时间后重试
        yield return new WaitForSeconds(attempt * 0.5f);
        
        // 重新请求纹理生成
        if (viewer.textureManager != null) {
            viewer.textureManager.RequestTexture(planeType, index, 
                priority: TextureRequestPriority.High, forceRegenerate: true);
            
            // 等待生成完成
            yield return new WaitForSeconds(2.0f);
            
            // 检查是否成功
            Texture2D texture = viewer.textureManager.GetTexture(planeType, index);
            if (texture != null) {
                UpdateTextureToUI(planeType, texture);
                Debug.Log($"第{attempt}次重试成功");
                yield break;
            }
        }
    }
    
    // 所有重试都失败
    Debug.LogError($"生成{planeType}平面切片{index}纹理失败，已重试{maxRetries}次");
    ShowErrorTexture(planeType);
}

private void ShowErrorTexture(DicomPlane.PlaneType planeType) {
    RawImage targetImage = GetTargetRawImage(planeType);
    if (targetImage != null) {
        targetImage.texture = GetErrorTexture();
        targetImage.color = new Color(1f, 0.5f, 0.5f, 1f);  // 红色调表示错误
    }
}
```

## 缓存协调机制

### CacheTextureForLaterUse实现
```csharp
private void CacheTextureForLaterUse(DicomPlane.PlaneType planeType, int index, Texture2D texture) {
    if (viewer.textureManager != null) {
        // 将纹理添加到缓存中
        viewer.textureManager.CacheTexture(planeType, index, texture);
        
        // 更新内存统计
        long textureSize = GetTextureMemorySize(texture);
        operationStats.TotalMemoryUsed += textureSize;
        
        // 如果缓存过多，触发清理
        if (operationStats.TotalMemoryUsed > GetMemoryThreshold()) {
            viewer.textureManager.TrimCache();
        }
    }
}

private long GetMemoryThreshold() {
    // 根据设备内存动态设置阈值
    long systemMemory = SystemInfo.systemMemorySize * 1024L * 1024L;
    return systemMemory / 4;  // 使用系统内存的1/4作为纹理缓存阈值
}
```

