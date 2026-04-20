import styles from "./ArchitectureSection.module.css";
import { useI18n } from "../i18n/I18nProvider";

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
        <h2 className="section-title">{t("arch.title")}</h2>
        <p className="section-lead">{t("arch.lead")}</p>

        <div className={`glass ${styles.diagram}`}>
          <div className={styles.flow}>
            {nodes.map((n, i) => (
              <div key={n.id} className={styles.flowItem}>
                <article className={styles.node}>
                  <header className={styles.nodeHead}>
                    <span className={styles.nodeLabel}>{n.label}</span>
                    <span className={styles.nodeSub}>{n.sub}</span>
                  </header>
                  <p className={styles.nodeBody}>{t(n.bodyKey)}</p>
                </article>
                {i < nodes.length - 1 ? (
                  <div className={styles.connector} aria-hidden>
                    <span className={styles.connectorLine} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className={styles.rail}>
            <div className={styles.railCard}>
              <span className={styles.railTitle}>{t("arch.data.title")}</span>
              <p>{t("arch.data.body")}</p>
            </div>
            <div className={styles.railCard}>
              <span className={styles.railTitle}>{t("arch.ship.title")}</span>
              <p>{t("arch.ship.body")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
