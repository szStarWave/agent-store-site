import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Terminal } from "lucide-react";

import { installScriptUrl, RELEASE_VERSION, releasesPageUrl } from "../lib/platform";
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
  const { lang: raw } = useParams();
  const lang = raw === "en-US" ? "en-US" : "zh-CN";

  // An agent may run the prompt from any cwd, so the URLs inside it have to be
  // absolute — but the origin only exists in the browser. SSG renders the
  // relative form and the effect upgrades it after hydration, the same
  // trade-off `DownloadCTA` makes for its one-liner.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const prompt = t("landing.agent.prompt", {
    version: RELEASE_VERSION,
    installUrl: `${origin}${installScriptUrl()}`,
    releasesUrl: releasesPageUrl(),
    configUrl: `${origin}/${lang}/docs/configuration`,
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
