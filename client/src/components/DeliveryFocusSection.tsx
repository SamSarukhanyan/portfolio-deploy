import styles from "./DeliveryFocusSection.module.css";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";

const focusKeys = ["hero.focus.0", "hero.focus.1", "hero.focus.2", "hero.focus.3"] as const;

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
              direction={idx % 2 === 0 ? "left" : "right"}
              delayMs={70 + idx * 45}
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

