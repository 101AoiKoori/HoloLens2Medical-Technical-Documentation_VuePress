# 调整切片索引

多平面重建（MPR）允许在不同平面上浏览 DICOM 数据集。UI 模块提供三个滑块用来控制轴向、矢状和冠状切片的索引。以下指南介绍如何配置和使用这些滑块。

## 配置滑块

1. 在 UI 面板中创建三个 MRTK3 `Slider`，并命名为 **AxialSlider**、**SagittalSlider** 和 **CoronalSlider**（或在 `DicomUIController` 中手动拖拽引用到对应字段）。
2. 默认情况下，滑块的取值范围为 0~1。当加载 DICOM 数据后，控制器会根据当前平面的总切片数启用或禁用滑块，并计算当前索引的归一化值。
3. 若启用 `autoFindUIElements`，确保滑块名称符合上述命名，以便脚本自动查找并绑定。

## 使用方法

1. **加载 DICOM 数据**：在滑动切片之前，必须先加载数据集；详见《加载 DICOM 数据》章节。
2. **滑动控制**：当某平面有超过一张切片时，滑块将被启用。移动滑块时会触发 `OnValueUpdated` 事件，`DicomUIController` 会调用 `OnPlaneSliderChanged(planeType, normalizedValue)`，其中 `normalizedValue` 为滑块当前值。
3. **索引计算**：脚本会获取平面的总切片数 `totalSlices`，然后根据公式

   ```csharp
   int newIndex = Mathf.RoundToInt(normalizedValue * (totalSlices - 1));
   ``

   计算新的切片索引。随后调用 `mprViewer.SetSliceIndex(planeType, newIndex)` 更新 2D 显示，并调用 `slice3DManager.SetAxialSliceIndex(newIndex)` 等方法同步 3D 切片。
4. **实时更新**：如果程序中有其他部分更改了切片索引，`MPRViewer` 会触发 `OnSliceChanged()` 事件，UI 控制器会在 `HandleSliceChanged()` 中将滑块的归一化值更新为当前索引对应的值，确保界面同步。

## 注意事项

* 当某个方向只有一张切片时，控制器会禁用对应的滑块以防止无效操作。
* 滑动过程中脚本使用 `isUpdatingUI` 标志防止事件回调互相触发。如果在自定义逻辑中直接调用 `SetSliceIndex()`，建议避免在回调内修改滑块值，或使用类似标志避免递归。

通过正确配置和使用滑块，用户可以方便地在三种正交方向上快速浏览 DICOM 数据集，实现多平面重建的交互体验。
