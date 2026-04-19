import { useMemo } from "react";
import styles from "./Hero.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";

const chipKeys = [
  "hero.chip.0",
  "hero.chip.1",
  "hero.chip.2",
  "hero.chip.3",
  "hero.chip.4",
  "hero.chip.5",
  "hero.chip.6",
  "hero.chip.7",
  "hero.chip.8",
  "hero.chip.9",
  "hero.chip.10",
  "hero.chip.11",
] as const;

export function Hero() {
  const { t } = useI18n();

  const highlightSet = useMemo(() => new Set(["hero.chip.2", "hero.chip.5", "hero.chip.6"]), []);

  const nameParts = site.displayName.split(" ");
  const firstName = nameParts[0] ?? site.displayName;
  const lastName = nameParts.slice(1).join(" ");

  return (
    <section id="top" className="section">
      <div className="shell">
        <div className={`glass ${styles.card}`}>
          <div className={styles.grid}>
            <div className={styles.copy}>
              <p className="tag">{t("hero.tag", { domain: site.domain })}</p>
              <h1 className={styles.title}>
                <span className={styles.titleFirst}>{firstName}</span>
                {lastName ? <span className={styles.titleLast}> {lastName}</span> : null}
              </h1>
              <p className={styles.subtitle}>{t("hero.subtitle")}</p>
              <p className={styles.lead}>{t("hero.lead")}</p>
              <p className={styles.body}>{t("hero.body")}</p>
              <div className={styles.actions}>
                <a className="btn-primary" href="#contact">
                  {t("hero.ctaContact")}
                </a>
                <a className="btn-ghost" href="#stack">
                  {t("hero.ctaStack")}
                </a>
              </div>
            </div>
            <div className={styles.visual} aria-hidden>
              <div className={styles.chipCloud}>
                <div className={styles.chipGrid}>
                  {chipKeys.map((key) => (
                    <span
                      key={key}
                      className={`${styles.chip} ${highlightSet.has(key) ? styles.chipHighlight : ""}`}
                    >
                      {t(key)}
                    </span>
                  ))}
                </div>
                <p className={styles.chipNote}>{t("hero.chipNote")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
