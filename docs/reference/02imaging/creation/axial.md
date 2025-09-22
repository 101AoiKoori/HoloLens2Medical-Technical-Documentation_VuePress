---
title: 生成轴向纹理
---

# 生成轴向纹理

轴向切面是 DICOM 序列中常见的原始平面。`DicomTextureCreator` 提供了同步和异步两种方式来获取轴向纹理。

## GetAxialTexture

`Texture2D GetAxialTexture(int index)`

同步返回序列中第 `index` 个轴向切片的纹理。具体流程如下:

1. 尝试从 `DicomTextureCache` 中获取该切片的纹理，如果存在则直接返回。
2. 如果缓存不存在，则调用 `DicomSlice.CreateTexture()` 读取切片数据、应用窗宽窗位并生成 `Texture2D`。
3. 生成完成后，将纹理加入缓存，并触发 `OnTextureUpdated` 事件。

```csharp
// 获取第 10 个轴向切片的纹理
Texture2D axialTex = creator.GetAxialTexture(10);
if (axialTex != null) {
    rawImage.texture = axialTex;
}
```

## PreloadAxialTextures

`IEnumerator PreloadAxialTextures(int startIndex, int endIndex)`

异步预加载 `[startIndex, endIndex]` 区间内的轴向纹理。协程会逐一调用 `GetAxialTexture()` 并适当让出控制权，避免阻塞主线程。可以结合进度条或回调函数实现加载动画。

```csharp
StartCoroutine(creator.PreloadAxialTextures(0, 50));
// 可在协程内部更新进度
```