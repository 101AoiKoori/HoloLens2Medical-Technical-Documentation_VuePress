---
title: 缓存大小与清理
---

# 缓存大小与清理

缓存容量和清理策略是 `DicomTextureCache` 的核心功能之一。本节介绍如何配置缓存大小以及如何主动或被动地清理缓存。

## 设置缓存大小

通过 `SetCacheSize(int axialSize, int sagittalSize, int coronalSize)` 可以为每个切面配置最大缓存数量。该方法还会按比例自动计算每个切面的内存上限，并在必要时触发缓存收缩。

```csharp
// 创建缓存并配置每个切面的最大存储数量
var cache = new DicomTextureCache();
cache.SetCacheSize(axialSize: 150, sagittalSize: 100, coronalSize: 100);
```

- **axialSize**:轴向切片的最大缓存数。
- **sagittalSize**:矢状切片的最大缓存数。
- **coronalSize**:冠状切片的最大缓存数。

内部会根据设定值计算 `_axialCacheMaxSize` 等字段，并将每个缓存槽位对应的内存上限设置为固定倍数。例如，轴向切片的上限是 `512 * 1024L * axialSize` 字节。调用后还会检查现有缓存是否超过新限制并进行收缩。

## 清除缓存

### ClearAllCaches()

`ClearAllCaches()` 会删除所有切面的缓存项，但会保留当前正在显示的纹理，防止界面闪烁。内部逻辑如下:

1. 遍历 `_currentDisplayedTextures` 保存当前显示的纹理以及其切面。
2. 调用内部方法 `ClearCache()` 分别清空轴向、矢状和冠状的缓存，并重置各种统计信息。
3. 将第一步中保存的纹理重新放入缓存并标记为永久，防止在下一次淘汰时被删除。

```csharp
// 切换数据源或释放内存时调用
cache.ClearAllCaches();
```

调用该方法后还会通过 `Resources.UnloadUnusedAssets()` 和 `GC.Collect()` 强制回收未使用的纹理资源。

## 自动清理

当缓存数量或内存超过设定限制时，会自动触发淘汰策略；该逻辑由 `AddTextureToCache()` 内部完成，详见下一节。