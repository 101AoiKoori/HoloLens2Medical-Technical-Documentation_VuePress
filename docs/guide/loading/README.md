# Loading模块:从索引加载 DICOM 序列

> 本页目标：完成从本地资源文件夹加载一套 DICOM 序列到场景，拿到体素信息，并触发进度/完成/失败事件。

## 本章完成后你将会

* 在场景中添加并配置 **DicomSeriesLoader** 组件
* 使用按钮一键触发加载流程 `StartLoading()` / `StopLoading()`
* 订阅 `OnLoadingStatusChanged` / `OnLoadingComplete` / `OnLoadingFailed`
* 了解 `StreamingAssets` 与 **绝对路径** 两种读法的差异

## 前置条件

* Unity（建议 2021 LTS+）
* MRTK3 已导入
* 目标平台：UWP（HoloLens 2）或 PC Standalone
* 资源放置：

  * 推荐：`Assets/StreamingAssets/DICOM/YourSeries/` 目录下放置若干 `.dcm`
  * 可选：同级放置 `dicom_index.json`（未提供也没关系，会自动扫描生成）

> **提示**
> 序列越完整、文件命名越规范，自动索引和排序越稳定。建议使用 4 位或 5 位递增序号命名切片：`0001.dcm, 0002.dcm, ...`。

## 场景搭建

1. 在层级面板中创建空物体 `DICOM_Loader`
2. 添加组件 **DicomSeriesLoader**（命名空间：`MedicalMR.DICOM.Loading`）
3. 在 Inspector 设置：

   * **Dicom Folder Path**：例如 `DICOM/YourSeries/`（相对 `StreamingAssets`）
   * **Use Absolute Path**：默认关闭；若勾选，输入绝对路径（见 How‑to 篇）
   * **Verbose Logging**：可选，打印更详细的加载日志
4. 新建脚本 `DicomLoadDemo.cs`，挂在同一物体上，并绑定一个 UI Button 的 OnClick → `DoLoad()`

```csharp
using UnityEngine;
using MedicalMR.DICOM.Loading;

public class DicomLoadDemo : MonoBehaviour
{
    public DicomSeriesLoader loader;

    void Awake()
    {
        // 进度 & 状态
        loader.OnLoadingStatusChanged.AddListener((p, s) =>
            Debug.Log($"[Loading] {p:P0} - {s}"));

        // 成功
        loader.OnLoadingComplete.AddListener((seriesObj, dims, spacing, origin) =>
        {
            Debug.Log($"[Completed] dims={dims} spacing={spacing} origin={origin}");
            // TODO: 将结果传给你的 Viewer / UI 层
        });

        // 失败
        loader.OnLoadingFailed.AddListener(err => Debug.LogError($"[Failed] {err}"));
    }

    public void DoLoad()  => loader.StartLoading();
    public void Cancel()  => loader.StopLoading();
}
```

> **验证**
> 运行后点击按钮，应看到 Console 持续打印进度，最终出现“Completed”日志；若路径错误或索引为空，会收到“Failed”日志。

## 索引文件（可选）

若手动提供 `dicom_index.json`，推荐结构如下：

```json
{
  "slices": [
    { "path": "DICOM/YourSeries/0001.dcm" },
    { "path": "DICOM/YourSeries/0002.dcm" }
  ]
}
```

> **说明**
> 未提供索引时，加载器会在目标目录中扫描 `.dcm` 文件并生成同结构的索引后再加载。索引减少 UWP 文件系统限制带来的不确定性，也能避免错读其它格式。

## 常见目录结构

```
Assets/
  StreamingAssets/
    DICOM/
      YourSeries/
        0001.dcm
        0002.dcm
        ...
        dicom_index.json   # 可选
```

## 下一步

* [绑定进度条与状态文本](./how-to/bind-progress.html)
* [改为绝对路径加载（PC/HL2）](./how-to/load-from-absolute-path.html)
* [理解：完整加载流水线与数据结构](./explanations/flow.html)
* [故障排除：路径、JSON、黑屏等](./troubleshooting/common-issues.html)