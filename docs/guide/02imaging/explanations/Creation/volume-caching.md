# 体素缓存与窗宽窗位 

为了高效生成冠状和矢状面，Creation 模块将所有轴向切片的像素数据解码到 `_rawVolumeData` 中，并对每个体素应用窗宽窗位后存入 `_cachedVolumeData`。此过程称为“体素缓存”。

## 构建原始体素数据

调用 `CacheRawVolumeData()`（在源码中隐藏）将遍历所有 `DicomSlice`，解码 16 位或 8 位的原始像素，并存入 `_rawVolumeData`。该数组按 Z‑Y‑X 顺序排列，维度由 `_dicomSeries.Dimensions` 提供。

## 应用窗宽窗位

在调用 `SetWindowLevel()` 时，如果 `_rawVolumeData` 已存在，则 `ApplyWindowLevelToVolumeData(center, width)` 会遍历 `_rawVolumeData`，将每个体素映射到 0–255 范围内的灰度。该方法同时更新 `_cachedVolumeData` 并设置 `_volumeDataCached` 标志。

```csharp
float lowValue = center - 0.5f * width;
float highValue = center + 0.5f * width;
float windowScale = 1.0f / width;
for (int i = 0; i < _rawVolumeData.Length; i++)
{
    float val = _rawVolumeData[i];
    float normalized;
    if (val <= lowValue) normalized = 0f;
    else if (val >= highValue) normalized = 1f;
    else normalized = (val - lowValue) * windowScale;
    byte intensity = (byte)(normalized * 255);
    _cachedVolumeData[i] = new Color32(intensity, intensity, intensity, 255);
}
```

## 更新所有平面纹理

一旦体素缓存和窗宽窗位应用完成，`UpdateAllPlaneTextures(axialIdx, sagittalIdx, coronalIdx)` 会根据当前索引更新三个平面的纹理。如果 `_volumeDataCached` 为 false，则先调用 `CacheVolumeData()` 以确保体素数据存在。

## 清理体素缓存

* `ClearVolumeCache()`：释放 `_cachedVolumeData` 并标记缓存无效，但保留 `_rawVolumeData` 以便重新应用不同的窗宽窗位。
* `ClearAllCache()`：同时释放 `_rawVolumeData` 和 `_cachedVolumeData`，适用于切换序列或释放大量内存。

## 注意事项

* 体素缓存占用较大内存，应与 Cache 模块的内存策略配合使用。
* 在 HoloLens 等低内存设备上可选择不使用体素缓存，直接使用回退算法生成矢状/冠状面。