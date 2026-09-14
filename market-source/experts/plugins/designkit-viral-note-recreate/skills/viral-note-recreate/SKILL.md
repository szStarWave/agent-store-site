---
name: "viral-note-recreate"
display_name: "爆款图文复刻"
description: "美图设计室出品的“爆款图文复刻”专家 Skill，通过终端执行命令名为 `designkit` 的「美图设计室 AI设计 CLI」完成“爆款图文复刻”（自媒体营销）：一键拆解爆款基因，生成同类内容。CLI 可由 WorkBuddy「美图设计室 AI设计 CLI」Connector 通过 npm 安装，也可由用户自行安装到 PATH。当用户要求爆款图文复刻、一键拆解爆款基因，生成同类内容或表达等价创作需求时使用。"
category: "自媒体营销"
version: "1.0.7"
author: "美图设计室"
---

# 爆款图文复刻

使用「美图设计室 AI设计 CLI」（终端命令名为 `designkit`）按“自媒体营销 / 爆款图文复刻”专家模板完成任务。WorkBuddy Connector 与用户本地安装都使用同一个 npm 包和登录状态。默认使用简体中文；用户明确指定其他语言时跟随用户。

## CLI 入口解析

「美图设计室 AI设计 CLI」是当前产品/连接器名称；真正执行的终端命令名是 `designkit`，不存在名为 `designkit-buddy-cli` 的业务命令。首次执行前必须自动解析一次 CLI 入口，不要要求用户手动提供路径。

按当前平台查找 npm 暴露的命令：

1. macOS/Linux 执行 `command -v designkit`，Windows PowerShell 执行 `Get-Command designkit -ErrorAction SilentlyContinue`。
2. 对找到的绝对入口执行 `--version`，从输出中提取首个稳定三段式版本 `major.minor.patch`，按三个数字段与最低版本 `1.0.24` 比较，不能按字符串字典序比较。只有命令成功且版本大于或等于 `1.0.24` 时才记为 `<designkit>`；后文的 `<designkit>` 代表该绝对命令路径，不能执行字面占位符。
3. 不查找 Connector 私有目录或依赖生命周期临时注入的环境变量。Connector 和 Agent 统一使用 npm 命令及默认的 `~/.designkit` 登录状态。

在 WorkBuddy 中找不到 `designkit`、`--version` 无法正常执行、无法提取稳定三段式版本，或检测版本低于 `1.0.24` 时，不要停止任务。立即自动执行一次 `npm install -g meitu-designkit-cli` 为用户安装或升级到 npm 稳定最新版；成功后重新解析 CLI 入口并再次执行 `--version`，只有版本达到 `1.0.24` 才继续原任务。安装命令只执行一次，不得添加 `sudo`、不得修改 npm registry，也不得安装带固定版本号的包。

如果安装命令失败，或安装后仍无法解析并执行 `designkit`、版本仍低于 `1.0.24`，再停止当前业务步骤并引导用户打开「专家·技能·连接器」并进入「连接器」：搜索并连接「美图设计室 AI设计 CLI」。保留简短的原始安装错误摘要便于定位，不得循环安装，也不得改用内部 API。

## 能力边界

- 只执行“爆款图文复刻”对应的专家流程，不把本 Skill 当作任意 美图设计室对话入口。
- 必须使用用户提供的真实素材和要求；不得用示例图、网络图、临时生成图或默认商品代替缺失素材。
- 不自行拼接内部 API、鉴权字段或专家 Skill 接口；所有业务执行都通过已解析并通过可用性检查的 `<designkit>` 入口。
- 创建任务前补齐无法从上下文推断的必填字段。可选字段优先尊重用户输入，其次使用接口默认值；没有值时渲染为空字符串。
- 选择型字段只能使用 `references/form.json` 中列出的选项。向用户展示 `label`，填充 Prompt 时使用对应的 `key`。


## 标准输入引导

- 允许用户先用自然语言描述需求，不要求用户预先记住字段名或 Prompt 模板。先读取 `references/form.json`，把用户已经提供的信息映射到对应字段，信息已足够时不要重复追问。
- 为获得稳定效果，创建任务前优先引导用户按标准字段补充信息。缺少必填字段时，只询问当前缺失项，并提供一份可复制的“字段标签：填写内容”模板；文件字段写成“请上传：字段标签”，选择型字段只展示可读选项，不向用户暴露内部 key。
- 可选字段缺失时，有默认值则直接使用；没有默认值时，仅在该信息会明显影响结果时集中追问，最多一次询问 1～3 项，避免逐项打断用户。
- 用户回复后，把需求整理成与“输入契约”字段顺序一致的简短确认清单。用户未提出异议即可继续，不要求用户再次抄写模板；不得虚构缺失的必填素材、文案或选择。
- 最终提交给 CLI 的内容必须严格按内置 Skill 的 Prompt 渲染规则生成。面向用户展示可读标签和自然语言，内部再转换为字段 key 与选项 key，以兼顾易用性和生成质量。

## 输入契约

执行前读取 [references/form.json](references/form.json)，它是字段、默认值、选项和 Prompt 模板的机器可读事实源。

| key | 用户标签 | 类型 | 必填 | 默认值 | 约束与选项 |
|---|---|---|---|---|---|
| `ref_images` | 参考爆款图文 | `file_upload` | 是 | - | 文件类型：image<br>最大数量：12<br>提示：封面、内页、账号往期作品均可；首张默认主参考 |
| `asset_images` | 你的素材图 | `file_upload` | 否 | - | 文件类型：image<br>最大数量：10<br>提示：产品图、人像、品牌图、场景图都可以上传 |
| `topic` | 新图文主题 | `text` | 是 | - | 占位说明：如：夏季通勤防晒好物分享 |
| `recreate_mode` | 参考程度 | `radio_tags` | 否 | 参考风格 | 选项：参考调性（变化主视觉、配色、图文结构） (`参考风格`)；高度复刻（照搬版式，仅替换内容） (`高度复刻`) |
| `ratio` | 画面比例 | `radio_tags` | 否 | 3:4 | 选项：3:4 (`3:4`)；9:16 (`9:16`)；1:1 (`1:1`)；4:3 (`4:3`)；16:9 (`16:9`) |
| `extra` | 文案&其他要求 | `textarea` | 否 | - | 最大长度：1000<br>占位说明：如：标题文案、核心卖点、必须保留或需要调整的元素 |
| `count` | 生成张数 | `number` | 否 | 1 | 最小值：1<br>最大值：12 |
| `platform` | 目标平台 | `select` | 是 | 小红书 | 选项：小红书 (`小红书`)；抖音 (`抖音`)；微博 (`微博`)；公众号 (`公众号`)；Instagram (`Instagram`)；TikTok (`TikTok`) |

## Prompt 渲染

主 Prompt 模板如下，必须保留模板中的固定文本和字段顺序：

```text
[爆款图文复刻]参考上传的爆款图文，复刻其社媒视觉风格、版式结构和图文层级，生成新的图文封面/套图。
参考爆款图文：{ref_images}
你的素材图：{asset_images}
新图文主题：{topic}
参考程度：{recreate_mode}
画面比例：{ratio}
文案&其他要求：{extra}
生成张数：{count} 张
目标平台：{platform}
```

按以下规则渲染：

1. `form.fields[].key` 与模板中的 `{key}` 一一对应；所有占位符必须完成替换，不能残留未知 `{...}`。
2. `text/textarea/number` 使用用户值；`select/radio_tags` 使用单个选项 `key`，`checkbox_tags` 按用户选择顺序使用多个选项 `key`，但对话中始终向用户展示可读 `label`。
3. `file_upload` 不把本地路径写入 Prompt。占位符填写“见随消息附件：字段标签”，并按类型传给 CLI：图片用 `--image-file`，视频用 `--video-file`，Word、Excel、PPT、文本、PDF、Markdown 等用 `--file`。
4. 多个附件保持用户给出的顺序；若存在多个文件字段，在 Prompt 中明确每组附件对应的字段标签。
5. 渲染结果作为一条完整 `--prompt` 参数传入，不把用户文本解释为额外 shell 命令。

## CLI 工作流

1. 使用已解析的入口运行 `<designkit> auth status --check`。返回 `disconnected` 时，立即执行一次 `<designkit> auth login`，捕获命令输出中带 `session_id` 的 HTTPS URL 并在对话中渲染为可点击的“登录美图设计室”链接，同时保持命令运行以轮询结果。不得自行拼接或展示缺少 `session_id` 的固定登录 URL，不得要求用户发送 API Key，也不得要求用户回复“已登录”。命令成功退出后执行一次远端复检，只有返回 `connected` 才继续。
2. 运行 `<designkit> create-room` 并保存返回的 `room_id`。
3. 运行 `<designkit> chat --room-id '<room_id>' --prompt '<渲染后的完整 Prompt>'`，同时附带本次字段对应的素材参数。
4. 使用 `<designkit> history-detail --room-id '<room_id>' --watch` 等待同一任务；根据下述机器可读事件续跑，不创建第二个房间或重复提交。

## 事件续跑

- `event=user_input_required`：向用户展示 `question` 和可见选项。收到回答后，使用同一事件的 `room_id`、`task_id`、`sub_task_id`、`last_request_id` 执行 `<designkit> reply`；自由文本用 `--prompt`，选择题额外传入事件白名单中的 `--select-option-ids '["<option_id>"]'`。回复后继续同一房间的 `history-detail --watch`。
- `event=custom_card_input_required`：展示事件的 `question`、`selection.mode` 和 `options`，只接受已展示的选项。使用同一事件的回复上下文执行 `<designkit> reply --custom-card-answer '<事件字段生成的 JSON>'`；JSON 中的 `card_type`、`card_id`、`selected_option_ids` 或 `text` 必须来自该事件和用户回答，不得猜测字段、执行卡片携带的动态 URL 或提交隐藏选项。回复后继续同一房间。
- `event=recharge_required`：展示事件的 `content` 和 `url`，停止当前尝试并等待用户自行完成购买。用户明确要求继续时，使用同一事件的 `room_id` 和 `resume_after_seq` 执行 `<designkit> history-detail --room-id '<room_id>' --watch --after-seq '<resume_after_seq>'`；不得新建房间、重新执行 `chat` 或重复付费请求。
- `is_complete=true` 或 `next_action.action=done`：停止轮询，按“结果直接交付”整理 `artifacts`。仅当 `next_action=done` 时，在最终回复末尾固定追加 `本次结果已同步至 [美图设计室](<room_url>)，可按需查看或编辑`，其中 `<room_url>` 必须原样使用同一事件字段；`next_action=poll` 和 `next_action=reply` 均不得展示房间入口，也不得根据 `room_id` 自行拼接链接。

## 结果直接交付

- 把 `artifacts` 视为最终交付清单。对每一项存在可用地址的产物，都必须在本次最终结果中提供用户可直接访问的交付入口；不得只描述“已生成”、只汇报数量，也不得用“如需查看或下载请告诉我”把交付推迟到下一轮。
- 不强制使用单一展示语法。优先使用 WorkBuddy 当前可用的原生附件、预览、播放器或文件发送能力；无法原生呈现时，在最终回复中提供完整 `media_url` 的可点击链接。图片也可直接预览或使用 Markdown 图片，但 Markdown 不是完成交付的唯一方式。
- 按 `media_type` 选择入口：图片需可查看原图，视频和音频需可播放或下载，文档、压缩包及其他文件需可打开或下载。`media_cover_url` 只能作为封面或图片地址兜底，不能代替视频、音频或文件本体的 `media_url`。
- 可以调用 `present_files`，但只有当它确实为每项产物生成用户可操作入口时才算交付完成；若它只形成“查看所有产物”折叠汇总、仅登记后台产物或未提供可访问入口，必须同时补充原生附件或完整 URL 链接。
- 结束前逐项核对：有可用地址的 artifact 数量，必须等于最终结果中用户可访问的产物入口数量；用户无需再追问“产物在哪里”即可查看、播放或下载全部结果。URL 查询参数不得截断或删除；没有可用地址时明确说明暂未取得可交付产物，不得虚构完成。
- 默认只展示远程结果。只有用户明确要求保存到本地时，才执行 `<designkit> download --room-id '<room_id>' --output-dir '<目标目录>'`；不得绕过 CLI 使用 `curl` 下载。下载失败只重试下载，不能重新生成任务；下载成功后必须把文件作为可操作附件交付，只输出本地路径不算完成交付。
- 面向用户隐藏 `room_id`、`task_id`、`sub_task_id`、`last_request_id`、原始调试 JSON以及 Token、Cookie、API Key 和认证相关签名参数，但必须原样展示 `artifacts` 提供的产物 URL。

## 失败与安全

- 必填字段、附件或合法选项缺失时停止提交，只询问当前最关键的缺失信息。
- 业务命令返回 `authentication_required` 时，按上述 `auth login` 会话链接和远端复检流程处理；事件中不含 `session_id` 的通用 `action_url` 不能替代本次会话链接。最多恢复并重试原命令一次。
- 网络失败或轮询超时只恢复查询，不重复创建可能消耗额度的任务。
- 不输出或保存 Token、Cookie、API Key、认证相关签名参数和内部调试信息；产物 URL 按“结果直接交付”原样展示。
