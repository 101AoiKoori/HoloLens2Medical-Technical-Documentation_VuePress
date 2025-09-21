# 获取纹理并管理请求 

使用 MPR 管理器获取纹理时，它会优先查询缓存；若未命中，则根据优先级将请求加入队列。

## 步骤

```csharp
// 获取 MPRTextureManager 实例
var mpr = GetComponent<MPRTextureManager>();

// 设置当前窗宽窗位（可选，若未设置则使用 DicomSeries 默认值）
mpr.SetWindowLevel(center, width);

// 设置当前索引（可选，用于计算优先级）
mpr.SetCurrentIndices(axialIndex, sagittalIndex, coronalIndex);

// 获取纹理
Texture2D tex = mpr.GetTexture(DicomPlane.PlaneType.Axial, axialIndex);
if (tex != null)
{
    rawImage.texture = tex;
}
// 如果返回 null，则异步生成会在稍后回调 OnTextureCreated 事件
mpr.OnTextureCreated += (plane, idx) => {
    if (plane == DicomPlane.PlaneType.Axial && idx == axialIndex)
    {
        rawImage.texture = mpr.GetTexture(plane, idx);
    }
};
```

## 说明

* 如果请求的是当前显示的切片，`MPRTextureManager` 会尝试同步生成。
* 如果缓存未命中并且不是当前切片，则请求会加入队列，按照优先级排序。
* 设置当前索引后，内部会调用 `UpdateRequestPriorities()` 调整队列。
* 请求完成时，通过 `OnTextureCreated` 事件通知调用者，需再次调用 `GetTexture()` 获取纹理并显示。