---
title: 基本DICOM序列加载
---
# 基本DICOM序列加载

这是Loading模块最基础的使用方式，演示如何在Unity场景中加载一组DICOM文件。

## 前置准备

### 1. 场景设置

在Unity场景中创建一个空GameObject，命名为`DicomLoader`:

```csharp
// 在Inspector中添加DicomSeriesLoader组件
// 或者通过代码添加
DicomSeriesLoader loader = gameObject.AddComponent<DicomSeriesLoader>();
```

### 2. 数据准备

将DICOM文件放置在`StreamingAssets/DICOM`目录下:

```
Assets/
└── StreamingAssets/
    └── DICOM/
        ├── slice001.dcm
        ├── slice002.dcm
        └── ...
```

## 基本加载代码

创建控制脚本，实现最简单的加载流程:

```csharp
using UnityEngine;
using MedicalMR.DICOM.Loading;
using MedicalMR.DICOM.Core;

public class BasicLoadingExample : MonoBehaviour
{
    [SerializeField] private DicomSeriesLoader loader;
    
    void Start()
    {
        // 获取或添加加载器组件
        if (loader == null)
            loader = GetComponent<DicomSeriesLoader>();
        
        // 订阅基本事件
        loader.OnLoadingComplete.AddListener(OnLoadingComplete);
        loader.OnLoadingFailed.AddListener(OnLoadingFailed);
        
        // 开始加载
        loader.StartLoading();
    }
    
    private void OnLoadingComplete(object result, Vector3Int dimensions, 
                                   Vector3 spacing, Vector3 origin)
    {
        DicomSeries series = result as DicomSeries;
        Debug.Log($"加载完成！切片数量: {series.Slices.Count}");
        Debug.Log($"体积尺寸: {dimensions}");
        Debug.Log($"体素间距: {spacing}");
        Debug.Log($"体积原点: {origin}");
    }
    
    private void OnLoadingFailed(string error)
    {
        Debug.LogError($"加载失败: {error}");
    }
}
```

## 加载器配置

在Inspector面板中配置`DicomSeriesLoader`组件的参数:

- **Dicom Folder Path**: `DICOM` (默认值)
- **Use Absolute Path**: 不勾选 (使用相对路径)
- **Verbose Logging**: 勾选 (启用详细日志)
- **Log Progress**: 勾选 (显示加载进度)

## 运行结果

运行场景后，控制台将显示:

```
[DicomSeriesLoader] 开始加载DICOM序列（数据集: DICOM）
[DicomSeriesLoader] 尝试加载索引文件: dicom_index.json
[DicomSeriesLoader] 索引解析完成，共 100 个文件
[DicomSeriesLoader] 加载完成 - 数据集: DICOM, 尺寸: (512, 512, 100)
```

## 常见问题

### 索引文件缺失

如果没有`dicom_index.json`文件，加载器会自动扫描目录并生成:

```json
{
  "slices": [
    { "path": "DICOM/slice001.dcm" },
    { "path": "DICOM/slice002.dcm" }
  ]
}
```

### 加载失败

最常见的失败原因:
- DICOM文件路径错误
- 文件格式不正确
- 缺少像素数据

检查控制台的详细错误信息来定位问题。