---
title: 生成冠状与矢状纹理
---

# 生成冠状与矢状纹理

对于冠状（Coronal）和矢状（Sagittal）切面，`DicomTextureCreator` 提供异步生成方法，因为这些平面往往需要从 3D 体数据中提取。此过程比轴向切面更复杂。

## CreateCoronalTextureCoroutine

`IEnumerator CreateCoronalTextureCoroutine(int index)`

生成指定索引的冠状纹理。方法内部流程:

1. 尝试从缓存中查找该切片的纹理。
2. 如果 `_cachedVolumeData` 已准备好，则直接从体数据中抽取第 `index` 层的所有像素。
3. 如果体数据未准备，则回退到逐像素读取:从对应的轴向纹理中按列复制像素。
4. 生成纹理后，将其加入缓存，并通过 `OnTextureUpdated` 事件传递给 UI。

调用示例:

```csharp
StartCoroutine(creator.CreateCoronalTextureCoroutine(coronalIndex));
```

## CreateSagittalTextureCoroutine

`IEnumerator CreateSagittalTextureCoroutine(int index)`

矢状纹理的生成逻辑与冠状类似，不同之处在于从 3D 体数据提取的是另一方向的切片。如果体数据未缓存，也会回退到逐像素拼接。

```csharp
StartCoroutine(creator.CreateSagittalTextureCoroutine(sagittalIndex));
```

## 回退与性能

当 `_cachedVolumeData` 未准备或窗口宽窗位改变后，需要重新缓存体数据，否则异步生成会采用逐像素方式，效率较低。建议在加载序列后立即调用 `CacheRawVolumeData()` 和 `CacheVolumeData()`，并在调整窗宽窗位后重新缓存。