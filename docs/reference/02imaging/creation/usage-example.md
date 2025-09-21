---
title: 使用示例
---

# 使用示例

以下示例演示如何使用 `DicomTextureCreator` 完成从加载序列到生成纹理的全过程。

```csharp
// 初始化组件
var cache = new DicomTextureCache();
cache.SetCacheSize(150, 100, 100);

var creator = new DicomTextureCreator(series, sliceManager, cache, mapper);

// 缓存原始体数据
creator.CacheRawVolumeData();
creator.CacheVolumeData();

// 设置初始窗宽窗位
creator.SetWindowLevel(series.DefaultWindowCenter, series.DefaultWindowWidth);

// 同步获取轴向纹理
int axialIndex = 25;
Texture2D axialTex = creator.GetAxialTexture(axialIndex);
axialImage.texture = axialTex;

// 异步获取冠状纹理
int coronalIndex = 40;
StartCoroutine(creator.CreateCoronalTextureCoroutine(coronalIndex));

// 监听纹理更新事件
creator.OnTextureUpdated += (plane, idx, tex) => {
    if (plane == DicomPlane.PlaneType.Coronal && idx == coronalIndex) {
        coronalImage.texture = tex;
    }
};

// 调整窗宽窗位时刷新体数据
void OnSliderChanged(float center, float width) {
    creator.SetWindowLevel(center, width);
}
```

此示例展示了如何在加载 DICOM 序列后缓存体数据、生成不同切面纹理，并在 UI 层响应事件。