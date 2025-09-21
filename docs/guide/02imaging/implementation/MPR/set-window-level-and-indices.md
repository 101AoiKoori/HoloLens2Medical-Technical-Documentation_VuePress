# 更新窗宽窗位与切片索引 

MPR 管理器需要知道当前窗宽窗位和当前切片索引，以便正确计算请求的优先级。

## 更新窗宽窗位

调用 `mpr.SetWindowLevel(center, width)` 更新参数。该方法会：

* 调用 Cache 模块更新窗口键；
* 清空请求队列；
* 重新添加当前切片的高优先级请求。

更新窗宽窗位不会立即生成纹理，需要重新调用 `GetTexture()` 或等待异步回调。

## 更新切片索引

调用 `mpr.SetCurrentIndices(axialIndex, sagittalIndex, coronalIndex)` 设置用户当前正在浏览的切片。该方法内部会刷新请求队列的优先级。

## 示例

```csharp
// 当用户拖动滑块时
void OnAxialIndexChanged(int newIndex)
{
    mpr.SetCurrentIndices(newIndex, mpr.CurrentSagittalIndex, mpr.CurrentCoronalIndex);
    mpr.GetTexture(DicomPlane.PlaneType.Axial, newIndex);
}

void OnWindowLevelChanged(float center, float width)
{
    mpr.SetWindowLevel(center, width);
}
```