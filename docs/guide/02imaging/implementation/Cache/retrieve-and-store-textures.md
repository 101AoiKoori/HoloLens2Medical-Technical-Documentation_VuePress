# 缓存取用与存储 

本指南说明如何正确地从缓存获取纹理，并在生成新纹理后存入缓存。合理使用缓存可以显著提升切片浏览的流畅度。

## 获取纹理

调用 `GetTextureFromCache(planeType, key)` 从指定平面的缓存中取出纹理。方法内部会更新 LRU 链表、访问计数和最后访问时间，并标记该纹理为活跃和当前显示。

```csharp
DicomTextureCache cache = ...;
string cacheKey = cache.GetTextureCacheKey(DicomPlane.PlaneType.Axial, index);
Texture2D tex = cache.GetTextureFromCache(DicomPlane.PlaneType.Axial, cacheKey);
if (tex != null)
{
    // 使用缓存中的纹理
}
else
{
    // 缓存未命中，需生成纹理
}
```

如果当前切片在选择锁开启期间被回收，`GetTextureFromCache` 会尝试恢复 `_lastValidTextures` 中保存的最后有效纹理。

## 存入新纹理

当生成新的纹理后，使用 `AddTextureToCache(planeType, key, texture)` 存入缓存。方法内部会：

* 为窗口键建立索引；
* 在必要时触发紧急淘汰并修剪缓存；
* 更新 LRU 列表、访问计数和最后访问时间；
* 如果处于选择锁状态，则将纹理标记为永久；
* 将纹理标记为活跃和可见。

```csharp
// 生成纹理后
Texture2D newTex = slice.CreateTexture(center, width);
string key = cache.GetTextureCacheKey(DicomPlane.PlaneType.Axial, index);
cache.AddTextureToCache(DicomPlane.PlaneType.Axial, key, newTex);
```

## 管理纹理状态

* **MarkTextureAsActive**：增加活跃引用计数，当纹理正在被异步加载或用于生成其他平面时调用。
* **MarkTextureAsVisible**：标记纹理当前在 UI 上可见，并更新 `_currentDisplayedTextures`。
* **MarkTextureAsPermanent**：在选择锁期间调用，防止纹理被淘汰。