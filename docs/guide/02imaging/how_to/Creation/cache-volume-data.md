# 缓存体素数据 

为了利用快速提取算法，需要先将所有轴向切片的原始像素解码为 3D 体素数组。此操作通常在加载序列或第一次生成矢状/冠状纹理时完成。

## 步骤

1. **调用缓存方法**：使用 `CacheVolumeData(center, width)` 或 `CacheRawVolumeData()` 解码体素数据。方法内部会遍历 `DicomSliceManager` 并填充 `_rawVolumeData`。
2. **应用窗宽窗位**：生成 `_cachedVolumeData`，并将 `_volumeDataCached` 设为 `true`。此步骤在 `ApplyWindowLevelToVolumeData()` 中完成。
3. **检索切片**：之后调用 `CreateCoronalTexture()` 或 `CreateSagittalTexture()` 时会优先使用 `_cachedVolumeData` 直接提取像素。

## 建议

* 根据设备性能决定是否在程序启动时缓存体素数据。桌面平台通常可以一次性缓存全部数据；移动平台可按需缓存。
* 每当窗宽窗位改变时，体素缓存需要重新应用灰阶映射；`DicomTextureCreator` 会自动在 `SetWindowLevel()` 中触发此操作。