---
name: "ppt-beautify"
display_name: "PPT美化"
description: "美图设计室出品的“PPT美化”专家 Skill，通过终端执行命令名为 `designkit` 的「美图设计室 AI设计 CLI」完成“PPT美化”（办公设计）：一键美化，让PPT更好看。CLI 可由 WorkBuddy「美图设计室 AI设计 CLI」Connector 通过 npm 安装，也可由用户自行安装到 PATH。当用户要求PPT美化、一键美化，让PPT更好看或表达等价创作需求时使用。"
category: "办公设计"
version: "1.0.8"
author: "美图设计室"
---

# PPT美化

使用「美图设计室 AI设计 CLI」（终端命令名为 `designkit`）按“办公设计 / PPT美化”专家模板完成任务。WorkBuddy Connector 与用户本地安装都使用同一个 npm 包和登录状态。默认使用简体中文；用户明确指定其他语言时跟随用户。

## CLI 入口解析

「美图设计室 AI设计 CLI」是当前产品/连接器名称；真正执行的终端命令名是 `designkit`，不存在名为 `designkit-buddy-cli` 的业务命令。首次执行前必须自动解析一次 CLI 入口，不要要求用户手动提供路径。

按当前平台查找 npm 暴露的命令：

1. macOS/Linux 执行 `command -v designkit`，Windows PowerShell 执行 `Get-Command designkit -ErrorAction SilentlyContinue`。
2. 对找到的绝对入口执行 `--version`，从输出中提取首个稳定三段式版本 `major.minor.patch`，按三个数字段与最低版本 `1.0.40` 比较，不能按字符串字典序比较。只有命令成功且版本大于或等于 `1.0.40` 时才记为 `<designkit>`；后文的 `<designkit>` 代表该绝对命令路径，不能执行字面占位符。
3. 不查找 Connector 私有目录或依赖生命周期临时注入的环境变量。Connector 和 Agent 统一使用 npm 命令及默认的 `~/.designkit` 登录状态。

在 WorkBuddy 中找不到 `designkit`、`--version` 无法正常执行、无法提取稳定三段式版本，或检测版本低于 `1.0.40` 时，不要停止任务。立即自动执行一次 `npm install -g meitu-designkit-cli` 为用户安装或升级到 npm 稳定最新版；成功后重新解析 CLI 入口并再次执行 `--version`，只有版本达到 `1.0.40` 才继续原任务。安装命令只执行一次，不得添加 `sudo`、不得修改 npm registry，也不得安装带固定版本号的包。

如果安装命令失败，或安装后仍无法解析并执行 `designkit`、版本仍低于 `1.0.40`，再停止当前业务步骤并引导用户打开「专家·技能·连接器」并进入「连接器」：搜索并连接「美图设计室 AI设计 CLI」。保留简短的原始安装错误摘要便于定位，不得循环安装，也不得改用内部 API。

## 能力边界

- 只执行“PPT美化”对应的专家流程，不把本 Skill 当作任意 美图设计室对话入口。
- 必须使用用户提供的真实素材和要求；不得用示例图、网络图、临时生成图或默认商品代替缺失素材。
- 不自行拼接内部 API、鉴权字段或专家 Skill 接口；所有业务执行都通过已解析并通过可用性检查的 `<designkit>` 入口。
- 创建任务前补齐无法从上下文推断的必填字段。可选字段优先尊重用户输入，其次使用接口默认值；没有值时渲染为空字符串。
- 选择型字段只能使用 `references/form.json` 中列出的选项。向用户展示 `label`，填充 Prompt 时使用对应的 `key`。

## 标准输入引导

- 允许用户先用自然语言描述需求，不要求用户预先记住字段名或 Prompt 模板。先读取 [references/form.json](references/form.json)，把用户已经提供的信息映射到对应字段，信息已足够时不要重复追问。
- 为获得稳定效果，创建任务前优先引导用户按标准字段补充信息。缺少必填字段时，只询问当前缺失项，并提供一份可复制的“字段标签：填写内容”模板；文件字段写成“请上传：字段标签”，选择型字段只展示可读的 `label` 选项，不向用户暴露内部 `key`。
- 可选字段缺失时，若 `form.json` 提供默认值则直接使用；没有默认值时，仅在该信息会明显影响结果时集中追问，最多一次询问 1～3 项，避免逐项打断用户。
- 用户回复后，把需求整理成与“输入契约”字段顺序一致的简短确认清单。用户未提出异议即可继续，不要求用户再次抄写模板；不得虚构缺失的必填素材、文案或选择。
- 最终提交给 CLI 的内容必须严格按“Prompt 渲染”规则生成。面向用户展示可读标签和自然语言，内部再转换为字段 `key` 与选项 `key`，以兼顾易用性和生成质量。

## 输入契约

执行前读取 [references/form.json](references/form.json)，它是字段、默认值、选项和 Prompt 模板的机器可读事实源。

| key | 用户标签 | 类型 | 必填 | 默认值 | 约束与选项 |
|---|---|---|---|---|---|
| `ref_files` | 参考文件 | `file_upload` | 是 | - | 文件类型：ppt, image, pdf<br>最大数量：10<br>提示：支持 PDF、PPT、图片等 |
| `language` | 语言 | `select` | 否 | - | 选项：自动匹配 (`auto`)；中文 (`chinese`)；英文 (`english`)；日语 (`japanese`)；韩语 (`korean`)；葡萄牙语（巴西） (`portuguese_brazil`)；西班牙语（墨西哥） (`spanish_mexico`)；俄语 (`russian`) |
| `style` | 视觉风格 | `radio_tags` | 否 | - | 选项：自动匹配 (`auto`)；简约高级 (`minimal_luxe`)；商务专业 (`business_professional`)；创意版式 (`creative_layout`)；网感潮流 (`digital_trendy`)；党建思政 (`party_civic`)；奢华大气 (`grand_luxury`)；中国风 (`chinese_style`) |
| `extra` | 补充要求 | `textarea` | 否 | - | 最大长度：10000<br>占位说明：色调、字体、版式、重点内容等补充说明 |

## Prompt 渲染

主 Prompt 模板如下，必须保留模板中的固定文本和字段顺序：

```text
[PPT美化]美化这份PPT。
参考文件：{ref_files}
语言：{language}
视觉风格：{style}
补充要求：{extra}
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
> PPT 逐页模式要求 CLI 版本不低于 `1.0.40`。进入本步骤前复用上述三段式版本比较；低于该版本时自动执行一次 `npm install -g meitu-designkit-cli` 并复检，仍低于 `1.0.40` 时停止并报告升级失败。

4. 首次运行 `<designkit> history-detail --room-id '<room_id>' --watch --yield-on-update`。它是前台阻塞命令，每取得首个可展示事件便输出并正常退出；禁止主动设置 `run_in_background=true`。立即渲染该事件后保存 `after_seq`，若仍需轮询则运行 `<designkit> history-detail --room-id '<room_id>' --watch --yield-on-update --after-seq '<after_seq>'`。按此方式串行续查至 `reply` 或 `done`，任一时刻只能有一个查询命令，不创建第二个房间、不重复提交任务。

## 事件续跑

- `event=history_update`：立即交付本轮 `artifacts`，每张图片使用 `title` 作为标题并作为独立图片逐张渲染，不合并成一张拼图或只报数量；同一事件含多张图片时也逐项渲染。若 `next_action=poll`，保存 `after_seq` 并用上述 `--yield-on-update --after-seq` 命令串行续查；若为 `reply`，先完成本轮图片交付，再等待和提交用户回答，并从同一事件的 `after_seq` 继续；若为 `done`，完成交付。
- `event=user_input_required`：存在选项预览时，先在普通对话正文中按选项顺序逐项渲染 `artifacts` 图片和对应文案，再使用 WorkBuddy 当前可用的原生单选或多选能力打开只含文字的选择弹窗；不要把图片或完整产物 JSON 塞进选择弹窗，避免 WorkBuddy 长 JSON 截断。不存在预览时直接展示文字选项。禁止自动代选，原生交互能力不可用时才降级为编号列表。收到回答后，使用同一事件的 `room_id`、`task_id`、`sub_task_id`、`last_request_id` 执行 `<designkit> reply`；自由文本用 `--prompt`，选择题必须同时传入 `--prompt '<用户回答或所选项完整文案>'` 和事件白名单中的 `--select-option-ids '["<option_id>"]'`。回复后从同一事件的 `after_seq` 使用 `--yield-on-update --after-seq` 串行续查。
- `event=custom_card_input_required`：展示层同样优先使用 WorkBuddy 当前可用的原生选择或文本输入能力，并等待用户明确提交；提交层仍须遵守事件的 `question`、`selection.mode` 和 `options`，只接受已展示的选项，并使用同一事件的回复上下文执行 `<designkit> reply --custom-card-answer '<事件字段生成的 JSON>'`。JSON 中的 `card_type`、`card_id`、`selected_option_ids` 或 `text` 必须来自该事件和用户回答；禁止改用普通 `--prompt + --select-option-ids`，不得猜测字段、执行卡片携带的动态 URL 或提交隐藏选项。回复后继续同一房间。
- `event=recharge_required`：展示事件的 `content` 和 `url`，并明确提示用户充值成功后回到当前对话回复“已充值”“好了”或“继续任务”。事件携带 `resume_after_seq`；仅当当前任务仍有待处理的充值事件时，才把这些表达识别为充值完成；随后依据结构化 `action` 校验目标，把事件的 `action_command`（即 `<designkit> resume`）作为前台阻塞长命令原样执行，禁止主动设置 `run_in_background=true`，并等待其退出，不得改为 `history-detail`、新建房间、重新执行普通 `chat` 或重复原 Prompt。没有待恢复事件时，“好了”等模糊表达不能触发恢复。
- `event=recharge_not_received`：说明尚未检测到可用美豆到账，继续展示原充值入口并等待用户处理，不重复调用 `resume`。
- `event=recharge_resumed`：这是续跑请求已被服务端受理的唯一凭据。只有收到该事件才能告知用户续跑已受理；随后继续处理同一命令返回的 `history_update`，不要求用户再次回复。单独收到 `history_update/next_action=done` 不得描述为续跑已受理。
- `is_complete=true` 或 `next_action.action=done`：停止轮询，按“结果直接交付”整理 `artifacts`。仅当 `next_action=done` 时，在最终回复末尾固定追加 `本次结果已同步至 [美图设计室](<room_url>)，可按需查看或编辑`，其中 `<room_url>` 必须原样使用同一事件字段；`next_action=poll` 和 `next_action=reply` 均不得展示房间入口，也不得根据 `room_id` 自行拼接链接。

## PPT 逐页交付

- `history_update.artifacts` 是本次游标之后的新产物，不在 WorkBuddy 内累计或转存整段历史 JSON。每处理一个事件就立即逐项展示，然后仅保留 `room_id` 和 `after_seq` 供下一次查询。
- 每个产物单独展示，优先显示 `title`，随后直接渲染完整 `media_url` 对应的图片；不得等全部 PPT 完成后再合并展示，也不得只展示最终汇总图。
- CLI 会依据 `after_seq` 过滤已经交付过的 URL。最终 `agent_artifact` 再次列出已展示页面时不得重复渲染；其中出现新 URL 时仍须逐张补交。

PPT 全部页面交付完成后，在最终回复中简短提示：`如需本地 PPTX，可直接告诉我“导出 PPTX”`。该提示只说明可用能力，不得在用户明确提出下载或导出前执行 `export-pptx`。

## 结果直接交付

- 把 `artifacts` 视为最终交付清单。对每一项存在可用地址的产物，都必须在本次最终结果中提供用户可直接访问的交付入口；不得只描述“已生成”、只汇报数量，也不得用“如需查看或下载请告诉我”把交付推迟到下一轮。
- 不强制使用单一展示语法。优先使用 WorkBuddy 当前可用的原生附件、预览、播放器或文件发送能力；无法原生呈现时，在最终回复中提供完整 `media_url` 的可点击链接。图片也可直接预览或使用 Markdown 图片，但 Markdown 不是完成交付的唯一方式。
- 按 `media_type` 选择入口：图片需可查看原图，视频和音频需可播放或下载，文档、压缩包及其他文件需可打开或下载。`media_cover_url` 只能作为封面或图片地址兜底，不能代替视频、音频或文件本体的 `media_url`。
- 可以调用 `present_files`，但只有当它确实为每项产物生成用户可操作入口时才算交付完成；若它只形成“查看所有产物”折叠汇总、仅登记后台产物或未提供可访问入口，必须同时补充原生附件或完整 URL 链接。
- 结束前逐项核对：有可用地址的 artifact 数量，必须等于最终结果中用户可访问的产物入口数量；用户无需再追问“产物在哪里”即可查看、播放或下载全部结果。URL 查询参数不得截断或删除；没有可用地址时明确说明暂未取得可交付产物，不得虚构完成。
- 默认只展示远程结果。只有用户明确要求把当前 PPT 下载、导出或保存为 PPTX 时，才执行 `<designkit> export-pptx --room-id '<room_id>' --output-dir '<目标目录>'`。该能力要求 CLI 版本不低于 `1.0.40`；执行前复用上述三段式版本比较，版本过低时自动升级一次并复检。命令成功后必须把 JSON 中 `file` 指向的唯一 `.pptx` 文件作为可操作附件交付，只输出本地路径不算完成交付。导出失败只重试导出，不重新生成 PPT；不得绕过 CLI 下载页面或自行拼装 PPTX。
- 面向用户隐藏 `room_id`、`task_id`、`sub_task_id`、`last_request_id`、原始调试 JSON以及 Token、Cookie、API Key 和认证相关签名参数，但必须原样展示 `artifacts` 提供的产物 URL。

## 失败与安全

- 必填字段、附件或合法选项缺失时停止提交，只询问当前最关键的缺失信息。
- 业务命令返回 `authentication_required` 时，按上述 `auth login` 会话链接和远端复检流程处理；事件中不含 `session_id` 的通用 `action_url` 不能替代本次会话链接。最多恢复并重试原命令一次。
- 网络失败或轮询超时只恢复查询，不重复创建可能消耗额度的任务。
- 不输出或保存 Token、Cookie、API Key、认证相关签名参数和内部调试信息；产物 URL 按“结果直接交付”原样展示。
