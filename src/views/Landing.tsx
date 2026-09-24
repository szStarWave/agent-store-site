import Link from "@docusaurus/Link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Bot, Download, Eye, Maximize2, Rocket, ShieldCheck, Star, Store, FileDown, X } from "lucide-react";

import { useLanguage, useTranslation } from "../i18n";
import { revealDelay, useRevealAll, useSpotlight } from "../lib/effects";
import {
  ARCH_LABELS,
  installScriptUrl,
  PLATFORM_LABELS,
  RELEASED_PLATFORMS,
  releaseAssetUrl,
  releasesPageUrl,
  githubUrl,
} from "../lib/platform";
import PageMeta from "../components/PageMeta";
import FaqSection from "../components/FaqSection";
import CopyButton from "../components/CopyButton";
import chatShot from "../assets/webui/chat.webp";
import connectorsShot from "../assets/webui/connectors.webp";
import expertsShot from "../assets/webui/experts.webp";
import settingsShot from "../assets/webui/settings.webp";
import skillsShot from "../assets/webui/skills.webp";

const META = {
  "zh-CN": {
    title: "Flowy Agent Store — 本地优先的 Agent 工作台",
    description:
      "Flowy Agent Store 是本地优先的单文件 Agent 运行时：一条命令在浏览器中拉起工作台，导入专家、技能与连接器，执行与凭据只留本机。",
  },
  "en-US": {
    title: "Flowy Agent Store — Run your agent workbench locally",
    description:
      "Flowy Agent Store is a local-first, single-file agent runtime. One command opens a workbench in your browser to import experts, skills and connectors — execution and credentials stay on your machine.",
  },
} as const;

/* ── Hero：徽章 + 大标语 + 双 CTA + 产品实拍轮播 ─────────────── */

/** 轮播的界面截图（与工作台各视图一一对应，文案在 i18n `landing.heroShots`）。 */
const HERO_SHOTS = [
  { key: "chat", src: chatShot },
  { key: "experts", src: expertsShot },
  { key: "skills", src: skillsShot },
  { key: "connectors", src: connectorsShot },
  { key: "settings", src: settingsShot },
] as const;

/** 轮播间隔与淡入淡出时长（CSS 里 `.hero-shot-img` 的 transition 要与此匹配）。 */
const SHOT_INTERVAL_MS = 4200;

/**
 * 产品实拍轮播：自动逐张淡入淡出，悬停/聚焦暂停，圆点可手动切换；
 * 点击当前图打开 lightbox 放大查看（原生 `<dialog>`，Esc / 点背景关闭）。
 * `prefers-reduced-motion` 下不自动播放（仍可手动点圆点）。
 */
function HeroShotCarousel() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  /** lightbox 是否打开。由状态驱动 `<dialog>`，避免「先弹空面板再渲染内容」的闪动。 */
  const [zoomed, setZoomed] = useState(false);
  const lightbox = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (paused || zoomed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % HERO_SHOTS.length), SHOT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, zoomed]);

  // `showModal` 让页面惰性但文档仍可滚动，所以 lightbox 打开期间锁住根元素。
  useEffect(() => {
    if (!zoomed) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [zoomed]);

  // 内容先渲染、再打开/关闭，不会闪一帧空面板。
  useEffect(() => {
    const dialog = lightbox.current;
    if (!dialog) return;
    if (zoomed && !dialog.open) dialog.showModal();
    if (!zoomed && dialog.open) dialog.close();
  }, [zoomed]);

  /** 落在 dialog 自身上的点击就是点了背景。 */
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === lightbox.current) lightbox.current.close();
  };

  const current = HERO_SHOTS[index];
  const currentLabel = t(`landing.heroShots.${current.key}`);

  return (
    <figure
      className="hero-shot"
      style={revealDelay(320)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <button
        type="button"
        className="hero-shot-zoom"
        onClick={() => setZoomed(true)}
        aria-label={`${currentLabel} — ${t("landing.heroShotZoom")}`}
      >
        <div className="hero-shot-stage">
          {HERO_SHOTS.map((shot, i) => (
            <img
              key={shot.key}
              className={i === index ? "hero-shot-img is-active" : "hero-shot-img"}
              src={shot.src}
              alt={i === index ? currentLabel : ""}
              width={1080}
              height={522}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              aria-hidden={i !== index}
            />
          ))}
        </div>
        <span className="hero-shot-hint" aria-hidden="true">
          <Maximize2 size={15} />
          {t("landing.heroShotZoom")}
        </span>
      </button>
      <div className="hero-shot-dots" role="group" aria-label={t("landing.heroShotsLabel")}>
        {HERO_SHOTS.map((shot, i) => (
          <button
            key={shot.key}
            type="button"
            className={i === index ? "hero-shot-dot is-active" : "hero-shot-dot"}
            aria-label={t(`landing.heroShots.${shot.key}`)}
            aria-current={i === index}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>

      <dialog
        ref={lightbox}
        className="shot-lightbox"
        aria-label={currentLabel}
        onClick={onBackdropClick}
        onClose={() => setZoomed(false)}
      >
        <figure className="shot-lightbox-inner">
          <img
            className="shot-lightbox-img"
            src={current.src}
            alt={currentLabel}
            width={1080}
            height={522}
          />
          <figcaption className="shot-lightbox-cap">
            <strong>{currentLabel}</strong>
            <button
              type="button"
              className="shot-lightbox-close"
              onClick={() => lightbox.current?.close()}
              aria-label={t("landing.heroShotClose")}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </figcaption>
        </figure>
      </dialog>
    </figure>
  );
}

function HeroSection({ lang }: { lang: ReturnType<typeof useLanguage> }) {
  const { t } = useTranslation();
  return (
    <section className="hero">
      <div className="hero-aurora" aria-hidden="true">
        <i className="aurora-blob aurora-a" />
        <i className="aurora-blob aurora-b" />
        <i className="aurora-blob aurora-c" />
      </div>
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-inner">
        <a className="hero-badge" href={githubUrl()} target="_blank" rel="noreferrer" style={revealDelay(0)}>
          <Star size={14} aria-hidden="true" />
          {t("landing.heroBadge")}
        </a>
        <h1 className="hero-title" style={revealDelay(70)}>{t("landing.heroTitle")}</h1>
        <p className="hero-sub" style={revealDelay(150)}>{t("landing.heroSubtitle")}</p>
        <div className="hero-actions" style={revealDelay(230)}>
          <Link className="btn btn-primary btn-lg" to={`/${lang}/docs/quick-start`}>
            {t("landing.heroCtaStart")}
          </Link>
          <Link className="btn btn-quiet btn-lg" to={`/${lang}/docs`}>
            {t("landing.heroCtaDocs")}
          </Link>
        </div>
        <HeroShotCarousel />
      </div>
    </section>
  );
}

/* ── 三步上手：左侧文案，右侧安装方式标签卡 ───────────────────── */
function InstallSection({ lang }: { lang: ReturnType<typeof useLanguage> }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"auto" | "manual">("auto");
  const [oneLiner, setOneLiner] = useState("");

  useEffect(() => {
    // 绝对地址：`irm | iex` 在任何终端 cwd 下都可用（SSG 阶段无 window，运行时补齐）。
    setOneLiner(`irm ${window.location.origin}${installScriptUrl()} | iex`);
  }, []);

  return (
    <section className="install" id="download">
      <div className="install-inner">
        <div className="install-copy">
          <h2 data-reveal>{t("landing.install.title")}</h2>
          <p className="subtle" data-reveal>{t("landing.install.subtitle")}</p>
        </div>

        <div className="install-card" data-reveal style={revealDelay(90)}>
          <div className="install-tabs" role="tablist" aria-label={t("landing.install.title")}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "auto"}
              className="install-tab"
              onClick={() => setTab("auto")}
            >
              {t("landing.install.tabAuto")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "manual"}
              className="install-tab"
              onClick={() => setTab("manual")}
            >
              {t("landing.install.tabManual")}
            </button>
          </div>

          <div className="install-panel">
            {tab === "auto" ? (
              <>
                <p className="install-hint">{t("landing.install.cmdHint")}</p>
                <div className="install-cmd">
                  <code>{oneLiner || `irm ${installScriptUrl()} | iex`}</code>
                  <CopyButton text={oneLiner || `irm ${installScriptUrl()} | iex`} label={t("landing.install.copy")} />
                </div>
                <p className="install-note">{t("landing.install.cmdNote")}</p>
                <p className="install-note">
                  <a href={installScriptUrl()} target="_blank" rel="noreferrer">
                    {t("landing.install.viewScript")}
                  </a>
                </p>
              </>
            ) : (
              <>
                <p className="install-hint">{t("landing.install.manualHint")}</p>
                <div className="install-platforms">
                  {RELEASED_PLATFORMS.map((p) => (
                    <a key={`${p.os}-${p.arch}`} className="install-platform" href={releaseAssetUrl(p)}>
                      <Download size={15} aria-hidden="true" />
                      <span className="install-platform-os">{PLATFORM_LABELS[p.os][lang]}</span>
                      <span className="install-platform-arch">{ARCH_LABELS[p.arch][lang]}</span>
                    </a>
                  ))}
                </div>
                <p className="install-note">
                  <a href={releasesPageUrl()} target="_blank" rel="noreferrer">
                    {t("landing.install.releases")}
                  </a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 为什么选择：左侧卖点按钮，右侧详情面板 ───────────────────── */
const WHY_ICONS = [Rocket, Store, Eye, ShieldCheck, Bot];

function WhySection() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const items = t("landing.why.items", { returnObjects: true }) as { title: string; desc: string }[];
  const Icon = WHY_ICONS[active] ?? WHY_ICONS[0];
  const current = items[active] ?? items[0];

  const onKeyNav = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setActive((prev) => (prev + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
  };

  return (
    <section className="why" id="features">
      <div className="why-inner">
        <h2 data-reveal>{t("landing.why.title")}</h2>
        <p className="subtle" data-reveal>{t("landing.why.subtitle")}</p>

        <div className="why-grid" data-reveal style={revealDelay(90)}>
          <div className="why-tabs" role="tablist" aria-label={t("landing.why.title")} onKeyDown={onKeyNav}>
            {items.map((item, i) => {
              const TabIcon = WHY_ICONS[i] ?? WHY_ICONS[0];
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  className="why-tab"
                  key={item.title}
                  onClick={() => setActive(i)}
                >
                  <span className="why-tab-icon" aria-hidden="true">
                    <TabIcon size={16} />
                  </span>
                  {item.title}
                </button>
              );
            })}
          </div>

          <div className="why-detail" role="tabpanel">
            <span className="why-detail-icon" aria-hidden="true">
              <Icon size={22} />
            </span>
            <h3>{current.title}</h3>
            <p>{current.desc}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 尾部 CTA ─────────────────────────────────────────────── */
function CtaSection({ lang }: { lang: ReturnType<typeof useLanguage> }) {
  const { t } = useTranslation();
  return (
    <section className="cta">
      <div className="hero-aurora" aria-hidden="true">
        <i className="aurora-blob aurora-a" />
        <i className="aurora-blob aurora-b" />
      </div>
      <div className="cta-inner">
        <h2 data-reveal>{t("landing.cta.title")}</h2>
        <p className="subtle subtle-center" data-reveal>{t("landing.cta.subtitle")}</p>
        <div className="cta-actions" data-reveal style={revealDelay(120)}>
          <Link className="btn btn-primary btn-lg" to={`/${lang}/docs/quick-start`}>
            {t("landing.cta.primary")}
          </Link>
          <a className="btn btn-quiet btn-lg" href="#download">
            <FileDown size={17} aria-hidden="true" />
            {t("landing.cta.secondary")}
          </a>
          <a className="btn btn-quiet btn-lg" href={githubUrl()} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const lang = useLanguage();

  // 页面级装饰性效果（滚动入场、聚光）。
  useRevealAll();
  useSpotlight(".install-platform");

  return (
    <>
      <PageMeta title={META[lang].title} description={META[lang].description} canonicalPath={`/${lang}`} />
      <HeroSection lang={lang} />
      <InstallSection lang={lang} />
      <WhySection />
      <FaqSection />
      <CtaSection lang={lang} />
    </>
  );
}
