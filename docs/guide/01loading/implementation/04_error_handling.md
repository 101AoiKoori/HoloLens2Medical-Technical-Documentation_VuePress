# 错误处理与异常管理

Loading模块需要处理多种类型的错误，包括文件读取失败、DICOM解析错误、像素数据提取失败等。本文介绍完整的错误处理策略。

## 错误分类与处理

### 1. 索引文件相关错误

```csharp
public class IndexErrorHandler : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    
    void Start()
    {
        // 订阅加载失败事件
        loader.OnLoadingFailed.AddListener(HandleLoadingFailure);
        
        // 订阅日志事件以捕获详细错误信息
        loader.OnLogMessage += HandleLogMessage;
    }
    
    private void HandleLoadingFailure(string errorMessage)
    {
        if (errorMessage.Contains("索引文件"))
        {
            Debug.LogError("索引文件错误，尝试解决方案...");
            TryFixIndexFile();
        }
        else if (errorMessage.Contains("未成功加载任何DICOM切片"))
        {
            Debug.LogError("所有DICOM文件加载失败，检查文件格式");
            ShowFileFormatError();
        }
        else if (errorMessage.Contains("数据验证失败"))
        {
            Debug.LogError("切片尺寸不一致，需要数据预处理");
            ShowValidationError();
        }
    }
    
    private void TryFixIndexFile()
    {
        // 尝试重新生成索引文件
        Debug.Log("尝试重新生成索引文件...");
        
        // 如果是绝对路径模式，提示用户手动创建
        if (loader.useAbsolutePath)
        {
            ShowUI("绝对路径模式下需要手动创建索引文件");
        }
        else
        {
            // 相对路径模式会自动尝试生成
            ShowUI("系统将自动扫描DICOM目录并生成索引");
        }
    }
}
```

### 2. 单个文件加载错误

```csharp
public class FileLoadingErrorHandler : MonoBehaviour
{
    private int totalFiles = 0;
    private int failedFiles = 0;
    private List<string> failedFilesList = new List<string>();
    
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        loader.OnLogMessage += TrackFileErrors;
        loader.OnLoadingComplete.AddListener(ReportLoadingSummary);
    }
    
    private void TrackFileErrors(string message)
    {
        // 解析日志信息统计错误
        if (message.Contains("索引解析完成，共"))
        {
            // 提取总文件数
            var parts = message.Split(' ');
            int.TryParse(parts[3], out totalFiles);
        }
        else if (message.Contains("加载失败：无法读取文件"))
        {
            failedFiles++;
            
            // 提取失败的文件名
            int startIndex = message.LastIndexOf(' ') + 1;
            string fileName = message.Substring(startIndex);
            failedFilesList.Add(fileName);
            
            Debug.LogWarning($"文件读取失败: {fileName}");
        }
        else if (message.Contains("无效的DICOM文件"))
        {
            failedFiles++;
            
            // 记录无效的DICOM文件
            int startIndex = message.LastIndexOf(' ') + 1;
            string fileName = message.Substring(startIndex);
            failedFilesList.Add(fileName);
            
            Debug.LogWarning($"DICOM文件无效: {fileName}");
        }
        else if (message.Contains("像素数据提取失败"))
        {
            failedFiles++;
            
            // 记录像素数据提取失败的文件
            int startIndex = message.LastIndexOf(' ') + 1;
            string fileName = message.Substring(startIndex);
            failedFilesList.Add(fileName);
            
            Debug.LogWarning($"像素数据提取失败: {fileName}");
        }
    }
    
    private void ReportLoadingSummary(object result, Vector3Int dimensions, 
                                      Vector3 spacing, Vector3 origin)
    {
        int successFiles = totalFiles - failedFiles;
        float successRate = (float)successFiles / totalFiles * 100f;
        
        Debug.Log($"加载汇总:");
        Debug.Log($"总文件数: {totalFiles}");
        Debug.Log($"成功加载: {successFiles}");
        Debug.Log($"失败文件: {failedFiles}");
        Debug.Log($"成功率: {successRate:F1}%");
        
        if (failedFiles > 0)
        {
            Debug.LogWarning($"失败文件列表: {string.Join(", ", failedFilesList)}");
            
            // 如果失败率过高，显示警告
            if (successRate < 80f)
            {
                ShowUI("警告：文件失败率过高，请检查DICOM数据质量");
            }
        }
    }
}
```

### 3. 数据验证错误

```csharp
public class ValidationErrorHandler : MonoBehaviour
{
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        loader.OnLogMessage += HandleValidationErrors;
    }
    
    private void HandleValidationErrors(string message)
    {
        if (message.Contains("像素数据长度不匹配"))
        {
            Debug.LogError("检测到像素数据长度不匹配，可能的原因：");
            Debug.LogError("1. DICOM文件损坏");
            Debug.LogError("2. 压缩格式不支持");
            Debug.LogError("3. 位深设置错误");
            
            ShowUI("建议使用DICOM验证工具检查文件完整性");
        }
        else if (message.Contains("警告：检测到不一致的切片尺寸"))
        {
            Debug.LogError("切片尺寸不一致，这会导致体积重建失败");
            Debug.LogError("需要对DICOM数据进行预处理，确保所有切片具有相同的分辨率");
            
            ShowUI("请使用医学影像处理软件将所有切片调整为相同尺寸");
        }
    }
}
```

## 异常捕获与恢复

### 1. 协程异常处理

```csharp
public class SafeLoadingWrapper : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    private Coroutine safeLoadingCoroutine;
    
    public void StartSafeLoading()
    {
        if (safeLoadingCoroutine != null)
        {
            StopCoroutine(safeLoadingCoroutine);
        }
        
        safeLoadingCoroutine = StartCoroutine(SafeLoadingCoroutine());
    }
    
    private IEnumerator SafeLoadingCoroutine()
    {
        try
        {
            // 预检查
            if (!PreLoadingCheck())
            {
                yield break;
            }
            
            // 开始加载
            loader.StartLoading();
            
            // 监控加载过程
            yield return MonitorLoadingProcess();
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"加载过程中发生未捕获的异常: {ex.Message}");
            Debug.LogError(ex.StackTrace);
            
            // 强制停止加载
            loader.StopLoading();
            
            // 清理资源
            System.GC.Collect();
        }
    }
    
    private bool PreLoadingCheck()
    {
        // 检查StreamingAssets目录
        if (!loader.useAbsolutePath)
        {
            string dicomPath = Path.Combine(Application.streamingAssetsPath, 
                                           loader.dicomFolderPath);
            if (!Directory.Exists(dicomPath))
            {
                Debug.LogError($"DICOM目录不存在: {dicomPath}");
                return false;
            }
        }
        
        // 检查内存状况
        long availableMemory = System.GC.GetTotalMemory(false);
        if (availableMemory > 500 * 1024 * 1024) // 500MB阈值
        {
            Debug.LogWarning("当前内存使用较高，建议先清理内存");
            System.GC.Collect();
        }
        
        return true;
    }
    
    private IEnumerator MonitorLoadingProcess()
    {
        float timeout = 300f; // 5分钟超时
        float startTime = Time.time;
        
        while (loader.isLoading)
        {
            if (Time.time - startTime > timeout)
            {
                Debug.LogError("加载超时，强制停止");
                loader.StopLoading();
                yield break;
            }
            
            yield return new WaitForSeconds(1f);
        }
    }
}
```

### 2. 内存压力处理

```csharp
public class MemoryPressureHandler : MonoBehaviour
{
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        loader.OnLogMessage += MonitorMemoryUsage;
    }
    
    private void MonitorMemoryUsage(string message)
    {
        // 在关键节点检查内存使用
        if (message.Contains("开始加载DICOM文件"))
        {
            CheckMemoryAndCleanup();
        }
        else if (message.Contains("切片排序完成"))
        {
            CheckMemoryAndCleanup();
        }
    }
    
    private void CheckMemoryAndCleanup()
    {
        long memoryBefore = System.GC.GetTotalMemory(false);
        
        if (memoryBefore > 800 * 1024 * 1024) // 800MB阈值
        {
            Debug.LogWarning($"内存使用过高: {memoryBefore / (1024 * 1024)}MB，执行垃圾回收");
            
            System.GC.Collect();
            System.GC.WaitForPendingFinalizers();
            System.GC.Collect();
            
            long memoryAfter = System.GC.GetTotalMemory(false);
            Debug.Log($"垃圾回收后内存: {memoryAfter / (1024 * 1024)}MB");
        }
    }
}
```

## 错误恢复策略

### 1. 自动重试机制

```csharp
public class AutoRetryLoader : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    [SerializeField] private int maxRetryAttempts = 3;
    private int currentAttempt = 0;
    
    void Start()
    {
        loader.OnLoadingFailed.AddListener(HandleRetry);
        loader.OnLoadingComplete.AddListener(OnSuccessfulLoad);
    }
    
    private void HandleRetry(string error)
    {
        currentAttempt++;
        
        if (currentAttempt <= maxRetryAttempts)
        {
            Debug.LogWarning($"加载失败，尝试第 {currentAttempt} 次重试: {error}");
            
            // 等待一段时间后重试
            StartCoroutine(RetryAfterDelay(2f));
        }
        else
        {
            Debug.LogError($"重试 {maxRetryAttempts} 次后仍然失败，放弃加载");
            ShowFinalErrorMessage(error);
        }
    }
    
    private IEnumerator RetryAfterDelay(float delay)
    {
        yield return new WaitForSeconds(delay);
        
        // 清理资源后重试
        System.GC.Collect();
        loader.StartLoading();
    }
    
    private void OnSuccessfulLoad(object result, Vector3Int dimensions, 
                                  Vector3 spacing, Vector3 origin)
    {
        if (currentAttempt > 0)
        {
            Debug.Log($"重试成功！经过 {currentAttempt} 次尝试后加载完成");
        }
        currentAttempt = 0; // 重置重试计数
    }
}
```

### 2. 部分加载处理

```csharp
public class PartialLoadingHandler : MonoBehaviour
{
    [SerializeField] private float minimumSuccessRate = 0.5f; // 50%最低成功率
    
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        loader.OnLogMessage += AnalyzePartialLoading;
    }
    
    private void AnalyzePartialLoading(string message)
    {
        // 分析进度信息中的成功/失败比例
        if (message.Contains("加载中") && message.Contains("成功:") && message.Contains("失败:"))
        {
            // 解析成功和失败数量
            var parts = message.Split(',');
            int successCount = ExtractNumber(parts[1], "成功:");
            int failedCount = ExtractNumber(parts[2], "失败:");
            
            int totalProcessed = successCount + failedCount;
            float currentSuccessRate = (float)successCount / totalProcessed;
            
            if (currentSuccessRate < minimumSuccessRate && totalProcessed > 10)
            {
                Debug.LogWarning($"当前成功率过低: {currentSuccessRate:P0}，建议检查数据质量");
            }
        }
    }
    
    private int ExtractNumber(string text, string prefix)
    {
        int startIndex = text.IndexOf(prefix) + prefix.Length;
        int endIndex = text.Length;
        
        string numberStr = text.Substring(startIndex, endIndex - startIndex).Trim();
        int.TryParse(numberStr, out int result);
        return result;
    }
}
```

## 用户友好的错误提示

### 1. 本地化错误消息

```csharp
public class LocalizedErrorMessages : MonoBehaviour
{
    private Dictionary<string, string> errorMessages = new Dictionary<string, string>
    {
        { "索引文件加载失败", "无法找到或读取索引文件，请检查DICOM数据目录" },
        { "未成功加载任何DICOM切片", "所有DICOM文件都无法加载，请检查文件格式和完整性" },
        { "数据验证失败", "DICOM数据不一致，请确保所有切片具有相同的尺寸" },
        { "像素数据提取失败", "无法提取图像数据，可能是压缩格式不支持" }
    };
    
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        loader.OnLoadingFailed.AddListener(ShowFriendlyError);
    }
    
    private void ShowFriendlyError(string technicalError)
    {
        string friendlyMessage = "加载DICOM数据时发生错误";
        
        foreach (var kvp in errorMessages)
        {
            if (technicalError.Contains(kvp.Key))
            {
                friendlyMessage = kvp.Value;
                break;
            }
        }
        
        // 显示用户友好的错误消息
        ShowErrorDialog(friendlyMessage, technicalError);
    }
    
    private void ShowErrorDialog(string userMessage, string technicalDetails)
    {
        Debug.LogError($"用户消息: {userMessage}");
        Debug.LogError($"技术细节: {technicalDetails}");
        
        // 在UI中显示错误对话框
        // 用户看到友好消息，开发者可以查看技术细节
    }
}
```

### 2. 错误预防建议

```csharp
public class ErrorPreventionTips : MonoBehaviour
{
    [ContextMenu("检查DICOM数据质量")]
    public void CheckDicomDataQuality()
    {
        string dicomPath = Path.Combine(Application.streamingAssetsPath, "DICOM");
        
        if (!Directory.Exists(dicomPath))
        {
            Debug.LogError("DICOM目录不存在，请创建StreamingAssets/DICOM目录");
            return;
        }
        
        string[] files = Directory.GetFiles(dicomPath, "*.dcm");
        
        if (files.Length == 0)
        {
            Debug.LogWarning("DICOM目录中没有.dcm文件");
            return;
        }
        
        Debug.Log($"找到 {files.Length} 个DICOM文件");
        
        // 检查索引文件
        string indexPath = Path.Combine(Application.streamingAssetsPath, "dicom_index.json");
        if (!File.Exists(indexPath))
        {
            Debug.LogWarning("没有找到索引文件，将使用自动生成模式");
        }
        else
        {
            Debug.Log("索引文件存在，将按索引顺序加载");
        }
        
        // 检查文件大小
        long totalSize = files.Sum(f => new FileInfo(f).Length);
        Debug.Log($"DICOM数据总大小: {totalSize / (1024 * 1024)}MB");
        
        if (totalSize > 1024 * 1024 * 1024) // 1GB
        {
            Debug.LogWarning("数据量较大，加载可能需要较长时间，建议启用进度监控");
        }
    }
}
```

通过这些完整的错误处理机制，Loading模块能够：

1. **预防错误**: 在加载前进行预检查
2. **捕获异常**: 在各个阶段捕获不同类型的错误
3. **提供反馈**: 给用户友好的错误提示和解决建议
4. **自动恢复**: 实现重试和部分加载容错机制
5. **资源管理**: 在错误发生时正确清理资源