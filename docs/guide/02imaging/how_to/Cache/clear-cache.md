# 清理缓存 

本页介绍如何手动清理缓存，以便释放内存或重新加载纹理。Cache 模块提供两种清理方式：

## 完全清理

调用 `ClearAllCaches()` 清空所有平面缓存，但会自动保留当前显示的纹理，然后重新放入缓存。

```csharp
// 获取 DicomTextureCache 实例
DicomTextureCache cache = ...;
// 清空所有缓存，保留当前视图
cache.ClearAllCaches();
```

清理后会立即调用资源卸载和垃圾回收，因此建议在非实时操作（如切换序列或关闭场景）时执行。

## 部分清理

如果只想清理某一个平面的缓存，可直接调用内部的 `ClearCache` 方法，但该方法是私有的。通常通过调整 `SetCacheSize` 的大小并让淘汰机制自动运行来实现。对于特定窗口键的纹理，可使用 `RemoveTextureByKey`，但同样是内部方法。

### 建议

* **切换 DICOM 序列** 时，先调用 `ClearAllCaches()`，再加载新序列。
* 如果需要确保 UI 不闪烁，可以在清理前调用 `LockSelectionMode()`，释放锁后再重建纹理。