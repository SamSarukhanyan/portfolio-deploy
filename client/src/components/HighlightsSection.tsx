import styles from "./HighlightsSection.module.css";
import { useI18n } from "../i18n/I18nProvider";

const cards = [
  { titleKey: "highlights.1.title" as const, bodyKey: "highlights.1.body" as const },
  { titleKey: "highlights.2.title" as const, bodyKey: "highlights.2.body" as const },
  { titleKey: "highlights.3.title" as const, bodyKey: "highlights.3.body" as const },
  { titleKey: "highlights.4.title" as const, bodyKey: "highlights.4.body" as const },
];

export function HighlightsSection() {
  const { t } = useI18n();

  return (
    <section id="highlights" className={`section ${styles.section}`}>
      <div className="shell">
        <h2 className="section-title">{t("highlights.title")}</h2>
        <p className="section-lead">{t("highlights.lead")}</p>
        <ul className={styles.grid}>
          {cards.map((h) => (
            <li key={h.titleKey} className={`glass ${styles.card}`}>
              <h3 className={styles.cardTitle}>{t(h.titleKey)}</h3>
              <p className={styles.cardText}>{t(h.bodyKey)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
