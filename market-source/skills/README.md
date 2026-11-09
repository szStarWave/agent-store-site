# CodeBuddy 官方技能市场（索引镜像）

本目录只保留官网目录页与客户端索引需要的 `.codebuddy-skill/marketplace.json` 和 `icons/`，
**不包含** `skills/<slug>/` 载荷。1889 条技能索引来自 workbuddy-market-collect 的
`recommend-build/market/index.json`（全部来自 `builtin-market`）；完整技能载荷在
ModelScope 的 `wb-market/skills/index.json` 与 `payload/` 归档中。

图标由 `scripts/import-wmc-skill-index.mjs` 按条目 `icon_url` 生成（默认最长边 128px WebP，
SVG 原样保留）。没有图标的条目在目录页显示字母徽标。
