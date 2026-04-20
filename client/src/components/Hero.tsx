import styles from "./Hero.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";

const focusKeys = ["hero.focus.0", "hero.focus.1", "hero.focus.2", "hero.focus.3"] as const;
const signalKeys = ["hero.signal.0", "hero.signal.1", "hero.signal.2"] as const;

export function Hero() {
  const { t } = useI18n();

  return (
    <section id="top" className="section">
      <div className="shell">
        <div className={`glass ${styles.card}`}>
          <div className={styles.grid}>
            <div className={styles.copy}>
              <p className={styles.domain}>{site.domain}</p>
              <h1 className={styles.title}>{t("hero.title")}</h1>
              <p className={styles.subtitle}>{t("hero.subtitle")}</p>
              <p className={styles.body}>{t("hero.body")}</p>
              <ul className={styles.focusList}>
                {focusKeys.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
              <div className={styles.actions}>
                <a className="btn-primary" href="#contact">
                  {t("hero.ctaContact")}
                </a>
                <a className="btn-ghost" href="#highlights">
                  {t("hero.ctaHighlights")}
                </a>
              </div>
            </div>
            <div className={styles.visual} aria-hidden>
              <div className={styles.signalPanel}>
                <p className={styles.signalTitle}>{t("hero.signalTitle")}</p>
                <ul className={styles.signalList}>
                  {signalKeys.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ul>
                <p className={styles.signalNote}>{t("hero.signalNote")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
