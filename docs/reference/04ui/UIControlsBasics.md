# UI 控件基础

在 `DicomUIController` 所使用的界面中，主要涉及两类 MRTK3 控件:`PressableButton`（可按压按钮）和 `Slider`（滑块）。理解这些控件的基本用法，有助于开发者自定义交互体验。此处提供对其工作原理和使用步骤的朴实介绍。

## 原理解读

### PressableButton

* **按压事件**:每个 `PressableButton` 都暴露 `OnClicked` 事件，在按钮被按下并抬起时触发。可以通过 `AddListener(Action)` 注册回调，也可以使用 Lambda 表达式直接绑定逻辑。

* **交互状态**:按钮有 `IsInteractable` 或 `enabled` 属性，用于控制是否允许用户按压。在数据未加载时，`DicomUIController` 会禁用某些按钮防止误操作。

### Slider

* **值的范围**:滑块的 `Value` 属性通常归一化到 0~1。改变此值会实时更新 UI 并触发 `OnValueUpdated` 事件。通过 `Value` 反向更新滑块，可以在代码中驱动 UI 改动。

* **值更新事件**:`OnValueUpdated` 接收一个 `SliderEventData` 参数，其中 `NewValue` 字段表示滑块的新值。可以绑定回调处理此值，例如映射到切片索引或窗位。

## 操作指南

1. **创建控件**:在 Unity 场景中，从 MRTK3 UI 控件库拖拽 `PressableButton` 和 `Slider` 到场景中。根据功能命名，如“加载按钮”、“重置按钮”、“轴向滑块”等。

2. **注册事件**:在脚本或 `DicomUIController` 中，通过以下方式绑定事件:

   ```csharp
   loadButton.OnClicked.AddListener(OnLoadButtonClicked);
   axialSlider.OnValueUpdated.AddListener((data) => OnPlaneSliderChanged(DicomPlane.PlaneType.Axial, data.NewValue));
   windowCenterSlider.OnValueUpdated.AddListener((data) => OnWindowCenterSliderChanged(data.NewValue));
   ```
   `DicomUIController` 在其内部方法 `ConnectButtonEvents()` 和 `ConnectSliderEvents()` 中已经完成了这些绑定。如果自定义控件，可以仿照上述方式手动绑定。

3. **控制交互**:根据业务需求启用或禁用控件。例如，在加载数据前可以调用 `button.IsInteractable = false` 或 `slider.enabled = false` 来阻止用户操作。

4. **更新值**:通过设置 `slider.Value` 可在代码中调整滑块位置，并自动触发其更新事件。例如，为跳转到某切片可直接设置滑块的 `Value` 为所需的归一化值。

5. **移除监听器**:在对象销毁前或需要重新绑定时，调用 `OnClicked.RemoveAllListeners()` 或 `OnValueUpdated.RemoveAllListeners()` 移除所有事件。

## 示例伪代码

```csharp
public class ButtonSliderExample : MonoBehaviour
{
    public PressableButton myButton;
    public Slider mySlider;

    void Start()
    {
        // 注册按钮事件
        myButton.OnClicked.AddListener(OnMyButtonClicked);
        // 注册滑块事件
        mySlider.OnValueUpdated.AddListener((data) => OnSliderChanged(data.NewValue));
    }

    void OnMyButtonClicked()
    {
        Debug.Log("按钮被点击");
    }

    void OnSliderChanged(float val)
    {
        Debug.Log($"滑块值:{val}");
    }

    void OnDestroy()
    {
        // 移除监听器以防止引用悬挂
        myButton.OnClicked.RemoveAllListeners();
        mySlider.OnValueUpdated.RemoveAllListeners();
    }
}
```

通过上述步骤，可以熟练地使用 MRTK3 的按钮与滑块控件构建交互界面，并在需要时结合 `DicomUIController` 的逻辑来控制医学影像的加载、浏览和调整。