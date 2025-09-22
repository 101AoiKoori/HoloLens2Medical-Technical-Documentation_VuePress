---
title: 从切片创建纹理并显示
---

# 从切片创建纹理并显示

**目标:** 在 Unity 中解码 `DicomSlice` 的像素数据，应用窗位/窗宽映射生成 `Texture2D`，并将其显示在 UI 的 `RawImage` 上。此流程是构建自定义查看器或 MPR 界面的基础步骤。

## 前置条件

- 你已有一个有效的 `DicomSlice` 对象，且其 `Dataset` 包含像素数据。
- 在 Unity 场景中布置了一个 `Canvas`，其中有一个 `RawImage` 用于显示纹理。
- 如果希望自定义窗位和窗宽，需要知道所使用的值及其含义；未指定时将使用切片或序列的默认值。

## 步骤

1. **解码像素数据**

   在创建纹理前必须确保像素数据已从 DICOM 文件中提取。通过检查 `IsPixelDataDecoded` 属性判断是否已解码，如果未解码则调用 `DecodePixelData()`:

   ```csharp
   if (!slice.IsPixelDataDecoded)
   {
       bool ok = slice.DecodePixelData();
       if (!ok)
       {
           Debug.LogError("Failed to decode pixel data");
           return;
       }
   }
   ```

   `DecodePixelData` 将读取 `PixelData` 标签下的字节，并保存到内部缓冲区。对于多帧数据，你可以自行扩展读取逻辑或选择只读取第一帧。

2. **创建纹理并调节窗位/窗宽**

   调用 `CreateTexture()` 生成灰度纹理。你可以传入自定义窗位和窗宽，或留空使用默认值:

   ```csharp
   // 使用默认窗位/窗宽
   Texture2D texDefault = slice.CreateTexture();

   // 使用自定义窗位和窗宽，以突出特定组织
   float customCenter = 40f;
   float customWidth  = 400f;
   Texture2D texCustom = slice.CreateTexture(customCenter, customWidth);
   ```

   `CreateTexture` 会根据窗位和窗宽对每个像素值进行线性归一化，并生成 RGBA 格式的纹理。如果不传入自定义参数，并且之前从未创建纹理，则函数会将生成的纹理缓存到切片内部，便于后续重复使用。若传入自定义窗位/窗宽，每次都会新建纹理。

3. **显示纹理**

   将生成的 `Texture2D` 赋值给 `RawImage` 的 `texture` 属性即可在界面上显示:

   ```csharp
   using UnityEngine.UI;

   public RawImage display;

   void Start()
   {
       // 假设 slice 已通过 Inspector 赋值
       if (!slice.IsPixelDataDecoded) slice.DecodePixelData();
       Texture2D tex = slice.CreateTexture();
       display.texture = tex;
   }
   ```

   你也可以在运行时切换窗位/窗宽，重新调用 `CreateTexture(customCenter, customWidth)` 并更新 UI，以实现实时对比度调节。

4. **释放纹理和像素资源**

   当该切片不再需要显示时，应释放占用的 GPU 和内存资源:

   ```csharp
   slice.ReleaseTexture(); // 销毁缓存纹理，释放显存
   // 如需彻底释放像素缓冲和元数据
   slice.Dispose();
   ```

   如果你还需要保留像素数据以便下次重新创建纹理，可以只调用 `ReleaseTexture()`；若调用 `Dispose()`，将丢失像素缓冲，需要重新解码。

## 结果

- 你成功创建并显示了一张 DICOM 切片纹理，灰度映射依据窗位/窗宽决定，颜色通道统一填充为灰度值。
- 使用自定义窗位和窗宽可以突出不同组织，对比度可视化更加灵活。
- 通过释放纹理和像素缓冲，可以避免显存和内存泄漏，确保应用在长时间运行或多次加载数据时保持稳定。
