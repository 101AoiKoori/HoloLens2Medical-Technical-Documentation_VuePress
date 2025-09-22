---
title: 坐标系统与方向映射原理
---

# 坐标系统与方向映射原理

医学影像涉及多个坐标系统的转换，Core模块通过DicomCoordinateMapper实现DICOM病人坐标系与Unity世界坐标系的映射。本文档解析坐标系统的原理和映射算法。

## 医学影像坐标系统概述

### DICOM病人坐标系(Patient Coordinate System)

DICOM标准定义了右手坐标系，以病人为中心:

- **X轴**:病人的左(-) → 右(+)方向
- **Y轴**:病人的后(-) → 前(+)方向  
- **Z轴**:病人的脚(-) → 头(+)方向

### Unity世界坐标系

Unity使用左手坐标系:

- **X轴**:场景的左(-) → 右(+)方向
- **Y轴**:场景的下(-) → 上(+)方向
- **Z轴**:场景的后(-) → 前(+)方向

### 解剖平面定义

医学影像通常从三个标准解剖平面观察:

**轴向平面(Axial)**:
- 水平切片，垂直于身体长轴
- 从头顶向脚底方向查看
- 显示左右和前后的解剖结构

**矢状平面(Sagittal)**:
- 纵向切片，平行于身体中线
- 从左侧或右侧查看
- 显示前后和头脚的解剖结构

**冠状平面(Coronal)**:
- 纵向切片，垂直于身体中线
- 从前方或后方查看
- 显示左右和头脚的解剖结构

## ImageOrientationPatient标签解析

### 标签结构

ImageOrientationPatient包含6个浮点数:
```
[Xx, Xy, Xz, Yx, Yy, Yz]
```

前三个数值(Xx, Xy, Xz)构成行向量，表示图像第一行的方向。
后三个数值(Yx, Yy, Yz)构成列向量，表示图像第一列的方向。

### 向量的几何意义

**行向量(Row Direction)**:
- 表示图像水平方向在病人坐标系中的朝向
- 通常对应图像的左-右方向
- 用于确定矢状轴的映射

**列向量(Column Direction)**:
- 表示图像垂直方向在病人坐标系中的朝向
- 通常对应图像的上-下方向
- 用于确定冠状轴的映射

**法向量(Normal Direction)**:
- 通过行向量×列向量的叉积计算得出
- 表示切片厚度方向，即穿透切片的方向
- 用于确定轴向轴的映射

## 主轴判定算法原理

DicomCoordinateMapper使用向量分量分析确定轴映射:

### 轴向轴确定

```csharp
// 计算法向量各分量的绝对值
Vector3 absNormal = new Vector3(
    Mathf.Abs(normalDirection.x),
    Mathf.Abs(normalDirection.y),
    Mathf.Abs(normalDirection.z)
);

// 选择绝对值最大的分量作为轴向轴
if (absNormal.x >= absNormal.y && absNormal.x >= absNormal.z)
    axialAxis = 0; // X轴对应轴向
else if (absNormal.y >= absNormal.z)
    axialAxis = 1; // Y轴对应轴向
else
    axialAxis = 2; // Z轴对应轴向
```

**判定原理**:法向量指向切片穿透方向，其最大分量对应的轴即为轴向轴。

### 矢状轴和冠状轴确定

在剩余的两个轴中，选择行向量投影较大的作为矢状轴:

```csharp
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
```

**判定原理**:行向量通常对应图像的左-右方向，因此其投影最大的轴应该是矢状轴。

## 轴符号计算原理

轴符号决定了索引映射时是否需要反转:

```csharp
private void CalculateAxisSigns()
{
    // 根据法向量的符号确定轴符号
    axisSign[0] = Mathf.Sign(normalDirection.x);
    axisSign[1] = Mathf.Sign(normalDirection.y);
    axisSign[2] = Mathf.Sign(normalDirection.z);

    // 确保没有零符号
    for (int i = 0; i < 3; i++)
    {
        if (axisSign[i] == 0)
            axisSign[i] = 1;
    }
}
```

### 符号的医学意义

**正符号(+1)**:坐标增长方向与DICOM标准一致
- X轴:左→右
- Y轴:后→前
- Z轴:脚→头

**负符号(-1)**:坐标增长方向与DICOM标准相反
- 需要在索引映射时反转:`index = size - 1 - index`

## 坐标转换算法

### 平面索引到体素坐标

将UI滑条的平面索引转换为三维体素坐标:

```csharp
public Vector3Int MapSagittalIndexToVolume(int sagittalIndex, Vector3Int dimensions)
{
    Vector3Int volumeCoord = Vector3Int.zero;
    
    switch (sagittalAxis)
    {
        case 0:
            volumeCoord.x = axisSign[0] > 0 ? 
                sagittalIndex : (dimensions.x - 1 - sagittalIndex);
            break;
        case 1:
            volumeCoord.y = axisSign[1] > 0 ? 
                sagittalIndex : (dimensions.y - 1 - sagittalIndex);
            break;
        case 2:
            volumeCoord.z = axisSign[2] > 0 ? 
                sagittalIndex : (dimensions.z - 1 - sagittalIndex);
            break;
    }
    
    return volumeCoord;
}
```

**算法原理**:
1. 根据轴映射确定目标轴
2. 根据轴符号决定是否反转索引
3. 其他轴坐标保持为0（表示平面位置）

### 体素坐标到平面像素坐标

将三维体素坐标投影到二维平面像素坐标:

```csharp
public Vector2Int GetCoordinatesInPlane(Vector3Int volumeCoord, DicomPlane.PlaneType planeType)
{
    switch (planeType)
    {
        case DicomPlane.PlaneType.Axial:
            if (axialAxis == 0)
                return new Vector2Int(volumeCoord.y, volumeCoord.z);
            else if (axialAxis == 1)
                return new Vector2Int(volumeCoord.x, volumeCoord.z);
            else
                return new Vector2Int(volumeCoord.x, volumeCoord.y);
        // ... 其他平面类似处理
    }
}
```

**投影原理**:去除平面法向量对应的坐标分量，保留其他两个分量作为平面坐标。

## 默认方向映射

当DICOM文件缺失方向信息时，使用标准默认映射:

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
}
```

这个默认映射符合最常见的医学影像约定。

## 坐标系转换的几何变换

### 旋转矩阵构造

从行向量和列向量构造旋转矩阵:

```
R = [rowDirection.x    columnDirection.x    normalDirection.x]
    [rowDirection.y    columnDirection.y    normalDirection.y]
    [rowDirection.z    columnDirection.z    normalDirection.z]
```

这个矩阵描述了从DICOM图像坐标系到病人坐标系的转换。

### 逆变换

从病人坐标