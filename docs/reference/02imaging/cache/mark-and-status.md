---
title: 标记与状态管理
---

# 标记与状态管理

除了基础的添加和读取，缓存模块还提供了一组方法来标记纹理的状态，以影响后续的淘汰策略。本节介绍这些标记以及如何使用。

## MarkTextureAsActive

`void MarkTextureAsActive(PlaneType planeType, string cacheKey)`

将纹理标记为“活跃”意味着它正在被渲染或引用中。方法内部会增加引用计数，防止在使用过程中被错误淘汰。通常不需要显式调用，该方法在 `GetTextureFromCache()` 和 `AddTextureToCache()` 中会自动执行。

## MarkTextureAsVisible

`void MarkTextureAsVisible(PlaneType planeType, string cacheKey)`

当纹理被真正显示在界面上时，应当调用此方法。它会:

- 更新 `_currentDisplayedTextures` 中对应切面的键。
- 增加引用计数，使其权重更高，减少被淘汰的机会。
- 在缓存缺失时记录 `_lastValidTextures`，用于“选择锁”回退。

UI 层在每次显示某个切面的纹理时，可以调用此方法以保证体验平滑。

## MarkTextureAsPermanent

`void MarkTextureAsPermanent(PlaneType planeType, string cacheKey)`

将纹理加入永久集合后，它不会在自动淘汰中被删除，除非手动调用 `ClearAllCaches()`。此方法同时调用 `MarkTextureAsVisible()` 和 `MarkTextureAsActive()`，适合用于固定的参考纹理或快速浏览时锁定当前切片。

## RefreshAllCurrentTextures

当快速浏览切片或切换窗口宽窗位时，可以调用 `RefreshAllCurrentTextures()` 将所有当前显示的纹理标记为永久，并尝试恢复丢失的纹理。这有助于在高频交互中保持稳定的显示效果。

## 键与状态示例

```csharp
// 假设 axialKey 是当前轴向纹理的缓存键
cache.MarkTextureAsVisible(PlaneType.Axial, axialKey);

// 当暂停浏览或切换UI时，锁定当前显示的纹理
cache.MarkTextureAsPermanent(PlaneType.Axial, axialKey);

// 结束快速浏览后，刷新状态，以释放锁定
cache.RefreshAllCurrentTextures();
```