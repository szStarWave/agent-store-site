import { useTranslation } from "../i18n";
import type { CSSProperties } from "react";

const ITEMS = ["q1", "q2", "q3", "q4"] as const;

/** FAQ —— 四个问题：本地优先边界、平台支持、登录、导入来源。 */
export default function FaqSection() {
  const { t } = useTranslation();

  return (
    <section className="faq" id="faq">
      <div className="section-inner">
        <h2 data-reveal>{t("landing.faq.title")}</h2>

        <div className="faq-list">
          {ITEMS.map((item, i) => (
            <details
              className="faq-item"
              key={item}
              data-reveal
              style={{ "--reveal-delay": `${i * 70}ms` } as CSSProperties}
              open={i === 0}
            >
              <summary>{t(`landing.faq.items.${item}.q`)}</summary>
              <p>{t(`landing.faq.items.${item}.a`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
