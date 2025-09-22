---
title: 使用示例
---

# 使用示例

以下示例演示如何在生成纹理时与缓存模块配合工作，典型流程包括设置缓存大小、生成并存入纹理、渲染时读取缓存以及在切换数据时清理缓存。

```csharp
// 初始化缓存并配置大小
var cache = new DicomTextureCache();
cache.SetCacheSize(150, 100, 100);

// 初始化纹理生成器（依赖 DicomSeries 和其他组件）
// var creator = new DicomTextureCreator(series, sliceManager, cache, mapper);

// 在窗宽窗位改变时更新缓存键
float center = 40f, width = 400f;
cache.SetCurrentWindowLevelKey(center, width);

// 获取某一切面的纹理
int index = 50;
string key = cache.GetTextureCacheKey(PlaneType.Axial, index);
Texture2D tex = cache.GetTextureFromCache(PlaneType.Axial, key);
if (tex == null) {
    // 缓存中没有，从生成器获取并加入缓存
    tex = creator.GetAxialTexture(index);
    cache.AddTextureToCache(PlaneType.Axial, key, tex);
}
cache.MarkTextureAsVisible(PlaneType.Axial, key);

// 当切换到新的 DICOM 序列时，清空旧缓存
// cache.ClearAllCaches();
```

此示例展现了缓存模块的典型用法:先配置大小，再在需要时检查缓存、生成纹理、更新状态，最后在切换数据时清理。