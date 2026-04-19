import styles from "./Hero.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";

export function Hero() {
  const { t } = useI18n();

  return (
    <section id="top" className={`section ${styles.hero}`}>
      <div className="shell">
        <div className={`glass ${styles.card}`}>
          <div className={styles.grid}>
            <div className={styles.copy}>
              <p className="tag">{t("hero.tag", { domain: site.domain })}</p>
              <h1 className={styles.title}>
                <span className="gradient-text">{site.displayName}</span>
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
              <div className={styles.orbit}>
                <span className={styles.core}>RN</span>
                <span className={styles.satellite} data-p="1">
                  React
                </span>
                <span className={styles.satellite} data-p="2">
                  Node
                </span>
                <span className={styles.satellite} data-p="3">
                  MySQL
                </span>
                <span className={styles.satellite} data-p="4">
                  CI/CD
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
