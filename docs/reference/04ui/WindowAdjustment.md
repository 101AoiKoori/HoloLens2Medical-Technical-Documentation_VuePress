# 窗位与窗宽调整

## 原理解读

窗位（Window Center）和窗宽（Window Width）是医学影像中的常见概念，用于调整影像的亮度和对比度。`DicomUIController` 通过两个滑块控制这两个参数，并与 `MPRViewer` 和 `DicomSlice3DManager` 同步。主要涉及以下方法:

* **窗位滑块事件**:`OnWindowCenterSliderChanged(float value)` 在窗位滑块变化时触发。它将滑块的归一化值映射到实际窗位范围:`center = Mathf.Lerp(windowCenterMin, windowCenterMax, value)`，同时从 `mprViewer` 获取当前窗宽。随后调用 `mprViewer.SetWindowLevel(center, width)` 设置新的窗位/窗宽，并同步三维平面显示。

* **窗宽滑块事件**:`OnWindowWidthSliderChanged(float value)` 类似地将滑块值映射到窗宽范围:`width = Mathf.Lerp(windowWidthMin, windowWidthMax, value)`，然后从 `mprViewer` 获取当前窗位并设置窗口参数。

* **预设窗位**:`ApplyWindowPreset(float center, float width)` 提供快捷方式，直接调用 `mprViewer.SetWindowLevel(center, width)` 应用预设值，并更新 3D 切片显示。

* **窗位更新事件**:当其他组件（如键盘快捷键）改变窗位或窗宽时，`mprViewer` 会触发 `OnWindowLevelChanged`。`DicomUIController` 将其绑定到 `HandleWindowLevelChanged(float center, float width)`，该方法使用 `Mathf.InverseLerp(windowCenterMin, windowCenterMax, center)` 和 `Mathf.InverseLerp(windowWidthMin, windowWidthMax, width)` 计算归一化值，更新两个滑块的 `Value` 属性，以反向同步 UI。

* **刷新滑块**:`UpdateAllSliders()` 在数据加载完成后调用，其中包括根据当前窗位和窗宽反向计算滑块值。

## 操作指南

1. **配置范围**:在 `DicomUIController` 中，通过 Inspector 设置 `windowCenterMin`、`windowCenterMax`、`windowWidthMin`、`windowWidthMax`，确定窗位和窗宽可调整的范围。

2. **准备滑块**:创建两个滑块并赋值给 `windowCenterSlider` 和 `windowWidthSlider`。控制器会在 `Start()` 中自动绑定事件。

3. **调节窗位/窗宽**:用户拖动滑块时，控制器会计算出对应的窗口参数并调用 `mprViewer.SetWindowLevel()`。三维切片管理器也会同步更新显示。

4. **反向同步**:如果窗位由其他脚本改变，`HandleWindowLevelChanged()` 会将新的窗位和窗宽映射为滑块值。无需开发者手动更新滑块。

5. **应用预设**:在某些情况下可以定义常用的窗位/窗宽组合（如软组织、骨窗）。调用 `ApplyWindowPreset(center, width)` 可快速切换到预设窗口。

### 示例伪代码

```csharp
public class WindowAdjustExample : MonoBehaviour
{
    public DicomUIController ui;

    void Start()
    {
        ui.SetMPRViewer(myMprViewer);
        ui.EnableControls(false);
    }

    // 提供按钮快速切换不同窗口
    public void ApplySoftTissueWindow()
    {
        // 假设软组织窗位为 40，窗宽为 400
        ui.ApplyWindowPreset(40f, 400f);
    }

    public void ApplyBoneWindow()
    {
        ui.ApplyWindowPreset(300f, 2000f);
    }
}
```

按照上述步骤，可以轻松实现窗位与窗宽的交互调节，提升影像浏览体验。