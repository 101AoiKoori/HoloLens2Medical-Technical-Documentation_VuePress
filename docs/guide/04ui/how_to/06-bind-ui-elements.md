# 自动绑定 UI 元素

在复杂场景中，手动拖拽每个按钮和滑块到脚本字段中既耗时又易出错。`DicomUIController` 支持自动查找模式，通过名称匹配自动绑定控件。这一能力源于 `autoFindUIElements` 选项和 `FindUIElements()` 方法。

## 开启自动查找

1. 在 Unity Inspector 中选中包含 `DicomUIController` 的对象，将 **Auto Find UI Elements** 勾选为 true。
2. 在 **UI Parent** 字段中指定一个父 Transform（可为空）。查找逻辑从该节点开始递归搜索；若未指定，则从当前对象所在的 Transform 向下搜索。

## 命名约定

脚本通过组件名匹配来寻找控件，以下是默认约定：

| 字段                | 查找名称示例 |
|--------------------|------------|
| `loadButton`       | **LoadButton** |
| `resetButton`      | **ResetButton** |
| `axialSlider`      | **AxialSlider** |
| `sagittalSlider`   | **SagittalSlider** |
| `coronalSlider`    | **CoronalSlider** |
| `windowCenterSlider` | **WindowCenterSlider** |
| `windowWidthSlider`  | **WindowWidthSlider** |
| `togglePlanesButton`  | **TogglePlanesButton** |
| `toggleBoundingButton`| **ToggleBoundingButton** |
| `statusText`       | **StatusText** |

只要子物体名称包含上述关键字（忽略大小写和下划线），`FindUIElements()` 就会找到对应的组件并赋值。例如，如果你的按钮命名为 `Btn_LoadButton`，也会匹配到 `loadButton` 字段。

## 使用步骤

1. 设计 UI 布局，确保所有按钮和滑块命名符合约定。名称可包含前缀或后缀，但必须包含关键词，例如 `TogglePlanesButton`。
2. 将 `DicomUIController` 挂载到 UI 根节点或合适的父节点，勾选 **Auto Find UI Elements**。
3. （可选）在 **UI Parent** 中指定查找的起点。如果不指定，则在脚本所在对象及其子树中查找。
4. 运行应用时，`DicomUIController.Start()` 会调用 `FindUIElements()` 填充所有未手动指定的引用。如果某个字段在 Inspector 中已经绑定，自动查找会跳过该字段。

## 手动覆盖

自动查找适用于大多数场景，但如果有特殊需求或名称不符合约定，可手动在 Inspector 中将具体控件拖入字段。手动绑定的字段不会被自动查找覆盖。

通过自动绑定功能，可大幅减少前期配置工作，让 UI 脚本更具复用性和容错性。
