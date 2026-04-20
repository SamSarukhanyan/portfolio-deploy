import styles from "./StackSection.module.css";
import { useI18n } from "../i18n/I18nProvider";

const layers = [
  {
    titleKey: "stack.clients.title" as const,
    summaryKey: "stack.clients.summary" as const,
    itemKeys: [
      "stack.clients.0",
      "stack.clients.1",
      "stack.clients.2",
      "stack.clients.3",
      "stack.clients.4",
      "stack.clients.5",
    ] as const,
    accent: "var(--accent)",
  },
  {
    titleKey: "stack.server.title" as const,
    summaryKey: "stack.server.summary" as const,
    itemKeys: [
      "stack.server.0",
      "stack.server.1",
      "stack.server.2",
      "stack.server.3",
      "stack.server.4",
      "stack.server.5",
    ] as const,
    accent: "var(--accent-2)",
  },
  {
    titleKey: "stack.infra.title" as const,
    summaryKey: "stack.infra.summary" as const,
    itemKeys: [
      "stack.infra.0",
      "stack.infra.1",
      "stack.infra.2",
      "stack.infra.3",
      "stack.infra.4",
      "stack.infra.5",
      "stack.infra.6",
      "stack.infra.7",
    ] as const,
    accent: "#7aa89a",
  },
];

export function StackSection() {
  const { t } = useI18n();

  return (
    <section id="stack" className={`section ${styles.section}`}>
      <div className="shell">
        <h2 className="section-title">{t("stack.title")}</h2>
        <p className="section-lead">{t("stack.lead")}</p>
        <div className={styles.grid}>
          {layers.map((layer) => (
            <article key={layer.titleKey} className={`glass ${styles.card}`}>
              <p className={styles.cardTitle} style={{ color: layer.accent }}>{t(layer.titleKey)}</p>
              <p className={styles.summary}>{t(layer.summaryKey)}</p>
              <ul className={styles.list}>
                {layer.itemKeys.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
