import { useLanguage, useTranslation } from "../i18n";
import { Terminal } from "lucide-react";

import { installScriptUrl, RELEASE_VERSION, releasesPageUrl, SITE_ORIGIN } from "../lib/platform";
import CopyButton from "./CopyButton";

/**
 * "Hand this prompt to your agent" — one copyable prompt that takes a coding
 * agent through download → start → report the workbench URL.
 *
 * It deliberately quotes the same two primitives the download section already
 * relies on (this site's `install.ps1` and the GitHub release page) instead of
 * inventing a third install path: `install.ps1` installs the binary and puts it
 * on the user PATH but does **not** start anything, so starting the service is
 * a separate step in a new terminal (`docs/cli.md`). The prompt also pins
 * `-Version`, because the script's own default is the npm `latest` tag, which
 * currently points at an older pre-release than the version this site ships.
 */
export default function AgentPromptSection() {
  const { t } = useTranslation();
  const lang = useLanguage();

  // Absolute URLs against the canonical origin, not `window.location.origin`:
  // an agent may run the copied prompt long after the page it came from is gone
  // (see `SITE_ORIGIN`). This also keeps SSG output and hydration identical.
  const prompt = t("landing.agent.prompt", {
    version: RELEASE_VERSION,
    installUrl: `${SITE_ORIGIN}${installScriptUrl()}`,
    releasesUrl: releasesPageUrl(),
    configUrl: `${SITE_ORIGIN}/${lang}/docs/configuration`,
  });

  return (
    <section className="agent-prompt" id="agent-prompt">
      <div className="section-inner">
        <p className="eyebrow" data-reveal>
          {t("landing.agent.eyebrow")}
        </p>
        <h2 data-reveal>{t("landing.agent.title")}</h2>
        <p className="subtle" data-reveal>
          {t("landing.agent.subtitle")}
        </p>

        <figure className="agent-prompt-card" data-reveal>
          <figcaption className="agent-prompt-head">
            <span className="agent-prompt-title">
              <Terminal size={15} aria-hidden="true" />
              {t("landing.agent.blockTitle")}
            </span>
            <CopyButton
              text={prompt}
              label={t("landing.agent.copy")}
              copiedLabel={t("landing.agent.copied")}
              showLabel
            />
          </figcaption>
          <pre className="agent-prompt-body">
            <code>{prompt}</code>
          </pre>
        </figure>

        <p className="agent-prompt-note" data-reveal>
          {t("landing.agent.note", { version: RELEASE_VERSION })}
        </p>
      </div>
    </section>
  );
}
