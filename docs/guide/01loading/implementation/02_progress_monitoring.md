---
title: 进度监控与状态显示
---
# 进度监控与状态显示

详细介绍如何监控DICOM加载进度并在UI中显示状态信息。

## 进度事件监听

`DicomSeriesLoader`通过`OnLoadingStatusChanged`事件实时报告加载进度:

```csharp
using UnityEngine;
using UnityEngine.UI;
using MedicalMR.DICOM.Loading;

public class LoadingProgressMonitor : MonoBehaviour
{
    [Header("UI引用")]
    [SerializeField] private Slider progressBar;
    [SerializeField] private Text statusText;
    [SerializeField] private Button loadButton;
    [SerializeField] private Button cancelButton;
    
    [Header("加载器")]
    [SerializeField] private DicomSeriesLoader loader;
    
    void Start()
    {
        // 订阅所有加载事件
        loader.OnLoadingStatusChanged.AddListener(OnProgressUpdate);
        loader.OnLoadingComplete.AddListener(OnLoadingComplete);
        loader.OnLoadingFailed.AddListener(OnLoadingFailed);
        
        // 绑定按钮事件
        loadButton.onClick.AddListener(StartLoading);
        cancelButton.onClick.AddListener(CancelLoading);
        
        // 初始化UI状态
        SetUIState(false);
    }
    
    private void OnProgressUpdate(float progress, string status)
    {
        // 更新进度条 (0.0 - 1.0)
        progressBar.value = progress;
        
        // 更新状态文本
        statusText.text = $"{status} ({progress:P0})";
        
        // 显示详细阶段信息
        DisplayProgressPhase(progress, status);
    }
    
    private void DisplayProgressPhase(float progress, string status)
    {
        string phase = "";
        
        if (progress < 0.1f)
            phase = "初始化阶段";
        else if (progress < 0.3f)
            phase = "索引文件处理";
        else if (progress < 0.9f)
            phase = "批量加载DICOM文件";
        else if (progress < 0.95f)
            phase = "数据排序与整理";
        else if (progress < 1.0f)
            phase = "体积属性设置";
        else
            phase = "加载完成";
            
        Debug.Log($"[{phase}] {status}");
    }
    
    private void StartLoading()
    {
        SetUIState(true);
        loader.StartLoading();
    }
    
    private void CancelLoading()
    {
        loader.StopLoading();
        SetUIState(false);
        statusText.text = "加载已取消";
        progressBar.value = 0f;
    }
    
    private void OnLoadingComplete(object result, Vector3Int dimensions, 
                                   Vector3 spacing, Vector3 origin)
    {
        SetUIState(false);
        statusText.text = $"加载完成 - {dimensions.z}张切片";
        progressBar.value = 1f;
    }
    
    private void OnLoadingFailed(string error)
    {
        SetUIState(false);
        statusText.text = $"加载失败: {error}";
        progressBar.value = 0f;
    }
    
    private void SetUIState(bool isLoading)
    {
        loadButton.interactable = !isLoading;
        cancelButton.interactable = isLoading;
    }
}
```

## 加载阶段说明

根据实际代码，加载过程分为以下几个主要阶段:

### 阶段1: 初始化 (0% - 5%)
- 准备目标DicomSeries
- 清理之前的资源
- 启动加载协程

### 阶段2: 索引处理 (5% - 20%)
- 读取或生成JSON索引文件
- 解析文件路径列表
- UTF-8 BOM字符处理

### 阶段3: 批量文件加载 (40% - 90%)
- 按索引顺序读取DICOM文件
- 解析DicomDataset
- 提取像素数据
- 创建DicomSlice对象
- 每5个文件更新一次进度

### 阶段4: 数据整理 (90% - 95%)
- 调用`targetSeries.SortSlices()`排序
- 基于Z轴位置排列切片

### 阶段5: 体积设置 (95% - 100%)
- 调用`SetVolumeProperties()`
- 推导体积尺寸、间距和原点
- 最终验证数据一致性

## 详细日志订阅

启用更详细的日志信息:

```csharp
void Start()
{
    // 订阅日志事件
    loader.OnLogMessage += OnLogMessage;
    
    // 启用详细日志
    loader.verboseLogging = true;
    loader.logProgress = true;
}

private void OnLogMessage(string message)
{
    // 将日志保存到文件或显示在UI面板
    Debug.Log(message);
    
    // 可以根据日志内容分析加载状态
    if (message.Contains("加载失败"))
    {
        // 处理单个文件失败
        Debug.LogWarning("检测到文件加载失败");
    }
}
```

## 超时检测

虽然基类包含超时机制，但可以添加自定义超时检测:

```csharp
private float loadingStartTime;
private float maxLoadingTime = 300f; // 5分钟超时

private void StartLoading()
{
    loadingStartTime = Time.time;
    SetUIState(true);
    loader.StartLoading();
    
    // 启动超时检测
    StartCoroutine(TimeoutCheck());
}

private IEnumerator TimeoutCheck()
{
    while (loader.isLoading)
    {
        if (Time.time - loadingStartTime > maxLoadingTime)
        {
            Debug.LogError("加载超时，强制取消");
            CancelLoading();
            yield break;
        }
        yield return new WaitForSeconds(1f);
    }
}
```