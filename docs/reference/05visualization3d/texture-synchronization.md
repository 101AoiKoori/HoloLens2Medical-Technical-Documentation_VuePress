---
title: 纹理同步与转换
---

# 纹理同步与转换

当在 2D 界面和 3D 场景之间共享图像时，需要将 UI 的 `RenderTexture` 转换为 3D 平面可用的 `Texture2D`。`DicomTextureBridge` 负责监听 MPRViewer 的事件并执行转换。本模块解释如何进行纹理同步和转换。

## 定义

纹理同步涉及以下关键部分:

| 名称 | 描述 |
|----|----|
| **Initialize()** | 在脚本启用时调用，查找 `mprViewer`、`dicomSeries`、`sliceManager`，绑定 RawImage 并注册事件。 |
| **ConvertAndUpdateAllTextures()** | 立即将三个方向的 RawImage 纹理转换为 `Texture2D` 并更新到 3D 平面。 |
| **ConvertAndUpdateAxialTexture() / ConvertAndUpdateSagittalTexture() / ConvertAndUpdateCoronalTexture()** | 分别转换并更新单个方向的纹理。 |
| **textureFilterMode** | 转换后纹理的过滤模式，可设置为 `Point`、`Bilinear` 等。 |
| **enableLogging** | 开启调试信息输出。 |
| **OnSliceChanged / OnDicomLoaded / OnWindowLevelChanged** | MPRViewer 触发的事件，桥接器会在这些事件发生时更新纹理。 |

转换流程大致如下:

1. 使用反射从 `mprViewer` 获取 `axialImage`、`sagittalImage` 和 `coronalImage` 三个私有 `RawImage` 字段。
2. 在切片变化时获取其 `RawImage.texture`，通常是一个 `RenderTexture`。
3. 创建临时 `RenderTexture` 并使用 `Graphics.Blit()` 拷贝像素。
4. 创建 `Texture2D`，读取像素并对 RGB 进行灰度均衡处理。
5. 设置过滤模式和包裹模式并 `Apply()`。
6. 将生成的 `Texture2D` 通过 `sliceManager` 传递给对应的平面控制器。

## 使用方法

1. 创建并挂载 `DicomTextureBridge` 组件，设置 `mprViewer` 和 `sliceManager` 引用。`dicomSeries` 通常自动从 `mprViewer` 获取，不需要手动设置。
2. 调整 `textureFilterMode` 和 `enableLogging` 以满足需求。
3. 调用 `Initialize()`（通常在 `Start()` 中自动执行），桥接器会注册事件并开始监听纹理变化。
4. 当需要手动刷新纹理时，可调用 `ConvertAndUpdateAllTextures()`。

## 使用示例

以下示例展示了如何配置桥接器并在窗宽窗位变化时刷新纹理:

```csharp
// 配置桥接器
var bridgeGO = new GameObject("Bridge");
var bridge = bridgeGO.AddComponent<DicomTextureBridge>();
bridge.mprViewer = mprViewer;
bridge.sliceManager = sliceManager;
bridge.textureFilterMode = FilterMode.Bilinear;
bridge.enableLogging = true;
// 初始化
bridge.Initialize();
// 当窗位窗宽调节时（UI 控件触发）
public void OnWindowLevelChanged(float center, float width)
{
    // 通知 MPRViewer 调整窗宽窗位
    mprViewer.SetWindowLevel(center, width);
    // 手动刷新 3D 平面
    bridge.ConvertAndUpdateAllTextures();
}
```

通过使用桥接器，可确保 UI 和 3D 场景始终显示一致的切片图像，不会因为数据格式不同而出现不同步问题。
