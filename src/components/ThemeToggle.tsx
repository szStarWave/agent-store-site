import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { useTranslation } from "../i18n";

type Theme = "light" | "dark";

const STORAGE_KEY = "flowy-theme";

/**
 * 主题切换。
 *
 * 旧站把主题写在 `<html data-theme="…">` 上，`src/css/style.css` 的暗色规则全部挂在
 * `[data-theme="dark"]` 选择器下——因此这里**继续写同一个属性**，而不是改用 Docusaurus 的
 * colorMode（其属性名恰好也是 `data-theme`，但值域与切换器由 theme-classic 掌控）。
 * `docusaurus.config.ts` 里关掉了 `themeConfig.colorMode.disableSwitch`，避免两套切换器打架。
 */
export default function ThemeToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>("light");

  // 首次挂载时读偏好：localStorage 优先，其次系统设置。放在 effect 里，
  // 让 SSG 产出的 HTML 与客户端首帧一致，避免 hydration 不匹配。
  useEffect(() => {
    let saved: Theme | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    } catch {
      saved = null;
    }
    const initial: Theme =
      saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 记不住主题不该影响切换本身。
    }
  };

  return (
    <button
      className="icon-btn"
      onClick={toggle}
      aria-label={theme === "light" ? t("nav.themeDark") : t("nav.themeLight")}
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
