---
title: 协程安全管理策略
---

# 协程安全管理策略

## 协程安全机制的必要性

在Visualization3D模块中，协程被广泛用于异步纹理更新、数据加载等待和状态检查。然而Unity的协程在GameObject未激活或组件禁用时会产生异常，因此模块实现了完整的协程安全管理机制。

## 核心安全检查实现

### GameObject状态验证

```csharp
private bool CanStartCoroutine()
{
    // 检查GameObject是否激活且在层级中，以及组件是否启用
    bool canStart = gameObject.activeInHierarchy && enabled;
    
    if (!canStart)
    {
        Debug.LogWarning($"[Component] GameObject '{gameObject.name}' 不能启动协程: " +
            $"activeInHierarchy={gameObject.activeInHierarchy}, enabled={enabled}");
    }
    
    return canStart;
}
```

**检查要点**:
- `gameObject.activeInHierarchy`:确保GameObject及其所有父对象都处于激活状态
- `enabled`:确保MonoBehaviour组件本身启用
- 双重检查避免了任何潜在的状态不一致问题

### 安全启动包装器

```csharp
private Coroutine SafeStartCoroutine(IEnumerator routine, string operationName = "未知操作")
{
    if (!CanStartCoroutine())
    {
        Debug.LogWarning($"跳过{operationName}，GameObject未激活");
        return null;
    }
    
    try
    {
        return StartCoroutine(routine);
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"启动{operationName}协程时出错: {ex.Message}");
        return null;
    }
}
```

**异常处理策略**:
- 预检查:启动前验证状态
- Try-catch:捕获启动过程中的异常
- 日志记录:提供详细的错误信息
- 优雅降级:返回null而不是抛出异常

## 协程生命周期管理

### 协程追踪系统

在DicomSlice3DManager中实现了完整的协程追踪:

```csharp
private List<Coroutine> activeCoroutines = new List<Coroutine>();

private Coroutine SafeStartCoroutine(IEnumerator routine, string operationName)
{
    if (!CanStartCoroutine())
        return null;
    
    try
    {
        Coroutine coroutine = StartCoroutine(routine);
        activeCoroutines.Add(coroutine); // 追踪协程实例
        return coroutine;
    }
    catch (System.Exception ex)
    {
        Debug.LogError($"启动{operationName}协程时出错: {ex.Message}");
        return null;
    }
}
```

### 批量协程清理

```csharp
private void StopAllActiveCoroutines()
{
    foreach (var coroutine in activeCoroutines)
    {
        if (coroutine != null)
        {
            try
            {
                StopCoroutine(coroutine);
            }
            catch (System.Exception)
            {
                // 忽略已完成的协程异常
                // Unity在协程已自然结束时调用StopCoroutine会抛异常
            }
        }
    }
    activeCoroutines.Clear();
}
```

**清理时机**:
- `OnDisable()`:组件禁用时
- 初始化开始前:防止重复初始化导致的协程冲突
- 对象销毁前:确保资源正确释放

## 运行时状态监控

### 协程内部状态检查

协程运行过程中需要持续监控GameObject状态:

```csharp
private IEnumerator UpdateTextureCoroutine()
{
    textureRetryCount = 0;
    bool textureUpdated = false;
    
    // 在循环中持续检查状态
    while (!textureUpdated && textureRetryCount < 5 && CanStartCoroutine())
    {
        Texture2D texture = GetTextureFromSources();
        
        if (texture != null)
        {
            SetTexture(texture);
            textureUpdated = true;
        }
        else
        {
            textureRetryCount++;
            yield return new WaitForSeconds(0.2f);
            
            // 等待后再次检查状态
            if (!CanStartCoroutine())
            {
                Debug.LogWarning("纹理更新协程被中断，GameObject已被禁用");
                yield break;
            }
        }
    }
    
    textureUpdateCoroutine = null; // 清理协程引用
}
```

### 长期运行协程的安全实现

DicomTextureBridge的纹理监控协程展示了长期协程的安全模式:

```csharp
private IEnumerator MonitorTextureChanges()
{
    while (true)
    {
        // 检查GameObject状态，如果未激活则暂停监视
        if (!CanStartCoroutine())
        {
            // 等待一段时间后再检查，避免无限循环消耗资源
            yield return new WaitForSeconds(1.0f);
            continue;
        }
        
        // 执行监视逻辑
        if (axialRawImage != null && axialRawImage.texture != null)
        {
            Texture currentTexture = axialRawImage.texture;
            if (convertedAxialTexture == null || currentTexture != convertedAxialTexture)
            {
                ConvertAndUpdateAxialTexture();
            }
        }
        
        // 类似处理其他平面...
        
        yield return new WaitForSeconds(0.5f);
    }
}
```

## 协程取消机制

### 单协程取消

```csharp
public void SetSliceIndex(int index)
{
    // 早期返回检查
    if (!CanStartCoroutine())
    {
        Debug.LogWarning($"切片索引设置被延迟，GameObject未激活");
        currentSliceIndex = index; // 仍然更新索引，以备后用
        return;
    }
    
    // 取消现有协程
    if (textureUpdateCoroutine != null)
    {
        StopCoroutine(textureUpdateCoroutine);
    }
    
    // 启动新协程
    textureUpdateCoroutine = SafeStartCoroutine(UpdateTextureCoroutine(), "纹理更新");
}
```

### 防重复启动机制

在DicomTextureBridge中使用状态标志防止重复协程:

```csharp
public void ConvertAndUpdateAxialTexture()
{
    // 多重检查:处理状态 + 数据有效性 + GameObject状态
    if (isProcessingAxial || axialRawImage == null || 
        axialRawImage.texture == null || !CanStartCoroutine()) 
        return;
    
    isProcessingAxial = true;
    SafeStartCoroutine(ConvertTextureCoroutine(
        axialRawImage.texture,
        DicomPlane.PlaneType.Axial,
        (texture) => {
            convertedAxialTexture = texture;
            if (sliceManager != null && sliceManager.AxialPlane != null)
            {
                sliceManager.AxialPlane.SetTexture(texture);
            }
            isProcessingAxial = false; // 重置处理标志
        }
    ), "轴向纹理转换");
}
```

## 错误恢复策略

### 优雅降级处理

当协程无法启动时，系统不会完全失败，而是采用降级策略:

```csharp
public void ForceUpdateTexture()
{
    if (!dicomDataReady) return;
    
    // 如果GameObject未激活，记录需要更新但不立即执行
    if (!CanStartCoroutine())
    {
        Debug.LogWarning($"纹理强制更新被延迟，GameObject未激活 (平面: {planeType})");
        return; // 等待GameObject激活后由其他机制触发更新
    }
    
    // 正常情况下的更新流程
    if (textureUpdateCoroutine != null)
    {
        StopCoroutine(textureUpdateCoroutine);
    }
    
    currentTexture = null; // 清除缓存强制重新获取
    textureUpdateCoroutine = SafeStartCoroutine(UpdateTextureCoroutine(), "强制纹理更新");
}
```

### 状态同步恢复

当GameObject重新激活时，通过OnEnable自动恢复:

```csharp
void OnEnable()
{
    // 当物体激活时确保纹理更新
    if (isInitialized && dicomDataReady)
    {
        ForceUpdateTexture();
    }
}
```

这确保了即使经历了禁用-启用循环，组件也能恢复到正确的状态。