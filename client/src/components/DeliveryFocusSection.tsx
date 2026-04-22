import styles from "./DeliveryFocusSection.module.css";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";

const focusKeys = ["hero.focus.0", "hero.focus.1", "hero.focus.2", "hero.focus.3"] as const;
const focusRevealPlan = [
  { direction: "left" as const, delayMs: 78, distancePx: 14 },
  { direction: "up" as const, delayMs: 136, distancePx: 20 },
  { direction: "right" as const, delayMs: 112, distancePx: 17 },
  { direction: "left" as const, delayMs: 188, distancePx: 22 },
];

export function DeliveryFocusSection() {
  const { t } = useI18n();

  return (
    <section className={`section ${styles.section}`}>
      <div className="shell">
        <div className={styles.grid}>
          {focusKeys.map((key, idx) => (
            <Reveal
              key={key}
              as="article"
              className={`glass ${styles.card}`}
              direction={focusRevealPlan[idx]?.direction ?? "up"}
              delayMs={focusRevealPlan[idx]?.delayMs ?? 80 + idx * 40}
              style={{ ["--reveal-distance" as string]: `${focusRevealPlan[idx]?.distancePx ?? 16}px` }}
            >
              <span className={styles.marker} aria-hidden />
              <p>{t(key)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

