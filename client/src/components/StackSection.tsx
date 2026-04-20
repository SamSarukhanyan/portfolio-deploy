import styles from "./StackSection.module.css";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";

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
        <div className={styles.head}>
          <Reveal as="h2" className="section-title" direction="left">
            {t("stack.title")}
          </Reveal>
          <Reveal className={styles.stackGlyph} direction="right" delayMs={65} aria-hidden>
            <span className={styles.stackLayer} />
            <span className={styles.stackLayer} />
            <span className={styles.stackLayer} />
          </Reveal>
        </div>
        <Reveal as="p" className="section-lead" direction="up" delayMs={60}>
          {t("stack.lead")}
        </Reveal>
        <div className={styles.grid}>
          {layers.map((layer, layerIdx) => (
            <Reveal
              key={layer.titleKey}
              as="article"
              className={`glass ${styles.card}`}
              direction={layerIdx % 2 === 0 ? "left" : "right"}
              delayMs={80 + layerIdx * 70}
            >
              <p className={styles.cardTitle} style={{ color: layer.accent }}>
                {t(layer.titleKey)}
              </p>
              <p className={styles.summary}>{t(layer.summaryKey)}</p>
              <ul className={styles.list}>
                {layer.itemKeys.map((key, idx) => (
                  <Reveal
                    key={key}
                    as="li"
                    direction={idx % 2 === 0 ? "up" : "right"}
                    delayMs={120 + idx * 24}
                  >
                    {t(key)}
                  </Reveal>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
