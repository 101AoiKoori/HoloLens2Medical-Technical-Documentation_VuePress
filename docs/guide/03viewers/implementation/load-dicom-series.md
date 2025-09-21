# 加载一套 DICOM 序列(最小流程)

> 目标：在运行时加载 DICOM 并显示三平面首帧。

## 步骤
1. 确保场景物体上含有 `DicomLoader`，若没有，MPRViewer 会自动添加 `DicomSeriesLoader`。  
2. 在代码中调用：
```csharp
using MedicalMR.DICOM.Viewers;
using MedicalMR.DICOM.Core;
using UnityEngine;

public class Demo : MonoBehaviour
{
    public MPRViewer viewer;

    void Start()
    {
        // 可先设置预设窗宽窗位
        // viewer.SetWindowLevel(2000f, 2000f); // 初始化后才会生效
        viewer.LoadDicomData();
        viewer.OnDicomLoaded += OnLoaded;
    }

    void OnLoaded(int axialCount)
    {
        Debug.Log($"Loaded. Axial slices: {axialCount}");
    }
}
```
3. 若启用了 **useProgressiveLoading**，会先出现轴向纹理再逐步出现矢状/冠状。  
4. 等待控制台出现“加载完成”相关日志，三张 `RawImage` 逐步显示。

## 常见问题
- 没有任何纹理：请确认 `RawImage` 引用绑定正确；检查资源路径与加载器设置。  
- 首帧只显示轴向：是正常的渐进模式行为。  

## 附加补充

- **设置路径**：`DicomLoader` 默认从 StreamingAssets 路径读取 DICOM 文件。UWP 平台下需要将数据复制到 `ApplicationData.Current.LocalFolder`，或在加载前使用 `UnityWebRequest` 从服务器下载数据到可读目录。
- **显示加载进度**：可以监听 `DicomSeriesLoader.OnProgressUpdated(float percent)`(或其实现)来更新进度条 UI。例如在进度回调中调用 `progressSlider.value = percent`；避免在回调中执行耗时操作。
- **统一窗位窗宽**：如果想在加载前就设定窗位/窗宽，可在 `OnDicomLoaded` 回调中调用 `viewer.SetWindowLevel()`，并确保 `useSmoothedWindowLevelChanges` 与速度参数适合当前序列的灰度范围。