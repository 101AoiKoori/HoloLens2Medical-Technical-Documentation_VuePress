---
title: 显隐控制实现方案
---
# 显隐控制实现方案

## MPRVisibilityController架构

MPRVisibilityController实现了对3D多平面重建界面的统一显隐控制。与简单的GameObject.SetActive不同，该控制器采用组件级控制策略，避免影响对象的生命周期和事件系统。

### 组件级显隐策略

```csharp
/// <summary>
/// 切换平面控制器的显隐状态，只影响渲染器组件，不影响GameObject本身
/// </summary>
/// <param name="controller">平面控制器</param>
/// <param name="visible">目标显隐状态</param>
private void TogglePlaneController(DicomPlaneController controller, bool visible)
{
    if (controller == null) return;
    
    // 获取平面对象
    GameObject planeObject = controller.planeObject;
    if (planeObject == null) return;
    
    // 控制渲染器组件
    Renderer renderer = planeObject.GetComponent<Renderer>();
    if (renderer != null)
    {
        renderer.enabled = visible;
    }
    
    // 控制碰撞器组件（如果存在交互需求）
    Collider collider = planeObject.GetComponent<Collider>();
    if (collider != null)
    {
        collider.enabled = visible;
    }
}
```

**设计优势**:
- 保持GameObject激活状态，确保脚本继续运行
- 保持Transform层级结构完整
- 事件系统和协程不受影响
- 内存中的数据和状态得以保留

### 统一显隐接口

```csharp
/// <summary>
/// 设置三维切面和平面外框的统一显隐状态
/// </summary>
/// <param name="visible">是否显示</param>
public void SetAllVisibility(bool visible)
{
    SetPlanesVisibility(!anyPlaneVisible);
}

/// <summary>
/// 仅切换包围盒显隐，保持平面状态不变
/// </summary>
public void ToggleBoundingOnly()
{
    bool anyBoundingVisible = AreBoundingElementsVisible();
    SetBoundingVisibility(!anyBoundingVisible);
}

/// <summary>
/// 检查包围盒元素是否可见
/// </summary>
private bool AreBoundingElementsVisible()
{
    // 检查碰撞器状态
    foreach (var collider in boundingColliders)
    {
        if (collider != null && collider.enabled)
            return true;
    }
    
    // 检查渲染器状态
    foreach (var renderer in boundingRenderers)
    {
        if (renderer != null && renderer.enabled)
            return true;
    }
    
    return false;
}
```

## UI集成实现

### MRTK3按钮绑定

```csharp
// 在Unity Inspector中配置，或通过代码绑定
public void OnToggleButtonPressed()
{
    ToggleAllVisibility();
    
    // 可选:提供用户反馈
    if (AreAnyVisible())
    {
        Debug.Log("多平面重建界面已显示");
    }
    else
    {
        Debug.Log("多平面重建界面已隐藏");
    }
}
```

**按钮配置**:
- PressableButton的OnClicked事件
- 语音命令的回调函数
- 手势识别的响应方法
- 键盘快捷键的处理函数

### 状态持久化

```csharp
[Header("状态管理")]
[SerializeField] private bool rememberLastState = true;
private const string VISIBILITY_PREF_KEY = "MPR_Visibility_State";

void Start()
{
    if (rememberLastState)
    {
        bool lastState = PlayerPrefs.GetInt(VISIBILITY_PREF_KEY, 1) == 1;
        SetAllVisibility(lastState);
    }
}

public void SetAllVisibility(bool visible)
{
    SetPlanesVisibility(visible);
    SetBoundingVisibility(visible);
    
    // 保存状态
    if (rememberLastState)
    {
        PlayerPrefs.SetInt(VISIBILITY_PREF_KEY, visible ? 1 : 0);
    }
}
```

## 性能优化实现

### 批量操作优化

```csharp
/// <summary>
/// 批量设置多个渲染器的状态，减少逐一调用的开销
/// </summary>
private void SetRenderersEnabled(List<Renderer> renderers, bool enabled)
{
    for (int i = 0; i < renderers.Count; i++)
    {
        if (renderers[i] != null)
        {
            renderers[i].enabled = enabled;
        }
    }
}

/// <summary>
/// 批量设置多个碰撞器的状态
/// </summary>
private void SetCollidersEnabled(List<Collider> colliders, bool enabled)
{
    for (int i = 0; i < colliders.Count; i++)
    {
        if (colliders[i] != null)
        {
            colliders[i].enabled = enabled;
        }
    }
}
```

### 状态缓存机制

```csharp
// 缓存上次的可见状态，避免重复的状态查询
private bool? lastVisibilityState = null;

public bool AreAnyVisible()
{
    // 快速路径:如果状态未改变，返回缓存值
    if (lastVisibilityState.HasValue)
    {
        bool currentState = CheckActualVisibility();
        if (currentState == lastVisibilityState.Value)
        {
            return currentState;
        }
    }
    
    // 完整检查并更新缓存
    bool visible = CheckActualVisibility();
    lastVisibilityState = visible;
    return visible;
}

private void InvalidateVisibilityCache()
{
    lastVisibilityState = null;
}
```

## 扩展性设计

### 自定义显隐规则

```csharp
/// <summary>
/// 允许外部代码注册自定义的显隐控制对象
/// </summary>
public void RegisterCustomVisibilityTarget(MonoBehaviour target, System.Action<bool> setVisibility)
{
    if (customTargets == null)
        customTargets = new List<(MonoBehaviour, System.Action<bool>)>();
    
    customTargets.Add((target, setVisibility));
}

private List<(MonoBehaviour target, System.Action<bool> setVisibility)> customTargets;

private void ApplyCustomVisibility(bool visible)
{
    if (customTargets == null) return;
    
    for (int i = customTargets.Count - 1; i >= 0; i--)
    {
        var (target, setVisibility) = customTargets[i];
        
        if (target == null)
        {
            // 清理已销毁的目标
            customTargets.RemoveAt(i);
            continue;
        }
        
        try
        {
            setVisibility?.Invoke(visible);
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"执行自定义显隐控制时出错: {ex.Message}");
        }
    }
}
```

这种设计允许其他模块注册自定义的显隐控制逻辑，提供了良好的扩展性和模块解耦。Visibility(visible);
    SetBoundingVisibility(visible);
}

/// <summary>
/// 设置所有平面的显隐状态，不影响包围盒
/// </summary>
/// <param name="visible">是否显示平面</param>
public void SetPlanesVisibility(bool visible)
{
    // 通过DicomSlice3DManager管理的三个正交平面
    if (slice3DManager != null)
    {
        TogglePlaneController(slice3DManager.AxialPlane, visible);
        TogglePlaneController(slice3DManager.SagittalPlane, visible);
        TogglePlaneController(slice3DManager.CoronalPlane, visible);
    }
    
    // 额外的平面控制器
    foreach (var extraPlane in extraPlanes)
    {
        TogglePlaneController(extraPlane, visible);
    }
}
```

## 包围盒显隐管理

### MRTK3集成支持

```csharp
/// <summary>
/// 设置包围盒和边界控制的显隐状态
/// </summary>
/// <param name="visible">是否显示包围盒</param>
private void SetBoundingVisibility(bool visible)
{
    // 控制碰撞器组件
    foreach (var collider in boundingColliders)
    {
        if (collider != null)
        {
            collider.enabled = visible;
        }
    }
    
    // 控制渲染器组件  
    foreach (var renderer in boundingRenderers)
    {
        if (renderer != null)
        {
            renderer.enabled = visible;
        }
    }
}
```

**支持的包围盒类型**:
- MRTK3的Bounds Control组件
- 自定义线框渲染器
- 交互手柄和控制点
- 边界指示器和辅助几何体

### 状态查询机制

```csharp
/// <summary>
/// 检查是否有任何受控对象处于显示状态
/// </summary>
/// <returns>如果任一平面或包围盒可见则返回true</returns>
public bool AreAnyVisible()
{
    // 检查平面可见性
    if (slice3DManager != null)
    {
        if (IsPlaneVisible(slice3DManager.AxialPlane) ||
            IsPlaneVisible(slice3DManager.SagittalPlane) ||
            IsPlaneVisible(slice3DManager.CoronalPlane))
        {
            return true;
        }
    }
    
    // 检查额外平面
    foreach (var extraPlane in extraPlanes)
    {
        if (IsPlaneVisible(extraPlane))
        {
            return true;
        }
    }
    
    // 检查包围盒可见性
    return AreBoundingElementsVisible();
}

/// <summary>
/// 检查单个平面是否可见
/// </summary>
private bool IsPlaneVisible(DicomPlaneController controller)
{
    if (controller == null || controller.planeObject == null)
        return false;
    
    Renderer renderer = controller.planeObject.GetComponent<Renderer>();
    return renderer != null && renderer.enabled;
}
```

## 智能切换算法

### 状态感知切换

```csharp
/// <summary>
/// 切换所有受控对象的显隐状态
/// 如果当前任一平面或包围盒处于显示状态，则全部隐藏；否则全部显示
/// </summary>
public void ToggleAllVisibility()
{
    bool nextState = !AreAnyVisible();
    SetAllVisibility(nextState);
}
```

**切换逻辑**:
- 任何一个元素可见 → 全部隐藏
- 所有元素都隐藏 → 全部显示
- 提供直观的"显示/隐藏所有"功能

### 选择性控制接口

```csharp
/// <summary>
/// 仅切换平面显隐，保持包围盒状态不变
/// </summary>
public void TogglePlanesOnly()
{
    bool anyPlaneVisible = false;
    
    // 检查平面可见性
    if (slice3DManager != null)
    {
        anyPlaneVisible = IsPlaneVisible(slice3DManager.AxialPlane) ||
                         IsPlaneVisible(slice3DManager.SagittalPlane) ||
                         IsPlaneVisible(slice3DManager.CoronalPlane);
    }
    
    if (!anyPlaneVisible)
    {
        foreach (var extraPlane in extraPlanes)
        {
            if (IsPlaneVisible(extraPlane))
            {
                anyPlaneVisible = true;
                break;
            }
        }
    }
    
    ```csharp
    SetPlanesVisibility(!anyPlaneVisible);
}

/// <summary>
/// 仅切换包围盒显隐，保持平面状态不变
/// </summary>
public void ToggleBoundingOnly()
{
    bool anyBoundingVisible = AreBoundingElementsVisible();
    SetBoundingVisibility(!anyBoundingVisible);
}

/// <summary>
/// 检查包围盒元素是否有任何可见的
/// </summary>
private bool AreBoundingElementsVisible()
{
    // 检查碰撞器状态
    foreach (var collider in boundingColliders)
    {
        if (collider != null && collider.enabled)
        {
            return true;
        }
    }
    
    // 检查渲染器状态
    foreach (var renderer in boundingRenderers)
    {
        if (renderer != null && renderer.enabled)
        {
            return true;
        }
    }
    
    return false;
}
```

## UI集成实现

### MRTK3按钮绑定

```csharp
// 在Unity Inspector中配置，或通过代码绑定
public void OnToggleButtonPressed()
{
    ToggleAllVisibility();
    
    // 可选:提供用户反馈
    if (AreAnyVisible())
    {
        Debug.Log("多平面重建界面已显示");
    }
    else
    {
        Debug.Log("多平面重建界面已隐藏");
    }
}
```

**按钮配置**:
- PressableButton的OnClicked事件
- 语音命令的回调函数
- 手势识别的响应方法
- 键盘快捷键的处理函数

### 状态持久化

```csharp
[Header("状态管理")]
[SerializeField] private bool rememberLastState = true;
private const string VISIBILITY_PREF_KEY = "MPR_Visibility_State";

void Start()
{
    if (rememberLastState)
    {
        bool lastState = PlayerPrefs.GetInt(VISIBILITY_PREF_KEY, 1) == 1;
        SetAllVisibility(lastState);
    }
}

public void SetAllVisibility(bool visible)
{
    SetPlanesVisibility(visible);
    SetBoundingVisibility(visible);
    
    // 保存状态
    if (rememberLastState)
    {
        PlayerPrefs.SetInt(VISIBILITY_PREF_KEY, visible ? 1 : 0);
    }
}
```

## 性能优化实现

### 批量操作优化

```csharp
/// <summary>
/// 批量设置多个渲染器的状态，减少逐一调用的开销
/// </summary>
private void SetRenderersEnabled(List<Renderer> renderers, bool enabled)
{
    for (int i = 0; i < renderers.Count; i++)
    {
        if (renderers[i] != null)
        {
            renderers[i].enabled = enabled;
        }
    }
}

/// <summary>
/// 批量设置多个碰撞器的状态
/// </summary>
private void SetCollidersEnabled(List<Collider> colliders, bool enabled)
{
    for (int i = 0; i < colliders.Count; i++)
    {
        if (colliders[i] != null)
        {
            colliders[i].enabled = enabled;
        }
    }
}
```

### 状态缓存机制

```csharp
// 缓存上次的可见状态，避免重复的状态查询
private bool? lastVisibilityState = null;

public bool AreAnyVisible()
{
    // 快速路径:如果状态未改变，返回缓存值
    if (lastVisibilityState.HasValue)
    {
        bool currentState = CheckActualVisibility();
        if (currentState == lastVisibilityState.Value)
        {
            return currentState;
        }
    }
    
    // 完整检查并更新缓存
    bool visible = CheckActualVisibility();
    lastVisibilityState = visible;
    return visible;
}

private void InvalidateVisibilityCache()
{
    lastVisibilityState = null;
}
```

## 扩展性设计

### 自定义显隐规则

```csharp
/// <summary>
/// 允许外部代码注册自定义的显隐控制对象
/// </summary>
public void RegisterCustomVisibilityTarget(MonoBehaviour target, System.Action<bool> setVisibility)
{
    if (customTargets == null)
        customTargets = new List<(MonoBehaviour, System.Action<bool>)>();
    
    customTargets.Add((target, setVisibility));
}

private List<(MonoBehaviour target, System.Action<bool> setVisibility)> customTargets;

private void ApplyCustomVisibility(bool visible)
{
    if (customTargets == null) return;
    
    for (int i = customTargets.Count - 1; i >= 0; i--)
    {
        var (target, setVisibility) = customTargets[i];
        
        if (target == null)
        {
            // 清理已销毁的目标
            customTargets.RemoveAt(i);
            continue;
        }
        
        try
        {
            setVisibility?.Invoke(visible);
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"执行自定义显隐控制时出错: {ex.Message}");
        }
    }
}
```

这种设计允许其他模块注册自定义的显隐控制逻辑，提供了良好的扩展性和模块解耦。