# 可见性管理

## 原理解读

在三维场景中，除了二维切片的浏览，还需要控制正交平面和包围盒（用于交互的边框与碰撞体）的显隐。`MPRVisibilityController` 提供了一套接口，用于统一或分别控制这些对象的可见状态。核心思想是通过启用/禁用组件的 `enabled` 属性或激活/隐藏 GameObject，而不是销毁对象，从而保证重新显示时不需重新实例化。

* **统一切换**:`ToggleAllVisibility()` 判断当前是否有平面或包围盒处于显示状态，如果有则全部隐藏，否则全部显示。

* **单独切换平面**:`TogglePlanesVisibility()` 使用 `AnyPlaneVisible()` 判断是否有平面可见，随后调用 `SetPlanesVisibility(target)` 批量启用或禁用三个正交平面和自定义平面。

* **单独切换包围盒**:`ToggleBoundingVisibility()` 检查 `boundingColliders` 和 `boundingRenderers` 是否有任何启用，反转所有包围盒的状态。

* **批量设置状态**:
  * `SetAllVisibility(bool visible)` 同时设置平面和包围盒的显隐状态，分别调用 `SetPlanesVisibility` 和 `SetBoundingVisibility`。
  * `SetPlanesVisibility(bool visible)` 遍历 `slice3DManager` 中的轴向、矢状、冠状平面以及 `extraPlanes` 列表，调用内部的 `TogglePlaneController(controller, visible)` 逐个启用或禁用平面。
  * `SetBoundingVisibility(bool visible)` 遍历 `boundingColliders` 和 `boundingRenderers`，设置它们的 `enabled` 为 `visible`。

* **状态查询**:
  * `IsPlaneVisible(DicomPlaneController controller)` 判断单个平面是否可见:若平面对象激活则可见，否则检查其渲染器的 `enabled` 状态。
  * `AnyPlaneVisible()` 判断是否有至少一个平面可见，用于切换逻辑。
  * `AreAnyVisible()` 同时检查平面和包围盒，返回是否存在任何可见对象。

* **辅助方法**:`TogglePlaneController(DicomPlaneController controller, bool visible)` 设置单个平面的 `enabled` 属性并激活/隐藏其 `planeObject`；当平面从隐藏变为可见时调用 `ForceUpdateTexture()` 强制刷新贴图。

## 操作指南

1. **配置目标对象**:在场景中将 `DicomSlice3DManager` 赋值给 `MPRVisibilityController.slice3DManager`；若有自定义平面（如斜切面），可将其 `DicomPlaneController` 添加到 `extraPlanes` 列表。将需要显隐的 `Collider` 组件添加到 `boundingColliders`，将外框渲染组件（如线框的 `LineRenderer`）添加到 `boundingRenderers`。

2. **统一切换**:通过按钮或其他交互调用 `ToggleAllVisibility()` 可一次性显示或隐藏所有平面和包围盒。例如，在 `DicomUIController` 中“显隐控制”按钮点击事件会调用 `visibilityController.TogglePlanesVisibility()` 或 `ToggleBoundingVisibility()`。

3. **单独切换平面**:调用 `TogglePlanesVisibility()` 只影响平面不影响包围盒。若想在脚本中强制显示或隐藏平面，可调用 `SetPlanesVisibility(true/false)`。

4. **单独切换包围盒**:调用 `ToggleBoundingVisibility()` 或 `SetBoundingVisibility(bool)` 只影响包围盒，可在与平面独立控制时使用。

5. **查询可见状态**:在执行切换前，可通过 `AreAnyVisible()` 检查是否有任何对象可见，或通过 `AnyPlaneVisible()` 单独检查平面状态。例如:

```csharp
if (!visibilityController.AnyPlaneVisible())
{
    // 如果所有平面都隐藏，则执行某些逻辑
}
```

6. **自定义平面**:为 `extraPlanes` 添加自定义的 `DicomPlaneController` 后，调用 `SetPlanesVisibility` 或 `TogglePlanesVisibility` 将自动将它们纳入控制范围。若只想控制特定平面，可直接调用 `TogglePlaneController(controller, visible)`。

## 示例伪代码

```csharp
public class VisibilityExample : MonoBehaviour
{
    public MPRVisibilityController visibility;

    // 切换所有对象
    public void OnToggleAll()
    {
        visibility.ToggleAllVisibility();
    }

    // 单独隐藏包围盒
    public void HideBounding()
    {
        visibility.SetBoundingVisibility(false);
    }

    // 添加自定义平面并显示
    public void AddObliquePlane(DicomPlaneController oblique)
    {
        visibility.extraPlanes.Add(oblique);
        visibility.SetPlanesVisibility(true);
    }
}
```

通过以上方法，可以灵活控制 3D 场景中切片平面和交互包围盒的显隐，从而提升用户的观测效率。