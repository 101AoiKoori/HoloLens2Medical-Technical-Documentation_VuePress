# 在场景中挂载并配置 MPRViewer

> 目标：把 MPRViewer 放到 Unity 场景中，绑定 UI，设置基础参数。

## 前置
- Unity(建议 2021LTS+)
- MRTK3 已安装
- 已有一个包含三张 `RawImage` 的 UI 面板

## 步骤
1. 在场景空物体上 **Add Component → MPRViewer**。  
2. 在 Inspector：将 UI 面板上的 `RawImage` 拖入：
   - **Axial Image**
   - **Sagittal Image**
   - **Coronal Image**
3.(可选)调整参数：
   - **useProgressiveLoading**：渐进生成三平面纹理，首屏更快；
   - **useBackgroundLoading**：后台分批预取，切片切换更顺；
   - **enableMemoryMonitoring/memoryCheckInterval**：启用定期内存检查；
   - **useSmoothedWindowLevelChanges** 与 **ChangeSpeed**：控制窗宽窗位过渡。
4. 运行场景，准备调用 `LoadDicomData()`。

> (截图占位)![Inspector 配置示例](./images/placeholder-inspector-setup.png)

## 额外说明

- **切片方向与旋转**：如果 DICOM 数据的坐标系与 Unity 世界坐标不一致，可通过旋转 `RawImage` 的 RectTransform(例如 `Rotate(0,180,0)`)或修改 `MPRTextureManager` 返回的纹理方向来校正。
- **3D 展示**：你可以把 `TextureUpdater` 生成的 `Texture2D` 赋给 `MeshRenderer.material.mainTexture`，在 3D 空间中显示切片。请使用 Unlit/Texture Shader 以避免光照影响纹理的灰度。
- **场景分辨率**：HL2 的默认渲染分辨率较低，建议在 `Player Settings` 中启用 XR SDK 的 Render Scale 或使用 `Dynamic Resolution` 以提升图像清晰度。