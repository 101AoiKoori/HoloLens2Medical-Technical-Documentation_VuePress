---
title: 内存与资源管理 
---
# 内存与资源管理 

Cache 模块通过以下方式控制内存占用并及时释放资源:

## 缓存上限与内存阈值

每个平面可配置最大缓存数量和内存上限。调用 `SetCacheSize(axial, sagittal, coronal)` 可调整这些参数，修改后会立即检查并修剪缓存。

当缓存数量或总占用超过 95% 阈值 (`_criticalMemoryPressureThreshold`) 时，会触发紧急淘汰。

## 清理缓存

调用 `ClearAllCaches()` 会清空所有缓存，但会自动保留当前屏幕显示的纹理并重新放入缓存。内部使用 `ClearCache` 遍历每个平面并销毁需要释放的纹理。

清理结束后会调用 `Resources.UnloadUnusedAssets()` 和 `GC.Collect()` 强制释放 GPU 和托管内存。

## 选择锁与最后有效纹理

在用户快速浏览切片时，可通过 `LockSelectionMode()` 激活选择锁，阻止缓存自动淘汰当前切片。锁期间，`GetTextureFromCache` 若找不到纹理，会使用 `_lastValidTextures` 中保存的最后有效纹理进行回退。

## 管理窗宽窗位

不同的 WL/WW 会生成不同的窗口键。调用 `SetCurrentWindowLevelKey(center, width)` 更新当前键后，旧键对应的纹理可以在下次清理时一起释放。

## 建议

* 在加载新序列或大量更改参数时调用 `ClearAllCaches()`，以避免遗留旧数据。
* 根据不同设备的内存容量合理配置每个平面的缓存大小。过大的缓存可能拖慢回收速度，过小则频繁触发生成。
* 在同步窗口宽窗位变化与纹理生成时，请确保及时更新当前窗口键，避免混用旧纹理。