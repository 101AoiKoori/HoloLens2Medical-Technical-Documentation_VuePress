---
title: DicomSeries API
---

# DicomSeries

`DicomSeries` 是 Core 模块中用于管理一个完整 DICOM 序列的 MonoBehaviour 组件。它组合并协调了若干子组件（元数据管理、切片管理、纹理缓存与创建、坐标映射），为其它模块提供统一的接口。

## 类定义

```csharp
public class DicomSeries : MonoBehaviour
{
    // 几何信息（读取自内部的 DicomMetadata）
    public Vector3Int Dimensions { get; }
    public Vector3    Spacing    { get; }
    public Vector3    Origin     { get; }

    // 默认窗位/窗宽
    public float DefaultWindowCenter { get; }
    public float DefaultWindowWidth  { get; }

    // 只读切片列表
    public IReadOnlyList<DicomSlice> Slices { get; }

    // 生命周期
    private void Awake();
    private void OnDestroy();

    // 初始化体积几何参数
    public void SetVolumeProperties(Vector3Int dimensions, Vector3 spacing, Vector3 origin, Quaternion orientation);

    // 添加切片
    public void AddSlice(DicomSlice slice);

    // 排序切片
    public void SortSlices();

    // 按索引获取切片
    public DicomSlice GetSlice(int index);

    // 根据索引获取轴向切片纹理
    public Texture2D GetAxialTexture(int index, float? windowCenter = null, float? windowWidth = null);

    // 创建矢状/冠状纹理（同步）
    public Texture2D CreateSagittalTexture(int xIndex, float? windowCenter = null, float? windowWidth = null);
    public Texture2D CreateCoronalTexture (int yIndex, float? windowCenter = null, float? windowWidth = null);

    // 创建矢状/冠状纹理（异步）
    public IEnumerator CreateSagittalTextureCoroutine(int xIndex, float windowCenter, float windowWidth, Action<Texture2D> onComplete);
    public IEnumerator CreateCoronalTextureCoroutine (int yIndex, float windowCenter, float windowWidth, Action<Texture2D> onComplete);

    // 获取矢状/冠状切片数量
    public int GetSagittalDimension();
    public int GetCoronalDimension();

    // 释放所有资源
    public void ReleaseResources();
}
```

> **注意:** 此类内部引用了 `DicomTextureCache` 和 `DicomTextureCreator` 等组件，这些位于 Imaging 模块，用于实际创建纹理和缓存结果。本文档只描述 Core 提供的接口。若需要了解纹理生成细节，请查阅 Imaging 模块的 API 文档。

## 用法说明

1. **初始化几何信息**:调用 `SetVolumeProperties()` 在序列加载前指定体素网格的大小、体素间距、起点和旋转。此操作将更新内部的 `DicomMetadata`。

2. **添加切片**:在读取每个 DICOM 文件后，将其转换为 `DicomSlice` 并调用 `AddSlice()` 添加。若添加的是第一张切片，并且数据集中包含 `ImageOrientationPatient` 标签，则 `_coordinateMapper` 会自动根据该标签初始化方向。

3. **排序切片**:加载完所有切片后，调用 `SortSlices()` 排序。这会确保 `GetSlice(index)` 返回的顺序符合解剖学的自然顺序。

4. **获取切片纹理**:
   - **轴向**:调用 `GetAxialTexture()` 直接获取指定索引的轴向纹理。若传入 `windowCenter` 或 `windowWidth`，则使用自定义窗位/窗宽；否则使用默认值。
   - **矢状/冠状 (同步)**:调用 `CreateSagittalTexture(xIndex)` 或 `CreateCoronalTexture(yIndex)` 创建新纹理。这些方法会立即返回，不带有回调。
   - **矢状/冠状 (异步)**:在 UI 线程不宜阻塞时使用协程版本。使用 `StartCoroutine(series.CreateSagittalTextureCoroutine(...))`，完成后通过回调 `onComplete` 获得纹理。

5. **获取切片数量**:使用 `GetSagittalDimension()` 和 `GetCoronalDimension()` 可查询对应平面有多少张切片，这通常用于设置 UI 滑条的最大值。

6. **释放资源**:调用 `ReleaseResources()` 将释放所有切片的纹理、清空缓存并提示垃圾回收。应在切换序列或卸载场景时调用。

## 使用示例（伪代码）

```csharp
// 初始化几何信息
series.SetVolumeProperties(new Vector3Int(256, 256, 64), new Vector3(0.8f, 0.8f, 1.5f), Vector3.zero, Quaternion.identity);

// 加载并添加切片
foreach (string file in dicomFiles)
{
    var dataset = DicomFile.Open(file).Dataset;
    var slice   = new DicomSlice(dataset, file, pixelData: null);
    series.AddSlice(slice);
}

// 排序
series.SortSlices();

// 显示第一张轴向切片
Texture2D axialTex = series.GetAxialTexture(0);
rawImage.texture = axialTex;

// 获取矢状/冠状维度
int numSagittal = series.GetSagittalDimension();
int numCoronal  = series.GetCoronalDimension();

// 创建一张矢状纹理（同步）
Texture2D sagTex = series.CreateSagittalTexture(xIndex: 10);

// 创建一张冠状纹理（异步）
StartCoroutine(series.CreateCoronalTextureCoroutine(yIndex: 20, windowCenter: 40f, windowWidth: 400f, onComplete: (tex) => {
    rawImage.texture = tex;
}));

// 销毁时释放资源
series.ReleaseResources();
```
