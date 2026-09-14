# PPT美化专家

基于现有PPT、PDF或页面图片重构视觉层级与版式，在保留内容的同时统一风格并提升专业质感。

## 类型

Agent 型（单个 AI 专家）

## 功能

通过内置 `ppt-beautify` Skill 调用美图设计室 AI设计 CLI，读取标准输入表单后完成追问、生成、进度续跑和产物直接交付。

## 使用示例

- 帮我把这份PPT美化成简约高级风格。
- 把这些页面图片统一成专业商务PPT风格。
- 保留全部内容，重点优化排版和配色体系。

## 头像

头像已按角色能力生成在 `avatars/` 目录下。如需替换为自定义头像，要求：
- 格式：PNG（推荐）或 JPG
- 尺寸：512×512 px
- 大小：单张不超过 500KB

## 安装

可在 WorkBuddy 专家中心导入 ZIP，或将专家目录放入：

```
$WORKBUDDY_CONFIG_DIR/plugins/marketplaces/my-experts/plugins/
```

未设置 `WORKBUDDY_CONFIG_DIR` 时，默认根目录为 `~/.workbuddy`。放置后使用 WorkBuddy 内置 `expert-manager` 校验并注册。

## 运行要求

- 实际终端命令为 `designkit`，最低兼容版本为 `1.0.40`；`--version` 输出按三段数字版本比较，不使用字符串字典序。
- 未发现 `designkit`、版本无法解析或低于 `1.0.40` 时，Agent 自动执行一次 `npm install -g meitu-designkit-cli`，安装后重新检测且达到最低版本才继续。只有安装失败、安装后仍无法执行 `designkit` 或仍低于最低版本时，才引导用户打开「专家·技能·连接器」并进入「连接器」，搜索并连接「美图设计室 AI设计 CLI」。
- 登录状态统一保存在 `~/.designkit`，专家包不内置 CLI 或用户凭证。

## 打包分享

```bash
zip -r designkit-ppt-beautify.zip designkit-ppt-beautify/
```
