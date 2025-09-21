---
title: DicomPlane API
---

# DicomPlane

`DicomPlane` 是 Core 模块中的一个静态辅助类，用于定义解剖学平面枚举。虽然简单，但它在调用坐标映射器和生成切片纹理时经常使用，可提升代码可读性。

## 类定义

```csharp
public static class DicomPlane
{
    public enum PlaneType
    {
        Axial,    // 轴向面 (常见于 CT/MR 横截面)
        Sagittal, // 矢状面 (左右切面)
        Coronal   // 冠状面 (前后切面)
    }
}
```

## 用法说明

该枚举用于选择或标识解剖学平面。例如，在调用 `DicomCoordinateMapper.GetCoordinatesInPlane()` 或 `DicomSeries` 的纹理生成方法时，需要指定平面类型。

## 使用示例

```csharp
// 选择矢状面
var plane = DicomPlane.PlaneType.Sagittal;

// 获取体素在矢状面上的二维坐标
Vector2Int coord = mapper.GetCoordinatesInPlane(voxelCoord, plane);

// 创建矢状面纹理
Texture2D tex = series.CreateSagittalTexture(xIndex: 10, windowCenter: null, windowWidth: null);
```
