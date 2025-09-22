---
title: 窗宽窗位键管理
---
# 窗宽窗位键管理

本页说明如何管理窗宽窗位键，确保不同对比度设置下的纹理互不干扰。

## 窗宽窗位键概念

窗宽窗位键是基于窗位中心值和窗宽值生成的字符串标识符，用于区分不同对比度设置下的纹理。

### 键的生成规则

```csharp
public string GetWindowLevelKey(float center, float width)
{
    return $"{Mathf.Round(center)}-{Mathf.Round(width)}";
}
```

- **四舍五入**:使用 `Mathf.Round()` 避免浮点精度问题
- **格式**:`{center}-{width}`，如 `40-400`
- **唯一性**:相同的窗宽窗位产生相同的键

## 设置当前窗宽窗位

使用 `SetCurrentWindowLevelKey()` 更新系统当前使用的窗宽窗位:

```csharp
DicomTextureCache cache = GetComponent<DicomTextureCache>();

// 用户调整窗宽窗位时
float center = 40.0f;
float width = 400.0f;

cache.SetCurrentWindowLevelKey(center, width);
```

该方法执行以下操作:
```csharp
public void SetCurrentWindowLevelKey(float center, float width)
{
    _currentWindowCenter = center;
    _currentWindowWidth = width;
    _currentWindowLevelKey = GetWindowLevelKey(center, width);
}
```

## 缓存键的完整结构

完整的缓存键由三部分组成:

```csharp
public string GetTextureCacheKey(DicomPlane.PlaneType planeType, int index, string windowLevelKey = null)
{
    string wlKey = windowLevelKey ?? _currentWindowLevelKey;
    
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            return $"Axial_{index}_{wlKey}";
        case DicomPlane.PlaneType.Sagittal:
            return $"Sagittal_{index}_{wlKey}";
        case DicomPlane.PlaneType.Coronal:
            return $"Coronal_{index}_{wlKey}";
        default:
            return string.Empty;
    }
}
```

示例缓存键:
- `Axial_25_40-400`:轴向第25层，窗位40，窗宽400
- `Sagittal_128_100-800`:矢状面第128层，窗位100，窗宽800

## 窗位键索引系统

系统维护从窗位键到纹理键的映射，便于批量操作:

```csharp
// 添加纹理时建立索引
string windowLevelKey = ExtractWindowLevelFromKey(key);
if (!string.IsNullOrEmpty(windowLevelKey))
{
    if (!_windowLevelToTextureKeys.ContainsKey(windowLevelKey))
    {
        _windowLevelToTextureKeys[windowLevelKey] = new HashSet<string>();
    }
    _windowLevelToTextureKeys[windowLevelKey].Add(key);
}
```

### 从缓存键提取窗位键

```csharp
private string ExtractWindowLevelFromKey(string key)
{
    try
    {
        // 缓存键格式:PlaneType_Index_WindowLevel
        var parts = key.Split('_');
        if (parts.Length >= 3)
        {
            return parts[2];  // 返回窗位键部分
        }
    }
    catch { }
    
    return null;
}
```

## 窗宽窗位变化的处理

### 清理旧窗位的纹理

当窗宽窗位改变时，可以选择性清理旧的纹理:

```csharp
public void ClearTexturesForWindowLevel(string oldWindowLevelKey)
{
    if (_windowLevelToTextureKeys.TryGetValue(oldWindowLevelKey, out var textureKeys))
    {
        foreach (string textureKey in textureKeys.ToList())
        {
            // 从各平面缓存中移除相关纹理
            RemoveTextureByKey(textureKey);
        }
        
        // 清理索引
        _windowLevelToTextureKeys.Remove(oldWindowLevelKey);
    }
}
```

### 实际使用示例

```csharp
public class WindowLevelController : MonoBehaviour
{
    private DicomTextureCache cache;
    private string previousWindowLevelKey;
    
    void OnWindowLevelChanged(float center, float width)
    {
        // 保存当前窗位键
        string currentKey = cache.GetWindowLevelKey(center, width);
        
        // 如果窗位真的发生了变化
        if (currentKey != previousWindowLevelKey)
        {
            // 设置新的窗位键
            cache.SetCurrentWindowLevelKey(center, width);
            
            // 可选:清理旧窗位的纹理以释放内存
            if (!string.IsNullOrEmpty(previousWindowLevelKey))
            {
                ClearOldWindowLevelTextures(previousWindowLevelKey);
            }
            
            previousWindowLevelKey = currentKey;
            
            // 重新生成当前显示的纹理
            RefreshCurrentTextures();
        }
    }
    
    private void ClearOldWindowLevelTextures(string oldKey)
    {
        // 延迟清理，给用户切换回原窗位的机会
        StartCoroutine(DelayedClearCoroutine(oldKey, 30f));
    }
    
    private IEnumerator DelayedClearCoroutine(string windowLevelKey, float delay)
    {
        yield return new WaitForSeconds(delay);
        
        // 如果当前窗位键已经不同，则清理旧纹理
        if (cache.GetWindowLevelKey(_currentCenter, _currentWidth) != windowLevelKey)
        {
            cache.ClearTexturesForWindowLevel(windowLevelKey);
        }
    }
}
```

## 内存管理注意事项

### 移除纹理时的清理

```csharp
private bool RemoveTextureByKey(Dictionary<string, Texture2D> cache, 
                               LinkedList<string> lruList, string key, ref long totalSize)
{
    // ... 其他清理逻辑 ...
    
    // 清理窗位键索引
    string windowLevelKey = ExtractWindowLevelFromKey(key);
    if (!string.IsNullOrEmpty(windowLevelKey) && _windowLevelToTextureKeys.ContainsKey(windowLevelKey))
    {
        _windowLevelToTextureKeys[windowLevelKey].Remove(key);
        
        // 如果窗位键下没有纹理了，移除整个键
        if (_windowLevelToTextureKeys[windowLevelKey].Count == 0)
        {
            _windowLevelToTextureKeys.Remove(windowLevelKey);
        }
    }
    
    return true;
}
```

## 使用建议

- **及时更新**:窗宽窗位改变时立即调用 `SetCurrentWindowLevelKey()`
- **避免频繁切换**:频繁的窗位变化会导致大量纹理重新生成
- **内存监控**:为不同窗位保留的纹理会占用大量内存
- **批量清理**:定期清理不再使用的窗位键，释放内存
- **精度控制**:合理设置窗宽窗位的精度，避免产生过多近似键

正确的窗位键管理确保不同对比度设置下的纹理能够正确缓存和复用。