---
title: 事件
---

# 事件

`DicomTextureCreator` 在生成纹理或调整窗宽窗位时，会通过事件通知监听者。使用这些事件可以在 UI 层及时更新图像和进度。

## OnWindowLevelChanged

`event Action<float, float> OnWindowLevelChanged`

当 `SetWindowLevel()` 成功更新窗宽窗位后触发，参数为新的窗位和窗宽。UI 可以根据此事件更新滑块的显示值。

```csharp
creator.OnWindowLevelChanged += (center, width) => {
    windowCenterLabel.text = center.ToString();
    windowWidthLabel.text = width.ToString();
};
```

## OnTextureUpdated

`event Action<DicomPlane.PlaneType, int, Texture2D> OnTextureUpdated`

每当生成一个新的纹理时（无论是轴向同步生成还是冠状/矢状异步生成），都会触发此事件。回调参数包括切面类型、切片索引和生成的纹理。UI 可以根据切面类型判断对应的图像控件，并更新显示。

```csharp
creator.OnTextureUpdated += (plane, index, tex) => {
    if (plane == DicomPlane.PlaneType.Sagittal) {
        sagittalImage.texture = tex;
    }
};
```

注册事件后注意在适当时机取消订阅，防止内存泄漏。