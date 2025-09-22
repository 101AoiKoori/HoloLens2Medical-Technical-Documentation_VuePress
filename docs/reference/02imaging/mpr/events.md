---
title: 事件
---

# 事件

`MPRTextureManager` 使用事件与 UI 或其他模块通信，通知异步纹理生成完成。

## OnTextureCreated

`event Action<PlaneType, int> OnTextureCreated`

当一个异步请求的纹理生成完成并被加入缓存时触发。回调参数为切面类型和索引。收到事件后，可以通过 `GetTexture()` 获取最终纹理并更新界面。

```csharp
mpr.OnTextureCreated += (plane, idx) => {
    Texture2D tex = mpr.GetTexture(plane, idx);
    if (plane == PlaneType.Coronal) {
        coronalImage.texture = tex;
    }
};
```

注意:回调不会直接返回纹理，而是提供索引，开发者需要再调用 `GetTexture()` 以确保获取到最新纹理。

## 订阅与取消

事件订阅通常在组件启用时进行，在组件销毁或不再需要时取消订阅，以避免内存泄漏。

```csharp
void OnEnable() {
    mpr.OnTextureCreated += OnTextureReady;
}

void OnDisable() {
    mpr.OnTextureCreated -= OnTextureReady;
}

void OnTextureReady(PlaneType plane, int idx) {
    // 处理纹理完成
}
```