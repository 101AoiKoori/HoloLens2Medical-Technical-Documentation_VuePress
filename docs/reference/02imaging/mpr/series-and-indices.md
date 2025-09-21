---
title: 设置序列与索引
---

# 设置序列与索引

在使用 MPR 管理器之前，需要先绑定当前的 DICOM 序列并设置初始切片索引。

## SetDicomSeries

`void SetDicomSeries(DicomSeries series)`

绑定一个新的 DICOM 序列。若先前已绑定其他序列，则会清理旧序列的资源并重置索引和窗口宽窗位。调用后，内部字段 `_dicomSeries` 被设置为新序列，同时 `_currentWindowCenter`、`_currentWindowWidth` 和当前索引都被初始化。

```csharp
mpr.SetDicomSeries(series);
// 默认索引初始化为 -1，后续需要调用 SetCurrentIndices()
```

## SetCurrentIndices

`void SetCurrentIndices(int axialIndex, int sagittalIndex, int coronalIndex)`

更新当前显示的轴向、矢状和冠状切片索引，并依据这些索引调整请求队列的优先级。这个方法通常在用户拖动滑块或点击按钮时调用。

```csharp
// 更新当前索引并刷新请求队列
mpr.SetCurrentIndices(axialIndex: 20, sagittalIndex: 30, coronalIndex: 40);
```

设置索引后，管理器会重新计算队列中每个请求的优先级，确保用户最近访问的切片优先生成。