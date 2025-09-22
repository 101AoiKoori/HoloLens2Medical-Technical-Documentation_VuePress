---
title: 内存管理策略实现
---
# 内存管理策略实现

> 深入解析Coroutine模块的内存监控、资源释放和延迟销毁机制

## 协程追踪与生命周期管理

### 协程注册机制实现
```csharp
private List<UnityEngine.Coroutine> activeCoroutines = new List<UnityEngine.Coroutine>();

public UnityEngine.Coroutine StartCoroutineTracked(IEnumerator routine) {
    // 1. 关闭状态检查
    if (viewer.isShuttingDown) return null;
    
    // 2. 启动协程
    UnityEngine.Coroutine coroutine = viewer.StartCoroutine(routine);
    
    // 3. 注册追踪
    if (coroutine != null) {
        activeCoroutines.Add(coroutine);
    }
    
    return coroutine;
}
```

**追踪优势分析**:
- **防止泄露**:确保所有协程都被记录
- **批量管理**:组件销毁时一次性清理
- **状态保护**:避免在关闭过程中启动新协程

### 安全取消策略
```csharp
public void CancelAllOperations() {
    // 1. 停止所有追踪的协程
    foreach (UnityEngine.Coroutine coroutine in activeCoroutines) {
        if (coroutine != null) {
            try {
                viewer.StopCoroutine(coroutine);
            } catch (Exception) { 
                // 忽略已停止协程的异常
            }
        }
    }
    
    // 2. 清空追踪列表
    activeCoroutines.Clear();
    
    // 3. 取消纹理管理器请求队列
    if (viewer.textureManager != null) {
        viewer.textureManager.CancelAllRequests();
    }
}
```

**异常处理设计**:
- 使用try-catch包装StopCoroutine调用
- 已停止的协程会抛出异常，但不影响清理流程
- 确保列表清空，避免状态不一致

## 纹理资源释放实现

### 分平面释放策略
```csharp
public void ReleaseAllResources() {
    // 1. 按平面类型逐一释放UI纹理
    ReleaseImageResources(DicomPlane.PlaneType.Axial);
    ReleaseImageResources(DicomPlane.PlaneType.Sagittal);
    ReleaseImageResources(DicomPlane.PlaneType.Coronal);
    
    // 2. 系统级资源回收
    Resources.UnloadUnusedAssets();
    
    // 3. 强制垃圾回收
    GC.Collect();
}
```

### 单平面纹理释放细节
```csharp
private void ReleaseImageResources(DicomPlane.PlaneType planeType) {
    // 1. 获取对应的RawImage组件
    RawImage targetImage = null;
    switch (planeType) {
        case DicomPlane.PlaneType.Axial:
            targetImage = viewer.axialImage;
            break;
        case DicomPlane.PlaneType.Sagittal:
            targetImage = viewer.sagittalImage;
            break;
        case DicomPlane.PlaneType.Coronal:
            targetImage = viewer.coronalImage;
            break;
    }
    
    if (targetImage != null) {
        // 2. 保存当前纹理引用
        Texture oldTexture = targetImage.texture;
        
        // 3. 断开UI引用
        targetImage.texture = null;
        
        // 4. 安全销毁检查
        if (oldTexture != null && 
            !viewer.textureUpdaterModule.IsTextureUsedElsewhere(oldTexture)) {
            UnityEngine.Object.Destroy(oldTexture);
        }
    }
}
```

**引用安全机制**:
- 先断开UI组件的引用
- 检查纹理是否在其他地方使用
- 避免销毁共享纹理导致的渲染错误

### 纹理使用检查实现
```csharp
// TextureUpdater模块中的引用检查
public bool IsTextureUsedElsewhere(Texture texture) {
    // 检查三个主要的RawImage组件
    if (viewer.axialImage != null && viewer.axialImage.texture == texture) 
        return true;
    if (viewer.sagittalImage != null && viewer.sagittalImage.texture == texture) 
        return true;
    if (viewer.coronalImage != null && viewer.coronalImage.texture == texture) 
        return true;
    
    // 可扩展检查其他可能的引用位置
    // 例如:3D可视化组件、材质球等
    return false;
}
```

## 延迟销毁机制实现

### 延迟销毁协程
```csharp
private IEnumerator DelayedTextureDisposal(Texture oldTexture) {
    // 1. 等待当前帧结束
    yield return new WaitForEndOfFrame();
    
    // 2. 再次检查引用状态
    if (oldTexture != null && !IsTextureUsedElsewhere(oldTexture)) {
        UnityEngine.Object.Destroy(oldTexture);
    }
}
```

**延迟销毁的必要性**:
- **渲染管线同步**:等待GPU完成当前帧的渲染
- **引用状态确认**:防止在纹理仍被使用时销毁
- **避免闪烁**:确保新纹理已经设置后再销毁旧纹理

### 纹理更新时的延迟释放
```csharp
// 在CreateAxialTextureAndUpdateUI中的使用
if (axialComplete && axialTexture != null && viewer.axialImage != null) {
    Texture oldTexture = viewer.axialImage.texture;
    viewer.axialImage.texture = axialTexture;
    viewer.axialImage.color = Color.white;
    
    // 延迟销毁旧纹理
    if (oldTexture != null && oldTexture != axialTexture) {
        viewer.StartCoroutine(DelayedTextureDisposal(oldTexture));
    }
}
```

## 内存监控机制实现

### 定时检查循环
```csharp
private float lastCheckTime = 0f;

public void UpdateMemoryMonitoring() {
    float currentTime = Time.realtimeSinceStartup;
    if (currentTime - lastCheckTime > viewer.memoryCheckInterval) {
        CheckMemoryStatus();
        lastCheckTime = currentTime;
    }
}
```

**时间控制优化**:
- 使用realtimeSinceStartup避免暂停影响
- 可配置的检查间隔，默认30秒
- 避免每帧检查的性能开销

### 内存压力检测实现
```csharp
public void CheckMemoryStatus() {
    bool highPressure = IsMemoryPressureHigh();
    if (highPressure) {
        Debug.Log("检测到高内存压力，进行资源清理");
        
        // 立即清理未使用资源
        Resources.UnloadUnusedAssets();
        
        // 强制垃圾回收
        GC.Collect();
    }
}
```

### 增强的内存压力检测
```csharp
public bool IsMemoryPressureHigh() {
    // 当前为简化实现，建议扩展为:
    
    // 方案1:基于系统内存使用率
    // long totalMemory = SystemInfo.systemMemorySize * 1024L * 1024L;
    // long allocatedMemory = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong();
    // return (float)allocatedMemory / totalMemory > 0.7f;
    
    // 方案2:基于Unity分配器
    // long reservedMemory = UnityEngine.Profiling.Profiler.GetTotalReservedMemoryLong();
    // return reservedMemory > 512 * 1024 * 1024; // 超过512MB
    
    // 方案3:基于纹理占用
    // return GetCurrentTextureMemoryUsage() > GetTextureMemoryLimit();
    
    return false; // 简化实现
}
```

## 内存优化策略实现

### 协程列表清理
```csharp
private void CleanupCompletedCoroutines() {
    // 移除所有null引用（已完成的协程）
    activeCoroutines.RemoveAll(c => c == null);
}
```

在内存检查时调用，防止列表无限增长。

### 批量操作优化
```csharp
public void OptimizedBatchRelease() {
    // 1. 暂停所有协程
    CancelAllOperations();
    
    // 2. 批量断开UI引用
    if (viewer.axialImage != null) viewer.axialImage.texture = null;
    if (viewer.sagittalImage != null) viewer.sagittalImage.texture = null;
    if (viewer.coronalImage != null) viewer.coronalImage.texture = null;
    
    // 3. 清理纹理管理器缓存
    if (viewer.textureManager != null) {
        viewer.textureManager.ClearAllCaches();
    }
    
    // 4. 统一进行系统级清理
    Resources.UnloadUnusedAssets();
    GC.Collect();
}
```

避免逐个释放的频繁系统调用，提高清理效率。

### 内存压力下的自适应策略
```csharp
// 在后台加载协程中的内存感知
if (viewer.coroutineModule.IsMemoryPressureHigh()) {
    // 策略1:增加等待时间
    yield return new WaitForSeconds(1.0f);
    
    // 策略2:减少批量大小
    batchSize = Mathf.Max(1, batchSize / 2);
    
    // 策略3:暂停预取
    if (GetMemoryPressureLevel() > 0.8f) {
        Debug.Log("内存压力过高，暂停后台加载");
        yield break;
    }
}
```

## 生命周期集成实现

### 组件启动时的内存初始化
```csharp
public void InitializeMemoryMonitoring() {
    lastCheckTime = Time.realtimeSinceStartup;
    
    // 初始内存状态记录
    if (viewer.enableMemoryMonitoring) {
        Debug.Log($"内存监控已启动，检查间隔: {viewer.memoryCheckInterval}秒");
        CheckMemoryStatus(); // 初始检查
    }
}
```

### Update循环中的内存管理
```csharp
// 在MPRViewer.Update中调用
if (enableMemoryMonitoring) {
    coroutineModule.UpdateMemoryMonitoring();
}
```

确保内存监控在主线程中定期执行。

### 组件关闭时的完整清理
```csharp
// OnDestroy中的调用序列
private void OnDestroy() {
    isShuttingDown = true;                    // 设置关闭标志
    coroutineModule.CancelAllOperations();    // 取消协程
    coroutineModule.ReleaseAllResources();    // 释放资源
}
```

**关闭顺序的重要性**:
1. 设置关闭标志防止新操作
2. 取消协程停止异步处理
3. 释放资源确保内存清理

## 高级内存管理技巧

### 纹理池管理
```csharp
// 建议的纹理池实现
private static Queue<Texture2D> texturePool = new Queue<Texture2D>();

public static Texture2D GetPooledTexture(int width, int height) {
    if (texturePool.Count > 0) {
        var texture = texturePool.Dequeue();
        if (texture.width == width && texture.height == height) {
            return texture;
        } else {
            UnityEngine.Object.Destroy(texture);
        }
    }
    return new Texture2D(width, height);
}

public static void ReturnToPool(Texture2D texture) {
    if (texture != null && texturePool.Count < 10) {
        texturePool.Enqueue(texture);
    } else if (texture != null) {
        UnityEngine.Object.Destroy(texture);
    }
}
```

### 内存使用统计
```csharp
public MemoryUsageStats GetMemoryUsageStats() {
    return new MemoryUsageStats {
        ActiveCoroutines = activeCoroutines.Count,
        AllocatedMemory = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong(),
        ReservedMemory = UnityEngine.Profiling.Profiler.GetTotalReservedMemoryLong(),
        TextureMemory = GetEstimatedTextureMemoryUsage()
    };
}

private long GetEstimatedTextureMemoryUsage() {
    long totalSize = 0;
    
    // 估算当前UI纹理占用
    if (viewer.axialImage?.texture != null) {
        var tex = viewer.axialImage.texture;
        totalSize += tex.width * tex.height * 4; // 假设RGBA32格式
    }
    
    // 类似计算其他纹理...
    
    return totalSize;
}
```

### 内存泄露检测
```csharp
public void DetectMemoryLeaks() {
    // 检查协程列表中的null引用
    int nullCount = activeCoroutines.Count(c => c == null);
    if (nullCount > 0) {
        Debug.LogWarning($"发现{nullCount}个已完成但未清理的协程引用");
        CleanupCompletedCoroutines();
    }
    
    // 检查纹理引用不一致
    CheckTextureReferenceConsistency();
}

private void CheckTextureReferenceConsistency() {
    // 检查UI组件的纹理引用是否与预期一致
    // 这有助于发现潜在的引用问题
}
```