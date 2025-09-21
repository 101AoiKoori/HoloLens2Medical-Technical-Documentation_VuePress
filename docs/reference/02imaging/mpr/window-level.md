---
title: 窗宽窗位设置
---

# 窗宽窗位设置

MPR 管理器需要在全局范围内维护窗宽窗位，以便生成的纹理与用户期望的亮度和对比度一致。

## SetWindowLevel

`void SetWindowLevel(float center, float width)`

更新全局的窗位和窗宽。如果新值不同于当前值，则会执行以下操作：

1. 更新内部 `_currentWindowCenter` 和 `_currentWindowWidth`。
2. 调用 `DicomTextureCache.SetCurrentWindowLevelKey()` 更新当前窗宽窗位键。
3. 清空请求队列并重新加入当前索引附近的高优先级请求。

```csharp
mpr.SetWindowLevel(center: 30f, width: 300f);
```

在 UI 层，应该在滑块或文本框改变时调用此方法。该方法不会直接更新已生成的纹理，而是依靠 `DicomTextureCreator` 在窗口改变后重新生成纹理并触发事件。