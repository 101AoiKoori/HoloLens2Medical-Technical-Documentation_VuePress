# 切片导航：与滑块/手势绑定

> 目标：让用户通过 UI 滑块或手势控制三平面索引。

## 步骤(以 UI Slider 为例)
```csharp
using UnityEngine;
using UnityEngine.UI;
using MedicalMR.DICOM.Viewers;
using MedicalMR.DICOM.Core;

public class SliceUI : MonoBehaviour
{
    public MPRViewer viewer;
    public Slider axialSlider, sagittalSlider, coronalSlider;

    void Start()
    {
        axialSlider.maxValue    = Mathf.Max(0, viewer.GetSliceCount(DicomPlane.PlaneType.Axial) - 1);
        sagittalSlider.maxValue = Mathf.Max(0, viewer.GetSliceCount(DicomPlane.PlaneType.Sagittal) - 1);
        coronalSlider.maxValue  = Mathf.Max(0, viewer.GetSliceCount(DicomPlane.PlaneType.Coronal) - 1);

        axialSlider.onValueChanged.AddListener(v => 
            viewer.SetSliceIndex(DicomPlane.PlaneType.Axial,    Mathf.RoundToInt(v)));
        sagittalSlider.onValueChanged.AddListener(v => 
            viewer.SetSliceIndex(DicomPlane.PlaneType.Sagittal, Mathf.RoundToInt(v)));
        coronalSlider.onValueChanged.AddListener(v => 
            viewer.SetSliceIndex(DicomPlane.PlaneType.Coronal,  Mathf.RoundToInt(v)));

        viewer.OnSliceChanged += (plane, idx, total) =>
        {
            if (plane == DicomPlane.PlaneType.Axial)    axialSlider.SetValueWithoutNotify(idx);
            if (plane == DicomPlane.PlaneType.Sagittal) sagittalSlider.SetValueWithoutNotify(idx);
            if (plane == DicomPlane.PlaneType.Coronal)  coronalSlider.SetValueWithoutNotify(idx);
        };
    }
}
```
## 说明
- `SetSliceIndex` 会自动 Clamp 并触发：更新 UI 纹理 + `OnSliceChanged` 事件。  
- 若打开了后台加载，将异步预取邻近切片，减少后续跳转卡顿。

## 进阶建议

- **手势交互**：在 MRTK3 中，可以使用 `PinchSlider`、`BoundsControl` 或自定义手势识别组件，让用户通过手部滑动或手势拖动控制切片索引。监听相应的 `OnValueUpdated` 事件并调用 `SetSliceIndex()`。
- **同步 UI 与索引**：如果在多个交互通道(手势、按键等)中修改索引，请使用 `OnSliceChanged` 回调统一更新滑块的位置，例如通过 `SetValueWithoutNotify()` 防止无限回调。
- **快速跳转**：可以设计按键或语音命令跳至特定索引，如第 0 张、最后一张或每次跳 10 张。在实现中只需计算目标索引并调用 `SetSliceIndex()` 即可。