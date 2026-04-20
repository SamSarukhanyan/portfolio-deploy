import styles from "./ArchitectureSection.module.css";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";

const nodes = [
  {
    id: "planning",
    label: "Design & Product Surface",
    sub: "React 19 · Vite · UX system",
    bodyKey: "arch.planning.body" as const,
  },
  {
    id: "backend",
    label: "API & Data Layer",
    sub: "Express 5 · Sequelize · MySQL",
    bodyKey: "arch.backend.body" as const,
  },
  {
    id: "delivery",
    label: "Delivery & Runtime",
    sub: "GitHub Actions · EC2 · Nginx · PM2",
    bodyKey: "arch.delivery.body" as const,
  },
];

export function ArchitectureSection() {
  const { t } = useI18n();

  return (
    <section id="architecture" className={`section ${styles.section}`}>
      <div className="shell">
        <Reveal as="h2" className="section-title" direction="right">
          {t("arch.title")}
        </Reveal>
        <Reveal as="p" className="section-lead" direction="up" delayMs={60}>
          {t("arch.lead")}
        </Reveal>

        <Reveal className={`glass ${styles.diagram}`} direction="up" delayMs={90}>
          <div className={styles.flow}>
            {nodes.map((n, i) => (
              <Reveal
                key={n.id}
                className={styles.flowItem}
                direction={i % 2 === 0 ? "left" : "right"}
                delayMs={110 + i * 80}
              >
                <Reveal as="article" className={styles.node} direction="up" delayMs={40}>
                  <header className={styles.nodeHead}>
                    <span className={styles.nodeLabel}>{n.label}</span>
                    <span className={styles.nodeSub}>{n.sub}</span>
                  </header>
                  <p className={styles.nodeBody}>{t(n.bodyKey)}</p>
                </Reveal>
                {i < nodes.length - 1 ? (
                  <div className={styles.connector} aria-hidden>
                    <span className={styles.connectorLine} />
                  </div>
                ) : null}
              </Reveal>
            ))}
          </div>

          <div className={styles.rail}>
            <Reveal className={styles.railCard} direction="left" delayMs={180}>
              <span className={styles.railTitle}>{t("arch.data.title")}</span>
              <p>{t("arch.data.body")}</p>
            </Reveal>
            <Reveal className={styles.railCard} direction="right" delayMs={220}>
              <span className={styles.railTitle}>{t("arch.ship.title")}</span>
              <p>{t("arch.ship.body")}</p>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
