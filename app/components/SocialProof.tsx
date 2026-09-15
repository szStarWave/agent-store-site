import { useTranslation } from "react-i18next";
import { Quote } from "lucide-react";

import { revealDelay } from "../lib/effects";

type ProofItem = { quote: string; role: string };

/** Lightweight social-proof band: short, editable quotes that reinforce the
 *  local-first value prop. Cards reuse `.feature-card` so the page-level
 *  spotlight (from Landing's `useSpotlight`) applies here too. */
export default function SocialProof() {
  const { t } = useTranslation();
  const items = t("landing.socialProof.items", { returnObjects: true }) as ProofItem[];

  return (
    <section className="social-proof" id="social-proof">
      <div className="section-inner">
        <h2 className="sp-title" data-reveal>
          {t("landing.socialProof.title")}
        </h2>
        <p className="subtle subtle-center" data-reveal>
          {t("landing.socialProof.subtitle")}
        </p>

        <div className="sp-grid">
          {items.map((item, i) => (
            <figure className="feature-card sp-card" data-reveal key={i} style={revealDelay(i * 90)}>
              <span className="sp-quote-mark" aria-hidden="true">
                <Quote size={16} />
              </span>
              <blockquote className="sp-quote">{item.quote}</blockquote>
              <figcaption className="sp-role">{item.role}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
