---
title: 平面控制机制原理
---
# 平面控制机制原理
## 单平面控制设计

DicomPlaneController作为单个切片平面的控制核心，负责平面的完整生命周期管理。每个控制器绑定到一个GameObject上，通过PlaneType枚举区分不同的解剖面类型。

### 平面几何生成

控制器使用Unity的Primitive.Quad作为基础几何体:

**几何属性**:
- 默认尺寸:1x1单位的四边形
- 顶点顺序:符合Unity的顺时针绕序
- UV坐标:标准0-1映射，支持纹理正确显示

**朝向校正**:
- 轴向面需要90度X轴旋转加180度Y轴旋转
- 矢状面仅需-90度Y轴旋转
- 冠状面保持默认朝向

### 材质系统设计

**着色器优先级**:
1. Custom/DicomSliceShader:专用医学影像着色器
2. Unlit/Transparent:透明无光照着色器
3. Transparent/Diffuse:透明漫反射着色器（兜底方案）

**材质属性管理**:
- `_WindowCenter`:控制影像亮度中心点
- `_WindowWidth`:控制影像对比度范围  
- `_Opacity`:整体透明度控制
- `_Color`:平面着色，支持多平面区分显示

## 纹理获取策略

### 多源获取机制

系统实现三级回退机制以保证纹理可用性:

**第一级:TextureManager缓存**
- 优先从MPRViewer的TextureManager获取缓存纹理
- 利用现有的LRU缓存机制，减少重复计算
- 支持预取策略，提升响应速度

**第二级:RawImage反射**
- 通过反射获取MPRViewer内部的RawImage组件
- 直接读取UI端已渲染的纹理内容
- 适用于UI优先更新的场景

**第三级:DicomSeries直接生成**
- 调用DicomSeries的纹理生成方法
- 轴向面使用GetAxialTexture获取原始切片
- 矢状面和冠状面使用Create方法重建纹理

### 纹理重试机制

当纹理获取失败时，系统提供自动重试:

```csharp
private IEnumerator UpdateTextureCoroutine()
{
    textureRetryCount = 0;
    bool textureUpdated = false;

    while (!textureUpdated && textureRetryCount < 5 && CanStartCoroutine())
    {
        Texture2D texture = GetTextureFromSources();
        if (texture != null)
        {
            SetTexture(texture);
            textureUpdated = true;
        }
        else
        {
            textureRetryCount++;
            yield return new WaitForSeconds(0.2f);
        }
    }
}
```

## 切片索引映射

### 空间位置计算

平面在3D空间的位置基于切片索引线性映射:

**归一化处理**:
```csharp
float normalizedPosition = (float)index / (total - 1);
```

**轴向移动策略**:
- 轴向平面沿Y轴移动，模拟从头到脚的切片浏览
- 矢状平面沿X轴移动，模拟从左到右的切片浏览  
- 冠状平面沿Z轴移动，模拟从前到后的切片浏览

### 边界约束机制

movementRange参数限制平面的移动范围:

```csharp
newPosition.y = Mathf.Lerp(-movementRange, movementRange, normalizedPosition);
```

这确保了平面始终在合理的显示范围内，避免过度分散影响观察效果。

## 协程安全管理

### 状态检查机制

每个协程启动前都会执行安全检查:

```csharp
private bool CanStartCoroutine()
{
    return gameObject.activeInHierarchy && enabled;
}
```

这避免了在GameObject未激活或组件禁用时执行协程导致的异常。

### 协程生命周期管理

- **启动前检查**:验证GameObject和组件状态
- **执行中监控**:定期检查是否仍可继续执行
- **异常处理**:捕获并记录协程执行异常
- **资源清理**:协程结束时清理临时资源