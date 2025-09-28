---
title: 工程搭建
---
# 工程搭建

> 目标：完成一个可在 **HoloLens 2** 上运行的 Unity 工程骨架，能够加载 DICOM / STL 文件，并使用 **MRTK3** 进行交互浏览。

## 1. 建立工程与基础目录

1. 使用 **Unity 2022 LTS**（推荐 Unity 2022.3.55f1c1）新建 3D 项目，项目名：`HoloLens2Medical`
2. 在 `Assets/` 下创建目录结构：

```json
Assets/
├──HoloLens2Medical
|   ├── DICOMModule/
|   │   ├── Custom/    // 放置着色器文件
|   │   ├── Prefab/    // 放置预制件
|   |   └── Script/    // 放置脚本
|   |       ├── Core/
|   │       ├── Loading/
|   │       ├── Imaging/
|   │       ├── Viewers/
|   │       ├── UI/
|   │       └── Visualization3D/
```
![alt text](./imgs/document_structure.png)

> 命名建议：统一使用命名空间 `MedicalMR.DICOM.<Module>`，例如：`MedicalMR.DICOM.Core`。
---

## 2. 安装第三方包

### 2.1 安装 MRTK3 环境
* MRTK3 和 XR 环境配置在官方文档中已有详细介绍，参见：[Mixed Reality Feature Tool](https://learn.microsoft.com/en-us/windows/mixed-reality/develop/unity/welcome-to-mr-feature-tool) 和 HoloLens2 官方教程：[HoloLens 2 fundamentals: develop mixed reality applications](https://learn.microsoft.com/en-us/training/paths/beginner-hololens-2-tutorials/)，本文不再重复描述。

### 2.2 安装 fo-dicom 第三方包
1. 在 Unity 中通过 Assets 导入 NuGet 的 NuGetForUnity 包
![alt text](./imgs/import_packages.png)
2. 导入完成后，在 `NuGet` 的 `Manage NuGet Packages` 中搜索 `fo-dicom` 并下载 5.2.2 版本的第三方包
![alt text](./imgs/fo-dicom.png)
3. 在创建的 C# 脚本中导入 `using FellowOakDicom` 包，没有报错即为安装成功

### 2.3 安装 pb_Stl 第三方包
1. 下载 `pb_Stl`：[pb_Stl](https://github.com/karl-/pb_Stl)，将文件放入根目录的 Packages 里
2. 打开 `Packages/manifest.json`，在 `"dependencies"` 列表中添加 `"co.parabox.stl":"https://github.com/karl-/pb_Stl.git"`
3. 在 Packages 中看到 `STL` 即为安装成功
![alt text](./imgs/stl.png)
---

## 3. Unity 平台与 UWP 配置

### 3.1 切换平台

* **File > Build Settings…** → 选择 **Universal Windows Platform** → `Switch Platform`

  * Architecture：**ARM 64-bit**
  * Target SDK Version：**10.0.22621.0**
![alt text](./imgs/uwp.png)


## 4. 预制件与场景层级（Hierarchy）

### 4.1 数据与资源放置
* 在 `Assets/HoloLens2Medical/DICOMModule/Prefabs/` 中可以找到已经配置好的预制件。
* 请将 `dicom` 数据放置在 `Assets\StreamingAssets\DICOM` 中，加载 `dicom` 前请先清除 `StreamingAssets` 中的 `json` 文件；

```
Assets/StreamingAssets/
└── DICOM/
    ├── series-index.json
    └── <你的 dcm 文件/子目录>
```
* 请将着色器文件放置在 `DICOMModule/Custom` 中

### 4.2 场景层级（Hierarchy）搭建
> 由于 visualization3d 模块是 STL 模型与 DICOM 数据交互模块的融合，因此在属于 STL 的层级结构中会出现 DICOM 相关脚本

1. 首先，在场景中创建一个空对象并命名为 **`DICOMModule`**。
在该对象下，再创建一个名为 **`Plane`** 的主空对象，用于承载各个视图。
然后，在 `Plane` 下分别建立三个 Canvas，代表不同切面：**轴位（Axial）**、**冠状位（Coronal）**、**矢状位（Sagittal）**。
最后，在每个切面对象下添加一个 Unity 自带的 **Raw Image** 组件（宽高均为 1 个单位），并分别命名为：

* `AxialRaw`
* `CoronalRaw`
* `SagittalRaw`
> 三个 `Canvas` 的 `Render mode` 设置为 `World Space`，宽高均设为 1，如图所示即可![canvas](./imgs/canvas.png)


2. 再回到 `DICOMModule` 空对象下，在它的子级创建一个名为 `DicomSystem` 的脚本挂载对象，
将 `Assets/HoloLens2Medical/DICOMModule/Script` 中的 `DicomManager` 挂载上去。
* `DicomManager` 会自动挂载 `DicomSeriesLoader`、`DicomUIController`、`MPRViewer` 这三个组件
![plane](./imgs/plane.png)

3. 接下来需要配置 `MPRViewer`、`DicomUIController` 这两个组件。
* 首先将 `Prefabs` 中的 `HandMenuLarge` 放置到场景层级中，如果 `HandMenuLarge` 离 `MRTK3` 的 `MRTK XR Rig` 距离较远，请将面板拖到摄像头可见范围内。
* 接下来在 `MPRViewer` 中将刚刚创建的 3 个 `Raw image` 拖入 UI 引用中（如上图所示），在 MPRViewer 中可以调整窗位和窗宽的初始位置、步幅。

![bottom](./imgs/bottom.png)
* 接下来在 `DicomUIController` 组件中依次放入 `HandMenuLarge` 预制件、`HandMenuLarge` 右侧的按钮、滑条，具体配置如图所示
* `HandMenuLarge` 预制件包含三个功能区域：
  - **左侧**：`MRTK3` 基础交互按钮（重置`STL`位置、标记模式、测距模式、清除标记）
  - **右侧**：`DICOM` 数据控制按钮（加载数据、重置视图、隐藏`3D`平面、关闭`STL`外框）  
  - **中间**：`DICOM` 切片索引滑块和**窗位**、**窗宽**调节
![HandMenuLarge](./imgs/HandMenuLarge.png)

4. 放置好 `DICOM` 数据文件并完成如上配置后，就可以正常加载 `dicom` 数据了。

### 4.3 STL（visualization3d）模块配置
![alt text](./imgs/BoundingBoxWithHandles.png)
> 为了方便拖动整个 `STL` 模型，我们在存放 `STL` 的父级对象上挂载 `bounds control`，官方教程请查看：[Add bounds control](https://learn.microsoft.com/en-us/training/modules/get-started-with-object-interaction/5-7-exercise-manipulate-3d-objects-with-bounds-control)

1. 创建 `STLModule` 空物体，在其子级创建 `STL` 空物体。`STL` 对象为 `MRTK3` 组件与 `3D` 组件交互的基础对象，在 `STL` 对象上依次挂载 `Box Collider`、`ConstraintManager`、`BoundsControl`、`StatefulInteractable`、`ObjectManipulator` 组件。
* 在 `BoundsControl` 组件中将 `BoundingBoxWithHandles` 预制件拖入 `bounds visuals prefab` 里，将 Hierarchy 中的 `STL` 对象拖入 `Target` 中，打开 `Handles Active` 后即可在运行窗口中看到 `BoundingBoxWithHandles` 操作边界，边界大小由 `Box Collider` 的大小决定
![alt text](./imgs/BoundsControl.png)

2. 在 `STL` 子级中添加 `DicomSlices` 对象，`DicomSlices` 对象用于控制和显示 3D 切面，因此请在 `DicomSlices` 的子级中创建 `AxialPlane`、`SagittalPlane`、`CoronalPlane` 三个空物体，在 `DicomSlices` 上挂载 `DicomSlice3DManager` 和 `DicomTextureBridge` 组件。
* 将三个空物体依次拖入 `DicomPlaneController` 的平面配置中。为了使三个平面正常渲染，请将放置在 `Custom` 中的 `Compute Shader`：`DicomSliceShader` 拖入材质设置中。
![alt text](./imgs/DicomPlaneController.png)

3. 最后，由于 `STL` 对象设置了 `Box Collider`，它会让 MRTK3 的交互仅限在 `Box Collider` 表面上，且 `3D 切面` 会在视觉上阻挡 `STL` 模型，因此需要额外配置一个 `UI` 组件来关闭 `Box Collider` 和 `3D 切面`。
* 在 `STL` 子级中添加 `MPRVisibility` 对象，在 `3D 切面管理` 中选择 `DicomSlices`，将 `STL` 对象拖入包围盒碰撞列表。
![alt text](./imgs/MPRVisibility.png)

#### 至此，DICOM 交互场景的必要组件都已配置完成。

## 5. 推荐的场景层级模板：
```
STLModule
  ├─STL（挂载 Box Collider、ConstraintManager、BoundsControl、StatefulInteractable、ObjectManipulator）
  |   ├─Model
  |   |   ├─动脉血管（STL模型）
  |   |   ├─占位（STL模型）
  |   |   ├─囊肿（STL模型）
  |   |   ...
  |   |   └─门静脉（STL模型）
  |   ├─DicomSlices（挂载 DicomSlice3DManager、DicomTextureBridge）
  |   |   ├─AxialPlane（轴位 空物体，会自动挂载 Plane）
  |   |   ├─SagittalPlane（冠状位 空物体，会自动挂载 Plane）
  |   |   └─CoronalPlane（矢状位 空物体，会自动挂载 Plane）
  |   └─MPRVisibility（挂载 MPRVisibilityController）
  |
DICOMModule
  ├─ Plane
  │   ├─ Axial       （轴位 Canvas，下挂 Raw Image：AxialRaw）
  │   │   └─ AxialRaw （Raw Image，1×1 单位）
  │   ├─ Coronal     （冠状位 Canvas，下挂 Raw Image：CoronalRaw）
  │   │   └─ CoronalRaw （Raw Image，1×1 单位）
  │   └─ Sagittal    （矢状位 Canvas，下挂 Raw Image：SagittalRaw）
  │       └─ SagittalRaw （Raw Image，1×1 单位）
  └─ DicomSystem     （DicomSeries、DicomTextureBridge 等核心脚本挂载）

```
---
## 6. 下一步
* [返回首页](../README.md)
---