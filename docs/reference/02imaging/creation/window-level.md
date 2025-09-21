---
title: 窗宽窗位与体数据
---

# 窗宽窗位与体数据

DICOM 影像常用窗宽（Window Width, WW）和窗位（Window Center, WC）来控制图像对比度和亮度。`DicomTextureCreator` 提供了一套接口来设置窗宽窗位并更新体数据。本节介绍这些方法。

## SetWindowLevel

`void SetWindowLevel(float windowCenter, float windowWidth)`

设置当前的窗位和窗宽。该方法首先记录新值，然后启动延时协程，通过 `CacheVolumeData()` 重新计算 `_cachedVolumeData`。延时是为了防止用户快速拖动滑块时频繁刷新。

```csharp
// 当用户调整滑块时调用
creator.SetWindowLevel(windowCenter: 40f, windowWidth: 400f);
```

## CacheRawVolumeData

`void CacheRawVolumeData()`

在加载序列时调用一次，遍历 `DicomSeries` 中的所有切片，解压像素并按切片索引、行列保存到 `_rawVolumeData[depth, row, column]`。如果没有调用此方法，后续切面的生成将退化为逐像素计算。

## CacheVolumeData

`void CacheVolumeData()`

根据当前的窗宽窗位，把 `_rawVolumeData` 映射到 `_cachedVolumeData`，其中每个体素转换为颜色值。该函数在 `SetWindowLevel()` 内部被调度运行。

```csharp
// 在加载完序列后，初始化缓存
creator.CacheRawVolumeData();
creator.CacheVolumeData();
```

## UpdateAllPlaneTextures

窗宽窗位改变时，通过 `UpdateAllPlaneTextures()` 可强制刷新三种平面的纹理，确保显示内容与新设置一致。

```csharp
// 在监听滑块变化时调用，刷新所有平面
creator.SetWindowLevel(center, width);
creator.UpdateAllPlaneTextures();
```