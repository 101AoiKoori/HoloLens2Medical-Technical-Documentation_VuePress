---
title: 双向数据同步
---
# 双向数据同步

DicomUIController实现了UI控件与数据模型间的双向数据绑定，确保用户操作和程序状态变更都能正确反映到界面上。本节详细分析双向同步的技术实现机制。

## 防递归机制设计

### isUpdatingUI标志实现

系统使用`isUpdatingUI`布尔标志防止事件循环:

```csharp
public class DicomUIController : MonoBehaviour
{
    // UI更新状态标志
    private bool isUpdatingUI = false;

    private void OnWindowCenterSliderChanged(float normalizedValue)
    {
        // 防递归检查
        if (isUpdatingUI || mprViewer == null) return;

        float center = Mathf.Lerp(windowCenterMin, windowCenterMax, normalizedValue);
        float width = mprViewer.GetWindowWidth();

        // 更新数据模型
        mprViewer.SetWindowLevel(center, width);
        if (slice3DManager != null)
        {
            slice3DManager.SetWindowLevel(center, width);
        }
    }

    private void HandleWindowLevelChanged(float center, float width)
    {
        // 防递归检查
        if (isUpdatingUI) return;

        // 设置更新标志
        isUpdatingUI = true;
        try
        {
            // 更新UI控件
            UpdateWindowLevelSliders(center, width);
        }
        finally
        {
            // 确保标志被清除
            isUpdatingUI = false;
        }
    }
}
```

### 标志生命周期管理

`isUpdatingUI`标志具有严格的生命周期管理:

1. **设置时机**:在UI更新操作开始前设置为true
2. **作用范围**:仅在UI同步操作期间有效
3. **清除保证**:使用try-finally确保标志被正确清除
4. **检查时机**:每个可能触发递归的事件处理器都检查此标志

```csharp
private void UpdateAllSliders()
{
    if (mprViewer == null) return;

    isUpdatingUI = true;
    try
    {
        // 批量更新所有滑块
        UpdateSliceSliders();
        UpdateWindowLevelSliders();
    }
    finally
    {
        isUpdatingUI = false;
    }
}
```

## 正向同步实现（UI → 数据）

### 切片索引同步机制

用户拖动切片滑块时的数据更新流程:

```csharp
private void OnPlaneSliderChanged(DicomPlane.PlaneType planeType, float normalizedValue)
{
    if (isUpdatingUI || mprViewer == null) return;

    // 第一步:计算目标索引
    int totalSlices = mprViewer.GetSliceCount(planeType);
    if (totalSlices <= 1) return;

    int newIndex = Mathf.RoundToInt(normalizedValue * (totalSlices - 1));
    newIndex = Mathf.Clamp(newIndex, 0, totalSlices - 1);

    // 第二步:更新主数据模型
    mprViewer.SetSliceIndex(planeType, newIndex);

    // 第三步:同步关联组件
    SynchronizeSliceIndex(planeType, newIndex);
}

private void SynchronizeSliceIndex(DicomPlane.PlaneType planeType, int index)
{
    if (slice3DManager == null) return;

    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            slice3DManager.SetAxialSliceIndex(index);
            break;
        case DicomPlane.PlaneType.Sagittal:
            slice3DManager.SetSagittalSliceIndex(index);
            break;
        case DicomPlane.PlaneType.Coronal:
            slice3DManager.SetCoronalSliceIndex(index);
            break;
    }
}
```

### 窗宽窗位同步实现

窗宽窗位调整的数据传播机制:

```csharp
private void OnWindowCenterSliderChanged(float normalizedValue)
{
    if (isUpdatingUI || mprViewer == null) return;

    // 计算实际窗位值
    float center = Mathf.Lerp(windowCenterMin, windowCenterMax, normalizedValue);
    float currentWidth = mprViewer.GetWindowWidth();

    // 同步更新所有相关组件
    UpdateWindowLevelAcrossComponents(center, currentWidth);
}

private void OnWindowWidthSliderChanged(float normalizedValue)
{
    if (isUpdatingUI || mprViewer == null) return;

    // 计算实际窗宽值
    float currentCenter = mprViewer.GetWindowCenter();
    float width = Mathf.Lerp(windowWidthMin, windowWidthMax, normalizedValue);

    // 同步更新所有相关组件
    UpdateWindowLevelAcrossComponents(currentCenter, width);
}

private void UpdateWindowLevelAcrossComponents(float center, float width)
{
    // 更新主视图
    if (mprViewer != null)
    {
        mprViewer.SetWindowLevel(center, width);
    }

    // 同步3D视图
    if (slice3DManager != null)
    {
        slice3DManager.SetWindowLevel(center, width);
    }
}
```

## 反向同步实现（数据 → UI）

### MPRViewer事件响应

当数据模型发生变化时，UI需要反向同步:

```csharp
private void HandleDicomLoaded(int sliceCount)
{
    // 启用控件
    EnableControls(true);

    // 更新状态信息
    UpdateStatus($"DICOM数据加载完成，共 {sliceCount} 张切片");

    // 同步UI状态
    UpdateAllSliders();

    // 同步3D管理器
    if (slice3DManager != null && mprViewer != null)
    {
        var loadedSeries = mprViewer.GetLoadedSeries();
        if (loadedSeries != null)
        {
            slice3DManager.SetDicomSeries(loadedSeries);
        }
    }
}

private void HandleSliceChanged(DicomPlane.PlaneType planeType, int sliceIndex, int totalSlices)
{
    if (isUpdatingUI) return;

    isUpdatingUI = true;
    try
    {
        UpdateSliceSlider(planeType, sliceIndex, totalSlices);
    }
    finally
    {
        isUpdatingUI = false;
    }
}

private void HandleWindowLevelChanged(float center, float width)
{
    if (isUpdatingUI) return;

    isUpdatingUI = true;
    try
    {
        UpdateWindowLevelSliders(center, width);
    }
    finally
    {
        isUpdatingUI = false;
    }
}
```

### 滑块状态更新实现

反向同步时的滑块状态更新:

```csharp
private void UpdateSliceSlider(DicomPlane.PlaneType planeType, int sliceIndex, int totalSlices)
{
    Slider targetSlider = GetSliderForPlaneType(planeType);
    if (targetSlider == null) return;

    if (totalSlices > 1)
    {
        // 计算归一化值
        float normalizedValue = (float)sliceIndex / (totalSlices - 1);
        targetSlider.Value = normalizedValue;
        targetSlider.enabled = true;
    }
    else
    {
        // 单张切片时禁用滑块
        targetSlider.enabled = false;
    }
}

private Slider GetSliderForPlaneType(DicomPlane.PlaneType planeType)
{
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial: return axialSlider;
        case DicomPlane.PlaneType.Sagittal: return sagittalSlider;
        case DicomPlane.PlaneType.Coronal: return coronalSlider;
        default: return null;
    }
}

private void UpdateWindowLevelSliders(float center, float width)
{
    // 更新窗位滑块
    if (windowCenterSlider != null)
    {
        float normalizedCenter = Mathf.InverseLerp(windowCenterMin, windowCenterMax, center);
        windowCenterSlider.Value = normalizedCenter;
    }

    // 更新窗宽滑块
    if (windowWidthSlider != null)
    {
        float normalizedWidth = Mathf.InverseLerp(windowWidthMin, windowWidthMax, width);
        windowWidthSlider.Value = normalizedWidth;
    }
}
```

## 批量同步优化

### UpdateAllSliders实现

系统提供批量更新机制提高同步效率:

```csharp
private void UpdateAllSliders()
{
    if (mprViewer == null) return;

    isUpdatingUI = true;
    try
    {
        // 更新切片滑块
        UpdateSliceSliders();
        
        // 更新窗宽窗位滑块
        UpdateWindowLevelSliders();
    }
    finally
    {
        isUpdatingUI = false;
    }
}

private void UpdateSliceSliders()
{
    // 轴向切片滑块
    int axialCount = mprViewer.GetSliceCount(DicomPlane.PlaneType.Axial);
    if (axialCount > 1)
    {
        int currentIndex = mprViewer.GetSliceIndex(DicomPlane.PlaneType.Axial);
        float normalizedValue = (float)currentIndex / (axialCount - 1);
        if (axialSlider != null)
        {
            axialSlider.Value = normalizedValue;
            axialSlider.enabled = true;
        }
    }
    else if (axialSlider != null)
    {
        axialSlider.enabled = false;
    }

    // 矢状切片滑块
    int sagittalCount = mprViewer.GetSliceCount(DicomPlane.PlaneType.Sagittal);
    if (sagittalCount > 1)
    {
        int currentIndex = mprViewer.GetSliceIndex(DicomPlane.PlaneType.Sagittal);
        float normalizedValue = (float)currentIndex / (sagittalCount - 1);
        if (sagittalSlider != null)
        {
            sagittalSlider.Value = normalizedValue;
            sagittalSlider.enabled = true;
        }
    }
    else if (sagittalSlider != null)
    {
        sagittalSlider.enabled = false;
    }

    // 冠状切片滑块
    int coronalCount = mprViewer.GetSliceCount(DicomPlane.PlaneType.Coronal);
    if (coronalCount > 1)
    {
        int currentIndex = mprViewer.GetSliceIndex(DicomPlane.PlaneType.Coronal);
        float normalizedValue = (float)currentIndex / (coronalCount - 1);
        if (coronalSlider != null)
        {
            coronalSlider.Value = normalizedValue;
            coronalSlider.enabled = true;
        }
    }
    else if (coronalSlider != null)
    {
        coronalSlider.enabled = false;
    }
}

private void UpdateWindowLevelSliders()
{
    float center = mprViewer.GetWindowCenter();
    float width = mprViewer.GetWindowWidth();

    // 更新窗位滑块
    if (windowCenterSlider != null)
    {
        float normalizedCenter = Mathf.InverseLerp(windowCenterMin, windowCenterMax, center);
        windowCenterSlider.Value = normalizedCenter;
    }

    // 更新窗宽滑块
    if (windowWidthSlider != null)
    {
        float normalizedWidth = Mathf.InverseLerp(windowWidthMin, windowWidthMax, width);
        windowWidthSlider.Value = normalizedWidth;
    }
}
```

## 状态一致性验证

### 同步完整性检查

系统实现状态验证机制确保同步的正确性:

```csharp
private bool VerifySynchronizationState()
{
    if (mprViewer == null) return false;

    bool isConsistent = true;

    // 验证切片索引同步
    if (!VerifySliceIndexSync())
    {
        Debug.LogWarning("切片索引同步状态不一致");
        isConsistent = false;
    }

    // 验证窗宽窗位同步
    if (!VerifyWindowLevelSync())
    {
        Debug.LogWarning("窗宽窗位同步状态不一致");
        isConsistent = false;
    }

    return isConsistent;
}

private bool VerifySliceIndexSync()
{
    // 检查轴向切片同步
    if (axialSlider != null && axialSlider.enabled)
    {
        int actualIndex = mprViewer.GetSliceIndex(DicomPlane.PlaneType.Axial);
        int totalSlices = mprViewer.GetSliceCount(DicomPlane.PlaneType.Axial);
        float expectedValue = (float)actualIndex / (totalSlices - 1);
        
        if (Mathf.Abs(axialSlider.Value - expectedValue) > 0.01f)
        {
            return false;
        }
    }

    // 类似检查矢状和冠状切片...
    return true;
}

private bool VerifyWindowLevelSync()
{
    if (windowCenterSlider == null || windowWidthSlider == null)
        return true;

    float actualCenter = mprViewer.GetWindowCenter();
    float actualWidth = mprViewer.GetWindowWidth();

    float expectedCenterValue = Mathf.InverseLerp(windowCenterMin, windowCenterMax, actualCenter);
    float expectedWidthValue = Mathf.InverseLerp(windowWidthMin, windowWidthMax, actualWidth);

    bool centerSync = Mathf.Abs(windowCenterSlider.Value - expectedCenterValue) < 0.01f;
    bool widthSync = Mathf.Abs(windowWidthSlider.Value - expectedWidthValue) < 0.01f;

    return centerSync && widthSync;
}
```

## 异步同步处理

### 延迟同步机制

对于频繁变更的操作，系统实现延迟同步减少性能开销:

```csharp
private Coroutine delayedSyncCoroutine;
private const float SYNC_DELAY = 0.1f; // 100ms延迟

private void ScheduleDelayedSync()
{
    // 取消之前的延迟同步
    if (delayedSyncCoroutine != null)
    {
        StopCoroutine(delayedSyncCoroutine);
    }

    // 启动新的延迟同步
    delayedSyncCoroutine = StartCoroutine(DelayedSyncCoroutine());
}

private IEnumerator DelayedSyncCoroutine()
{
    yield return new WaitForSeconds(SYNC_DELAY);
    
    // 执行同步操作
    if (!isUpdatingUI && mprViewer != null)
    {
        UpdateAllSliders();
    }
    
    delayedSyncCoroutine = null;
}
```

### 同步状态恢复

当检测到同步不一致时，系统能够自动恢复:

```csharp
public void ForceSync()
{
    if (mprViewer == null) return;

    Debug.Log("强制执行UI同步");
    
    isUpdatingUI = true;
    try
    {
        // 强制更新所有UI元素
        UpdateAllSliders();
        
        // 同步3D组件状态
        SynchronizeExternalComponents();
        
        // 验证同步结果
        if (!VerifySynchronizationState())
        {
            Debug.LogError("强制同步后状态仍然不一致");
        }
    }
    finally
    {
        isUpdatingUI = false;
    }
}

private void SynchronizeExternalComponents()
{
    if (slice3DManager == null) return;

    // 同步所有切片索引
    slice3DManager.SetAxialSliceIndex(mprViewer.GetSliceIndex(DicomPlane.PlaneType.Axial));
    slice3DManager.SetSagittalSliceIndex(mprViewer.GetSliceIndex(DicomPlane.PlaneType.Sagittal));
    slice3DManager.SetCoronalSliceIndex(mprViewer.GetSliceIndex(DicomPlane.PlaneType.Coronal));

    // 同步窗宽窗位
    slice3DManager.SetWindowLevel(mprViewer.GetWindowCenter(), mprViewer.GetWindowWidth());
}
```

通过这套完整的双向数据同步机制，DicomUIController确保了UI状态与数据模型的实时一致性，同时通过防递归、批量更新和状态验证等优化手段，保证了系统的稳定性和性能。