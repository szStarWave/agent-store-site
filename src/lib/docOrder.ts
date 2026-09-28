/**
 * 文档侧边栏的展示顺序与分组键。
 *
 * 单独放在这个**不依赖 React** 的文件里，是为了让 `docusaurus.config.ts`（构建期配置，
 * 跑在 Node 里）也能读到它——旧站由 `react-router.config.ts` 的 `prerender()` 枚举文档路由，
 * 现在路由由 docs 插件的 `routeBasePath` 自动产出，这份顺序只服务侧边栏与页脚。
 *
 * `content/docs/` 的 Markdown 从上游 `Michael-Lfx/allo` 同步，**不带 front matter**，
 * 所以顺序与标题不能写在文档里，只能在这里显式登记；标题取自 `docs.sections.*` 词条。
 */
export interface DocSections {
  quickStart: string;
  cli: string;
  pluginsMarket: string;
  typescriptSdk: string;
  examplesSdk: string;
  upgrade: string;
  changelog: string;
  configuration: string;
  architecture: string;
  compatibility: string;
}

/** slug 即 `content/docs/<lang>/<slug>.md` 的文件名，与 docs 插件的 doc id 一致。 */
export const DOC_ORDER: { slug: string; sectionKey: keyof DocSections }[] = [
  { slug: "quick-start", sectionKey: "quickStart" },
  { slug: "cli", sectionKey: "cli" },
  { slug: "plugins-market", sectionKey: "pluginsMarket" },
  { slug: "typescript-sdk", sectionKey: "typescriptSdk" },
  { slug: "examples-sdk", sectionKey: "examplesSdk" },
  { slug: "upgrade", sectionKey: "upgrade" },
  { slug: "changelog", sectionKey: "changelog" },
  { slug: "configuration", sectionKey: "configuration" },
  { slug: "architecture", sectionKey: "architecture" },
  { slug: "compatibility", sectionKey: "compatibility" },
];

export const DOC_SLUGS: readonly string[] = DOC_ORDER.map((entry) => entry.slug);
