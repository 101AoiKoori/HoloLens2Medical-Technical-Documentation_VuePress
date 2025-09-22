---
title: 体数据缓存
---

# 体数据缓存

为提高生成冠状和矢状纹理的效率，`DicomTextureCreator` 支持在加载序列后一次性缓存体素数据。缓存机制分两步:

## CacheRawVolumeData

`void CacheRawVolumeData()`

读取整个序列，将每个切片解码为 16 位灰度值并存入 `_rawVolumeData[depth][row][column]`。完成后，可以从该数组中任意提取平面的像素。然而，未应用窗宽窗位前，像素值仍是原始灰度。

## CacheVolumeData

`void CacheVolumeData()`

根据当前窗宽窗位，将 `_rawVolumeData` 映射为 `_cachedVolumeData`，数据类型为 `Color32[]`。该数组在内存中按 `depth × rows × cols` 顺序排布，可以直接用于生成纹理。

调用示例:

```csharp
creator.CacheRawVolumeData();  // 只在加载序列时调用一次
creator.CacheVolumeData();     // 在每次调整窗宽窗位后调用
```

## 性能考虑

体数据缓存会占用较大的内存，但能显著提升冠状和矢状平面生成的速度。如果内存受限，可以在调用 `CreateCoronalTextureCoroutine()` 或 `CreateSagittalTextureCoroutine()` 前检查是否有必要再次缓存体数据。