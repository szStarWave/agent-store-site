import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "../i18n";
import { Boxes, Maximize2, MessageSquare, Plug, Settings, Sparkles, X } from "lucide-react";

import { revealDelay } from "../lib/effects";
import chatShot from "../assets/webui/chat.webp";
import connectorsShot from "../assets/webui/connectors.webp";
import expertsShot from "../assets/webui/experts.webp";
import settingsShot from "../assets/webui/settings.webp";
import skillsShot from "../assets/webui/skills.webp";

type ViewKey = "chat" | "experts" | "skills" | "connectors" | "settings";

/**
 * 已发布 Web UI 的真实截屏，每张对应一个界面。截屏都是 1080×522，
 * 所以每行的图位固定同一宽高比，切换视图不会引起回流。
 */
const VIEWS: { key: ViewKey; icon: typeof Boxes; src: string }[] = [
  { key: "chat", icon: MessageSquare, src: chatShot },
  { key: "experts", icon: Sparkles, src: expertsShot },
  { key: "skills", icon: Boxes, src: skillsShot },
  { key: "connectors", icon: Plug, src: connectorsShot },
  { key: "settings", icon: Settings, src: settingsShot },
];

/**
 * 产品预览：**图文交替的多行**，每行一张截屏配一段「编号 + 标题 + 说明」，左右依次交替。
 *
 * 布局从「左侧标签栏 + 右侧单张大图」改成多行，是因为标签栏把五个视图压成一屏，
 * 每张截屏都只能缩得很小；拆成多行后每张图都能占到半屏宽，细节看得清，
 * 编号列表也让「有哪些界面、各自解决什么」更容易扫读。
 *
 * 交互保留两点：
 * - 点击任意截屏打开 lightbox 放大（原实现只有当前标签那张能点）。
 * - 每行带 `data-reveal`，进入视口时交错浮现（`revealDelay()` 给出逐行延迟）。
 */
export default function WorkbenchShowcase() {
  const { t } = useTranslation();
  /** 当前放大的视图；`null` 表示 lightbox 关闭。 */
  const [zoomed, setZoomed] = useState<ViewKey | null>(null);
  const lightbox = useRef<HTMLDialogElement>(null);

  const current = VIEWS.find((view) => view.key === zoomed);

  // Warm the shots shortly after mount (all five together are ~148 KB): opening the
  // lightbox then paints instantly instead of flashing an empty stage.
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const view of VIEWS) new Image().src = view.src;
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // `showModal` makes the page inert but still lets the document scroll behind the
  // backdrop, so lock the root while the lightbox is up.
  useEffect(() => {
    if (!zoomed) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [zoomed]);

  /**
   * 由状态驱动 `<dialog>` 的开关，而不是在点击回调里直接调 `showModal()`。
   *
   * 后者会先弹出面板、再让 React 渲染内容，中间有一帧是空面板；
   * 放在 effect 里则是「内容先渲染、再打开」，不会闪。
   */
  useEffect(() => {
    const dialog = lightbox.current;
    if (!dialog) return;
    if (zoomed && !dialog.open) dialog.showModal();
    if (!zoomed && dialog.open) dialog.close();
  }, [zoomed]);

  const openLightbox = (key: ViewKey) => setZoomed(key);

  /** Clicks that land on the dialog itself are backdrop clicks. */
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === lightbox.current) lightbox.current.close();
  };

  return (
    <section className="showcase" id="product">
      <div className="showcase-inner">
        <p className="eyebrow eyebrow-center" data-reveal>
          {t("landing.showcase.label")}
        </p>
        <h2 data-reveal>{t("landing.showcase.title")}</h2>
        <p className="subtle subtle-center" data-reveal>
          {t("landing.showcase.subtitle")}
        </p>

        <div className="showcase-rows">
          {VIEWS.map((view, i) => {
            const Icon = view.icon;
            const label = t(`landing.showcase.views.${view.key}.label`);
            const desc = t(`landing.showcase.views.${view.key}.desc`);
            return (
              <article
                className="showcase-row"
                key={view.key}
                /* 奇偶行左右交替：图片与文字互换位置（窄屏在 CSS 里统一成单列）。 */
                data-flip={i % 2 === 1 ? "true" : undefined}
              >
                <figure className="showcase-row-shot" data-reveal style={revealDelay(60)}>
                  <button
                    type="button"
                    className="ui-zoom"
                    onClick={() => openLightbox(view.key)}
                    aria-label={`${label} — ${t("landing.showcase.zoom")}`}
                  >
                    <img
                      className="ui-shot"
                      src={view.src}
                      /* alt 只写界面名：说明文案已加长，整段塞进 alt 反而拖累读屏。 */
                      alt={label}
                      width={1080}
                      height={522}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="ui-zoom-hint" aria-hidden="true">
                      <Maximize2 size={15} />
                      {t("landing.showcase.zoom")}
                    </span>
                  </button>
                </figure>

                <div className="showcase-row-copy" data-reveal style={revealDelay(120)}>
                  {/* 编号与参考图一致：两位补零（01…05）。 */}
                  <span className="showcase-row-no" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="showcase-row-title">
                    <span className="showcase-row-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    {label}
                  </h3>
                  <p className="showcase-row-desc">{desc}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <dialog
        ref={lightbox}
        className="ui-lightbox"
        aria-label={current ? t(`landing.showcase.views.${current.key}.label`) : undefined}
        onClick={onBackdropClick}
        onClose={() => setZoomed(null)}
      >
        {current && (
          <figure className="ui-lightbox-inner">
            <img
              className="ui-lightbox-shot"
              src={current.src}
              alt={t(`landing.showcase.views.${current.key}.label`)}
              width={1080}
              height={522}
            />
            <figcaption className="ui-lightbox-cap">
              <strong>{t(`landing.showcase.views.${current.key}.label`)}</strong>
              <span>{t(`landing.showcase.views.${current.key}.desc`)}</span>
              <button
                type="button"
                className="ui-lightbox-close"
                onClick={() => lightbox.current?.close()}
                aria-label={t("landing.showcase.close")}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </section>
  );
}
