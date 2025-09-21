# 绝对路径加载

当DICOM数据不在Unity的StreamingAssets目录中时，可以使用绝对路径模式从外部目录加载数据。这在处理大型数据集或用户选择的数据时特别有用。

## 基本配置

### 1. 启用绝对路径模式

```csharp
using UnityEngine;
using MedicalMR.DICOM.Loading;

public class AbsolutePathLoader : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    [SerializeField] private string absolutePath = @"C:\MedicalData\Patient001";
    
    void Start()
    {
        // 配置绝对路径加载
        loader.useAbsolutePath = true;
        loader.dicomFolderPath = absolutePath;
        
        // 订阅事件
        loader.OnLoadingComplete.AddListener(OnLoadComplete);
        loader.OnLoadingFailed.AddListener(OnLoadFailed);
        
        // 开始加载
        loader.StartLoading();
    }
    
    private void OnLoadComplete(object result, Vector3Int dimensions, 
                                Vector3 spacing, Vector3 origin)
    {
        Debug.Log($"从绝对路径加载完成: {absolutePath}");
        Debug.Log($"加载了 {dimensions.z} 张切片");
    }
    
    private void OnLoadFailed(string error)
    {
        Debug.LogError($"绝对路径加载失败: {error}");
        Debug.LogError($"路径: {absolutePath}");
    }
}
```

### 2. 路径格式处理

根据`GetFullPath()`方法的实现，系统会自动处理不同的路径格式：

```csharp
public class PathFormatExample : MonoBehaviour
{
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        loader.useAbsolutePath = true;
        
        // 这些路径格式都会被正确处理：
        
        // Windows风格路径
        loader.dicomFolderPath = @"C:\MedicalData\Series1";
        
        // Unix风格路径  
        loader.dicomFolderPath = "/home/user/medical/series1";
        
        // 已经是URI格式的路径
        loader.dicomFolderPath = "file:///C:/MedicalData/Series1";
        
        // 包含空格的路径
        loader.dicomFolderPath = @"C:\Medical Data\Patient 001";
    }
}
```

## 文件夹选择器集成

### 1. Windows文件夹选择

```csharp
using UnityEngine;
using System.Windows.Forms; // 需要引用System.Windows.Forms
using MedicalMR.DICOM.Loading;

public class FolderPickerLoader : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    
    public void SelectAndLoadFolder()
    {
        #if UNITY_EDITOR || UNITY_STANDALONE_WIN
        
        FolderBrowserDialog folderDialog = new FolderBrowserDialog();
        folderDialog.Description = "选择包含DICOM文件的文件夹";
        folderDialog.ShowNewFolderButton = false;
        
        if (folderDialog.ShowDialog() == DialogResult.OK)
        {
            string selectedPath = folderDialog.SelectedPath;
            Debug.Log($"用户选择了路径: {selectedPath}");
            
            // 验证路径中是否包含DICOM文件
            if (ValidateDicomFolder(selectedPath))
            {
                LoadFromAbsolutePath(selectedPath);
            }
            else
            {
                Debug.LogError("选择的文件夹中没有找到DICOM文件");
            }
        }
        
        #else
        Debug.LogWarning("文件夹选择器仅在Windows平台支持");
        #endif
    }
    
    private bool ValidateDicomFolder(string path)
    {
        if (!System.IO.Directory.Exists(path))
            return false;
            
        // 检查是否包含.dcm文件
        string[] dcmFiles = System.IO.Directory.GetFiles(path, "*.dcm");
        return dcmFiles.Length > 0;
    }
    
    private void LoadFromAbsolutePath(string absolutePath)
    {
        loader.useAbsolutePath = true;
        loader.dicomFolderPath = absolutePath;
        
        // 生成索引文件名
        string folderName = System.IO.Path.GetFileName(absolutePath);
        string indexFileName = folderName.ToLower() + "_index.json";
        
        Debug.Log($"将使用索引文件: {indexFileName}");
        
        loader.StartLoading();
    }
}
```

### 2. 跨平台文件选择

```csharp
using UnityEngine;
using MedicalMR.DICOM.Loading;

public class CrossPlatformFileSelector : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    
    public void SelectDicomFolder()
    {
        #if UNITY_EDITOR
        string path = UnityEditor.EditorUtility.OpenFolderPanel(
            "选择DICOM文件夹", "", "");
        if (!string.IsNullOrEmpty(path))
        {
            LoadFromPath(path);
        }
        
        #elif UNITY_STANDALONE_WIN
        // Windows运行时使用系统对话框
        SelectAndLoadFolder(); // 调用上面的Windows方法
        
        #elif UNITY_STANDALONE_OSX
        // macOS运行时的处理
        Debug.LogWarning("macOS平台请手动设置absolutePath");
        
        #else
        Debug.LogWarning("当前平台不支持文件夹选择器");
        #endif
    }
    
    private void LoadFromPath(string selectedPath)
    {
        Debug.Log($"选择的路径: {selectedPath}");
        
        loader.useAbsolutePath = true;
        loader.dicomFolderPath = selectedPath;
        loader.StartLoading();
    }
}
```

## 索引文件管理

### 1. 自动创建索引文件

绝对路径模式下不会自动生成索引，需要手动创建：

```csharp
public class AbsolutePathIndexCreator : MonoBehaviour
{
    [SerializeField] private string targetDirectory;
    
    [ContextMenu("为绝对路径创建索引")]
    public void CreateIndexForAbsolutePath()
    {
        if (!System.IO.Directory.Exists(targetDirectory))
        {
            Debug.LogError($"目录不存在: {targetDirectory}");
            return;
        }
        
        // 扫描DICOM文件
        string[] dcmFiles = System.IO.Directory.GetFiles(targetDirectory, "*.dcm");
        
        if (dcmFiles.Length == 0)
        {
            Debug.LogWarning("目录中没有找到DICOM文件");
            return;
        }
        
        // 创建索引数据
        var indexData = new IndexData();
        indexData.slices = new System.Collections.Generic.List<SliceEntry>();
        
        foreach (string file in dcmFiles)
        {
            string fileName = System.IO.Path.GetFileName(file);
            indexData.slices.Add(new SliceEntry { path = fileName });
        }
        
        // 生成JSON
        string json = JsonUtility.ToJson(indexData, true);
        
        // 保存索引文件
        string folderName = System.IO.Path.GetFileName(targetDirectory);
        string indexFileName = folderName.ToLower() + "_index.json";
        string indexPath = System.IO.Path.Combine(targetDirectory, indexFileName);
        
        System.IO.File.WriteAllText(indexPath, json);
        
        Debug.Log($"索引文件已创建: {indexPath}");
        Debug.Log($"包含 {dcmFiles.Length} 个DICOM文件");
    }
    
    [System.Serializable]
    private class IndexData
    {
        public System.Collections.Generic.List<SliceEntry> slices;
    }
    
    [System.Serializable]
    private class SliceEntry
    {
        public string path;
    }
}
```

### 2. 验证绝对路径索引

```csharp
public class AbsolutePathValidator : MonoBehaviour
{
    public bool ValidateAbsolutePathSetup(string absolutePath)
    {
        // 检查目录存在性
        if (!System.IO.Directory.Exists(absolutePath))
        {
            Debug.LogError($"目录不存在: {absolutePath}");
            return false;
        }
        
        // 检查DICOM文件
        string[] dcmFiles = System.IO.Directory.GetFiles(absolutePath, "*.dcm");
        if (dcmFiles.Length == 0)
        {
            Debug.LogError($"目录中没有DICOM文件: {absolutePath}");
            return false;
        }
        
        // 检查索引文件
        string folderName = System.IO.Path.GetFileName(absolutePath);
        string indexFileName = folderName.ToLower() + "_index.json";
        string indexPath = System.IO.Path.Combine(absolutePath, indexFileName);
        
        if (!System.IO.File.Exists(indexPath))
        {
            Debug.LogWarning($"索引文件不存在: {indexPath}");
            Debug.LogWarning("将无法进行加载，请创建索引文件");
            return false;
        }
        
        // 验证索引文件内容
        try
        {
            string indexContent = System.IO.File.ReadAllText(indexPath);
            var paths = JSONIndexParser.Parse(indexContent);
            
            if (paths == null || paths.Count == 0)
            {
                Debug.LogError("索引文件解析失败或为空");
                return false;
            }
            
            Debug.Log($"验证通过: {dcmFiles.Length} 个DICOM文件, 索引包含 {paths.Count} 个条目");
            return true;
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"索引文件验证失败: {ex.Message}");
            return false;
        }
    }
}
```

## UWP平台特殊处理

### 1. UWP文件访问权限

```csharp
public class UWPAbsolutePathLoader : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    
    void Start()
    {
        #if UNITY_WSA && !UNITY_EDITOR
        LoadFromUWPFolder();
        #else
        LoadFromStandardPath();
        #endif
    }
    
    #if UNITY_WSA && !UNITY_EDITOR
    private async void LoadFromUWPFolder()
    {
        try
        {
            // UWP平台使用StorageFolder
            var picker = new Windows.Storage.Pickers.FolderPicker();
            picker.SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.DocumentsLibrary;
            picker.FileTypeFilter.Add(".dcm");
            
            Windows.Storage.StorageFolder folder = await picker.PickSingleFolderAsync();
            
            if (folder != null)
            {
                string folderPath = folder.Path;
                Debug.Log($"UWP选择的文件夹: {folderPath}");
                
                loader.useAbsolutePath = true;
                loader.dicomFolderPath = folderPath;
                loader.StartLoading();
            }
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"UWP文件夹选择失败: {ex.Message}");
        }
    }
    #endif
    
    private void LoadFromStandardPath()
    {
        // 标准平台的处理
        string standardPath = @"C:\MedicalData\DefaultSeries";
        
        loader.useAbsolutePath = true;
        loader.dicomFolderPath = standardPath;
        loader.StartLoading();
    }
}
```

## 性能优化建议

### 1. 大文件夹处理

```csharp
public class LargeFolderOptimizer : MonoBehaviour
{
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        loader.OnLogMessage += OptimizeForLargeDataset;
    }
    
    private void OptimizeForLargeDataset(string message)
    {
        if (message.Contains("索引解析完成，共"))
        {
            // 提取文件数量
            var parts = message.Split(' ');
            if (int.TryParse(parts[3], out int fileCount))
            {
                if (fileCount > 500) // 大数据集
                {
                    Debug.Log("检测到大数据集，启用性能优化模式");
                    
                    // 建议进行内存清理
                    System.GC.Collect();
                    
                    // 可以在这里调整其他性能参数
                    OptimizeForLargeDataset(fileCount);
                }
            }
        }
    }
    
    private void OptimizeForLargeDataset(int fileCount)
    {
        Debug.Log($"为 {fileCount} 个文件的大数据集优化性能设置");
        
        // 建议用户关闭其他程序释放内存
        if (fileCount > 1000)
        {
            Debug.LogWarning("数据集非常大，建议关闭其他应用程序以释放内存");
        }
    }
}
```

### 2. 网络路径支持

```csharp
public class NetworkPathLoader : MonoBehaviour
{
    [SerializeField] private string networkPath = @"\\server\medical\patient001";
    
    void Start()
    {
        var loader = GetComponent<DicomSeriesLoader>();
        
        if (IsNetworkPath(networkPath))
        {
            Debug.Log("检测到网络路径，启用网络优化模式");
            SetupNetworkLoading(loader);
        }
    }
    
    private bool IsNetworkPath(string path)
    {
        return path.StartsWith(@"\\") || path.StartsWith("//");
    }
    
    private void SetupNetworkLoading(DicomSeriesLoader loader)
    {
        loader.useAbsolutePath = true;
        loader.dicomFolderPath = networkPath;
        
        // 网络路径加载需要更长的超时时间
        Debug.Log("网络路径加载可能需要更长时间，请耐心等待");
        
        loader.StartLoading();
    }
}
```

绝对路径模式为Loading模块提供了灵活的数据源访问能力，特别适用于：

1. **大型数据集**: 不受StreamingAssets限制
2. **用户选择**: 支持动态选择数据目录  
3. **网络存储**: 可以访问网络共享目录
4. **开发调试**: 直接访问开发机器上的测试数据