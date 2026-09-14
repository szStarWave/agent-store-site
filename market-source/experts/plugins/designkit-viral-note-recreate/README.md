# 爆款图文复刻专家

拆解爆款图文的视觉风格、版式结构与信息层级，结合新主题和素材生成同类封面或套图内容。

## 类型

Agent 型（单个 AI 专家）

## 功能

通过内置 `viral-note-recreate` Skill 调用 美图设计室 AI设计 CLI，读取标准表单、补齐必要输入、处理生成任务事件，并直接交付最终产物。

## 使用示例

- 参考这组爆款图文，用我的主题和素材复刻同类内容。
- 拆解这张爆款封面，并生成 3 张同风格社媒图片。
- 参考这些图文，为目标平台生成一套同类轮播图。

## 头像

头像已自动生成在 `avatars/` 目录下。如需替换为自定义头像，要求：

- 格式：PNG（推荐）或 JPG
- 尺寸：512×512 px
- 大小：单张不超过 500KB

## 安装

可在 WorkBuddy 专家中心导入 ZIP，或将专家目录放入：

```text
$WORKBUDDY_CONFIG_DIR/plugins/marketplaces/my-experts/plugins/
```

未设置 `WORKBUDDY_CONFIG_DIR` 时，默认根目录为 `~/.workbuddy`。放置后使用 WorkBuddy 内置 `expert-manager` 校验并注册。

## 运行要求

- 实际终端命令为 `designkit`，最低兼容版本为 `1.0.24`；`--version` 输出按三个数字段比较，不使用字符串字典序。
- 未发现 `designkit`、版本无法解析或低于 `1.0.24` 时，Agent 自动执行一次 `npm install -g meitu-designkit-cli`，安装后重新检测且达到最低版本才继续。只有安装失败、安装后仍无法执行 `designkit` 或仍低于最低版本时，才引导用户打开「专家·技能·连接器」并进入「连接器」，搜索并连接「美图设计室 AI设计 CLI」。
- 登录状态统一保存在 `~/.designkit`，专家包不内置 CLI 或用户凭证。

## 打包分享

使用 WorkBuddy 内置 `expert-manager` 的 `package_expert.py` 生成可安装 ZIP。
