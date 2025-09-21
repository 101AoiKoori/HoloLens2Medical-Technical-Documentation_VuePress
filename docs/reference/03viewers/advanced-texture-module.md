# 高级纹理与管理模块 API

## 定义

### GetTextureManager()

- **功能**：获取当前实例的 `MPRTextureManager` 对象。
- **返回值**：`MPRTextureManager`；若尚未初始化则可能为 `null`。
- **说明**：提供对内部纹理缓存管理器的访问。高级用户可以使用它直接获取或缓存纹理。

### 使用 MPRTextureManager

`MPRTextureManager` 用于缓存和管理切片纹理，内部根据平面索引和窗位窗宽生成一个缓存键，并存储生成的 `Texture2D` 对象。它主要由系统内部调用，但在高级使用场景下可以手动操作。

常用方法：
- `GetTexture(DicomPlane.PlaneType plane, int index)`：获取指定平面和索引的纹理；若缓存不存在则会触发纹理创建。
- `AddTextureToCache(DicomPlane.PlaneType plane, string key, Texture2D texture)`：手动将纹理添加到缓存。

### 使用 DicomSeries

通过 `GetLoadedSeries()` 获取 `DicomSeries`，可以直接访问序列的切片并创建纹理：
- `DicomSlice slice = series.GetSlice(int index)`：获取指定索引的轴向切片。
- `Texture2D tex = slice.CreateTexture(center, width)`：使用指定的窗位、窗宽创建纹理。

## 用法

1. 在特殊场景（例如自定义 3D 渲染或纹理缓存策略）下，可调用 `GetTextureManager()` 获取内部管理器，并通过 `GetTexture()` 方法直接获取某一切片的纹理。
2. 通过 `GetLoadedSeries()` 可以直接访问切片数据并自行创建纹理，适用于在外部脚本中处理纹理或在多平面之外的场景中使用。

## 示例（伪代码）

```csharp
// 假设 viewer 为 MPRViewer 实例
MPRTextureManager manager = viewer.GetTextureManager();

// 获取轴向第 i 张的纹理
Texture2D tex = manager.GetTexture(DicomPlane.PlaneType.Axial, i);
if (tex != null) {
    // 可以将该纹理用于其他渲染，例如 3D 模型
    myMeshRenderer.material.mainTexture = tex;
}

// 手动从序列创建纹理
DicomSeries series = viewer.GetLoadedSeries();
if (series != null) {
    DicomSlice slice = series.GetSlice(i);
    float center = viewer.GetWindowCenter();
    float width = viewer.GetWindowWidth();
    Texture2D customTex = slice.CreateTexture(center, width);
    // 使用 customTex 自行处理
}
```

> 高级操作需确保理解纹理生命周期与内存管理，避免重复生成纹理导致内存泄漏。一般情况下，直接使用 `MPRViewer` 提供的接口即可满足功能需求。