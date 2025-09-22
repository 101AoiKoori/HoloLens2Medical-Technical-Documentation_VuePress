---
title: 切片索引与预取策略
---
# 切片索引与预取策略

> 三平面切片索引管理和智能预取算法详解

## 索引初始化原理

### 中位值计算策略
当DICOM序列加载完成时，SliceControl模块将所有平面的索引重置为中位值:

```csharp
ResetSliceIndices() {
    if (loadedSeries == null) return;
    
    // 轴向:基于实际切片数量
    axialIndex = loadedSeries.Slices.Count > 0 ? 
                 loadedSeries.Slices.Count / 2 : 0;
    
    // 矢状:基于重建维度
    sagittalIndex = loadedSeries.GetSagittalDimension() > 0 ? 
                    loadedSeries.GetSagittalDimension() / 2 : 0;
    
    // 冠状:基于重建维度  
    coronalIndex = loadedSeries.GetCoronalDimension() > 0 ? 
                   loadedSeries.GetCoronalDimension() / 2 : 0;
}
```

### 维度来源差异
- **轴向切片**:直接来自DicomSeries.Slices集合的实际DICOM切片数量
- **矢状/冠状切片**:来自DicomSeries的重建维度计算，基于体素空间的大小

## 索引设置规则

### 边界检查与夹值
```csharp
SetSliceIndex(planeType, index) {
    // 1. 前置条件检查
    if (!isInitialized || loadedSeries == null || isShuttingDown) return;
    
    // 2. 获取该平面的总切片数
    int totalSlices = GetTotalSlices(planeType);
    if (totalSlices <= 0) return;
    
    // 3. 严格的边界限制
    index = Mathf.Clamp(index, 0, totalSlices - 1);
    
    // 4. 避免无效更新
    int oldIndex = GetCurrentIndex(planeType);
    if (index == oldIndex) return;
    
    // 5. 更新对应平面的索引
    // 6. 同步到纹理管理器
    // 7. 触发UI更新和事件
}
```

### 索引同步机制
索引变化时需要同步更新多个系统:
1. **内部状态更新**:更新SliceControl模块的索引变量
2. **纹理管理器同步**:调用`textureManager.SetCurrentIndices()`
3. **UI立即刷新**:调用`textureUpdaterModule.UpdateTexture()`
4. **事件通知**:触发`OnSliceChanged`事件
5. **预取触发**:启动相邻切片的后台加载

## 预取策略详解

### 相邻切片预取算法
基于当前索引，向两侧对称扩展:

```csharp
LoadAdjacentSlicesCoroutine(planeType, centerIndex, range) {
    for (int offset = 1; offset <= range; offset++) {
        int index1 = centerIndex - offset;  // 向前
        int index2 = centerIndex + offset;  // 向后
        
        // 根据平面类型进行边界检查和纹理请求
        switch (planeType) {
            case DicomPlane.PlaneType.Axial:
                if (index1 >= 0 && index1 < loadedSeries.Slices.Count)
                    textureManager.GetTexture(planeType, index1);
                if (index2 >= 0 && index2 < loadedSeries.Slices.Count)
                    textureManager.GetTexture(planeType, index2);
                break;
            // 类似处理矢状和冠状...
        }
        
        yield return null; // 逐帧让出执行权，避免卡顿
        
        // 内存压力检测
        if (coroutineModule.IsMemoryPressureHigh()) {
            yield return new WaitForSeconds(0.5f);
        }
    }
}
```

**预取优势**:
- 减少用户切换切片时的等待时间
- 基于局部性原理，用户通常浏览相邻切片
- 异步加载不影响当前交互的响应性

### 系统性后台加载

#### 分批加载策略
```csharp
BackgroundLoadingCoroutine() {
    yield return new WaitForSeconds(0.5f); // 初始等待
    
    int batchSize = 3;
    
    // 计算各平面的批次数量
    int totalAxialBatches = Mathf.Min(5, 
        Mathf.CeilToInt((float)loadedSeries.Slices.Count / batchSize));
    int totalSagittalBatches = Mathf.Min(3, 
        Mathf.CeilToInt((float)loadedSeries.GetSagittalDimension() / batchSize));
    int totalCoronalBatches = Mathf.Min(3, 
        Mathf.CeilToInt((float)loadedSeries.GetCoronalDimension() / batchSize));
    
    // 轴向优先处理
    for (int batch = 0; batch < totalAxialBatches; batch++) {
        yield return LoadAxialBatchCoroutine(batch, batchSize);
        if (coroutineModule.IsMemoryPressureHigh()) {
            yield return new WaitForSeconds(1.0f);
        }
    }
    
    // 矢状/冠状并行处理
    for (int batch = 0; batch < Mathf.Max(totalSagittalBatches, totalCoronalBatches); batch++) {
        // 交替处理矢状和冠状
        // 插入内存压力检查和等待
    }
}
```

#### 批量算法实现
以轴向为例:
```csharp
LoadAxialBatchCoroutine(int batchIndex, int batchSize) {
    int offset = (batchIndex + 1) * batchSize / 2;
    
    for (int i = 0; i < batchSize; i++) {
        // 基于当前索引向两侧扩展
        int idx1 = axialIndex - offset + i;
        int idx2 = axialIndex + offset - i;
        
        // 边界检查后请求纹理
        if (idx1 >= 0 && idx1 < loadedSeries.Slices.Count) {
            textureManager.GetTexture(DicomPlane.PlaneType.Axial, idx1);
        }
        if (idx2 >= 0 && idx2 < loadedSeries.Slices.Count && idx2 != idx1) {
            textureManager.GetTexture(DicomPlane.PlaneType.Axial, idx2);
        }
        
        // 每处理2张让出一次执行权
        if (i % 2 == 1) yield return null;
    }
}
```

## 内存感知优化

### 压力检测触发
```csharp
if (coroutineModule.IsMemoryPressureHigh()) {
    yield return new WaitForSeconds(0.5f); // 相邻预取
    yield return new WaitForSeconds(1.0f); // 批量加载
}
```

### 自适应调整策略
- **正常情况**:按默认间隔和批量大小处理
- **内存压力**:增加等待时间，减少并发请求
- **极端情况**:暂停后台加载，保证当前操作流畅性

## 性能优化考虑

### 平面优先级
1. **轴向优先**:医学影像最常用的浏览方向
2. **矢状/冠状延后**:重建计算量大，非主要浏览方向

### 预取范围平衡
- **默认范围3**:在内存占用和响应速度间平衡
- **可配置设计**:不同设备和数据大小可调整
- **动态调整**:根据设备性能和内存状况实时优化