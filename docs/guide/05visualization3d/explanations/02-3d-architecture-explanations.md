---
title: 3D可视化架构原理
---
# 3D可视化架构原理
## 多平面重建技术

多平面重建（MPR）是医学影像领域的核心技术，通过将体积数据切割为不同方向的平面来观察解剖结构。Visualization3D模块实现了标准的三正交面重建:

**轴向面（Axial）**:垂直于人体纵轴的横断面，显示人体的横截面结构，如CT扫描的原始切片。每个轴向切片对应DicomSeries中的一个DicomSlice对象。

**矢状面（Sagittal）**:平行于人体正中矢状面的纵切面，将人体分为左右两部分。矢状面纹理需要从体积数据中重新采样生成。

**冠状面（Coronal）**:平行于人体冠状面的纵切面，将人体分为前后两部分。冠状面纹理同样需要从体积数据重建。

## 3D空间布局设计

### 坐标系统转换

医学影像坐标系与Unity世界坐标系之间存在转换关系:

- **DICOM坐标系**:基于患者方位（Patient Orientation），使用LPS坐标系（Left-Posterior-Superior）
- **Unity坐标系**:左手坐标系，Y轴向上，Z轴向前
- **DicomCoordinateMapper**:负责两个坐标系之间的转换，解析ImageOrientationPatient标签实现正确的空间映射

### 平面朝向与旋转

每个平面在3D空间中的朝向通过Quaternion旋转实现:

- **轴向平面**:绕X轴旋转90度，绕Y轴旋转180度，确保切片正面朝向观察者
- **矢状平面**:绕Y轴旋转-90度，使平面法向量指向X轴正方向
- **冠状平面**:保持默认朝向，法向量指向Z轴正方向

### 平面位置映射

平面在3D空间中的位置基于切片索引动态计算:

```csharp
float normalizedPosition = (float)index / (total - 1);
Vector3 newPosition = initialPosition;

switch (planeType)
{
    case DicomPlane.PlaneType.Axial:
        newPosition.y = Mathf.Lerp(-movementRange, movementRange, normalizedPosition);
        break;
    // 其他平面类似处理
}
```

## 纹理管理架构

### 多级纹理源

系统采用多级回退机制获取纹理:

1. **优先级1**:MPRViewer的TextureManager缓存
2. **优先级2**:MPRViewer的RawImage纹理
3. **优先级3**:DicomSeries直接生成

### 纹理转换流程

RawImage中的RenderTexture需要转换为Texture2D才能用于3D材质:

1. 使用Graphics.Blit复制RenderTexture到临时缓冲区
2. 创建新的Texture2D对象并设置合适的纹理格式
3. 使用ReadPixels从RenderTexture读取像素数据
4. 执行灰度均衡处理，确保医学影像的正确显示
5. 应用纹理设置并释放临时资源

## 事件驱动同步机制

### 双向数据绑定

2D UI与3D场景通过事件实现双向同步:

- **UI到3D**:MPRViewer触发OnSliceChanged事件，DicomTextureBridge监听并更新3D纹理
- **3D到UI**:DicomPlaneController触发OnSliceIndexChanged事件，同步回MPRViewer的切片索引

### 状态一致性保证

通过以下机制确保状态一致性:

1. **防递归机制**:避免事件循环触发导致的无限递归
2. **索引比较**:只有当索引真正改变时才触发更新
3. **异步协调**:使用协程处理耗时的纹理转换操作