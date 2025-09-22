---
title: 纹理创建流水线 
---
# 纹理创建流水线 

当调用 `GetTexture()` 且缓存未命中时，MPR 管理器会根据请求的平面类型选择不同的生成方式。

## 同步生成

* 只有轴向纹理会在主线程同步生成，因为解码速度较快。
* 调用 `CreateTextureSync()` 获取纹理后立即写入缓存并返回。

## 异步生成

* 矢状和冠状纹理创建涉及重新采样，需要在协程中异步执行以避免阻塞主线程。
* `ProcessQueueCoroutine` 会启动 `CreateTextureCoroutine(request)` 来处理单个请求。
* `CreateTextureInternalCoroutine` 根据平面类型选择同步或异步生成:
  * 轴向面直接调用 `CreateAxialTextureSafe`。
  * 矢状面调用 `_dicomSeries.CreateSagittalTextureCoroutine` 并提供回调。
  * 冠状面调用 `_dicomSeries.CreateCoronalTextureCoroutine`。
* 生成完成后，纹理写入缓存并触发 `OnTextureCreated` 事件。

## 超时处理

在异步生成过程中，如果协程在设定时间内未完成，则记录警告并继续下一步。这一限制防止长时间的阻塞或死锁。