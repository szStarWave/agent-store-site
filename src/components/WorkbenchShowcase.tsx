import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
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
 * Real screenshots of the shipped Web UI, one per catalog surface plus the
 * conversation view. Every shot is 1080×52x, so the stage pins the same aspect
 * ratio and switching views never reflows the page.
 */
const VIEWS: { key: ViewKey; icon: typeof Boxes; src: string }[] = [
  { key: "chat", icon: MessageSquare, src: chatShot },
  { key: "experts", icon: Sparkles, src: expertsShot },
  { key: "skills", icon: Boxes, src: skillsShot },
  { key: "connectors", icon: Plug, src: connectorsShot },
  { key: "settings", icon: Settings, src: settingsShot },
];

export default function WorkbenchShowcase() {
  const { t } = useTranslation();
  const [active, setActive] = useState<ViewKey>("chat");
  const [zoomed, setZoomed] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const lightbox = useRef<HTMLDialogElement>(null);

  const index = VIEWS.findIndex((view) => view.key === active);
  const current = VIEWS[index];
  const label = t(`landing.showcase.views.${current.key}.label`);
  const desc = t(`landing.showcase.views.${current.key}.desc`);
  const shotAlt = `${label} — ${desc}`;

  // Warm the remaining shots shortly after mount (all five together are ~148 KB):
  // switching a view then paints instantly instead of flashing an empty stage.
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const view of VIEWS) new Image().src = view.src;
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // `showModal` makes the page inert but still lets the document scroll behind
  // the backdrop, so lock the root while the lightbox is up.
  useEffect(() => {
    if (!zoomed) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [zoomed]);

  const openLightbox = () => {
    if (lightbox.current && !lightbox.current.open) lightbox.current.showModal();
    setZoomed(true);
  };
  const closeLightbox = () => lightbox.current?.close();

  /** Clicks that land on the dialog itself are backdrop clicks. */
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === lightbox.current) lightbox.current.close();
  };

  /** Arrow/Home/End roving focus, matching the vertical tablist convention. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    let next = -1;
    if (step !== 0) next = (index + step + VIEWS.length) % VIEWS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = VIEWS.length - 1;
    else return;

    event.preventDefault();
    setActive(VIEWS[next].key);
    tabs.current[next]?.focus();
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

        <div className="showcase-layout">
          <div
            className="ui-views"
            role="tablist"
            aria-orientation="vertical"
            aria-label={t("landing.showcase.title")}
            onKeyDown={onKeyDown}
          >
            {VIEWS.map((view, i) => {
              const Icon = view.icon;
              const selected = view.key === active;
              return (
                <button
                  key={view.key}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`ui-tab-${view.key}`}
                  aria-selected={selected}
                  aria-controls={`ui-panel-${view.key}`}
                  tabIndex={selected ? 0 : -1}
                  className={selected ? "ui-view is-active" : "ui-view"}
                  onClick={() => setActive(view.key)}
                >
                  <span className="ui-view-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="ui-view-text">
                    <span className="ui-view-label">{t(`landing.showcase.views.${view.key}.label`)}</span>
                    <span className="ui-view-desc">{t(`landing.showcase.views.${view.key}.desc`)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ui-stage-wrap" data-reveal style={revealDelay(140)}>
            <span className="showcase-glow" aria-hidden="true" />
            <figure
              className="ui-stage"
              id={`ui-panel-${active}`}
              role="tabpanel"
              aria-labelledby={`ui-tab-${active}`}
            >
              <button
                type="button"
                className="ui-zoom"
                onClick={openLightbox}
                aria-label={`${label} — ${t("landing.showcase.zoom")}`}
              >
                <img
                  key={active}
                  className="ui-shot"
                  src={current.src}
                  alt={shotAlt}
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
          </div>
        </div>
      </div>

      <dialog
        ref={lightbox}
        className="ui-lightbox"
        aria-label={`${label} — ${t("landing.showcase.zoom")}`}
        onClick={onBackdropClick}
        onClose={() => setZoomed(false)}
      >
        <figure className="ui-lightbox-inner">
          <img className="ui-lightbox-shot" src={current.src} alt={shotAlt} width={1080} height={522} />
          <figcaption className="ui-lightbox-cap">
            <strong>{label}</strong>
            <span>{desc}</span>
            <button
              type="button"
              className="ui-lightbox-close"
              onClick={closeLightbox}
              aria-label={t("landing.showcase.close")}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </figcaption>
        </figure>
      </dialog>
    </section>
  );
}
