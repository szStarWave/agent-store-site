import Link from "@docusaurus/Link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  ArrowRight,
  Bot,
  Box,
  Cpu,
  Download,
  FileDown,
  GitBranch,
  History,
  Lock,
  Maximize2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Terminal,
  X,
  Zap,
} from "lucide-react";

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
    title: "Flowy Agent Store — 本地优先的 Agent 协作工作台与运行时",
    description:
      "Flowy Agent Store 是本地优先的轻量单文件 Agent 运行时：纯 Rust 原生单二进制分发，零外部依赖，极速开箱即用。全链路执行、敏感凭据与会话状态 100% 驻留本机；内置 380+ 专家角色、260+ 技能与 220+ MCP 连接器，支持多 Agent 计划有向无环图（Planned DAG）协同编排。",
  },
  "en-US": {
    title: "Flowy Agent Store — Local-First Agent Runtime & Workbench",
    description:
      "Flowy Agent Store is a local-first, lightweight single-file agent runtime powered by a native Rust engine. Preloaded with 380+ expert agents, 260+ skills, and 220+ MCP connectors. Full execution, private credentials, and state remain 100% local, orchestrating deterministic multi-agent Planned DAG workflows.",
  },
} as const;

/* ── Hero：徽章 + 大标语 + 多 CTA + 产品实拍轮播 ─────────────── */

const HERO_SHOTS = [
  { key: "chat", src: chatShot },
  { key: "experts", src: expertsShot },
  { key: "skills", src: skillsShot },
  { key: "connectors", src: connectorsShot },
  { key: "settings", src: settingsShot },
] as const;

const SHOT_INTERVAL_MS = 4200;

function HeroShotCarousel() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const lightbox = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (paused || zoomed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % HERO_SHOTS.length), SHOT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, zoomed]);

  useEffect(() => {
    if (!zoomed) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [zoomed]);

  useEffect(() => {
    const dialog = lightbox.current;
    if (!dialog) return;
    if (zoomed && !dialog.open) dialog.showModal();
    if (!zoomed && dialog.open) dialog.close();
  }, [zoomed]);

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
            <Rocket size={17} aria-hidden="true" />
            {t("landing.heroCtaStart")}
          </Link>
          <Link className="btn btn-quiet btn-lg" to={`/${lang}/market`}>
            <Store size={17} aria-hidden="true" />
            {t("landing.heroCtaMarket")}
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

/* ── 全景指标条（Stat Metrics Strip） ───────────────────────── */
function MetricsSection() {
  const { t } = useTranslation();
  const metrics = t("landing.metrics", { returnObjects: true }) as {
    value: string;
    label: string;
    desc: string;
  }[];

  return (
    <section className="metrics">
      <div className="metrics-inner">
        <div className="metrics-grid">
          {metrics.map((item, idx) => (
            <div className="metric-card" key={item.label} data-reveal style={revealDelay(idx * 60)}>
              <span className="metric-val">{item.value}</span>
              <span className="metric-label">{item.label}</span>
              <span className="metric-desc">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 安装卡片组件（供工作流第一步复用） ────────────────────────── */
function InstallCard({ lang }: { lang: ReturnType<typeof useLanguage> }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"auto" | "manual">("auto");
  const [oneLiner, setOneLiner] = useState("");

  useEffect(() => {
    setOneLiner(`irm ${window.location.origin}${installScriptUrl()} | iex`);
  }, []);

  return (
    <div className="install-card" id="download">
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
  );
}

/* ── 三步工作流展示（Seamless Workflow） ────────────────────── */
function WorkflowSection({ lang }: { lang: ReturnType<typeof useLanguage> }) {
  const { t } = useTranslation();

  return (
    <section className="workflow" id="workflow">
      <div className="workflow-inner">
        <div className="section-head" data-reveal>
          <div className="eyebrow">
            <Zap size={14} aria-hidden="true" />
            <span>{t("landing.workflow.tag")}</span>
          </div>
          <h2>{t("landing.workflow.title")}</h2>
          <p className="subtle">{t("landing.workflow.subtitle")}</p>
        </div>

        <div className="workflow-grid">
          {/* Step 1 */}
          <div className="workflow-step" data-reveal style={revealDelay(0)}>
            <span className="workflow-step-badge">{t("landing.workflow.step1.badge")}</span>
            <h3>{t("landing.workflow.step1.title")}</h3>
            <p>{t("landing.workflow.step1.desc")}</p>
            <div className="workflow-step-slot">
              <InstallCard lang={lang} />
            </div>
          </div>

          {/* Step 2 */}
          <div className="workflow-step" data-reveal style={revealDelay(100)}>
            <span className="workflow-step-badge">{t("landing.workflow.step2.badge")}</span>
            <h3>{t("landing.workflow.step2.title")}</h3>
            <p>{t("landing.workflow.step2.desc")}</p>
            <div className="workflow-step-slot">
              <Link className="btn btn-quiet" to={`/${lang}/market`}>
                <Store size={15} aria-hidden="true" />
                <span>{t("landing.heroCtaMarket")}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Step 3 */}
          <div className="workflow-step" data-reveal style={revealDelay(200)}>
            <span className="workflow-step-badge">{t("landing.workflow.step3.badge")}</span>
            <h3>{t("landing.workflow.step3.title")}</h3>
            <p>{t("landing.workflow.step3.desc")}</p>
            <div className="workflow-step-slot">
              <Link className="btn btn-quiet" to={`/${lang}/docs/architecture`}>
                <GitBranch size={15} aria-hidden="true" />
                <span>{t("docs.sections.architecture")}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 六大架构支柱矩阵（Architectural Pillars） ───────────────── */
const FEATURE_ICONS = [ShieldCheck, Cpu, GitBranch, Box, Lock, History];

function FeaturesSection() {
  const { t } = useTranslation();
  const features = t("landing.features.items", { returnObjects: true }) as {
    tag: string;
    title: string;
    desc: string;
  }[];

  return (
    <section className="features" id="features">
      <div className="features-inner">
        <div className="section-head" data-reveal>
          <div className="eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            <span>{t("landing.features.tag")}</span>
          </div>
          <h2>{t("landing.features.title")}</h2>
          <p className="subtle">{t("landing.features.subtitle")}</p>
        </div>

        <div className="features-grid">
          {features.map((item, idx) => {
            const Icon = FEATURE_ICONS[idx] ?? Sparkles;
            return (
              <div className="feature-card" key={item.title} data-reveal style={revealDelay(idx * 70)}>
                <div className="feature-head">
                  <div className="feature-icon-box">
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <span className="feature-tag">{item.tag}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── 开放生态与模型兼容墙（Ecosystem Support Wall） ─────────── */
const ECOSYSTEM_DATA = {
  models: ["OpenAI", "Anthropic Claude", "Qwen 通义千问", "DeepSeek", "Ollama", "vLLM", "SiliconFlow"],
  standards: ["Model Context Protocol (MCP)", "CodeBuddy Plugins", "WorkBuddy Skills", "JSON-RPC 2.0", "SQLite WAL"],
  tooling: ["TypeScript SDK", "Flowy CLI", "Embedded Web UI", "PowerShell", "cURL / WebSocket"],
};

function EcosystemSection() {
  const { t } = useTranslation();

  return (
    <section className="ecosystem" id="ecosystem">
      <div className="ecosystem-inner">
        <div className="section-head" data-reveal>
          <div className="eyebrow">
            <Bot size={14} aria-hidden="true" />
            <span>{t("landing.ecosystem.tag")}</span>
          </div>
          <h2>{t("landing.ecosystem.title")}</h2>
          <p className="subtle">{t("landing.ecosystem.subtitle")}</p>
        </div>

        <div className="ecosystem-groups">
          <div className="ecosystem-group" data-reveal style={revealDelay(0)}>
            <span className="ecosystem-group-title">{t("landing.ecosystem.modelsTag")}</span>
            <div className="ecosystem-chips">
              {ECOSYSTEM_DATA.models.map((name) => (
                <span className="ecosystem-chip" key={name}>
                  <i className="ecosystem-chip-dot" aria-hidden="true" />
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="ecosystem-group" data-reveal style={revealDelay(100)}>
            <span className="ecosystem-group-title">{t("landing.ecosystem.standardsTag")}</span>
            <div className="ecosystem-chips">
              {ECOSYSTEM_DATA.standards.map((name) => (
                <span className="ecosystem-chip" key={name}>
                  <i className="ecosystem-chip-dot" aria-hidden="true" />
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="ecosystem-group" data-reveal style={revealDelay(200)}>
            <span className="ecosystem-group-title">{t("landing.ecosystem.devsTag")}</span>
            <div className="ecosystem-chips">
              {ECOSYSTEM_DATA.tooling.map((name) => (
                <span className="ecosystem-chip" key={name}>
                  <i className="ecosystem-chip-dot" aria-hidden="true" />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 尾部高转化率 CTA ──────────────────────────────────────── */
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
            <Rocket size={17} aria-hidden="true" />
            {t("landing.cta.primary")}
          </Link>
          <a className="btn btn-quiet btn-lg" href="#download">
            <FileDown size={17} aria-hidden="true" />
            {t("landing.cta.secondary")}
          </a>
          <Link className="btn btn-quiet btn-lg" to={`/${lang}/market`}>
            <Store size={17} aria-hidden="true" />
            {t("landing.heroCtaMarket")}
          </Link>
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

  useRevealAll();
  useSpotlight(".metric-card, .feature-card, .workflow-step, .install-platform");

  return (
    <>
      <PageMeta title={META[lang].title} description={META[lang].description} canonicalPath={`/${lang}`} />
      <HeroSection lang={lang} />
      <MetricsSection />
      <WorkflowSection lang={lang} />
      <FeaturesSection />
      <EcosystemSection />
      <FaqSection />
      <CtaSection lang={lang} />
    </>
  );
}
