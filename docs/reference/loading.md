# Loading 模块 API 参考

命名空间：`MedicalMR.DICOM.Loading`

> 本页为 **Loading** 相关公共 API 的权威说明。只列出对外可见/需使用的成员；内部实现细节以教程与解释篇为准。

## DicomLoader（抽象基类 / MonoBehaviour）

**序列化字段**

* `string dicomFolderPath`：目标目录（相对 `StreamingAssets` 或绝对路径，取决于下项）
* `bool useAbsolutePath`：是否把上项视为绝对路径
* `bool verboseLogging`：是否打印详细日志

**事件**

* `OnLoadingStatusChanged(float progress, string status)`：进度与状态回报
* `OnLoadingComplete(object seriesObject, Vector3Int dims, Vector3 spacing, Vector3 origin)`：加载完成
* `OnLoadingFailed(string error)`：失败回报

**方法**

* `StartLoading()`：开始加载流程（抽象）
* `StopLoading()`：停止并清理（抽象）

## DicomSeriesLoader : DicomLoader

**用途**

* 从指定目录（或索引）读取 DICOM 切片，构造 `DicomSeries`，期间多次回报进度

**常用成员**

* `override void StartLoading()`：启动主协程
* `override void StopLoading()`：取消加载，清理资源
* （内部）索引解析、文件读取（兼容 UWP 的 UnityWebRequest）、像素解码与切片入列

**最小使用示例**

```csharp
public class Example : MonoBehaviour
{
    public DicomSeriesLoader loader;
    void Start()
    {
        loader.OnLoadingComplete.AddListener((obj, dims, spacing, origin) =>
            Debug.Log($"Loaded dims={dims} spacing={spacing} origin={origin}"));
        loader.StartLoading();
    }
}
```

## JSON 索引格式（建议）

```json
{
  "slices": [
    { "path": "DICOM/SeriesA/0001.dcm" },
    { "path": "DICOM/SeriesA/0002.dcm" }
  ]
}
```

* `path` 支持相对（推荐）或绝对路径
* 你可以扩展自定义键，但解析器至少需要 `slices[].path`

## 事件触发时机（参考）

* **StatusChanged**：索引阶段开始、扫描完成、每批文件处理完、收尾排序
* **Complete**：所有切片成功入列且体素属性已确定
* **Failed**：目录/索引为空、读文件/解析 DICOM 失败等

## 最佳实践

* 在 **教程层** 上封装一次 `Loader + Viewer + UI` 的闭环，供新手直接复用
* 大数据量时在完成回调后延迟刷新 Viewer，避免逐张刷新导致卡顿
* PC 上可用绝对路径；HL2 上优先考虑 `StreamingAssets` 或应用可访问目录