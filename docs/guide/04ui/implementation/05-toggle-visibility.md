# 切换平面与包围盒显隐

在三维可视化中，显示或隐藏切片平面和外框可以帮助用户聚焦于感兴趣的部分。UI 模块通过两个按钮调用 `MPRVisibilityController` 提供的显隐功能。

## 准备工作

1. 在 UI 面板中创建两个 `PressableButton`，命名为 **TogglePlanesButton** 和 **ToggleBoundingButton**，或在 `DicomUIController` 中手动引用。
2. 确保场景中存在 `MPRVisibilityController`，并在 `DicomUIController` 的 `visibilityController` 字段中设置引用（可通过 `autoFindUIElements` 自动查找）。
3. 在 `MPRVisibilityController` 中填写好 `slice3DManager`、`extraPlanes`、`boundingColliders` 和 `boundingRenderers` 等字段，确保能够控制正确的对象。

## 操作流程

1. **显示或隐藏三维切面**：
   - 单击 **TogglePlanesButton** 会触发 UI 控制器内联的委托，调用 `visibilityController.TogglePlanesVisibility()`。
   - `TogglePlanesVisibility()` 检查当前是否有平面可见（通过内部的 `AnyPlaneVisible()`）。若至少有一个平面显示，则全部隐藏；否则全部显示。
   - 平面显隐通过 `SetActive()` 控制 `planeObject`，同时禁用或启用控制器本身以暂停更新。

2. **显示或隐藏包围盒**：
   - 单击 **ToggleBoundingButton** 会调用 `visibilityController.ToggleBoundingVisibility()`。
   - 该方法遍历 `boundingColliders` 和 `boundingRenderers`，如果有任何一个组件处于启用状态，则全部禁用；否则全部启用。这适用于 MRTK3 的 Bounds Control 之类的外框显示。

3. **统一切换**：
   - 若需要一个按钮同时控制平面和包围盒，可将其点击事件绑定到 `ToggleAllVisibility()`。该方法调用 `AreAnyVisible()` 判断是否有平面或包围盒处于显示状态，并将所有对象的状态取反。

## 使用建议

* 在多平面重建场景中，可将三维切面默认隐藏，通过按钮按需显示，提高初始加载速度。
* 包围盒通常用于操纵或缩放对象，如无需频繁调整可默认隐藏，使用按钮临时显示。
* 若添加自定义平面（斜切面等），请将其控制器添加到 `extraPlanes` 列表中，这样显隐逻辑会自动纳入统一管理。

通过简单的按钮交互，用户即可自定义视图显示方式，让三维可视化更加灵活。
