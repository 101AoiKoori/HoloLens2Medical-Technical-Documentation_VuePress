---
title: 纹理桥接机制原理
---
# 纹理桥接机制原理
## 2D-3D桥接架构

DicomTextureBridge实现了2D UI界面与3D场景之间的纹理数据同步。由于MPRViewer使用RawImage显示RenderTexture，而3D材质需要Texture2D，因此需要桥接器进行格式转换和数据同步。

### 桥接范围

**UI端组件**:
- MPRViewer的axialImage、sagittalImage、coronalImage（RawImage）
- 各RawImage绑定的RenderTexture纹理
- UI端的窗宽窗位调整和切片索引变化

**3D端组件**:
- DicomSlice3DManager管理的三个平面控制器
- 各平面的Material.mainTexture属性
- 3D场景中的切片位置和显示状态

## 反射机制应用

### RawImage引用获取

由于MPRViewer的RawImage字段为private，桥接器使用反射机制获取引用:

```csharp
System.Type viewerType = mprViewer.GetType();
System.Reflection.FieldInfo axialField = viewerType.GetField("axialImage",
    System.Reflection.BindingFlags.Instance |
    System.Reflection.BindingFlags.NonPublic);

if (axialField != null)
    axialRawImage = axialField.GetValue(mprViewer) as RawImage;
```

**反射使用场景**:
- 获取MPRViewer内部的RawImage组件
- 访问非公开的UI元素引用
- 实现松耦合的组件间通信

### 安全性考虑

反射操作包含在try-catch块中，确保:
- 字段名变更时不会导致崩溃
- 空引用异常的妥善处理
- 降级到其他纹理获取方式

## 事件驱动更新

### 事件监听机制

桥接器监听MPRViewer的三个关键事件:

**OnSliceChanged事件**:
- 触发条件:UI切片索引变化
- 响应动作:转换对应平面的纹理
- 执行流程:检查GameObject状态 → 启动转换协程 → 更新3D纹理

**OnDicomLoaded事件**:
- 触发条件:新的DICOM数据加载完成
- 响应动作:重新查找RawImage引用，延迟更新所有纹理
- 执行流程:更新dicomSeries引用 → 重新绑定RawImage → 批量纹理转换

**OnWindowLevelChanged事件**:
- 触发条件:窗宽窗位参数调整
- 响应动作:重新转换所有平面纹理
- 执行流程:检查GameObject状态 → 批量启动转换协程

### 异步处理策略

所有纹理转换操作使用协程异步执行:

```csharp
private IEnumerator ConvertTextureCoroutine(Texture sourceTexture, DicomPlane.PlaneType planeType, System.Action<Texture2D> callback)
{
    if (sourceTexture == null)
    {
        callback?.Invoke(null);
        yield break;
    }

    Texture2D convertedTexture = CreateCompatibleTexture(sourceTexture, planeType);
    yield return null; // 等待一帧确保处理完成
    callback?.Invoke(convertedTexture);
}
```

## 纹理转换算法

### 格式转换流程

RenderTexture转Texture2D的具体步骤:

1. **创建临时RenderTexture**:
   ```csharp
   RenderTexture tempRT = RenderTexture.GetTemporary(
       sourceTexture.width, sourceTexture.height, 0, RenderTextureFormat.ARGB32);
   ```

2. **GPU内存复制**:
   ```csharp
   Graphics.Blit(sourceTexture, tempRT);
   ```

3. **创建目标Texture2D**:
   ```csharp
   Texture2D newTexture = new Texture2D(
       sourceTexture.width, sourceTexture.height, TextureFormat.RGBA32, false);
   ```

4. **CPU读取像素数据**:
   ```csharp
   RenderTexture.active = tempRT;
   newTexture.ReadPixels(new Rect(0, 0, tempRT.width, tempRT.height), 0, 0);
   ```

### 灰度均衡处理

医学影像通常为灰度图像，需要确保RGB三通道的一致性:

```csharp
Color[] pixels = newTexture.GetPixels();
for (int i = 0; i < pixels.Length; i++)
{
    float grayValue = Mathf.Max(pixels[i].r, Mathf.Max(pixels[i].g, pixels[i].b));
    pixels[i] = new Color(grayValue, grayValue, grayValue, 1.0f);
}
newTexture.SetPixels(pixels);
```

这确保了纹理在3D场景中的正确显示，避免色彩偏差。

## 状态监控机制

### 纹理变化监控

桥接器运行一个长期协程监控RawImage纹理变化:

```csharp
private IEnumerator MonitorTextureChanges()
{
    while (true)
    {
        if (!CanStartCoroutine())
        {
            yield return new WaitForSeconds(1.0f);
            continue;
        }

        // 检查各平面纹理是否变化
        if (axialRawImage != null && axialRawImage.texture != null)
        {
            Texture currentTexture = axialRawImage.texture;
            if (convertedAxialTexture == null || currentTexture != convertedAxialTexture)
            {
                ConvertAndUpdateAxialTexture();
            }
        }

        yield return new WaitForSeconds(0.5f);
    }
}
```

### 处理状态管理

使用布尔标志防止同一平面的并发转换:

- `isProcessingAxial`:轴向面转换状态
- `isProcessingSagittal`:矢状面转换状态  
- `isProcessingCoronal`:冠状面转换状态

这避免了同一平面同时启动多个转换协程导致的资源竞争。