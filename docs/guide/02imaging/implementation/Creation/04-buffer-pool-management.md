---
title: 缓冲区池管理
---
# 缓冲区池管理

本页介绍DicomTextureCreator的缓冲区池机制，用于减少内存分配和垃圾回收压力。

## 缓冲区池概述

缓冲区池管理Color32数组的复用，避免频繁的大数组分配和释放:

```csharp
// 内部缓冲区池字段
private Dictionary<string, Color32[]> _pixelBufferPool = new Dictionary<string, Color32[]>();
private int _maxBuffersInPool = 5;
```

缓冲区池按不同的尺寸和用途分类存储，使用字符串键区分不同类型的缓冲区。

## 获取缓冲区

`GetColorBuffer()` 方法从池中获取或创建新的缓冲区:

```csharp
private Color32[] GetColorBuffer(string key, int size)
{
    Color32[] buffer;
    
    // 尝试从池中获取现有缓冲区
    if (_pixelBufferPool.TryGetValue(key, out buffer) && buffer.Length >= size)
    {
        // 从池中移除并返回
        _pixelBufferPool.Remove(key);
        return buffer;
    }
    
    // 创建新缓冲区
    buffer = new Color32[size];
    return buffer;
}
```

### 使用示例

```csharp
// 在矢状面纹理生成中使用
public Texture2D CreateSagittalTexture(int xIndex, float windowCenter, float windowWidth)
{
    // ... 其他逻辑 ...
    
    // 获取合适大小的颜色缓冲区
    Color32[] colors = GetColorBuffer($"sagittal_{width}x{height}", width * height);
    
    try
    {
        // 使用缓冲区进行纹理生成
        // ... 像素处理逻辑 ...
        
        // 创建纹理
        Texture2D texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
        texture.SetPixels32(colors);
        texture.Apply();
        
        return texture;
    }
    finally
    {
        // 归还缓冲区到池中
        ReturnColorBuffer($"sagittal_{width}x{height}", colors);
    }
}
```

## 归还缓冲区

`ReturnColorBuffer()` 方法将使用完的缓冲区归还到池中:

```csharp
private void ReturnColorBuffer(string key, Color32[] buffer)
{
    if (buffer == null) return;
    
    // 检查对象池大小限制
    if (_pixelBufferPool.Count >= _maxBuffersInPool)
    {
        // 移除一个现有缓冲区以腾出空间
        var keys = new List<string>(_pixelBufferPool.Keys);
        if (keys.Count > 0)
        {
            _pixelBufferPool.Remove(keys[0]); // 移除第一个
        }
    }
    
    // 将缓冲区添加到池中
    _pixelBufferPool[key] = buffer;
}
```

### 池大小管理

缓冲区池使用简单的FIFO策略管理大小:

- **最大容量**:默认5个缓冲区
- **淘汰策略**:移除最先加入的缓冲区
- **键冲突处理**:相同键的缓冲区会覆盖旧的

## 缓冲区键设计

缓冲区键按纹理类型和尺寸分类:

```csharp
// 轴向纹理缓冲区（通常不需要，因为直接从DicomSlice生成）
string axialKey = $"axial_{width}x{height}";

// 矢状面纹理缓冲区
string sagittalKey = $"sagittal_{width}x{height}";

// 冠状面纹理缓冲区
string coronalKey = $"coronal_{width}x{height}";

// 体素缓存相关缓冲区
string volumeKey = $"volume_{totalVoxels}";
```

### 键命名规则

- **类型前缀**:标识纹理平面类型
- **尺寸信息**:包含宽度和高度
- **用途区分**:避免不同用途的缓冲区混用

## 缓冲区大小策略

### 尺寸匹配原则

获取缓冲区时使用 "大于等于" 的匹配策略:

```csharp
// 只有当现有缓冲区大小大于等于请求大小时才复用
if (_pixelBufferPool.TryGetValue(key, out buffer) && buffer.Length >= size)
{
    // 可以复用
    return buffer;
}
```

这种策略的优点:
- **避免越界**:确保缓冲区足够大
- **减少分配**:较大的缓冲区可用于较小的需求
- **简化逻辑**:不需要复杂的大小匹配算法

### 常见缓冲区大小

```csharp
// 典型的缓冲区大小示例
512 x 512 = 262,144 像素 ≈ 1MB (Color32)
256 x 256 = 65,536 像素 ≈ 256KB
1024 x 1024 = 1,048,576 像素 ≈ 4MB
```

## 内存管理

### 池容量配置

根据应用需求调整池的最大容量:

```csharp
public void ConfigureBufferPool(int maxBuffers)
{
    _maxBuffersInPool = maxBuffers;
    
    // 如果当前池超过新限制，清理多余缓冲区
    while (_pixelBufferPool.Count > _maxBuffersInPool)
    {
        var firstKey = _pixelBufferPool.Keys.First();
        _pixelBufferPool.Remove(firstKey);
    }
}
```

### 平台适配

```csharp
void ConfigureForPlatform()
{
    #if UNITY_WSA && !UNITY_EDITOR
        // HoloLens平台，内存受限
        _maxBuffersInPool = 2;
    #elif UNITY_ANDROID || UNITY_IOS
        // 移动平台，中等缓存
        _maxBuffersInPool = 3;
    #else
        // 桌面平台，较大缓存
        _maxBuffersInPool = 5;
    #endif
}
```

## 清理操作

### 完全清理

`Cleanup()` 方法清空缓冲区池和其他资源:

```csharp
public void Cleanup()
{
    // 清空缓冲区池
    _pixelBufferPool.Clear();
    
    // 清空处理状态
    _processingTextures.Clear();
    
    // 清理缓存
    ClearAllCache();
    
    // 停止延迟更新协程
    if (_delayedUpdateCoroutine != null && _coroutineRunner != null)
    {
        _coroutineRunner.StopCoroutine(_delayedUpdateCoroutine);
        _delayedUpdateCoroutine = null;
    }
}
```

### 选择性清理

```csharp
// 清理特定类型的缓冲区
public void ClearBuffersOfType(string typePrefix)
{
    var keysToRemove = _pixelBufferPool.Keys
        .Where(key => key.StartsWith(typePrefix))
        .ToList();
        
    foreach (var key in keysToRemove)
    {
        _pixelBufferPool.Remove(key);
    }
}

// 清理大于指定大小的缓冲区
public void ClearLargeBuffers(int maxSize)
{
    var keysToRemove = _pixelBufferPool
        .Where(kvp => kvp.Value.Length > maxSize)
        .Select(kvp => kvp.Key)
        .ToList();
        
    foreach (var key in keysToRemove)
    {
        _pixelBufferPool.Remove(key);
    }
}
```

## 性能监控

### 池统计信息

```csharp
public void LogBufferPoolStats()
{
    if (_enableDebugLog)
    {
        long totalMemory = 0;
        foreach (var buffer in _pixelBufferPool.Values)
        {
            totalMemory += buffer.Length * sizeof(Color32);
        }
        
        Debug.Log($"缓冲区池统计: " +
                 $"数量={_pixelBufferPool.Count}/{_maxBuffersInPool}, " +
                 $"总内存={totalMemory / (1024 * 1024)}MB");
                 
        foreach (var kvp in _pixelBufferPool)
        {
            long bufferSize = kvp.Value.Length * sizeof(Color32);
            Debug.Log($"  {kvp.Key}: {bufferSize / 1024}KB");
        }
    }
}
```

### 命中率统计

```csharp
// 添加统计字段
private int _bufferHits = 0;
private int _bufferMisses = 0;

private Color32[] GetColorBuffer(string key, int size)
{
    Color32[] buffer;
    
    if (_pixelBufferPool.TryGetValue(key, out buffer) && buffer.Length >= size)
    {
        _bufferHits++;
        _pixelBufferPool.Remove(key);
        return buffer;
    }
    
    _bufferMisses++;
    buffer = new Color32[size];
    return buffer;
}

public float GetBufferHitRate()
{
    int total = _bufferHits + _bufferMisses;
    return total > 0 ? (float)_bufferHits / total : 0f;
}
```

## 使用建议

### 最佳实践

```csharp
// 1. 使用try-finally确保缓冲区归还
public Texture2D SafeCreateTexture(int width, int height, string type)
{
    string bufferKey = $"{type}_{width}x{height}";
    Color32[] colors = GetColorBuffer(bufferKey, width * height);
    
    try
    {
        // 执行纹理生成逻辑
        return ProcessTextureData(colors, width, height);
    }
    finally
    {
        // 确保缓冲区被归还
        ReturnColorBuffer(bufferKey, colors);
    }
}

// 2. 根据使用模式调整池大小
void OptimizePoolSize()
{
    float hitRate = GetBufferHitRate();
    
    if (hitRate < 0.5f && _maxBuffersInPool < 10)
    {
        // 命中率低，增加池大小
        _maxBuffersInPool++;
    }
    else if (hitRate > 0.9f && _maxBuffersInPool > 2)
    {
        // 命中率很高，可以减小池大小
        _maxBuffersInPool--;
    }
}
```

### 错误处理

```csharp
private Color32[] SafeGetColorBuffer(string key, int size)
{
    try
    {
        return GetColorBuffer(key, size);
    }
    catch (OutOfMemoryException)
    {
        // 内存不足时清理池并重试
        Debug.LogWarning("内存不足，清理缓冲区池");
        _pixelBufferPool.Clear();
        
        // 直接创建所需大小的缓冲区
        return new Color32[size];
    }
}
```

### 调试工具

```csharp
#if UNITY_EDITOR
[UnityEditor.MenuItem("Tools/DICOM/Log Buffer Pool Stats")]
static void LogBufferPoolStatsFromMenu()
{
    var creator = FindObjectOfType<DicomTextureCreator>();
    if (creator != null)
    {
        creator.LogBufferPoolStats();
    }
}
#endif
```

缓冲区池是优化内存使用的重要机制，合理配置能显著减少GC压力并提升性能。