# 获取轴向纹理 

本页介绍如何通过 `DicomTextureCreator` 获取轴向纹理，并在纹理生成完成后更新 UI。

## 步骤

1. **实例化 Creator**：确保已经创建 `DicomTextureCreator` 实例并绑定 `DicomSeries`、`DicomSliceManager`、`DicomTextureCache` 和 `DicomCoordinateMapper`。参见其他模块的初始化说明。
2. **生成缓存键并查询缓存**：调用 `GetAxialTexture(index, center, width)` 会自动生成缓存键并检查缓存。
3. **生成纹理**：如果缓存未命中，内部会调用 `DicomSlice.CreateTexture()` 生成新的 `Texture2D` 并存入缓存。
4. **处理返回值**：当方法返回非空纹理时，表示纹理已准备好；如果返回 `null`，说明索引无效或 DICOM 数据尚未准备好。
5. **订阅事件**：可以订阅 `OnTextureUpdated` 事件，在纹理生成后收到回调并刷新 RawImage 或其他 UI 元素。

## 示例

```csharp
// 创建 DicomTextureCreator 实例
var creator = new DicomTextureCreator(series, sliceManager, cache, mapper);

// 设置窗宽窗位
creator.SetWindowLevel(center, width);

// 获取第 50 张轴向纹理
Texture2D tex = creator.GetAxialTexture(50, center, width);
if (tex != null)
{
    rawImage.texture = tex;
}
// 订阅纹理更新事件
creator.OnTextureUpdated += (plane, idx, texture) =>
{
    if (plane == DicomPlane.PlaneType.Axial && idx == 50)
    {
        rawImage.texture = texture;
    }
};
```

如果需要异步批量加载，请参阅《预加载轴向纹理》。