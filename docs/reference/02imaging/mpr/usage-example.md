---
title: 使用示例
---

# 使用示例

下面的示例演示如何使用 `MPRTextureManager` 在 Unity 场景中实现多平面重建:

```csharp
// 挂载管理器
MPRTextureManager mpr = gameObject.AddComponent<MPRTextureManager>();

// 设置缓存和生成器
var cache = new DicomTextureCache();
cache.SetCacheSize(150, 100, 100);
var creator = new DicomTextureCreator(series, sliceManager, cache, mapper);

// 监听 MPR 生成完成事件
mpr.OnTextureCreated += (plane, idx) => {
    var tex = mpr.GetTexture(plane, idx);
    switch (plane) {
        case PlaneType.Axial:
            axialImage.texture = tex;
            break;
        case PlaneType.Sagittal:
            sagittalImage.texture = tex;
            break;
        case PlaneType.Coronal:
            coronalImage.texture = tex;
            break;
    }
};

// 绑定序列
mpr.SetDicomSeries(series);

// 设置初始索引和窗宽窗位
mpr.SetCurrentIndices(0, 0, 0);
mpr.SetWindowLevel(series.DefaultWindowCenter, series.DefaultWindowWidth);

// 获取轴向纹理（同步返回）并显示
Texture2D axialTex = mpr.GetTexture(PlaneType.Axial, 0);
axialImage.texture = axialTex;

// 主动请求矢状与冠状纹理（异步）
mpr.RequestTexture(PlaneType.Sagittal, 0);
mpr.RequestTexture(PlaneType.Coronal, 0);

// 在用户拖动滑块时更新索引
void OnSliderChanged(int axialIdx, int sagittalIdx, int coronalIdx) {
    mpr.SetCurrentIndices(axialIdx, sagittalIdx, coronalIdx);
}
```

此流程展示了 MPR 模块的典型用法:绑定序列、设置索引和窗宽窗位、同步获取轴向纹理、异步请求其他平面，并在生成完成事件中更新 UI。