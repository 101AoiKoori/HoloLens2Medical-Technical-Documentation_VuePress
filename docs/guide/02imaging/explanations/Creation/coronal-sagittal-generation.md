# 冠状和矢状纹理生成 

与轴向切片不同，冠状和矢状切片需要在三维体素中重新采样像素。`DicomTextureCreator` 提供两种路径：

* **快速路径**：当体素缓存 (`_cachedVolumeData`) 已存在且包含当前窗宽窗位应用后的灰阶值时，直接调用 `ExtractCoronalTextureFromVolume()` 或 `ExtractSagittalTextureFromVolume()` 批量复制像素。此方法利用坐标映射预先计算好的索引，提高生成速度。
* **回退路径**：如果体素缓存尚未构建或缓存失败，回退到逐像素算法 (`FallbackCreateCoronalTexture`/`FallbackCreateSagittalTexture`)。回退算法会按列遍历轴向切片，从每个切片的 `Texture2D` 中读取像素并组合为一个新纹理。该方法较慢，但保证在任何情况下都能生成纹理。

## 生成流程

以 `CreateCoronalTexture(yIndex, center, width)` 为例：

1. 验证索引有效性。
2. 生成缓存键并检查 `DicomTextureCache` 是否存在。
3. 计算切面尺寸，若无效则返回 null。
4. 如果体素缓存未准备好，尝试调用 `CacheVolumeData`。失败则回退到逐像素算法。
5. 从 `_cachedVolumeData` 中快速提取纹理，或通过回退函数逐像素拼接。
6. 创建 `Texture2D`，应用像素并存入缓存。

矢状切面的生成与此类似，只是索引轴不同。

## 性能建议

* 尽早调用 `CacheVolumeData()` 或 `CacheRawVolumeData()` 以便使用快速路径。
* 体素缓存使用的内存较大，生成后请根据需要调用缓存清理和内存监控。
* 回退路径会频繁调用 `Texture2D.GetPixels32()`，可能导致主线程卡顿，应避免在 UI 响应周期中使用。