---
title: 配置缓存限制
---
# 配置缓存限制

本页介绍如何设置各平面的缓存大小和内存上限，以及相关的计算规则。

## 设置缓存大小

使用 `SetCacheSize()` 方法配置三个平面的最大纹理数量:

```csharp
DicomTextureCache cache = GetComponent<DicomTextureCache>();

// 设置轴向256张，矢状64张，冠状64张
cache.SetCacheSize(256, 64, 64);
```

该方法执行以下操作:

1. **更新缓存数量限制**:
   - `_axialCacheMaxSize = axialSize`
   - `_sagittalCacheMaxSize = sagittalSize` 
   - `_coronalCacheMaxSize = coronalSize`

2. **计算内存限制**:
   - 轴向:`512KB × 数量`
   - 矢状/冠状:`768KB × 数量`

3. **立即修剪缓存**:调用 `CheckAndTrimCache()` 确保当前缓存符合新限制

## 内存限制计算

不同平面使用不同的内存估算系数:

```csharp
// 内部计算逻辑
_axialMemoryLimit = 512 * 1024L * axialSize;      // 轴向:512KB/张
_sagittalMemoryLimit = 768 * 1024L * sagittalSize; // 矢状:768KB/张  
_coronalMemoryLimit = 768 * 1024L * coronalSize;   // 冠状:768KB/张
```

矢状和冠状面的系数更大，因为重建过程需要更多计算和内存。

## 缓存修剪触发条件

当满足以下任一条件时触发自动修剪:

1. **数量超限**:`cache.Count > maxSize`
2. **内存超限**:`totalSize > memoryLimit`

修剪目标:
- 数量降至最大值的80%
- 内存占用降至限制的80%

```csharp
private void TrimCacheToFitLimits(Dictionary<string, Texture2D> cache, 
                                 LinkedList<string> lruList, ref long totalSize, 
                                 int maxCount, long maxSize)
{
    long targetSize = (long)(maxSize * 0.8f);
    int targetCount = (int)(maxCount * 0.8f);
    
    while ((cache.Count > targetCount || totalSize > targetSize) && lruList.Count > 0)
    {
        bool removed = RemoveWithBalancedStrategy(cache, lruList, ref totalSize);
        if (!removed) break;
    }
}
```

## 平台推荐配置

根据设备性能选择合适的缓存大小:

### HoloLens 2 / 移动设备
```csharp
// 内存受限设备
cache.SetCacheSize(128, 32, 32);
```

### 桌面PC
```csharp
// 高性能设备
cache.SetCacheSize(512, 128, 128);
```

### 高端工作站
```csharp
// 大内存设备
cache.SetCacheSize(1024, 256, 256);
```

## 运行时调整

可以根据系统状态动态调整缓存大小:

```csharp
public void AdjustCacheForMemoryPressure()
{
    if (IsMemoryPressureHigh())
    {
        // 降低缓存大小
        cache.SetCacheSize(64, 16, 16);
    }
    else
    {
        // 恢复正常大小
        cache.SetCacheSize(256, 64, 64);
    }
}
```

## 注意事项

- **立即生效**:设置后会立即修剪当前缓存
- **保留策略**:修剪时会保护当前显示和高优先级纹理
- **性能影响**:过小的缓存会导致频繁重新生成纹理
- **内存计算**:实际纹理大小可能与估算值有差异

合理的缓存配置能在内存占用和性能之间取得最佳平衡。