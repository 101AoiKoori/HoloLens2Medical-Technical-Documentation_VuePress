---
title: 轴向纹理生成 
---
# 轴向纹理生成 

轴向切片是三维体数据的原始顺序。`GetAxialTexture(index, center, width)` 完成以下步骤:

1. **索引验证**:确保索引在有效范围内，并且存在切片。
2. **生成缓存键**:调用 `GetWindowLevelKey` 和 `GetTextureCacheKey` 组合出唯一键。
3. **查询缓存**:如果缓存命中，则直接返回纹理。
4. **解码切片**:通过 `DicomSlice.CreateTexture()` 读取 PixelData 并应用窗宽窗位。
5. **存入缓存并通知**:使用 `AddTextureToCache` 存储纹理，并触发 `OnTextureUpdated` 事件。

## 批量预加载

为提升滚动切片时的流畅度，可以调用 `PreloadAxialTextures(center, width, startIndex, endIndex)` 逐一生成并缓存指定范围内的轴向纹理。该方法同步执行，适用于小范围预加载。

对于大量切片，建议使用协程版本 `PreloadAxialTexturesCoroutine(center, width)`，它每次处理一个批次并在下一帧继续。典型用法:

```csharp
// 在 MonoBehaviour 上启动协程
StartCoroutine(textureCreator.PreloadAxialTexturesCoroutine(center, width));
```

### 注意事项

* 预加载会占用缓存，请确保已合理设置缓存上限。
* 生成纹理前会再次检查缓存，因此重复调用不会重复生成相同纹理。