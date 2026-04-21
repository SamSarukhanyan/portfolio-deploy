import { type CSSProperties } from "react";
import styles from "./Hero.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";
import { onSpaLinkClick } from "../utils/spaRouter";

const focusKeys = ["hero.focus.0", "hero.focus.1", "hero.focus.2", "hero.focus.3"] as const;
const signalKeys = ["hero.signal.0", "hero.signal.1", "hero.signal.2"] as const;

const SNAKE_SEGMENTS = 12;

function MotionDockSnake() {
  return (
    <div className={styles.heroSnakeCell}>
      <span className={styles.heroSnake} aria-hidden>
        {Array.from({ length: SNAKE_SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={styles.snakeSegRing}
            style={{ ["--i" as string]: String(i) } as CSSProperties}
          >
            <span className={styles.snakeSegDot} />
          </span>
        ))}
      </span>
    </div>
  );
}

export function Hero() {
  const { t } = useI18n();
  const heroTitle = t("hero.title").replace("Production full-stack", "Production\u00A0full-stack");

  return (
    <section id="top" className="section">
      <div className="shell">
        <Reveal className={styles.card} direction="up">
          <div className={styles.grid}>
            <div className={styles.copy}>
              <Reveal className={styles.domainRow} direction="left">
                <p className={styles.domain}>{site.domain}</p>
                <p className={styles.portfolioTag}>Portfolio</p>
              </Reveal>
              <Reveal as="h1" className={styles.title} direction="up" delayMs={60}>
                {heroTitle}
              </Reveal>
              <Reveal className={`${styles.codeStream} ${styles.codeStreamInline}`} direction="up" delayMs={95} aria-hidden>
                <div className={styles.codeStreamTop}>
                  <span className={styles.codeDot} />
                  <span className={styles.codeDot} />
                  <span className={styles.codeDot} />
                  <span className={styles.codeLabel}>Release pipeline</span>
                </div>
                <div className={styles.codeViewport}>
                  <span className={`${styles.codeLine} ${styles.codeLineOne}`}>
                    const deploy = await pipeline.run("production");
                  </span>
                  <span className={`${styles.codeLine} ${styles.codeLineTwo}`}>
                    if (health.ok) pm2.reload("api") &amp;&amp; notify("done");
                  </span>
                  <span className={`${styles.codeLine} ${styles.codeLineThree}`}>
                    security.headers.enable(); tls.renew(); logs.stream();
                  </span>
                </div>
              </Reveal>
              <Reveal className={styles.heroArtRow} direction="up" delayMs={102}>
                <span className={styles.heroArtLabel}>My art link</span>
                <a className={styles.heroArtLink} href="/art" onClick={(event) => onSpaLinkClick(event, "/art")}>
                  {t("hero.ctaArt")}
                </a>
              </Reveal>
              <Reveal as="p" className={styles.summary} direction="up" delayMs={110}>
                {t("hero.summary")}
              </Reveal>
              <ul className={styles.focusList}>
                {focusKeys.map((key, idx) => (
                  <Reveal
                    key={key}
                    as="li"
                    direction={idx % 2 === 0 ? "left" : "right"}
                    delayMs={180 + idx * 40}
                  >
                    {t(key)}
                  </Reveal>
                ))}
              </ul>
              <Reveal className={styles.actions} direction="up" delayMs={260}>
                <a className="btn-primary" href="#contact">
                  {t("hero.ctaContact")}
                </a>
                <a className="btn-ghost" href="#highlights">
                  {t("hero.ctaHighlights")}
                </a>
              </Reveal>
            </div>
            <div className={styles.visual} aria-hidden>
              <Reveal className={`${styles.orbit} ${styles.orbitDesktop}`} direction="right" delayMs={90}>
                <div className={styles.motionDock}>
                  <MotionDockSnake />
                  <div className={styles.devCore}>
                    <span className={styles.coreBloom}>
                      <span className={styles.bloomRing} />
                      <span className={styles.bloomRing} />
                      <span className={styles.bloomRing} />
                      <span className={styles.bloomCenter} aria-hidden>
                        <span className={styles.logoChip}>
                          <span className={styles.logoNode} />
                          <span className={styles.logoNode} />
                          <span className={styles.logoNode} />
                        </span>
                      </span>
                    </span>
                  </div>
                </div>
              </Reveal>
              <Reveal className={styles.signalPanel} direction="right" delayMs={120}>
                <Reveal as="p" className={styles.signalTitle} direction="up">
                  {t("hero.signalTitle")}
                </Reveal>
                <ul className={styles.signalList}>
                  {signalKeys.map((key, idx) => (
                    <Reveal
                      key={key}
                      as="li"
                      direction="right"
                      delayMs={140 + idx * 40}
                    >
                      {t(key)}
                    </Reveal>
                  ))}
                </ul>
                <Reveal as="p" className={styles.signalNote} direction="up" delayMs={260}>
                  {t("hero.signalNote")}
                </Reveal>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
