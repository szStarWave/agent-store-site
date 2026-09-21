import { useEffect } from "react";

/**
 * 落地页动效助手 —— 零依赖、仅客户端的装饰性效果。
 * 全部效果都是装饰；`prefers-reduced-motion` 会在 CSS 里把它收敛掉。
 *
 * 与旧站（`app/lib/effects.ts`）的唯一区别：Docusaurus 的页面在客户端路由跳转时
 * 可能**复用组件实例**，所以观察器要在依赖变化与卸载时正确断开——这里的每个 hook
 * 都返回清理函数，且 `useRevealAll` 每次路由切换后重新扫描 DOM。
 */

/** 自定义 CSS 变量可以和平常的 style 属性一起写。 */
type CSSVariables = React.CSSProperties & Record<`--${string}`, string | number>;

/** 行内样式助手：给 `[data-reveal]` / hero 入场做交错延迟。 */
export function revealDelay(ms: number): CSSVariables {
  return { "--reveal-delay": `${ms}ms` };
}

/**
 * 元素进入视口时给每个 `[data-reveal]` 加上 `.is-visible`（只触发一次）。
 * 它会查询整个文档，所以**每页只挂一次**——渲染 `[data-reveal]` 标记的页面组件持有它。
 */
export function useRevealAll() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      for (const el of els) el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);
}

/** 统计数字用的缓动整数爬升 0 → 目标值。 */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * `[data-count]` 元素进入视口时的计数动画。
 * 与 `useRevealAll` 同一套模式：一次挂载观察整个文档。
 */
export function useCountUp() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    if (!("IntersectionObserver" in window)) return;
    // 用户要求减少动效时保留 SSG 已渲染的终值。
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          const el = entry.target as HTMLElement;
          const target = el.dataset.count;
          if (!target) continue;
          const final = Number(target);
          if (!Number.isFinite(final)) continue;
          const duration = 900 + Math.min(final, 2000) * 0.15;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            el.textContent = String(Math.round(easeOutQuart(t) * final));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);
}

/**
 * 跟随光标的聚光效果：在命中的卡片上写 `--mx` / `--my`（元素内坐标），
 * CSS 借此在光标下画一层径向高光。用事件委托挂在 `document` 上：
 * 卡片可能挂载/卸载（切换标签、过滤）而无需重跑 effect。
 */
export function useSpotlight(selector: string) {
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => document.removeEventListener("mousemove", onMove);
  }, [selector]);
}

/** 滚动进度：把 `--progress`（0..1）写到 `.scroll-progress` 条上。 */
export function useScrollProgress() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".scroll-progress");
    if (!bar) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      bar.style.setProperty("--progress", progress.toFixed(4));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
}
