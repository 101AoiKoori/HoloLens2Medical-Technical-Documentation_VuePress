---
title: 添加与获取纹理
---

# 添加与获取纹理

缓存模块的核心操作是存入纹理和从缓存中读取纹理。本节介绍相关接口及其内部逻辑。

## 添加纹理

使用 `AddTextureToCache(PlaneType planeType, string cacheKey, Texture2D texture)` 可以将新生成的纹理加入缓存。在执行过程中，它会：

1. 判断是否已存在同名键，若存在则替换并正确处理旧纹理的销毁。
2. 检查是否达到内存或数量上限，若超出则根据淘汰策略移除得分最低的纹理。
3. 将纹理存入指定切面的字典，更新 LRU 列表、使用计数和最后访问时间，并将纹理标记为当前显示且活跃。

```csharp
string key = cache.GetTextureCacheKey(PlaneType.Axial, sliceIndex);
cache.AddTextureToCache(PlaneType.Axial, key, newTexture);
```

该方法内部还会在窗口宽窗位键映射表中记录键值，以便在窗口调整时批量更新。

## 获取纹理

`Texture2D GetTextureFromCache(PlaneType planeType, string cacheKey)` 用于读取缓存中的纹理：

- 如果缓存中存在且不为空，则更新 LRU 列表、使用计数和最后访问时间，并返回纹理。
- 如果处于“选择锁”状态且不存在缓存，则尝试使用上一个有效纹理回退，避免界面出现黑屏。
- 如果无法找到，则返回 `null`，调用者应当继续生成纹理。

```csharp
Texture2D cachedTex = cache.GetTextureFromCache(PlaneType.Coronal, key);
if (cachedTex != null) {
    // 使用缓存纹理
} else {
    // 生成新纹理并加入缓存
}
```

## 判断存在

使用 `HasTextureInCache(PlaneType planeType, string cacheKey)` 可以在不更新 LRU 的情况下检查某个键是否已缓存，常用于决定是否需要生成纹理。