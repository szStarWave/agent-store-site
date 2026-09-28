import OriginalComponentTypes from "@theme-original/NavbarItem/ComponentTypes";

// 用相对路径而不是 `@theme/NavbarItem/...`：`@theme/*` 的类型声明只覆盖 Docusaurus
// 内置组件（见 @docusaurus/module-type-aliases），本站新增的这两个不在其中。
// 相对导入在类型与运行时都解析得动。
import LocaleNavbarItem, { LOCALIZED_NAV_ITEM_TYPE } from "./LocaleNavbarItem";
import LocaleToggleNavbarItem, { LOCALE_TOGGLE_ITEM_TYPE } from "./LocaleToggleNavbarItem";

/**
 * navbar item 类型映射 —— 在原表基础上登记本站的两个自定义类型。
 *
 * ## 为什么用 `@theme-original` 而不是抄一份
 *
 * 主题别名是**逐文件**解析的（`@docusaurus/core/lib/webpack/aliases`）：`src/theme/` 下的
 * 同名文件会覆盖 theme-classic 的实现，同时把原实现挂到 `@theme-original/...` 上。
 * 官方对这份文件的 `wrap` 动作是 `forbidden`（它是映射表，不是组件），
 * 但可以直接 import `@theme-original` 再展开——于是**不必抄写那 27 行**，
 * 升级 Docusaurus 时新增的类型也会自动带上。
 *
 * ## 自定义类型为什么以 `custom-` 开头
 *
 * theme-classic 的 `NavbarItemSchema` 只放行 `type` 以 `custom-` 开头的未知项
 * （`CustomNavbarItemSchema`，见其 `options.js`），其它未知 type 会被 Joi 拒绝。
 * 这正是插件作者注册自定义导航项的官方入口。
 */
const ComponentTypes = {
  ...OriginalComponentTypes,
  [LOCALIZED_NAV_ITEM_TYPE]: LocaleNavbarItem,
  [LOCALE_TOGGLE_ITEM_TYPE]: LocaleToggleNavbarItem,
};

export default ComponentTypes;
