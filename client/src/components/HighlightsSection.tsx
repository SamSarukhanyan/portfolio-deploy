import styles from "./HighlightsSection.module.css";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";
import { onSpaLinkClick } from "../utils/spaRouter";

const cards = [
  { titleKey: "highlights.1.title" as const, bodyKey: "highlights.1.body" as const },
  { titleKey: "highlights.2.title" as const, bodyKey: "highlights.2.body" as const },
  { titleKey: "highlights.3.title" as const, bodyKey: "highlights.3.body" as const },
  { titleKey: "highlights.4.title" as const, bodyKey: "highlights.4.body" as const },
  { titleKey: "highlights.5.title" as const, bodyKey: "highlights.5.body" as const },
  { titleKey: "highlights.6.title" as const, bodyKey: "highlights.6.body" as const },
];

export function HighlightsSection() {
  const { t } = useI18n();

  return (
    <section id="highlights" className={`section ${styles.section}`}>
      <div className="shell">
        <div className={styles.head}>
          <Reveal as="h2" className="section-title" direction="left">
            {t("highlights.title")}
          </Reveal>
          <Reveal className={styles.signal} direction="right" delayMs={70} aria-hidden>
            <span className={styles.signalBar} />
            <span className={styles.signalBar} />
            <span className={styles.signalBar} />
            <span className={styles.signalDot} />
          </Reveal>
        </div>
        <Reveal as="p" className="section-lead" direction="up" delayMs={60}>
          {t("highlights.lead")}
        </Reveal>
        <Reveal className={styles.artPortalWrap} direction="up" delayMs={95}>
          <a className={styles.artPortal} href="/art" onClick={(event) => onSpaLinkClick(event, "/art")}>
            {t("hero.ctaArt")}
          </a>
        </Reveal>
        <ul className={styles.grid}>
          {cards.map((h, idx) => (
            <Reveal
              key={h.titleKey}
              as="li"
              className={`glass ${styles.card}`}
              direction={idx % 3 === 0 ? "left" : idx % 3 === 1 ? "up" : "right"}
              delayMs={80 + idx * 45}
            >
              <p className={styles.cardKicker}>{t("highlights.kicker")}</p>
              <h3 className={styles.cardTitle}>{t(h.titleKey)}</h3>
              <p className={styles.cardText}>{t(h.bodyKey)}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
