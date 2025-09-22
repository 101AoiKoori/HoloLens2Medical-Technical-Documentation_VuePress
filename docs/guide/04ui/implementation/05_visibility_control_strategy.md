---
title: 显隐控制策略
---
# 显隐控制策略

MPRVisibilityController实现了精细化的3D平面和包围盒显隐控制。本节深入分析组件级控制策略、状态检测算法和批量操作优化的技术实现。

## 组件级控制实现

### 平面控制器操作

`TogglePlaneController`实现了对单个平面的精细控制:

```csharp
private void TogglePlaneController(DicomPlaneController controller, bool visible)
{
    if (controller == null) return;

    // 第一层:控制器本身的启用状态
    // 这会暂停Update()调用和协程执行，但保持组件引用有效
    controller.enabled = visible;

    // 第二层:平面对象的激活状态
    if (controller.planeObject != null)
    {
        // 使用SetActive而不是Renderer.enabled
        // 这样可以避免DicomPlaneController.SetTexture强制启用渲染器的问题
        controller.planeObject.SetActive(visible);
    }

    // 第三层:纹理同步机制
    if (visible)
    {
        // 重新显示时强制更新纹理确保显示最新切片
        try
        {
            controller.ForceUpdateTexture();
        }
        catch (System.Exception ex)
        {
            // 忽略因隐藏期间调用而产生的异常
            // 这种异常通常发生在纹理更新过程中组件状态不一致时
            Debug.LogWarning($"平面纹理更新异常（可忽略）: {ex.Message}");
        }
    }
}
```

### 分层控制策略原理

系统采用三层控制策略避免破坏组件生命周期:

1. **组件行为层**:控制`MonoBehaviour.enabled`
   - 暂停Update()、FixedUpdate()等生命周期方法
   - 停止协程执行但保持协程状态
   - 保持组件引用和序列化数据完整

2. **对象激活层**:控制`GameObject.SetActive()`
   - 控制整个对象及其子组件的可见性
   - 影响物理模拟和碰撞检测
   - 保持父子关系和Transform数据

3. **纹理同步层**:控制纹理更新机制
   - 恢复显示时强制刷新纹理
   - 处理隐藏期间的纹理状态变更
   - 异常容错避免状态不一致

### 包围盒控制实现

包围盒控制采用组件级精确控制:

```csharp
public void SetBoundingVisibility(bool visible)
{
    // 控制碰撞体交互能力
    if (boundingColliders != null)
    {
        foreach (var collider in boundingColliders)
        {
            if (collider != null)
            {
                // 仅控制enabled状态，不影响GameObject
                collider.enabled = visible;
                
                // 记录状态变更用于调试
                if (enableDebugLog)
                {
                    Debug.Log($"设置碰撞体 {collider.name} 启用状态: {visible}");
                }
            }
        }
    }

    // 控制渲染器可见性
    if (boundingRenderers != null)
    {
        foreach (var renderer in boundingRenderers)
        {
            if (renderer != null)
            {
                // 仅控制enabled状态，保持材质和网格数据
                renderer.enabled = visible;
                
                if (enableDebugLog)
                {
                    Debug.Log($"设置渲染器 {renderer.name} 启用状态: {visible}");
                }
            }
        }
    }
}
```

## 状态检测算法

### 单组件状态检测

`IsPlaneVisible`实现了多层次状态检测:

```csharp
private bool IsPlaneVisible(DicomPlaneController controller)
{
    if (controller == null) return false;

    // 第一优先级:检查平面对象激活状态
    if (controller.planeObject != null)
    {
        return controller.planeObject.activeSelf;
    }

    // 第二优先级:检查子级渲染器状态
    // 使用includeInactive=true确保能找到被禁用的渲染器
    var renderer = controller.GetComponentInChildren<Renderer>(true);
    if (renderer != null)
    {
        return renderer.enabled;
    }

    // 第三优先级:检查控制器本身的启用状态
    return controller.enabled;
}
```

### 批量状态检测

`AreAnyVisible`实现了短路求值优化的批量检测:

```csharp
public bool AreAnyVisible()
{
    // 阶段1:检查标准三正交平面
    if (slice3DManager != null)
    {
        // 短路求值:任一平面可见即返回true
        if (IsPlaneVisible(slice3DManager.AxialPlane)) return true;
        if (IsPlaneVisible(slice3DManager.SagittalPlane)) return true;
        if (IsPlaneVisible(slice3DManager.CoronalPlane)) return true;
    }

    // 阶段2:检查额外自定义平面
    if (extraPlanes != null)
    {
        foreach (var plane in extraPlanes)
        {
            if (IsPlaneVisible(plane)) return true;
        }
    }

    // 阶段3:检查包围盒碰撞体
    if (boundingColliders != null)
    {
        foreach (var collider in boundingColliders)
        {
            if (collider != null && collider.enabled)
                return true;
        }
    }

    // 阶段4:检查包围盒渲染器
    if (boundingRenderers != null)
    {
        foreach (var renderer in boundingRenderers)
        {
            if (renderer != null && renderer.enabled)
                return true;
        }
    }

    return false;
}
```

### 分类状态检测

系统提供分类的状态检测方法:

```csharp
private bool AnyPlaneVisible()
{
    // 仅检查平面，不考虑包围盒
    if (slice3DManager != null)
    {
        if (IsPlaneVisible(slice3DManager.AxialPlane)) return true;
        if (IsPlaneVisible(slice3DManager.SagittalPlane)) return true;
        if (IsPlaneVisible(slice3DManager.CoronalPlane)) return true;
    }

    if (extraPlanes != null)
    {
        foreach (var plane in extraPlanes)
        {
            if (IsPlaneVisible(plane)) return true;
        }
    }

    return false;
}

private bool AnyBoundingVisible()
{
    // 仅检查包围盒组件
    if (boundingColliders != null)
    {
        foreach (var collider in boundingColliders)
        {
            if (collider != null && collider.enabled) return true;
        }
    }

    if (boundingRenderers != null)
    {
        foreach (var renderer in boundingRenderers)
        {
            if (renderer != null && renderer.enabled) return true;
        }
    }

    return false;
}
```

## 批量操作优化

### 统一显隐控制

`SetAllVisibility`实现了高效的批量操作:

```csharp
public void SetAllVisibility(bool visible)
{
    // 分别处理两个独立子系统
    SetPlanesVisibility(visible);
    SetBoundingVisibility(visible);

    // 记录操作日志
    if (enableDebugLog)
    {
        Debug.Log($"设置所有对象显隐状态: {visible}");
    }
}

public void SetPlanesVisibility(bool visible)
{
    // 处理标准三正交平面
    if (slice3DManager != null)
    {
        TogglePlaneController(slice3DManager.AxialPlane, visible);
        TogglePlaneController(slice3DManager.SagittalPlane, visible);
        TogglePlaneController(slice3DManager.CoronalPlane, visible);
    }

    // 处理额外自定义平面
    if (extraPlanes != null)
    {
        foreach (var plane in extraPlanes)
        {
            TogglePlaneController(plane, visible);
        }
    }

    // 触发平面可见性变更事件
    OnPlanesVisibilityChanged?.Invoke(visible);
}
```

### 智能切换算法

切换方法实现了智能的"全有或全无"策略:

```csharp
public void TogglePlanesVisibility()
{
    // 检查当前状态:如果任何平面可见，则隐藏全部；否则显示全部
    bool anyVisible = AnyPlaneVisible();
    bool targetState = !anyVisible;
    
    SetPlanesVisibility(targetState);
    
    if (enableDebugLog)
    {
        Debug.Log($"切换平面显示状态: {anyVisible} -> {targetState}");
    }
}

public void ToggleBoundingVisibility()
{
    // 分别检查碰撞体和渲染器的可见状态
    bool anyBoundingVisible = AnyBoundingVisible();
    bool targetState = !anyBoundingVisible;
    
    SetBoundingVisibility(targetState);
    
    if (enableDebugLog)
    {
        Debug.Log($"切换包围盒显示状态: {anyBoundingVisible} -> {targetState}");
    }
}

public void ToggleAllVisibility()
{
    // 全局状态检查和切换
    bool anyVisible = AreAnyVisible();
    bool targetState = !anyVisible;
    
    SetAllVisibility(targetState);
    
    if (enableDebugLog)
    {
        Debug.Log($"切换全部显示状态: {anyVisible} -> {targetState}");
    }
}
```

## 扩展性设计

### 动态平面管理

系统支持运行时添加和移除自定义平面:

```csharp
public void AddExtraPlane(DicomPlaneController plane)
{
    if (plane == null) return;
    
    if (extraPlanes == null)
    {
        extraPlanes = new List<DicomPlaneController>();
    }
    
    if (!extraPlanes.Contains(plane))
    {
        extraPlanes.Add(plane);
        Debug.Log($"添加额外平面: {plane.name}");
    }
}

public void RemoveExtraPlane(DicomPlaneController plane)
{
    if (extraPlanes != null && plane != null)
    {
        extraPlanes.Remove(plane);
        Debug.Log($"移除额外平面: {plane.name}");
    }
}

public void ClearExtraPlanes()
{
    if (extraPlanes != null)
    {
        extraPlanes.Clear();
        Debug.Log("清除所有额外平面");
    }
}
```

### 包围盒组件动态管理

支持运行时管理包围盒组件:

```csharp
public void AddBoundingCollider(Collider collider)
{
    if (collider == null) return;
    
    if (boundingColliders == null)
    {
        boundingColliders = new List<Collider>();
    }
    
    if (!boundingColliders.Contains(collider))
    {
        boundingColliders.Add(collider);
        Debug.Log($"添加包围盒碰撞体: {collider.name}");
    }
}

public void AddBoundingRenderer(Renderer renderer)
{
    if (renderer == null) return;
    
    if (boundingRenderers == null)
    {
        boundingRenderers = new List<Renderer>();
    }
    
    if (!boundingRenderers.Contains(renderer))
    {
        boundingRenderers.Add(renderer);
        Debug.Log($"添加包围盒渲染器: {renderer.name}");
    }
}
```

## 性能优化策略

### 批处理优化

对于大量组件的操作，系统实现了批处理优化:

```csharp
private void BatchToggleComponents<T>(List<T> components, bool enabled) where T : Behaviour
{
    if (components == null) return;

    // 批量操作前禁用不必要的事件
    var originalEventState = Physics.autoSimulation;
    Physics.autoSimulation = false;

    try
    {
        // 批量设置组件状态
        foreach (var component in components)
        {
            if (component != null)
            {
                component.enabled = enabled;
            }
        }
    }
    finally
    {
        // 恢复物理模拟
        Physics.autoSimulation = originalEventState;
    }
}
```

### 状态缓存机制

实现状态缓存减少重复检测:

```csharp
private Dictionary<DicomPlaneController, bool> visibilityCache = 
    new Dictionary<DicomPlaneController, bool>();
private float lastCacheUpdateTime = 0;
private const float CACHE_UPDATE_INTERVAL = 0.1f; // 100ms缓存有效期

private bool GetCachedVisibility(DicomPlaneController controller)
{
    float currentTime = Time.time;
    
    // 检查缓存是否过期
    if (currentTime - lastCacheUpdateTime > CACHE_UPDATE_INTERVAL)
    {
        visibilityCache.Clear();
        lastCacheUpdateTime = currentTime;
    }
    
    // 尝试从缓存获取
    if (visibilityCache.TryGetValue(controller, out bool cachedVisibility))
    {
        return cachedVisibility;
    }
    
    // 计算并缓存结果
    bool actualVisibility = IsPlaneVisible(controller);
    visibilityCache[controller] = actualVisibility;
    
    return actualVisibility;
}
```

### 异步状态更新

对于复杂场景，提供异步状态更新:

```csharp
public void SetAllVisibilityAsync(bool visible, System.Action onComplete = null)
{
    StartCoroutine(SetAllVisibilityCoroutine(visible, onComplete));
}

private IEnumerator SetAllVisibilityCoroutine(bool visible, System.Action onComplete)
{
    // 分帧处理大量平面
    if (extraPlanes != null)
    {
        int processedCount = 0;
        foreach (var plane in extraPlanes)
        {
            TogglePlaneController(plane, visible);
            processedCount++;
            
            // 每处理5个组件让出一帧
            if (processedCount % 5 == 0)
            {
                yield return null;
            }
        }
    }
    
    // 处理标准平面
    if (slice3DManager != null)
    {
        TogglePlaneController(slice3DManager.AxialPlane, visible);
        yield return null;
        
        TogglePlaneController(slice3DManager.SagittalPlane, visible);
        yield return null;
        
        TogglePlaneController(slice3DManager.CoronalPlane, visible);
        yield return null;
    }
    
    // 处理包围盒
    SetBoundingVisibility(visible);
    
    // 完成回调
    onComplete?.Invoke();
}
```

## 调试和监控

### 状态监控功能

系统提供完整的状态监控:

```csharp
[System.Serializable]
public struct VisibilityStatus
{
    public bool axialPlaneVisible;
    public bool sagittalPlaneVisible;
    public bool coronalPlaneVisible;
    public int extraPlanesVisible;
    public int boundingCollidersEnabled;
    public int boundingRenderersEnabled;
    public bool anyVisible;
}

public VisibilityStatus GetCurrentStatus()
{
    var status = new VisibilityStatus();
    
    if (slice3DManager != null)
    {
        status.axialPlaneVisible = IsPlaneVisible(slice3DManager.AxialPlane);
        status.sagittalPlaneVisible = IsPlaneVisible(slice3DManager.SagittalPlane);
        status.coronalPlaneVisible = IsPlaneVisible(slice3DManager.CoronalPlane);
    }
    
    if (extraPlanes != null)
    {
        status.extraPlanesVisible = extraPlanes.Count(plane => IsPlaneVisible(plane));
    }
    
    if (boundingColliders != null)
    {
        status.boundingCollidersEnabled = boundingColliders.Count(col => col != null && col.enabled);
    }
    
    if (boundingRenderers != null)
    {
        status.boundingRenderersEnabled = boundingRenderers.Count(ren => ren != null && ren.enabled);
    }
    
    status.anyVisible = AreAnyVisible();
    
    return status;
}
```