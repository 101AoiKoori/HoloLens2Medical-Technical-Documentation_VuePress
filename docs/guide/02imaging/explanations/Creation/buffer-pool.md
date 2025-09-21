# 缓冲区池与性能优化 

为避免频繁分配和回收大数组，`DicomTextureCreator` 维护一个颜色缓冲区池 `_pixelBufferPool`。

## 获取与归还缓冲区

* `GetColorBuffer(key, size)`：如果缓冲池中存在足够大的数组，则直接取出；否则创建新数组。
* `ReturnColorBuffer(key, buffer)`：将数组归还缓冲池。池的大小受 `_maxBuffersInPool` 控制，超过上限时会随机淘汰旧缓冲区。

使用缓冲池有助于减少 GC 产生的卡顿，尤其是在频繁生成矢状/冠状纹理时。

## 清理与协程管理

调用 `Cleanup()` 将清空缓冲池、重置正在处理的纹理集合并停止延迟更新协程。建议在切换序列或场景卸载时调用。

## 建议

* 根据项目需求调整 `_maxBuffersInPool`。过小可能导致频繁分配数组，过大则占用更多内存。
* 每种平面尺寸使用不同的键（如 `axial_512x512`、`coronal_256x256`），以便正确复用缓冲区。