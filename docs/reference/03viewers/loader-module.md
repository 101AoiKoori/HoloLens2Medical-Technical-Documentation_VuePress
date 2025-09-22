---
title: 加载模块 API
---
# 加载模块 API

## 定义

### LoadDicomData()

- **功能**:启动 DICOM 序列的加载流程。调用此方法后，内部的 Loader 模块会通过挂载在对象上的 `DicomLoader` 或自动添加的 `DicomSeriesLoader` 来异步读取 DICOM 数据。
- **参数**:无。
- **返回值**:无（void）。
- **说明**:如果正在加载或组件正在关闭，重复调用将被忽略并输出警告。

### OnDicomLoaded

- **类型**:事件 (event)。
- **声明**:`event void DicomLoadedEventHandler(int sliceCount)`。
- **功能**:当 DICOM 数据加载完成时触发。
- **参数**:`sliceCount` – 加载后的轴向切片总数。
- **说明**:订阅此事件以在加载完成后初始化 UI（如设置滑块最大值）、更新逻辑或通知用户。

### GetLoadedSeries()

- **功能**:返回当前加载的 `DicomSeries` 对象。
- **返回值**:`DicomSeries` 实例；若尚未加载则返回 `null`。
- **说明**:可以通过返回的 `DicomSeries` 获取默认窗位窗宽、切片数和其他元数据。

## 用法

1. 在场景中挂载 `MPRViewer` 组件，确保已绑定三张 `RawImage`。
2. 在脚本中获取 `MPRViewer` 引用，并订阅 `OnDicomLoaded` 事件来处理加载完成后的逻辑。
3. 调用 `LoadDicomData()` 开始加载 DICOM 数据序列。
4. 可在 `OnDicomLoaded` 回调中使用 `GetLoadedSeries()` 访问已经加载的序列对象。

## 示例（伪代码）

```csharp
// 获取 MPRViewer 组件引用
MPRViewer viewer = GetComponent<MPRViewer>();

// 订阅加载完成事件
viewer.OnDicomLoaded += (int sliceCount) => {
    Debug.Log($"DICOM 加载完成，共 {sliceCount} 张轴向切片");
    // 根据 sliceCount 设置滑块范围、启用界面等
    int axialTotal = viewer.GetSliceCount(DicomPlane.PlaneType.Axial);
    // 初始化其他交互组件...
};

// 启动加载流程
viewer.LoadDicomData();

// 可选:在其他逻辑中访问加载后的序列
DicomSeries series = viewer.GetLoadedSeries();
if (series != null) {
    // 例如获取默认窗位/窗宽
    float defaultCenter = series.DefaultWindowCenter;
    float defaultWidth = series.DefaultWindowWidth;
}
```

> 启用 `useProgressiveLoading` 时，系统会先显示轴向首帧，再逐步生成矢状和冠状切片；禁用该选项则会一次性创建所有纹理。