---
title: MPRVisibilityController 原理解读
---
# MPRVisibilityController 原理解读

`MPRVisibilityController` 隶属于 `MedicalMR.DICOM.UI` 命名空间，提供了切换三维切片平面及其外框可视化的统一方法。与传统的GameObject激活/停用方式不同，它采用组件级的启用/禁用策略，避免破坏对象的生命周期和加载流程。

## 设计理念

### 组件级控制策略
传统的`GameObject.SetActive(false)`会完全停用对象，导致以下问题:
* 中断正在进行的协程和更新循环
* 破坏组件间的引用关系
* 影响数据加载和初始化流程

MPRVisibilityController采用更精细的组件级控制:
* 控制`Renderer.enabled`实现视觉隐藏
* 控制`Collider.enabled`禁用交互
* 控制`DicomPlaneController.enabled`暂停更新逻辑
* 保持GameObject激活状态维护组件生命周期

### 分离控制机制
系统将显隐控制分为两个独立子系统:

1. **平面控制子系统**:管理三维切片平面的显隐
   - 轴向、矢状、冠状三个正交平面
   - 额外的自定义切面（如斜切面）
   - 支持批量操作和单独控制

2. **包围盒控制子系统**:管理MRTK3外框的显隐
   - BoxCollider交互控制
   - 线框或网格渲染器显示
   - 支持多个包围盒组件并发管理

## 数据结构设计

### 引用管理
脚本维护四个核心引用集合:

```csharp
[SerializeField] private DicomSlice3DManager slice3DManager;
[SerializeField] private List<DicomPlaneController> extraPlanes;
[SerializeField] private List<Collider> boundingColliders;
[SerializeField] private List<Renderer> boundingRenderers;
```

* **slice3DManager**:访问标准三正交平面的统一入口
* **extraPlanes**:扩展平面支持，如自定义角度切面
* **boundingColliders**:MRTK3 Bounds Control的交互组件
* **boundingRenderers**:包围盒的视觉表示组件

### 状态查询机制
系统实现多层次的状态查询:

1. **单个组件状态**:`IsPlaneVisible(controller)`检查个体显示状态
2. **子系统状态**:`AnyPlaneVisible()`检查平面子系统状态
3. **全局状态**:`AreAnyVisible()`检查整个系统状态

## 核心算法实现

### 平面显隐控制
`TogglePlaneController()`实现精细的平面控制:

```csharp
private void TogglePlaneController(DicomPlaneController controller, bool visible)
{
    if (controller == null) return;

    // 控制器本身的启用状态
    controller.enabled = visible;

    // 平面对象的激活状态
    if (controller.planeObject != null)
    {
        controller.planeObject.SetActive(visible);
    }

    // 重新显示时强制更新纹理
    if (visible)
    {
        try
        {
            controller.ForceUpdateTexture();
        }
        catch (System.Exception)
        {
            // 忽略隐藏期间调用产生的异常
        }
    }
}
```

### 状态切换逻辑
`TogglePlanesVisibility()`采用"全有或全无"的切换策略:

```csharp
public void TogglePlanesVisibility()
{
    bool target = !AnyPlaneVisible(); // 如果任何平面可见则隐藏全部
    SetPlanesVisibility(target);      // 否则显示全部
}
```

这种设计确保用户操作的一致性和可预测性。

### 包围盒控制算法
包围盒控制采用组件遍历策略:

```csharp
public void SetBoundingVisibility(bool visible)
{
    // 控制碰撞体
    if (boundingColliders != null)
    {
        foreach (var col in boundingColliders)
        {
            if (col != null) col.enabled = visible;
        }
    }

    // 控制渲染器
    if (boundingRenderers != null)
    {
        foreach (var ren in boundingRenderers)
        {
            if (ren != null) ren.enabled = visible;
        }
    }
}
```

## 状态检测实现

### 平面可见性检测
`IsPlaneVisible()`采用分层检测策略:

1. **优先检查平面对象**:如果存在`planeObject`则检查其`activeSelf`状态
2. **回退到渲染器检测**:如果无平面对象则查找子级Renderer的enabled状态
3. **容错处理**:空引用自动返回false，避免异常中断

### 复合状态检测
`AreAnyVisible()`实现短路求值优化:

```csharp
public bool AreAnyVisible()
{
    // 检查标准平面（短路求值）
    if (slice3DManager != null)
    {
        if (IsPlaneVisible(slice3DManager.AxialPlane)) return true;
        if (IsPlaneVisible(slice3DManager.SagittalPlane)) return true;
        if (IsPlaneVisible(slice3DManager.CoronalPlane)) return true;
    }

    // 检查额外平面
    if (extraPlanes != null)
    {
        foreach (var plane in extraPlanes)
        {
            if (IsPlaneVisible(plane)) return true;
        }
    }

    // 检查包围盒组件
    // ...

    return false;
}
```

## 扩展性设计

### 自定义平面支持
通过`extraPlanes`列表，系统支持任意数量的自定义切面:
* 斜切面（Oblique Plane）
* 曲面重建（Curved Reformation）
* 多角度投影（Multi-angle Projection）

### MRTK3集成优化
针对MRTK3的Bounds Control优化了包围盒控制:
* 分离碰撞体和渲染器控制，支持仅显示不可交互
* 支持多个包围盒并发管理
* 兼容不同类型的包围盒可视化组件

### 性能优化考虑
* 使用null检查避免Missing Reference异常
* 采用短路求值减少不必要的组件遍历
* 延迟纹理更新直到显示时才执行