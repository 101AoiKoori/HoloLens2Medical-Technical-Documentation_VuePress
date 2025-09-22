---
title: 缓存淘汰与 LRU 策略 
---
# 缓存淘汰与 LRU 策略 

为了控制内存占用，Cache 模块实现了基于 LRU 的混合淘汰策略。核心方法 `RemoveWithBalancedStrategy` 会综合使用次数、最后访问时间、纹理大小和引用计数计算一个分数，分值最低的纹理将被优先移除。

## 综合得分计算

在检查候选项时，算法会遍历 LRU 列表的前若干节点，忽略当前显示或标记为永久/可见/活跃的纹理。对于每个候选键:

* `useCount`:纹理的访问次数，若在 `_textureRefCounts` 中存在引用则额外加权。
* `timeFactor`:从最后一次访问到当前的时间差。
* `size`:纹理在 `_textureSizes` 中记录的占用字节。

分数计算公式为 `(useCount + 1) * (10 / (timeFactor + 1)) / size`，得分越低的纹理被认为越不重要。

## 紧急清理

当检测到缓存大小或占用超过阈值时，`EmergencyCleanup` 会一次性清理若干纹理。它使用不同的权重:引用次数权重为 2，活跃纹理分数会放大 10 倍。

紧急清理后，会触发 `Resources.UnloadUnusedAssets` 释放 GPU 资源。

## LRU 列表更新

当纹理被访问或添加时，`UpdateLRU` 会将对应键移动到链表尾部。淘汰时则从链表头部开始遍历候选项。

## 选择锁与保护机制

如果用户正在查看某个切片，`MarkTextureAsPermanent` 会将其加入 `_permanentTextures`，并同时标记为活跃和可见。被保护的纹理不会被淘汰，直到释放锁或显示其他切片。