# 常见问题与修复

## 1. 找不到文件 / 路径错误

* 检查 `Dicom Folder Path` 是否为相对 `StreamingAssets` 的子路径
* 绝对路径请使用正斜杠 `/`，并确认应用对该目录有权限（UWP）

## 2. JSON 解析失败

* 确认 `dicom_index.json` 为 UTF‑8（无 BOM 更稳）
* 键名区分大小写：`{"slices": [{ "path": "…" }]}`

## 3. 加载黑屏，但无报错

* 查看 **Window Center/Width** 默认值；尝试在 Viewer 层设置合理窗宽窗位
* 确认像素位深（8/16 bit）处理路径正确

## 4. 顺序错乱

* 手动提供索引并按期望顺序列出

## 5. HL2 真机读不到绝对路径

* 改为 `StreamingAssets`；或采用文件选择器/复制到可访问目录

## 6. 大量切片卡顿

* 采用异步 UI（进度条/提示）；完成后再一次性刷新视图

## 7. 构建后报 IL2CPP Stripping 相关问题

* 确保 DICOM 相关程序集未被裁剪（如有需要可在 Link.xml 声明保留）