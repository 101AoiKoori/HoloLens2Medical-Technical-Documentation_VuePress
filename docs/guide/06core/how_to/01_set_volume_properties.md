---
title: 设置体积属性
---

# 设置体积属性

**目标：** 在 Unity 中初始化一个新的 `DicomSeries`，并为其指定体素网格尺寸、体素间距、原点和方向四元数，使后续加载的切片有一致的空间基准。

## 前置条件

- 已在 Unity 场景中创建一个空的 `GameObject` 用于挂载 `DicomSeries` 组件。
- 已知体积的几何信息，例如：
  - **Dimensions**：`(256, 256, 64)` 表示体素网格的行、列和切片数；
  - **Spacing**：`(0.8f, 0.8f, 1.5f)` 表示每个体素在物理空间中的宽、高和切片间距；
  - **Origin**：`(0f, 0f, 0f)` 通常表示图像坐标系起点在世界原点；
  - **Orientation**：通常使用 `Quaternion.identity` 表示无旋转，亦可根据 DICOM 标签计算。

若暂时无法从 DICOM 索引文件中读取这些值，可使用占位值或留空，待稍后更新。确保在添加任何切片之前设置正确的体积属性。

## 步骤

1. **添加组件**：在 *Hierarchy* 面板中选中目标对象，点击 *Add Component* 按钮，搜索 `DicomSeries` 并将其添加到对象上。  

2. **编写脚本设置属性**：创建一个新的 MonoBehaviour 脚本，例如 `VolumeSetup.cs`，并将其挂载到同一对象。在脚本中引用 `MedicalMR.DICOM.Core` 命名空间，并在 `Start()` 方法中调用 `SetVolumeProperties`：

```csharp
using UnityEngine;
using MedicalMR.DICOM.Core;

public class VolumeSetup : MonoBehaviour
{
    public DicomSeries series; // 在 Inspector 中拖拽赋值

    public Vector3Int customDimensions = new Vector3Int(256, 256, 64);
    public Vector3 customSpacing  = new Vector3(0.8f, 0.8f, 1.5f);
    public Vector3 customOrigin   = Vector3.zero;
    public Quaternion customOrientation = Quaternion.identity;

    void Start()
    {
        // 调用前确保 series 已经赋值
        if (series == null)
        {
            Debug.LogError("DicomSeries is not assigned");
            return;
        }

        // 设置体积几何和方向
        series.SetVolumeProperties(customDimensions, customSpacing, customOrigin, customOrientation);
    }
}
```

3. **运行场景验证**：进入 *Play* 模式，检查 Console 是否有错误输出。此时 `DicomSeries` 内部保存了传入的元数据。你可以通过在其他脚本中访问 `series.Dimensions`、`series.Spacing` 等属性验证其值是否正确。

4. **更新元数据**：如果稍后从索引文件或扫描仪数据读取了新的几何参数，可以再次调用 `SetVolumeProperties` 更新这些属性。注意更新后应重新加载切片并排序，以保证顺序正确。

## 结果

- `DicomSeries` 的内部 `DicomMetadata` 已记录体素网格尺寸、间距、原点和方向四元数。
- 后续在加载切片或映射坐标时，都会使用这些元数据作为基准。
- 由于 `SetVolumeProperties` 不做参数校验，若传入值与实际 DICOM 数据不匹配，可能导致图像显示比例和方向错误。请确保来源可靠。
