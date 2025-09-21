---
title: 切片导航与索引控制
---

# 切片导航与索引控制

在渲染 DICOM 数据时，控制切片索引是浏览体数据的核心。本模块说明如何通过 `DicomPlaneController` 和 `DicomSlice3DManager` 控制切片索引、更新平面位置以及监听切片变化。

## 定义

切片索引控制涉及以下关键成员：

| 名称 | 作用 |
|----|----|
| **SetSliceIndex(int index)** | 设置当前切片序号，并更新纹理及平面在 3D 空间中的位置。 |
| **GetCurrentSliceIndex() : int** | 返回当前平面所处的切片索引。 |
| **GetTotalSliceCount() : int** | 返回该平面可用的总切片数（由 `DicomSeries` 提供）。 |
| **OnSliceIndexChanged (事件)** | 当 `SetSliceIndex` 导致索引改变时触发，传递平面类型和索引。可用于同步 UI 或其他逻辑。 |
| **SetAxialSliceIndex / SetSagittalSliceIndex / SetCoronalSliceIndex** | `DicomSlice3DManager` 的方法，用于直接设置三个平面中的某一个索引。 |

切片索引从 0 开始，范围为 `[0, GetTotalSliceCount() - 1]`。`SetSliceIndex()` 会对输入索引进行限制，确保不会超出范围。调用该方法还会根据索引计算平面在 3D 场景中的位置：

- **轴向平面**：沿 Y 轴移动。
- **矢状平面**：沿 X 轴移动。
- **冠状平面**：沿 Z 轴移动。

移动距离根据 `movementRange` 在 -movementRange 和 +movementRange 之间线性插值。

## 使用方法

- 若只控制单个平面，在获取或设置切片时调用 `GetCurrentSliceIndex()` 和 `SetSliceIndex()`。
- 若使用 `DicomSlice3DManager` 管理多个平面，通过管理器的 `SetAxialSliceIndex()` 等方法一次设置，管理器会自动检查是否已初始化并刷新纹理。
- 订阅 `OnSliceIndexChanged` 可在索引变化时更新自定义 UI 或同步到 2D MPRViewer。若使用了 `DicomSlice3DManager`，还可订阅其 `OnSliceChanged` 事件，该事件在任意平面索引变化时触发。

## 使用示例

假设存在一个滑条控件来控制轴向切片索引，可以如下绑定：

```csharp
// slider 值变化时更新轴向切片索引
public void OnAxialSliderChanged(float value)
{
    int index = Mathf.RoundToInt(value);
    // 直接设置 DicomPlaneController
    axialController.SetSliceIndex(index);
}

// 订阅轴向平面索引变化，更新滑条显示
void Start()
{
    axialController.OnSliceIndexChanged += (type, idx) => {
        if (type == DicomPlane.PlaneType.Axial)
        {
            axialSlider.value = idx;
        }
    };
}
```

如果通过管理器统一控制，可以调用：

```csharp
// 设置矢状平面的索引
sliceManager.SetSagittalSliceIndex(5);
// 监听任意平面索引变化
sliceManager.OnSliceChanged += (planeType, sliceIndex) => {
    // 更新对应 UI 控件
};
```

利用这些接口，可以实现自定义的切片导航 UI，并与三维场景中的平面保持同步。
