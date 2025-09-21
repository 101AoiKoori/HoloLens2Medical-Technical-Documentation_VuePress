---
title: 缓存键与窗口宽窗位
---

# 缓存键与窗口宽窗位

为了区分同一切片在不同窗宽窗位下的纹理，缓存模块使用复合键进行索引。本节介绍相关函数。

## SetCurrentWindowLevelKey

`void SetCurrentWindowLevelKey(float center, float width)`

将当前的窗宽窗位保存为内部状态，以便随后生成键和比较。在 MPR 管理器或纹理生成器更新窗宽窗位时，应当调用此方法。

## GetWindowLevelKey

`string GetWindowLevelKey(float center, float width)`

根据窗宽和窗位返回一个字符串形式的键，例如 `"40-400"`。该键用于组合纹理缓存键。

## GetTextureCacheKey

`string GetTextureCacheKey(PlaneType planeType, int index, string wlKey = null)`

根据切面、切片序号和窗宽窗位键生成完整的缓存键。例如，轴向第 12 切片在 `"40-400"` 窗宽窗位下的键可能是 `"Axial_12_40-400"`。

如果 `wlKey` 为 `null`，则使用 `SetCurrentWindowLevelKey()` 最近设置的键。

```csharp
cache.SetCurrentWindowLevelKey(center, width);
string key = cache.GetTextureCacheKey(PlaneType.Sagittal, 30);
```

## 键的作用

这些键使缓存可以在不同的窗宽窗位组合下存储多份相同切片的纹理。当窗口宽窗位改变时，通过刷新键可以避免旧纹理被错误访问。