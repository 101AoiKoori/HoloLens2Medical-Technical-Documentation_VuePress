# 切片导航

## 原理解读

医学影像通常以一系列二维切片的形式存储。多平面重建（MPR）通过在不同方向上选取切片来观察数据。本模块围绕 `DicomUIController` 中的切片导航逻辑展开，介绍如何通过滑块控制不同平面的切片索引。

* **切片滑块事件**：在 `ConnectSliderEvents()` 中，每个方向的滑块 (`axialSlider`、`sagittalSlider`、`coronalSlider`) 都绑定到 `OnPlaneSliderChanged(DicomPlane.PlaneType planeType, float normalizedValue)`。当用户拖动滑块时，事件传入归一化值 (0~1)。

* **计算切片索引**：`OnPlaneSliderChanged` 将归一化值映射为实际切片索引：先从 `mprViewer` 获取对应方向的切片总数 (`GetSliceCount(planeType)`)，然后用 `Mathf.RoundToInt(normalizedValue * (totalSlices - 1))` 计算索引。通过 `mprViewer.SetSliceIndex(planeType, newIndex)` 更新视图。

* **同步三维切片**：若存在 `slice3DManager`，则根据平面类型调用 `SetAxialSliceIndex`、`SetSagittalSliceIndex` 或 `SetCoronalSliceIndex`，使三维场景中的切片平面同步移动。

* **反向更新滑块**：当切片索引由其他途径改变（例如通过键盘或其他脚本），`mprViewer` 会触发 `OnSliceChanged` 事件。`DicomUIController` 的 `HandleSliceChanged(planeType, sliceIndex, totalSlices)` 会计算新的归一化值 `sliceIndex / (totalSlices - 1)` 并更新相应滑块的 `Value` 属性，保证 UI 状态与实际视图一致。

* **刷新所有滑块**：在 DICOM 加载完成或窗位改变后，需要调用 `UpdateAllSliders()` 遍历三个方向的切片和窗位/窗宽，更新滑块值并启用/禁用控件。例如，当某方向只有一张切片时，将对应滑块设为不可交互。

## 操作指南

1. **准备滑块**：在 Unity 场景中创建三个滑块，分别对应轴向、矢状和冠状平面。将它们赋值给 `DicomUIController` 的 `axialSlider`、`sagittalSlider` 和 `coronalSlider`。

2. **绑定事件**：控制器会在 `Start()` 或手动调用 `ConnectSliderEvents()` 时自动绑定 `OnPlaneSliderChanged`。无需在外部手动注册。

3. **拖动滑块**：用户拖动滑块时，`OnPlaneSliderChanged` 会根据滑块值计算新的切片索引，并调用 `mprViewer.SetSliceIndex()` 更新画面。若存在三维场景，则调用 `slice3DManager.Set*SliceIndex()` 同步平面位置。

4. **自动刷新**：当数据加载完成或切片索引在代码中被修改时，控制器会在内部调用 `UpdateAllSliders()` 或 `HandleSliceChanged()` 自动更新滑块，使 UI 状态与当前视图一致。

5. **自定义交互**：如果需要通过代码跳转到某个切片，可以直接设置滑块的 `Value`，例如 `axialSlider.Value = 0.5f;`。控制器会自动触发滑块事件并更新视图。

### 示例伪代码

```csharp
public class NavigationExample : MonoBehaviour
{
    public DicomUIController ui;

    void Start()
    {
        // 默认情况下控制器已绑定滑块事件
    }

    // 跳到中间切片
    public void JumpToMiddle()
    {
        // 通过设置滑块值改变当前切片
        ui.axialSlider.Value = 0.5f; // Axial 中间
        ui.sagittalSlider.Value = 0.5f;
        ui.coronalSlider.Value = 0.5f;
    }
}
```

通过以上流程，开发者可以方便地在不同方向上浏览影像数据，实现切片导航功能。