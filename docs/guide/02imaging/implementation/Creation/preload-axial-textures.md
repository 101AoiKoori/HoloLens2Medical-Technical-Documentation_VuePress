# 预加载轴向纹理 

当用户快速拖动滑块浏览切片时，实时生成纹理可能导致卡顿。通过预加载周围一段范围内的轴向纹理，可以显著提升浏览流畅度。

## 同步预加载

使用 `PreloadAxialTextures(center, width, startIndex, endIndex)` 同步加载一段连续切片。该方法适合在资源加载阶段或较小范围内预加载。

```csharp
// 预加载第 30 到 50 张轴向纹理
creator.PreloadAxialTextures(center, width, 30, 50);
```

## 异步批量预加载

`PreloadAxialTexturesCoroutine(center, width)` 会将全部切片分批加载，每批默认 10 张，并在每批之间等待一帧。这可避免阻塞主线程。用法如下：

```csharp
StartCoroutine(creator.PreloadAxialTexturesCoroutine(center, width));
```

可以根据项目需要修改批量大小。

## 注意事项

* 预加载会占用缓存，并可能触发淘汰。务必合理设置缓存上限。
* 在低内存平台上，可根据当前索引动态预加载附近的少数切片，而非整套数据。