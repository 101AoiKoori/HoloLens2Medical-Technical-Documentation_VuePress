# MPRVisibilityController 原理解读

`MPRVisibilityController` 提供了切换三维切片平面及其外框可视化的统一方法。与旧版脚本不同，它不会直接禁用或销毁 GameObject，而是控制渲染器、碰撞体和控制器组件的启用状态，从而避免破坏对象的生命周期和加载流程。

## 数据成员

| 字段                        | 说明 |
|-----------------------------|------|
| `slice3DManager`            | 引用 `DicomSlice3DManager`，用于获取轴向、矢状和冠状平面的控制器。 |
| `extraPlanes`               | 存放自定义平面控制器（`DicomPlaneController`），例如斜切面。 |
| `boundingColliders`         | 需要隐藏/显示的外框 `Collider` 组件集合，例如 MRTK3 Bounds Control 使用的 `BoxCollider`。 |
| `boundingRenderers`         | 用于显示包围盒可视化（线框或网格）的 `Renderer` 集合。 |

## 公共方法

### ToggleAllVisibility()

该方法检查是否有任何平面或包围盒正在显示（通过调用 `AreAnyVisible()`），然后将所有受控对象切换到相反的状态。当需要快速全部隐藏或全部显示时，可将此方法绑定到单个按键。

### SetAllVisibility(bool visible)

同时设置平面和包围盒的显隐状态。它分别调用 `SetPlanesVisibility(visible)` 和 `SetBoundingVisibility(visible)`。

### SetPlanesVisibility(bool visible)

按给定状态控制所有平面的显隐：

1. 通过 `slice3DManager` 获取轴向 (`AxialPlane`)、矢状 (`SagittalPlane`) 和冠状 (`CoronalPlane`) 平面的 `DicomPlaneController`，调用内部 `TogglePlaneController(controller, visible)`。
2. 遍历 `extraPlanes` 列表，为每个自定义平面调用相同方法。

### SetBoundingVisibility(bool visible)

遍历 `boundingColliders` 集合，将每个 `Collider` 的 `enabled` 设置为 `visible`；遍历 `boundingRenderers` 集合，将每个 `Renderer` 的 `enabled` 设置为 `visible`。与平面控制不同，外框不通过 `GameObject.SetActive()` 控制，而是直接启用或禁用碰撞体/渲染器。

### TogglePlanesVisibility()

若任意平面当前可见，则隐藏所有平面；否则显示所有平面。该逻辑由 `AnyPlaneVisible()` 判断是否存在可见平面。

### ToggleBoundingVisibility()

检测 `boundingColliders` 或 `boundingRenderers` 中是否有可见对象，随后调用 `SetBoundingVisibility(!anyVisible)` 进行反转。这样可以单独控制包围盒而不影响平面显示。

### AreAnyVisible()

判断是否有任何平面、碰撞体或渲染器处于显示状态。它按以下顺序检查：

1. 使用 `slice3DManager` 和 `extraPlanes` 依次调用 `IsPlaneVisible(controller)` 判断平面是否可见。如果平面对象的 `GameObject.activeSelf` 为真，则认为可见；否则根据渲染器的 `enabled` 状态判断。
2. 遍历 `boundingColliders`，若有任一碰撞体 `enabled == true` 则返回 true。
3. 遍历 `boundingRenderers`，若有任一渲染器 `enabled == true` 则返回 true。

若全部检查都不满足，则返回 false。

## 内部工具方法

### TogglePlaneController(DicomPlaneController controller, bool visible)

该方法仅用于私有内部调用，它控制单个平面的显隐逻辑：

1. 将控制器本身的 `enabled` 设置为 `visible`，这会暂停或恢复其 `Update()` 调用，但不会禁用 GameObject。
2. 若控制器拥有 `planeObject`（一般为平面的 Quad 或 Mesh），则通过 `planeObject.SetActive(visible)` 控制其显示。使用激活状态可避免 `SetTexture()` 强制启用渲染器。
3. 当恢复可见时，调用 `ForceUpdateTexture()` 更新纹理，确保显示最新切片。

### IsPlaneVisible(DicomPlaneController controller)

判断某个平面当前是否可见：

* 首先检查 `planeObject.activeSelf` 是否为真；若为空则视为不可见。
* 若没有 `planeObject`，则查找子物体的 `Renderer`，若存在且 `enabled == true` 则视为可见。

### AnyPlaneVisible()

仅检查平面是否可见，不考虑包围盒。在 `TogglePlanesVisibility()` 中用于决定是否需要隐藏或显示所有平面。

## 总结

`MPRVisibilityController` 通过组件级的开关控制提供了细粒度的显隐策略。它既可以统一切换所有平面和包围盒，也支持分开控制平面与包围盒。与 UI 模块配合时，用户通过按钮即可快速控制三维视图的显示状态，且不会打断对象的生命周期或加载逻辑。
