---
title: 切片数据解码与纹理生成原理
---

# 切片数据解码与纹理生成原理

`DicomSlice` 是医学影像处理流程中的关键单元。它既负责从 DICOM 数据集中提取并保存必要的元数据，又在适当的时候解码像素数据并转换为 Unity `Texture2D` 对象供渲染使用。本节详细解析其内部流程，为开发者提供优化或扩展的参考。

## 构造切片

在实例化 `DicomSlice` 时，你需要提供一个 `DicomDataset`、图像文件路径以及(可选的)已解码的像素数据：

```csharp
public DicomSlice(DicomDataset dataset, string filePath, byte[] pixelData = null)
```

构造函数会执行以下工作：

1. 从数据集中提取基本元数据：`InstanceNumber`(实例号)、`SliceLocation`、`ImagePositionPatient`、`PixelSpacing`、`SliceThickness`、`Rows`、`Columns`、`WindowCenter`、`WindowWidth` 等。由于不同 DICOM 制造商可能使用不同的标签，提取逻辑会尝试多个候选标签并优雅降级。
2. 保存文件路径，以便将来重新解码或查看原始 DICOM 文件时使用。
3. 如果 `pixelData` 参数不为 `null`，则直接保存像素缓冲并标记为已解码；否则设为未解码状态，等待后续调用 `DecodePixelData()` 解码。
4. 初始化 `Texture2D` 缓存字段为 `null`，等待首次创建纹理时填充。

## 解码像素数据

医疗图像通常以 8 位或 16 位灰度存储。`DecodePixelData()` 的实现概述如下：

1. 首先检查 `IsPixelDataDecoded` 标志，如果已解码则直接返回 `true`。
2. 如果像素缓冲区为 `null`，则调用 Fellow Oak DICOM 库从数据集读取 `PixelData` 标签，通常只提取第一帧。对于多帧数据可以扩展读取多个帧。
3. 将读取到的字节拷贝到内部缓冲区，设置解码标志并返回 `true`。如果数据集缺失或读取失败，返回 `false` 并记录错误。

解码的成本较高，尤其是在 UWP 环境下。因此通常在首次访问像素数据时才调用该方法，实现懒加载。

## 创建纹理

`Texture2D` 是 Unity 用于显示 2D 图像的核心对象。`DicomSlice.CreateTexture(float? windowCenter = null, float? windowWidth = null)` 将像素数据转换为灰度纹理，其关键步骤如下：

1. **确保解码**：若 `IsPixelDataDecoded` 为 `false`，自动调用 `DecodePixelData()`。若解码失败抛出异常。
2. **尺寸校验**：检查提取的行数和列数是否为正数；若不合理则中止。
3. **窗位/窗宽处理**：确定用于映射灰度的窗位 (`winCenter`) 和窗宽 (`winWidth`)：
   - 如果调用者传入了 `windowCenter` 和 `windowWidth` 参数，则使用它们；
   - 否则如果切片包含 `WindowCenter`/`WindowWidth` 标签，则使用这些标签的值；
   - 若这些标签缺失，则使用 `DicomMetadata.DefaultWindowCenter` 和 `DefaultWindowWidth`。

4. **创建颜色数组**：分配一个 `Color32[]` 数组，其长度等于宽 × 高。对于每个像素，执行以下映射：
   - 读取像素原始值：对于 8 位数据，直接使用一个字节；对于 16 位数据，将两字节组合为 16 位无符号整型；根据 DICOM 的 `PixelRepresentation` 处理有符号数。  
   - 根据窗位和窗宽应用线性变换：
     $$\text{normVal} = \frac{\text{pixelValue} - (winCenter - 0.5)}{winWidth} + 0.5$$
     其中 `normVal` 在 [0,1] 范围内，然后裁剪到 0 和 1 之间。
   - 将 `normVal` 乘以 255 得到 8 位灰度，写入 R、G、B 三个通道，Alpha 通道固定为 255。

5. **构建纹理**：创建一个 `Texture2D(width, height, TextureFormat.RGBA32, false)` 实例，调用 `SetPixels32` 传入颜色数组，然后 `Apply()` 提交到 GPU。
6. **缓存纹理**：若未传入自定义窗位/窗宽，则将生成的纹理保存到切片内部缓存，下次调用 `CreateTexture()` 时可直接返回缓存，避免重复计算。

通过这种方式，可以方便地创建不同窗位/窗宽下的纹理用于交互调节，而不会影响原始像素数据。

## 释放资源

由于 Unity 的纹理和像素缓冲分布在 GPU 和托管堆上，不及时释放会导致内存泄漏。`ReleaseTexture()` 销毁缓存的 `Texture2D` 并释放 GPU 内存。调用 `Dispose()` 会在释放纹理的同时清空像素缓冲和元数据，并将解码标志复位。建议在切片不再使用时主动调用，以让垃圾回收器及时回收。

## 性能与扩展建议

* **懒加载**：除非需要立即显示，否则不要在加载切片后立即调用 `DecodePixelData()` 和 `CreateTexture()`。延迟解码可以显著减少启动时间，特别是在设备性能有限的情况下。
* **复用纹理**：当用户调节窗位/窗宽时，可以选择使用相同的像素缓冲创建新的纹理，而不是重新解码像素数据。
* **多帧数据**：当前实现只支持单帧像素，如果你需要支持动态序列(如心脏跳动)，应扩展 `DecodePixelData()` 读取所有帧，或在 `DicomSeries` 层面管理多个时间点。
* **GPU 加速**：对于更高性能要求，可以在 shader 中实现窗位/窗宽映射，将 16 位纹理上传至 GPU，并在渲染时实时调整。Core 模块的实现提供了一个可行的基线，便于将来迁移到 GPU 方案。

## 进一步阅读

请参考如何文档 [从切片创建纹理](/guide/06core/implementation/04_create_texture_from_slice.md)，了解如何在 Unity 中使用这些方法将切片显示在 UI 元素上，并根据需要调整窗位和窗宽。
