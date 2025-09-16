# 调整窗位窗宽(带平滑过渡)

> 目标：用两个滑块或二维手势改变窗位/窗宽。

## 步骤(以双 Slider 为例)
```csharp
using UnityEngine;
using UnityEngine.UI;
using MedicalMR.DICOM.Viewers;

public class WLUI : MonoBehaviour
{
    public MPRViewer viewer;
    public Slider centerSlider;
    public Slider widthSlider;

    void Start()
    {
        viewer.OnWindowLevelChanged += (c, w) =>
        {
            centerSlider.SetValueWithoutNotify(c);
            widthSlider.SetValueWithoutNotify(w);
        };

        centerSlider.onValueChanged.AddListener(v => viewer.SetWindowLevel(v, viewer.GetWindowWidth()));
        widthSlider.onValueChanged.AddListener(v => viewer.SetWindowLevel(viewer.GetWindowCenter(), v));
    }
}
```
## 说明
- 平滑模式下会逐帧 Lerp，立即模式下则一次应用；两者均会刷新三平面的“当前索引”纹理。  
- 若需要预设快速按钮，可直接调用 `SetWindowLevel(预设中心, 预设宽度)`。

## 进阶建议

- **二维手势**：在 XR 环境下，可以使用 `Slider2D` 或自定义手势控制窗位与窗宽。通过 X 轴控制 `Center`，Y 轴控制 `Width`，在 `OnValueUpdated` 回调中调用 `SetWindowLevel()`。
- **预设按钮**：为常用窗宽/窗位(如骨窗、软组织窗)设置快捷按钮，例如按钮点击回调中直接 `viewer.SetWindowLevel(800, 1500)`，并配合立即模式获得迅速反馈。
- **数值限制**：根据数据类型设置 Slider 的最小值和最大值。CT 序列的窗宽通常需要更大的范围，例如 4000，而 MR 序列较小(通常小于 1000)。合理限制可避免用户将参数调至极端导致图像全黑或全白。