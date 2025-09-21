# 参考与 API 总览

这里收录项目对外可用的 **类型（class/interface）** 的说明。
目标：接手的人能 **查得到、看得懂、调得对**。

> 说明
> * 文档以“**类型为单位**”组织，不按文件组织。
> * 拆成多个文件的 `partial class` 会 **合并写在同一页**，并在页内给出各分部的职责说明。
> * 教程与搭建步骤请看 **“指南（Guide）”**；这里只讲 API。

## 模块导航

* **[core](/reference/core/)**
  基础数据结构与坐标：`DicomSeries`、`DicomSlice`、`DicomCoordinateMapper` 等。
* **[imaging](/reference/imaging/)**
  纹理生成与缓存、MPR 管理：`DicomTextureCreator`、`DicomTextureCache`、`MPRTextureManager` 等。
* **[loading](/reference/loading/)**
  DICOM 序列加载：`DicomLoader`、`DicomSeriesLoader` 等。
* **[ui](/reference/ui/)**
  与 MRTK3 UI 的控制器与适配（例如窗位/窗宽、切片滑块等）。
* **[viewers](/reference/viewers/)**
  将影像映射到 Unity `RawImage`、多视图/多平面显示的管理。
* **[visualization3d](/reference/visualization3d/)**
  3D 可视化相关类型（体素到可移动平面的复制等）。

> 每个模块下可继续分子目录；左侧栏会自动分组显示。

---

## 如何阅读本参考

每个类型页的结构保持一致：

1. **概览**：用途、所在命名空间（例如 `MedicalMR.DICOM.Loading`）。
2. **关键属性**：对外可设置/查询的字段或属性。
3. **关键方法**：最常用的 3–7 个入口方法（其他成员放在“成员清单”表里一行说明）。
4. **事件**：签名、触发时机、常见用途（例如进度条绑定）。
5. **最小示例**：10\~20 行可以直接跑的片段。
6. **分部文件映射（partial）**：列出 `*.API.cs / *.Core.cs / *.Helpers.cs ...` 的职责。

---

## 命名与约定

* **命名空间**：统一以 `MedicalMR.DICOM.<Module>` 开头。
* **路径与资源**：

  * DICOM数据通常放置在 `StreamingAssets`下；UWP/HoloLens 2 下使用 `UnityWebRequest` 读取绝对路径。
  * `dicom_index.json` 为可选索引文件；未提供时由加载器自动扫描并生成，如果存在无法读取的问题请删除`dicom_index.json`后再启动，
* **位深与窗口化**：纹理生成支持 8/16 位灰度；窗位/窗宽由 UI 控制器或 API 设置。

---
需要更完整的动手步骤、工程命名与场景搭建，请移步 **指南（Guide）**。
