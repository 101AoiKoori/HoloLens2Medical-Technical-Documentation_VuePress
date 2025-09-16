# 获取加载后的体积信息

在加载完成后，需要获取序列的整体尺寸、体素间距和原点坐标，用于体渲染或其他后续处理。`DicomSeriesLoader` 会在完成事件中提供这些信息。

## 监听完成事件

在控制脚本中订阅 `OnLoadingComplete`：

```csharp
loader.OnLoadingComplete.AddListener((object result, Vector3Int dims, Vector3 spacing, Vector3 origin) =>
{
    var series = result as DicomSeries;
    Debug.Log($"尺寸: {dims}, 间距: {spacing}, 原点: {origin}");
    // 此处可以创建 VolumeTexture 或 MPR 图像
});
```

回调参数 `dims` 对应 `(宽, 高, 切片数)`【782507737950471†L60-L62】；`spacing` 对应像素间距 `(dx, dy, dz)`【782507737950471†L63-L67】；`origin` 是体积左上角像素在患者坐标系中的位置【782507737950471†L68-L71】。

## 直接访问 DicomSeries

你也可以在加载器上取得 `targetSeries` 属性并访问：

```csharp
var dims = loader.targetSeries.Dimensions;
var spacing = loader.targetSeries.Spacing;
var origin = loader.targetSeries.Origin;
```

确保在 `OnLoadingComplete` 事件之后使用这些属性。

## 使用建议

- 如果需要将像素间距从毫米转换为米，在使用前将 `spacing` 除以 1000。
- 如果需要计算体素中心位置，应在原点基础上加上半个间距。

![体积信息获取示意图](./images/placeholder.png)
