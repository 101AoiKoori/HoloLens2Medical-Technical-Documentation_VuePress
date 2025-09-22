---
title: Creation 概述
---

# 纹理生成模块概述

`DicomTextureCreator` 是整个 Imaging 模块的生产单元，负责把 DICOM 数据转换为 Unity 可用的 `Texture2D` 或颜色缓冲。它以分文件（partial class）的方式实现，以便把不同切面的生成逻辑分散到独立文件中。

## 作用与依赖

- **图像解码**:使用 `DicomSeries` 和 `DicomSliceManager` 读取 DICOM 序列并解压像素数据。
- **纹理生成**:根据当前窗宽窗位，从 2D 切片或 3D 体数据中生成轴向、矢状和冠状纹理。
- **事件通知**:在纹理生成或窗宽窗位改变时触发事件，供 UI 更新使用。

## 主要流程

1. **缓存体数据**:在加载序列时，通过 `CacheRawVolumeData()` 一次性读取所有切片，构建 `_rawVolumeData` 三维数组。
2. **应用窗宽窗位**:调用 `CacheVolumeData()` 将 `_rawVolumeData` 映射为 `_cachedVolumeData`，以便快速生成冠状/矢状纹理。
3. **生成纹理**:调用 `GetAxialTexture()`, `CreateCoronalTextureCoroutine()` 或 `CreateSagittalTextureCoroutine()` 生成特定切面纹理，优先从缓存中获取；若无缓存，则根据体数据或逐像素算法生成新纹理。
4. **预加载与更新**:通过 `PreloadAxialTextures()` 预热多个纹理，通过 `UpdateAllPlaneTextures()` 在窗宽窗位改变后刷新纹理。