# 获取冠状/矢状纹理 

生成冠状或矢状纹理与轴向类似，但会优先利用体素缓存，并在缓存不可用时回退到逐像素算法。

## 步骤

1. **确保体素缓存存在**：在调用 `CreateCoronalTexture()` 或 `CreateSagittalTexture()` 前，请先调用 `CacheVolumeData(center, width)` 或在初始化阶段缓存体素数据，这样可以使用快速路径。
2. **生成纹理**：调用 `CreateCoronalTexture(yIndex, center, width)` 或 `CreateSagittalTexture(xIndex, center, width)`。
3. **处理回退**：如果方法返回 `null`，说明索引无效或无法创建纹理，可能需要检查维度或体素缓存状态。方法内部会自动尝试回退算法。
4. **存入缓存并通知**：成功生成后，纹理会被加入 `DicomTextureCache` 并触发 `OnTextureUpdated` 事件。

## 示例

```csharp
// 缓存体素数据（可选但推荐）
creator.CacheVolumeData(center, width);

// 获取某个矢状面纹理
Texture2D sagTex = creator.CreateSagittalTexture(30, center, width);
if (sagTex != null)
{
    sagittalImage.texture = sagTex;
}

// 获取某个冠状面纹理
Texture2D corTex = creator.CreateCoronalTexture(40, center, width);
if (corTex != null)
{
    coronalImage.texture = corTex;
}
```

如果需要异步处理，在 MPR 模块中调用 `CreateSagittalTextureCoroutine` 或 `CreateCoronalTextureCoroutine`。