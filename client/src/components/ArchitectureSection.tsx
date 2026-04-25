import styles from "./ArchitectureSection.module.css";
import { useSectionDecorPause } from "../hooks/useSectionDecorPause";
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
  const [sectionRef, decorPaused] = useSectionDecorPause();

  return (
    <section
      ref={sectionRef}
      id="architecture"
      className={`section ${styles.section}`}
      data-anim-paused={decorPaused ? "true" : undefined}
    >
      <div className="shell">
        <div className={styles.head}>
          <Reveal as="h2" className="section-title" direction="right">
            {t("arch.title")}
          </Reveal>
          <Reveal className={styles.route} direction="left" delayMs={70} aria-hidden>
            <span className={styles.netSvg} aria-hidden>
              <svg viewBox="0 0 120 72" className={styles.netSvgInner}>
                <path className={styles.netEdgeA} d="M18 52 L60 14 L102 52 Z" fill="none" />
                <path className={styles.netEdgeB} d="M60 14 v38" fill="none" />
                <circle className={styles.netVertexA} cx="18" cy="52" r="4" />
                <circle className={styles.netVertexB} cx="102" cy="52" r="4" />
                <circle className={styles.netVertexC} cx="60" cy="14" r="4" />
                <circle className={styles.netPulse} cx="60" cy="38" r="3" />
              </svg>
            </span>
            <span className={styles.netGlow} />
          </Reveal>
        </div>
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
