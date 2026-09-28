/// <reference types="@docusaurus/module-type-aliases" />

/**
 * 图片与字体资源模块声明。
 *
 * Docusaurus 的 webpack 会把图片按 `file-loader` / `url-loader` 处理并返回 URL 字符串，
 * 但 `@docusaurus/module-type-aliases` 只声明了 `*.module.css` 等少数几种；类型检查因此会报
 * `Cannot find module '../assets/logo.png'`。这里补齐站点用到的扩展名。
 */
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.gif" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}
declare module "*.avif" {
  const src: string;
  export default src;
}
declare module "*.ico" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.woff" {
  const src: string;
  export default src;
}
declare module "*.woff2" {
  const src: string;
  export default src;
}
