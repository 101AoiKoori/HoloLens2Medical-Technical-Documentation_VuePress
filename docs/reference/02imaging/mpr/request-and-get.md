---
title: 请求与获取纹理
---

# 请求与获取纹理

MPR 管理器提供两种方法来获取切片纹理:同步查询和异步请求。本节介绍这两种方法的差异和用法。

## GetTexture

`Texture2D GetTexture(PlaneType plane, int index)`

尝试返回指定切面的纹理。如果满足以下条件，将同步返回纹理:

- 对于轴向平面，当前切片已在缓存中或可以快速生成。
- 对于矢状或冠状平面，纹理已经生成并缓存。

如果纹理尚未生成，则方法会加入请求队列并立即返回 `null`。UI 可根据返回值决定是否显示加载指示。

```csharp
Texture2D tex = mpr.GetTexture(PlaneType.Axial, currentIndex);
if (tex != null) {
    image.texture = tex;
} else {
    // 显示加载动画
}
```

## RequestTexture

`void RequestTexture(PlaneType plane, int index)`

向请求队列主动添加一个任务。这在需要预加载附近切片时很有用，例如在拖动滚动条时可以提前请求下一帧的纹理。

```csharp
mpr.RequestTexture(PlaneType.Sagittal, nextIndex);
```

请求队列会根据当前索引和任务优先级排序，高优先级的请求会先生成。管理器内部还会去重，避免重复请求。

## IsSliceLoading

`bool IsSliceLoading(PlaneType plane, int index)`

检查指定切片是否在请求队列或正在生成中。常用于控制 UI 的加载提示。

## 生成完成回调

对于异步生成的纹理，管理器通过 `OnTextureCreated` 事件通知外部。详情见事件章节。