---
title: 切片控制模块 API
---
# 切片控制模块 API

## 定义

### SetSliceIndex(DicomPlane.PlaneType plane, int index)

- **功能**:设定指定平面的当前切片索引，并刷新对应平面的显示纹理。
- **参数**:
  - `plane`:平面类型，取值为 `Axial`（轴向）、`Sagittal`（矢状）或 `Coronal`（冠状）。
  - `index`:目标索引值，取值范围为 0 到切片总数减一。
- **返回值**:无。
- **说明**:当未初始化或尚未加载数据时，调用将被忽略。函数内部会自动裁剪 (`Clamp`) 传入索引，并在索引真正发生变化时触发 `OnSliceChanged` 事件。若启用了后台加载（`useBackgroundLoading`），调用后会启动预取相邻切片的协程。

### GetSliceIndex(DicomPlane.PlaneType plane)

- **功能**:获取指定平面当前的切片索引。
- **参数**:`plane` – 平面类型。
- **返回值**:当前索引 (`int`)。

### GetSliceCount(DicomPlane.PlaneType plane)

- **功能**:返回指定平面的总切片数。
- **返回值**:切片数量 (`int`)，如果未加载数据则为 0。

### OnSliceChanged

- **类型**:事件 (event)。
- **声明**:`event void SliceChangedEventHandler(DicomPlane.PlaneType planeType, int sliceIndex, int totalSlices)`。
- **功能**:当切片索引发生变化时触发。
- **参数**:`planeType` – 修改的平面；`sliceIndex` – 新的索引值；`totalSlices` – 该平面的总切片数。
- **说明**:订阅此事件可在 UI 中同步显示当前索引或更新相关状态。

## 用法

1. 在 DICOM 数据加载完成后（即 `OnDicomLoaded` 触发后），通过 `GetSliceCount` 获取各平面的切片总数，并设置滑块或手势控件的最大值。
2. 在滑块或手势的回调中调用 `SetSliceIndex(plane, index)`，实现切片跳转。
3. 订阅 `OnSliceChanged` 事件以监听索引变化，从而更新界面或实现其他逻辑。

## 示例（伪代码）

```csharp
// 假设 viewer 是 MPRViewer 实例
// 初始化滑块范围（在 OnDicomLoaded 回调中）
int axialTotal = viewer.GetSliceCount(DicomPlane.PlaneType.Axial);
axialSlider.maxValue = axialTotal > 0 ? axialTotal - 1 : 0;

// 滑块值变化时设置索引
axialSlider.onValueChanged.AddListener(value => {
    int idx = Mathf.RoundToInt(value);
    viewer.SetSliceIndex(DicomPlane.PlaneType.Axial, idx);
});

// 手势或其他控制方式也可以调用 SetSliceIndex()

// 订阅索引变化事件
viewer.OnSliceChanged += (DicomPlane.PlaneType plane, int index, int total) => {
    if (plane == DicomPlane.PlaneType.Axial) {
        // 同步滑块位置并更新显示文本
        axialSlider.SetValueWithoutNotify(index);
        Debug.Log($"轴向平面索引变为 {index}/{total - 1}");
    }
    // 其他平面类似
};
```

> 开启 `useBackgroundLoading` 后，索引变化会自动预取相邻切片，有助于提升快速切换时的响应速度。