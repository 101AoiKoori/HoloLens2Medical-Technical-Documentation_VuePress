---
title: DicomMetadata API
---

# DicomMetadata

`DicomMetadata` 是 Core 模块中的一个轻量级类，用于保存一个 DICOM 序列的几何信息和默认窗口参数。它不执行任何复杂的逻辑，只提供对内部字段的读取权限及设置方法。

## 类定义

```csharp
public class DicomMetadata
{
    // 体素网格的尺寸 (x, y, z)
    public Vector3Int Dimensions { get; private set; }

    // 相邻体素之间的物理距离 (毫米)
    public Vector3 Spacing { get; private set; }

    // 体积在病人坐标系中的起点
    public Vector3 Origin { get; private set; }

    // 从病人坐标系到 Unity 世界坐标系的旋转
    public Quaternion Orientation { get; private set; } = Quaternion.identity;

    // 默认窗位与窗宽
    public float DefaultWindowCenter { get; private set; } = 1500f;
    public float DefaultWindowWidth  { get; private set; } = 2000f;

    // 设置体积属性
    public void SetVolumeProperties(Vector3Int dimensions, Vector3 spacing, Vector3 origin, Quaternion orientation);
}
```

## 用法说明

`DicomMetadata` 只负责存储数据，因此它的字段全部为只读属性。调用 `SetVolumeProperties` 方法来一次性设置体素网格尺寸、体素间距、原点和方向四元数。调用该方法不会进行任何验证，调用者应保证参数与实际 DICOM 数据一致。

在实际项目中，你通常不需要直接创建 `DicomMetadata` 实例，而是通过 `DicomSeries.SetVolumeProperties()` 间接更新内部的 `DicomMetadata`。可以在加载序列之前或加载过程中更新几何信息，以便在解析切片或生成纹理时保持一致。

## 使用示例（伪代码）

```csharp
// 设定新的序列几何信息
var dimensions = new Vector3Int(256, 256, 128);
var spacing    = new Vector3(0.8f, 0.8f, 1.5f);
var origin     = new Vector3(0f, 0f, 0f);
var orientation = Quaternion.identity;

// 假设 series 是一个 DicomSeries 实例
series.SetVolumeProperties(dimensions, spacing, origin, orientation);

// 之后读取 metadata 信息
Vector3Int dims  = series.Dimensions;
Vector3    space = series.Spacing;
```
