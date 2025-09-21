# 设置窗宽窗位 

窗宽窗位 (Window Level/Width) 控制医学影像的对比度和亮度。当用户调整窗宽或窗位时，需要重新映射像素值并更新所有平面纹理。

## 调用方式

通过 `DicomTextureCreator.SetWindowLevel(center, width)` 更新当前参数。如果短时间内多次调用，该方法会启动延迟协程，等待变化稳定后统一应用。

当延迟时间到达后，`ApplyWindowLevelChanges(center, width)` 会：

* 更新 `_lastWindowCenter` 和 `_lastWindowWidth`。
* 在 `DicomTextureCache` 中设置当前窗口键。
* 如果 `_rawVolumeData` 已存在，则调用 `ApplyWindowLevelToVolumeData()` 重新生成 `_cachedVolumeData`。
* 调用 `UpdateAllPlaneTextures()` 更新当前索引对应的三个平面纹理。

## 事件通知

在应用新窗宽窗位后，会触发 `OnWindowLevelChanged(center, width)` 事件，使 UI 层可以更新滑块或其他显示组件。

## 示例

```csharp
void OnWindowSliderChanged(float center, float width)
{
    creator.SetWindowLevel(center, width);
}

creator.OnWindowLevelChanged += (c, w) =>
{
    // 例如更新文本显示当前值
    centerText.text = c.ToString();
    widthText.text = w.ToString();
};
```

### 注意

* 窗宽窗位过小可能导致图像过暗或过亮。通常窗宽应大于 1，窗位在像素值范围内。
* 调整窗宽窗位会失效所有旧缓存，应避免在内存紧张情况下频繁调整。