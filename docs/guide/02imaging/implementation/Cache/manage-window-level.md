# 管理窗宽窗位键 

不同的窗宽窗位对应不同的对比度和灰阶映射。为了避免混淆，需要确保每种窗宽窗位使用独立的缓存键。Cache 模块提供了辅助方法：

* `GetWindowLevelKey(center, width)`：根据窗位 (`center`) 与窗宽 (`width`) 生成标准化的字符串，如 `40-400`。
* `SetCurrentWindowLevelKey(center, width)`：更新当前使用的窗口键。建议在用户调整窗宽窗位滑块后立即调用。
* `GetTextureCacheKey(planeType, index, windowLevelKey = null)`：生成完整的缓存键。若不指定 `windowLevelKey`，则使用当前窗口键。

## 示例

```csharp
// 当窗宽窗位滑块改变时
void OnWindowLevelChanged(float center, float width)
{
    cache.SetCurrentWindowLevelKey(center, width);
    // 生成新的缓存键并重新加载纹理
    string key = cache.GetTextureCacheKey(DicomPlane.PlaneType.Axial, index);
    // 使用生成器创建新的纹理并存入缓存
}
```

正确管理窗宽窗位键可以避免不同对比度下的纹理互相覆盖，同时方便批量清理旧键关联的纹理。