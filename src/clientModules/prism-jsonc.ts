import Prism from "prismjs";

/**
 * 把 `jsonc` 注册成 `json` 的别名。
 *
 * `content/docs/` 里有两条 ```jsonc 围栏（带注释的 JSON），而 Prism **没有** jsonc 语法包：
 * 直接在 `themeConfig.prism.additionalLanguages` 里写 `"jsonc"` 会让
 * `prism-include-languages` 去 `require("prismjs/components/prism-jsonc")` 并报
 * `Cannot find module './prism-jsonc'`，构建直接失败。
 *
 * 旧站用 `rehype-highlight`，它内部把 jsonc 归到 json，所以那些围栏一直有高亮。
 * 这里用别名把同一行为补回来：语言名仍是 jsonc（不加别名的话 Prism 找不到语法，
 * 代码块会退化成纯文本）。
 *
 * 这个模块通过 `clientModules` 注入，在主题的 `prism-include-languages` 之后执行——
 * 也就是 Prism 实例已经装配完毕、准备渲染代码块之前。
 */
Prism.languages.jsonc = Prism.languages.json;
