---
title: 坐标变换算法实现
---

# 坐标变换算法实现

本文档详细解析DicomCoordinateMapper中ImageOrientationPatient解析的数学实现，包括法向量计算、轴判定算法和索引映射的具体技术细节。

## ImageOrientationPatient标签解析

DICOM标准中ImageOrientationPatient包含6个浮点数，DicomCoordinateMapper的解析实现:

```csharp
public void InitializeFromDataset(DicomDataset dataset)
{
    if (dataset == null) return;

    if (dataset.Contains(DicomTag.ImageOrientationPatient))
    {
        try
        {
            double[] orientation = dataset.GetValues<double>(DicomTag.ImageOrientationPatient);
            if (orientation != null && orientation.Length >= 6)
            {
                // 提取并归一化行向量
                rowDirection = new Vector3(
                    (float)orientation[0],
                    (float)orientation[1],
                    (float)orientation[2]
                ).normalized;

                // 提取并归一化列向量
                columnDirection = new Vector3(
                    (float)orientation[3],
                    (float)orientation[4],
                    (float)orientation[5]
                ).normalized;

                // 计算法向量（叉积）
                normalDirection = Vector3.Cross(rowDirection, columnDirection).normalized;

                // 判定主轴
                DetermineMainAxes();
                isInitialized = true;
            }
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"Error parsing DICOM orientation matrix: {ex.Message}");
            UseDefaultOrientation();
        }
    }
}
```

### 向量归一化的重要性

归一化确保向量长度为1，避免DICOM数据中的数值误差:

```csharp
rowDirection = new Vector3(
    (float)orientation[0],
    (float)orientation[1],
    (float)orientation[2]
).normalized;
```

**数学原理**:
- 归一化公式:`v_norm = v / |v|`
- Unity的`.normalized`属性自动计算:`sqrt(x² + y² + z²)`
- 防止后续计算中的缩放错误

## 法向量计算的数学实现

法向量通过叉积计算，表示切片的法线方向:

```csharp
normalDirection = Vector3.Cross(rowDirection, columnDirection).normalized;
```

### 叉积的几何意义

**数学公式**:
```
n = r × c = (r_y*c_z - r_z*c_y, r_z*c_x - r_x*c_z, r_x*c_y - r_y*c_x)
```

**几何解释**:
- 法向量垂直于行向量和列向量构成的平面
- 方向符合右手定则
- 长度等于平行四边形面积（归一化后为1）

**医学影像中的应用**:
- 法向量指向切片的"穿透"方向
- 用于确定轴向平面（通常是头-脚方向）
- 判断切片的空间朝向

## 主轴判定算法

DetermineMainAxes()通过比较向量分量的绝对值确定解剖轴:

```csharp
private void DetermineMainAxes()
{
    // 找到法向量绝对值最大的分量 - 确定轴向轴
    Vector3 absNormal = new Vector3(
        Mathf.Abs(normalDirection.x),
        Mathf.Abs(normalDirection.y),
        Mathf.Abs(normalDirection.z)
    );

    if (absNormal.x >= absNormal.y && absNormal.x >= absNormal.z)
        axialAxis = 0; // X轴对应轴向
    else if (absNormal.y >= absNormal.z)
        axialAxis = 1; // Y轴对应轴向
    else
        axialAxis = 2; // Z轴对应轴向

    // 找到行向量绝对值最大的分量 - 在剩余轴中确定矢状轴
    Vector3 absRow = new Vector3(
        Mathf.Abs(rowDirection.x),
        Mathf.Abs(rowDirection.y),
        Mathf.Abs(rowDirection.z)
    );

    // 在非轴向轴中选择行向量投影最大的作为矢状轴
    if (axialAxis != 0 && (axialAxis == 1 || absRow.x >= absRow.y) && (axialAxis == 2 || absRow.x >= absRow.z))
        sagittalAxis = 0;
    else if (axialAxis != 1 && (axialAxis == 2 || absRow.y >= absRow.z))
        sagittalAxis = 1;
    else
        sagittalAxis = 2;

    // 冠状轴是剩余的轴
    coronalAxis = 3 - axialAxis - sagittalAxis;

    // 计算轴符号
    CalculateAxisSigns();
}
```

### 轴判定的数学逻辑

**轴向轴确定**:
- 法向量分量绝对值最大的轴即为轴向轴
- 因为轴向平面垂直于法向量
- 医学上通常对应头-脚方向

**矢状轴确定**:
- 在剩余两个轴中，选择行向量投影最大的
- 行向量通常对应图像的左-右方向
- 医学上对应左-右矢状切片

**冠状轴确定**:
- 剩余的轴自然成为冠状轴
- 通过减法计算:`3 - axialAxis - sagittalAxis`
- 医学上对应前-后方向

## 轴符号计算算法

CalculateAxisSigns()确定每个轴的正负方向:

```csharp
private void CalculateAxisSigns()
{
    // 根据行向量、列向量、法向量的符号确定轴符号
    axisSign[0] = Mathf.Sign(normalDirection.x);
    axisSign[1] = Mathf.Sign(normalDirection.y);
    axisSign[2] = Mathf.Sign(normalDirection.z);

    // 确保没有零符号
    for (int i = 0; i < 3; i++)
    {
        if (axisSign[i] == 0)
            axisSign[i] = 1;
    }

    // 应用特殊方向规则
    ApplySpecialOrientationRules();
}
```

### 符号确定的医学意义

轴符号决定了Unity坐标系与DICOM病人坐标系的对应关系:

**正符号(+1)**:
- X轴:左→右（病人左侧到右侧）
- Y轴:后→前（病人背部到腹部）  
- Z轴:脚→头（病人脚部到头部）

**负符号(-1)**:
- 对应的方向相反
- 在索引映射时需要反转:`index = size - 1 - index`

## 索引映射的核心算法

### 矢状索引到体素坐标映射

MapSagittalIndexToVolume实现平面索引到三维坐标的转换:

```csharp
public Vector3Int MapSagittalIndexToVolume(int sagittalIndex, Vector3Int dimensions)
{
    if (!isInitialized) UseDefaultOrientation();

    Vector3Int volumeCoord = Vector3Int.zero;

    switch (sagittalAxis)
    {
        case 0:
            volumeCoord.x = axisSign[0] > 0 ? sagittalIndex : (dimensions.x - 1 - sagittalIndex);
            break;
        case 1:
            volumeCoord.y = axisSign[1] > 0 ? sagittalIndex : (dimensions.y - 1 - sagittalIndex);
            break;
        case 2:
            volumeCoord.z = axisSign[2] > 0 ? sagittalIndex : (dimensions.z - 1 - sagittalIndex);
            break;
    }

    return volumeCoord;
}
```

### 索引反转的数学原理

当轴符号为负时，需要反转索引:

```csharp
volumeCoord.x = axisSign[0] > 0 ? sagittalIndex : (dimensions.x - 1 - sagittalIndex);
```

**数学解释**:
- 正符号:直接映射 `index → index`
- 负符号:反转映射 `index → (size-1-index)`
- 这确保了索引0始终对应正确的解剖位置

**示例**:
- 体素尺寸为256，索引100
- 正符号:映射到100
- 负符号:映射到155 (256-1-100)

## 平面坐标映射算法

GetCoordinatesInPlane将三维坐标投影到二维平面:

```csharp
public Vector2Int GetCoordinatesInPlane(Vector3Int volumeCoord, DicomPlane.PlaneType planeType)
{
    if (!isInitialized) UseDefaultOrientation();

    Vector2Int planeCoord = Vector2Int.zero;

    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            if (axialAxis == 0)
                planeCoord = new Vector2Int(volumeCoord.y, volumeCoord.z);
            else if (axialAxis == 1)
                planeCoord = new Vector2Int(volumeCoord.x, volumeCoord.z);
            else
                planeCoord = new Vector2Int(volumeCoord.x, volumeCoord.y);
            break;

        case DicomPlane.PlaneType.Sagittal:
            if (sagittalAxis == 0)
                planeCoord = new Vector2Int(volumeCoord.y, volumeCoord.z);
            else if (sagittalAxis == 1)
                planeCoord = new Vector2Int(volumeCoord.x, volumeCoord.z);
            else
                planeCoord = new Vector2Int(volumeCoord.x, volumeCoord.y);
            break;

        case DicomPlane.PlaneType.Coronal:
            if (coronalAxis == 0)
                planeCoord = new Vector2Int(volumeCoord.y, volumeCoord.z);
            else if (coronalAxis == 1)
                planeCoord = new Vector2Int(volumeCoord.x, volumeCoord.z);
            else
                planeCoord = new Vector2Int(volumeCoord.x, volumeCoord.y);
            break;
    }

    return planeCoord;
}
```

### 坐标投影的几何原理

对于每种平面类型，去除对应的轴坐标:

**轴向平面投影**:
- 如果axialAxis=2（Z轴），则投影为(X,Y)
- 如果axialAxis=1（Y轴），则投影为(X,Z)  
- 如果axialAxis=0（X轴），则投影为(Y,Z)

**数学表示**:
```
axial_plane = project_perpendicular_to(axial_axis)
sagittal_plane = project_perpendicular_to(sagittal_axis)
coronal_plane = project_perpendicular_to(coronal_axis)
```

## 体素到轴向像素的快速映射

MapVoxelToAxialPixel提供轴向平面的专用快速映射:

```csharp
public Vector2Int MapVoxelToAxialPixel(Vector3Int voxelCoord)
{
    if (!isInitialized)
    {
        Debug.LogError("Orientation helper not initialized");
        return Vector2Int.zero;
    }

    var axesMapping = GetCurrentAxesMapping();
    int axialAxis = axesMapping.axial;
    int[] axialPlaneAxes = GetRemainingAxes(axialAxis);

    int x = voxelCoord[axialPlaneAxes[0]];
    int y = voxelCoord[axialPlaneAxes[1]];

    return new Vector2Int(x, y);
}
```

### GetRemainingAxes的算法实现

获取除指定轴外的其余两个轴:

```csharp
public int[] GetRemainingAxes(int excludedAxis)
{
    int[] result = new int[2];
    int index = 0;

    for (int i = 0; i < 3; i++)
    {
        if (i != excludedAxis)
        {
            if (index < 2)
            {
                result[index] = i;
                index++;
            }
        }
    }

    return result;
}
```

**算法效率**:
- O(1)时间复杂度（固定3次迭代）
- 避免动态分配，使用预分配数组
- 内联候选，编译器可能优化为直接计算

## 特殊方向规则处理

ApplySpecialOrientationRules允许处理特殊设备或序列:

```csharp
private void ApplySpecialOrientationRules()
{
    if (enableDebugLog)
    {
        Debug.Log($"Before applying special orientation rules: Axial={axialAxis}, Sagittal={sagittalAxis}, Coronal={coronalAxis}");
    }

    // 可以在此添加特定方向规则
    // 例如特殊设备或序列的处理

    if (enableDebugLog)
    {
        Debug.Log($"After applying special orientation rules: Axial={axialAxis}, Sagittal={sagittalAxis}, Coronal={coronalAxis}");
    }
}
```

### 扩展性设计

这个方法为将来可能的特殊情况预留空间:

**可能的规则**:
- 特定制造商的坐标系差异
- 特殊扫描序列的方向修正
- 历史数据的兼容性处理
- 用户自定义的方向偏好

## 默认方向的回退机制

当ImageOrientationPatient缺失或解析失败时，使用默认方向:

```csharp
private void UseDefaultOrientation()
{
    rowDirection = new Vector3(1, 0, 0);      // X轴方向
    columnDirection = new Vector3(0, 1, 0);   // Y轴方向  
    normalDirection = new Vector3(0, 0, 1);   // Z轴方向

    axialAxis = 2;    // Z轴对应轴向（头-脚）
    sagittalAxis = 0; // X轴对应矢状（左-右）
    coronalAxis = 1;  // Y轴对应冠状（前-后）

    axisSign[0] = 1;  // 正向
    axisSign[1] = 1;  // 正向
    axisSign[2] = 1;  // 正向

    isInitialized = true;
}
```

### 默认映射的医学标准

这个默认映射符合常见的医学影像约定:
- Z轴:头-脚方向（轴向切片）
- X轴:左-右方向（矢状切片）  
- Y轴:前-后方向（冠状切片）

## 坐标系验证和调试

通过调试输出验证坐标映射的正确性:

```csharp
if (enableDebugLog)
{
    Debug.Log($"DICOM orientation matrix initialization successful:");
    Debug.Log($"  Row vector: {rowDirection}");
    Debug.Log($"  Column vector: {columnDirection}");
    Debug.Log($"  Normal vector: {normalDirection}");
    Debug.Log($"  Main axes mapping: Axial={axialAxis}, Sagittal={sagittalAxis}, Coronal={coronalAxis}");
    Debug.Log($"  Axis signs: X={axisSign[0]}, Y={axisSign[1]}, Z={axisSign[2]}");
}
```

这些信息帮助开发者验证:
- 向量是否正交且归一化
- 轴分配是否符合医学约定
- 符号是否正确反映空间关系

## 总结

DicomCoordinateMapper的坐标变换算法实现了以下关键功能:

1. **向量解析**:从DICOM标签提取并归一化方向向量
2. **法向量计算**:通过叉积确定切片法线方向  
3. **轴判定**:基于向量分量大小自动确定解剖轴映射
4. **符号计算**:处理坐标系方向差异
5. **索引映射**:在平面索引和三维坐标间双向转换
6. **容错机制**:提供默认方向和异常处理

这些算法确保了不论DICOM数据的方向如何，都能正确映射到统一的三维坐标系统。