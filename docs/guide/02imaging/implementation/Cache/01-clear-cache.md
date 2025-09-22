---
title: 清理缓存
---
# 清理缓存

本页说明如何清理DicomTextureCache中的纹理缓存，释放内存并重置缓存状态。

## 完全清理缓存

`ClearAllCaches()` 方法清空所有平面的缓存，但会自动保留当前显示的纹理以避免UI闪烁。

```csharp
// 获取缓存实例
DicomTextureCache cache = GetComponent<DicomTextureCache>();

// 清空所有缓存，保留当前显示的纹理
cache.ClearAllCaches();
```

该方法的执行步骤:

1. **保存当前显示纹理**:遍历 `_currentDisplayedTextures`，将正在显示的纹理暂存
2. **清理所有缓存**:调用内部 `ClearCache()` 方法清空三个平面的缓存字典和LRU链表
3. **重置统计数据**:清空 `_textureSizes`、`_usageCounter`、`_lastAccessTime` 等统计字典
4. **恢复显示纹理**:将暂存的纹理重新放入对应缓存，并设置高优先级
5. **释放资源**:调用 `Resources.UnloadUnusedAssets()` 和 `GC.Collect()` 强制释放GPU和托管内存

## 内部清理机制

内部 `ClearCache()` 方法处理单个平面的缓存清理:

```csharp
private void ClearCache(Dictionary<string, Texture2D> cache, LinkedList<string> lruList,
                      Dictionary<DicomPlane.PlaneType, Texture2D> texturesToPreserve = null)
{
    // 收集需要销毁的纹理
    List<Texture2D> texturesToDestroy = new List<Texture2D>();
    
    foreach (var kvp in cache)
    {
        if (纹理不需要保留)
        {
            texturesToDestroy.Add(kvp.Value);
        }
    }
    
    // 清空缓存或保留指定纹理
    // 销毁收集的纹理对象
}
```

该方法通过比较纹理引用来判断是否需要保留，确保当前显示的纹理不被意外销毁。

## 自动缓存修剪

当缓存数量或内存占用超过阈值时，`CheckAndTrimCache()` 会自动触发修剪:

```csharp
private void CheckAndTrimCache()
{
    if (_selectionLockActive) return; // 选择锁期间不执行修剪
    
    // 检查每个平面是否超限
    if (_axialTextureCache.Count > _axialCacheMaxSize || 
        _axialTotalSize > _axialMemoryLimit)
    {
        TrimCacheToFitLimits(_axialTextureCache, _axialLRU, 
                           ref _axialTotalSize, _axialCacheMaxSize, _axialMemoryLimit);
    }
    // 矢状面和冠状面的检查...
}
```

修剪时会将缓存降至80%的目标值，为后续添加留出空间。

## 使用建议

- **切换序列时**:调用 `ClearAllCaches()` 确保旧数据不占用内存
- **内存压力时**:配合内存监控使用，在检测到压力时主动清理
- **避免频繁调用**:清理操作开销较大，应在适当时机进行
- **选择锁期间**:修剪会被暂停，避免清理用户正在查看的纹理

清理操作完成后，缓存状态完全重置，后续纹理请求会重新生成并填充缓存。