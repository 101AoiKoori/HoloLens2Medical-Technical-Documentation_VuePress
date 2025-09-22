---
title: 内存与协程管理机制
---
# 内存与协程管理机制

> Coroutine模块的资源释放、协程追踪与内存监控实现详解

## 协程生命周期管理

### 统一追踪机制
Coroutine模块维护一个活跃协程列表，实现集中管理:
```csharp
private List<UnityEngine.Coroutine> activeCoroutines = new List<UnityEngine.Coroutine>();

public UnityEngine.Coroutine StartCoroutineTracked(IEnumerator routine) {
    if (viewer.isShuttingDown) return null;
    
    UnityEngine.Coroutine coroutine = viewer.StartCoroutine(routine);
    if (coroutine != null) {
        activeCoroutines.Add(coroutine);
    }
    return coroutine;
}
```

**设计优势**:
- 防止协程泄露:所有协程都被追踪
- 批量取消:组件销毁时一次性清理
- 状态保护:关闭状态下拒绝新协程启动

### 安全取消机制
```csharp
public void CancelAllOperations() {
    foreach (UnityEngine.Coroutine coroutine in activeCoroutines) {
        if (coroutine != null) {
            try {
                viewer.StopCoroutine(coroutine);
            } catch (Exception) { 
                // 忽略已经停止的协程异常
            }
        }
    }
    activeCoroutines.Clear();
    
    // 同时取消纹理管理器的请求队列
    if (viewer.textureManager != null) {
        viewer.textureManager.CancelAllRequests();
    }
}
```

**异常处理策略**:
- 使用try-catch包装StopCoroutine，防止已停止协程引发异常
- 无论是否成功都要清空列表，确保状态一致

## 资源释放管理

### 分层次释放策略
```csharp
public void ReleaseAllResources() {
    // 1. 按平面类型释放UI纹理
    ReleaseImageResources(DicomPlane.PlaneType.Axial);
    ReleaseImageResources(DicomPlane.PlaneType.Sagittal);
    ReleaseImageResources(DicomPlane.PlaneType.Coronal);
    
    // 2. 系统级资源回收
    Resources.UnloadUnusedAssets();
    GC.Collect();
}
```

### UI纹理释放实现
```csharp
private void ReleaseImageResources(DicomPlane.PlaneType planeType) {
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
        Texture oldTexture = targetImage.texture;
        targetImage.texture = null;  // 断开引用
        
        // 检查是否可以安全销毁
        if (oldTexture != null && 
            !viewer.textureUpdaterModule.IsTextureUsedElsewhere(oldTexture)) {
            UnityEngine.Object.Destroy(oldTexture);
        }
    }
}
```

**引用安全检查**:
- 断开RawImage的纹理引用
- 检查纹理是否在其他地方使用
- 避免销毁仍在使用的共享纹理

## 内存监控机制

### 定时检查实现
```csharp
private float lastCheckTime = 0f;

public void UpdateMemoryMonitoring() {
    float currentTime = Time.realtimeSinceStartup;
    if (currentTime - lastCheckTime > viewer.memoryCheckInterval) {
        CheckMemoryStatus();
        lastCheckTime = currentTime;
    }
}

public void CheckMemoryStatus() {
    bool highPressure = IsMemoryPressureHigh();
    if (highPressure) {
        Debug.Log("检测到高内存压力，进行资源清理");
        Resources.UnloadUnusedAssets();
        GC.Collect();
    }
}
```

### 内存压力检测
当前实现为简化版本:
```csharp
public bool IsMemoryPressureHigh() {
    // 简化的内存压力检测
    return false;
}
```

**扩展建议**:
```csharp
public bool IsMemoryPressureHigh() {
    // 获取系统总内存
    long totalMemory = SystemInfo.systemMemorySize * 1024L * 1024L;
    
    // 获取当前分配内存
    long allocatedMemory = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong();
    
    // 计算使用率
    float memoryUsageRatio = (float)allocatedMemory / totalMemory;
    
    // 超过70%认为高压力
    return memoryUsageRatio > 0.7f;
}
```

## 延迟销毁机制

### 纹理延迟释放
TextureUpdater模块实现了延迟纹理销毁:
```csharp
private IEnumerator DelayedTextureDisposal(Texture oldTexture) {
    yield return new WaitForEndOfFrame();
    
    if (oldTexture != null && !IsTextureUsedElsewhere(oldTexture)) {
        UnityEngine.Object.Destroy(oldTexture);
    }
}
```

**延迟销毁原因**:
- 避免在纹理更新的同一帧销毁
- 给GPU足够时间完成渲染
- 防止纹理仍在渲染管线中时被销毁

### 引用检查实现
```csharp
public bool IsTextureUsedElsewhere(Texture texture) {
    // 检查是否在其他RawImage中使用
    if (viewer.axialImage != null && viewer.axialImage.texture == texture) return true;
    if (viewer.sagittalImage != null && viewer.sagittalImage.texture == texture) return true;
    if (viewer.coronalImage != null && viewer.coronalImage.texture == texture) return true;
    
    // 可扩展:检查其他可能的引用位置
    return false;
}
```

## 内存优化策略

### 协程清理优化
定期清理已完成的协程引用:
```csharp
private void CleanupCompletedCoroutines() {
    activeCoroutines.RemoveAll(c => c == null);
}
```

在内存检查时调用，避免列表无限增长。

### 批量操作优化
```csharp
// 资源释放时的批量操作
ReleaseAllResources() {
    // 1. 先取消所有协程
    CancelAllOperations();
    
    // 2. 批量释放UI资源
    ReleaseImageResources(...);
    
    // 3. 最后进行系统级清理
    Resources.UnloadUnusedAssets();
    GC.Collect();
}
```

避免频繁的单次清理操作，提高效率。

### 内存压力响应
后台加载协程会检查内存压力并调整行为:
```csharp
if (viewer.coroutineModule.IsMemoryPressureHigh()) {
    yield return new WaitForSeconds(0.5f);  // 增加等待时间
}
```

**自适应策略**:
- 正常情况:按默认间隔处理
- 内存压力:增加等待时间，减少并发
- 极端情况:暂停后台加载

## 生命周期集成

### 组件生命周期绑定
```csharp
// Awake: 初始化内存监控
coroutineModule.InitializeMemoryMonitoring();

// Update: 定期内存检查
if (enableMemoryMonitoring) {
    coroutineModule.UpdateMemoryMonitoring();
}

// OnDisable: 取消协程
coroutineModule.CancelAllOperations();

// OnDestroy: 完整清理
coroutineModule.CancelAllOperations();
coroutineModule.ReleaseAllResources();
```

确保在组件的各个生命周期阶段正确管理资源。