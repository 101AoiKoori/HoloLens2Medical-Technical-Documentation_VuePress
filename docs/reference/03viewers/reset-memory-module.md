---
title: 视图复位与内存管理模块 API
---
# 视图复位与内存管理模块 API

## 定义

### ResetView()

- **功能**:将视图恢复到加载序列的默认状态，包括将窗位和窗宽设置为 `DicomSeries` 的默认值，并将切片索引恢复到每个平面的中间位置。
- **返回值**:无。
- **说明**:调用该方法会停止所有正在运行的协程，释放已加载的纹理资源（取消缓存）、刷新三平面视图，并尝试回收未使用的资产。适合在用户完成操作后需要回到初始状态时使用。

### 内存监测与清理相关属性

- **enableMemoryMonitoring** (`bool`):是否启用内存监测。启用后系统会定期检查内存压力并在需要时调用垃圾回收与资源卸载。
- **memoryCheckInterval** (`float`):内存监测的时间间隔，单位为秒。默认值见 Inspector，可根据设备性能调整。
- **useBackgroundLoading** (`bool`):是否启用后台批量预取。开启后会在切片索引变化时自动加载附近的切片，需占用额外内存。
- **useProgressiveLoading** (`bool`):是否启用渐进加载。开启后首帧更快显示，纹理在后台逐步生成。

## 用法

1. 调用 `ResetView()` 可以快速回到初始状态，适用于演示结束或用户点击重置按钮的场景。
2. `enableMemoryMonitoring` 默认为启用，系统会根据 `memoryCheckInterval` 触发内存监控；若检测到高内存压力会尝试 `Resources.UnloadUnusedAssets()` 并强制 GC。可在 Inspector 调整监测间隔。
3. 根据目标设备的内存大小和性能，调整 `useBackgroundLoading` 和 `useProgressiveLoading` 以取得平衡。

## 示例（伪代码）

```csharp
// 假设 viewer 为 MPRViewer 实例

// 用户点击重置按钮时
resetButton.onClick.AddListener(() => {
    viewer.ResetView();
    Debug.Log("已重置视图至默认状态");
});

// 可根据设备性能在启动时调整监测间隔
void Start() {
    viewer.useProgressiveLoading = true;
    viewer.useBackgroundLoading = true;
    viewer.enableMemoryMonitoring = true;
    viewer.memoryCheckInterval = 15f; // 每 15 秒检查一次内存
}
```

> `ResetView()` 会调用内部的 `CancelAllOperations()` 和 `ReleaseAllResources()`，以确保协程停止并释放旧纹理。为避免在交互高峰期间卡顿，可在用户不操作时调用复位或手动释放。