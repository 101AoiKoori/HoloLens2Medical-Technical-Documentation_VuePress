# 绑定进度条与状态文本

> 目标：将 `OnLoadingStatusChanged` 的进度与说明文字绑定到 UI（Slider + Text）。

## 步骤

1. 在场景中放置 `Slider` 与 `Text`（或 TextMeshPro `TMP_Text`）
2. 新建脚本 `LoadingProgressUI.cs`，拖到 `DICOM_Loader` 上，并将引用拖拽到 Inspector
3. 运行测试

```csharp
using UnityEngine;
using UnityEngine.UI;
using TMPro; // 如使用 TextMeshPro
using MedicalMR.DICOM.Loading;

public class LoadingProgressUI : MonoBehaviour
{
    public DicomSeriesLoader loader;
    public Slider progressBar;
    public TMP_Text statusText; // 如果用内置 Text，请改为 UnityEngine.UI.Text

    void Awake()
    {
        loader.OnLoadingStatusChanged.AddListener((p, s) =>
        {
            if (progressBar) progressBar.value = p;        // p: [0,1]
            if (statusText)  statusText.text  = s ?? "";  // 状态文案
        });

        loader.OnLoadingComplete.AddListener((_, dims, spacing, origin) =>
        {
            if (statusText) statusText.text = $"完成：{dims}  spacing={spacing}";
        });

        loader.OnLoadingFailed.AddListener(err =>
        {
            if (statusText) statusText.text = $"失败：{err}";
        });
    }
}
```

> **提示**
> 若希望加载时禁用交互，结束后恢复，可在 `Awake()` 中在 `StartLoading()` 前后切换 CanvasGroup 的 `interactable`/`blocksRaycasts`。
