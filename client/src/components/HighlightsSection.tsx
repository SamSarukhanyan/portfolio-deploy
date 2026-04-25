import styles from "./HighlightsSection.module.css";
import { useSectionDecorPause } from "../hooks/useSectionDecorPause";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";

const cards = [
  { titleKey: "highlights.1.title" as const, bodyKey: "highlights.1.body" as const },
  { titleKey: "highlights.2.title" as const, bodyKey: "highlights.2.body" as const },
  { titleKey: "highlights.3.title" as const, bodyKey: "highlights.3.body" as const },
  { titleKey: "highlights.4.title" as const, bodyKey: "highlights.4.body" as const },
  { titleKey: "highlights.5.title" as const, bodyKey: "highlights.5.body" as const },
  { titleKey: "highlights.6.title" as const, bodyKey: "highlights.6.body" as const },
];

const revealPlan = [
  { direction: "left" as const, delayMs: 84, distancePx: 14 },
  { direction: "right" as const, delayMs: 152, distancePx: 22 },
  { direction: "up" as const, delayMs: 116, distancePx: 16 },
  { direction: "left" as const, delayMs: 214, distancePx: 19 },
  { direction: "up" as const, delayMs: 178, distancePx: 20 },
  { direction: "right" as const, delayMs: 246, distancePx: 15 },
];

export function HighlightsSection() {
  const { t } = useI18n();
  const [sectionRef, decorPaused] = useSectionDecorPause();

  return (
    <section
      ref={sectionRef}
      id="highlights"
      className={`section ${styles.section}`}
      data-anim-paused={decorPaused ? "true" : undefined}
    >
      <div className="shell">
        <div className={styles.head}>
          <Reveal as="h2" className="section-title" direction="left" delayMs={24} skipInitialVisibilityCheck>
            {t("highlights.title")}
          </Reveal>
          <Reveal className={styles.signal} direction="right" delayMs={92} aria-hidden skipInitialVisibilityCheck>
            <span className={styles.meter} aria-hidden>
              <span className={styles.meterBar} data-i="0" />
              <span className={styles.meterBar} data-i="1" />
              <span className={styles.meterBar} data-i="2" />
              <span className={styles.meterBar} data-i="3" />
              <span className={styles.meterBar} data-i="4" />
            </span>
            <span className={styles.meterCap} />
            <span className={styles.meterDot} />
          </Reveal>
        </div>
        <Reveal as="p" className="section-lead" direction="up" delayMs={56} skipInitialVisibilityCheck>
          {t("highlights.lead")}
        </Reveal>
        <ul className={styles.grid}>
          {cards.map((h, idx) => (
            <Reveal
              key={h.titleKey}
              as="li"
              className={`glass ${styles.card}`}
              direction={revealPlan[idx]?.direction ?? "up"}
              delayMs={revealPlan[idx]?.delayMs ?? 100 + idx * 40}
              style={{ ["--reveal-distance" as string]: `${revealPlan[idx]?.distancePx ?? 16}px` }}
              skipInitialVisibilityCheck
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
