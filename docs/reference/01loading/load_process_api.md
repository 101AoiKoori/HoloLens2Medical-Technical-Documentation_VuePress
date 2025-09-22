---
title: 批量加载流程 API
---
# 批量加载流程 API

## 定义
`LoadSeriesCoroutine()` 是 `DicomSeriesLoader` 的核心协程，负责按顺序加载索引中列出的每个 DICOM 文件，并将有效切片添加到 `DicomSeries` 中。该方法在 `StartLoading()` 中通过 `StartCoroutine` 启动。

## 主要步骤
加载流程大致分为以下阶段:

1. **读取索引文件**:协程首先调用 `LoadIndexFileCoroutine()` 并更新进度。如果索引为空，则通过 `FailLoading` 终止加载。
2. **遍历切片列表**:设置总体和已完成计数后，依次读取列表中的每个相对路径。对每个文件:
   - 使用 `GetFullPath` 拼接完整路径并通过 `ReadFileBytesCoroutine` 读取二进制数据。
   - 如果读取失败，则记录错误并继续下一个文件。
   - 使用 `DicomFile.Open` 解析数据集并检查有效性；若无效或像素数据为空，则跳过。
   - 调用 `ExtractPixelData` 获取像素数据，克隆数据集并创建 `DicomSlice` 对象。
   - 将生成的切片添加到 `targetSeries`。
   - 每处理若干文件或到达末尾，调用 `UpdateProgress` 更新进度说明。
3. **排序与体积信息**:所有切片加载完成后，如果未加载成功任何切片，则通过 `FailLoading` 结束。否则调用 `targetSeries.SortSlices()` 排序并更新进度。
4. **体积属性和验证**:调用 `SetVolumeProperties()` 设置序列的尺寸、间距和原点。之后更新进度为 100%。
5. **完成或失败**:最后调用 `ValidateLoadedSeries()` 验证序列一致性，并根据结果调用 `CompleteLoading` 或 `FailLoading`。

该协程结束后执行一次垃圾回收以释放未引用的数据。

## 用法
`LoadSeriesCoroutine` 由 `StartLoading()` 自动调用，通常无需在外部直接访问。要自定义加载流程，可以根据需要在派生类中覆盖 `StartLoading` 并启动自己的协程。

以下伪代码演示了如何在自定义加载器中调用核心加载逻辑:

```csharp
public override void StartLoading()
{
    isLoading = true;
    // 初始化或配置参数...
    // 启动批量加载流程
    StartCoroutine(LoadSeriesCoroutine());
}
```

由于这是内部实现细节，通常不建议外部直接修改此协程逻辑，但你可以参考此流程了解加载的顺序和验证步骤。