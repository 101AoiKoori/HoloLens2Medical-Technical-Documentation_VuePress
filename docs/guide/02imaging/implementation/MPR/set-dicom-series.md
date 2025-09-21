# 设置新的 DicomSeries 

当用户选择不同的 DICOM 序列时，需要更新 MPR 管理器所使用的数据并清理旧资源。

## 步骤

1. 调用 `mpr.SetDicomSeries(newSeries)`。该方法会：
   * 清空请求队列并释放当前缓存；
   * 重置窗宽窗位为 `newSeries` 的默认值；
   * 重置当前切片索引。
2. 如果之前订阅了 `OnTextureCreated` 等事件，无需重新订阅，事件会继续触发。
3. 调用 `SetCurrentIndices()` 设置新的起始索引，或直接调用 `GetTexture()` 以异步生成纹理。

## 注意

* 切换序列时务必先清理缓存，以避免旧纹理占用内存。
* 如果切换后不再需要 MPR 管理器，可以调用 `CleanupResources()` 彻底释放资源。