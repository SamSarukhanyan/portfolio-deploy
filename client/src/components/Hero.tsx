import styles from "./Hero.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";

const focusKeys = ["hero.focus.0", "hero.focus.1", "hero.focus.2", "hero.focus.3"] as const;
const signalKeys = ["hero.signal.0", "hero.signal.1", "hero.signal.2"] as const;

export function Hero() {
  const { t } = useI18n();
  const heroTitle = t("hero.title").replace("Production full-stack", "Production\u00A0full-stack");

  return (
    <section id="top" className="section">
      <div className="shell">
        <Reveal className={`glass ${styles.card}`} direction="up">
          <div className={styles.grid}>
            <div className={styles.copy}>
              <Reveal className={styles.domainRow} direction="left">
                <p className={styles.domain}>{site.domain}</p>
                <p className={styles.portfolioTag}>Portfolio</p>
              </Reveal>
              <Reveal className={`${styles.orbit} ${styles.orbitMobile}`} direction="right" delayMs={90} aria-hidden>
                <div className={styles.motionDock}>
                  <div className={styles.miniSolar}>
                    <span className={styles.miniSun} />
                    <span className={styles.miniOrbitOuter}>
                      <span className={styles.miniPlanetOuter} />
                    </span>
                    <span className={styles.miniOrbitInner}>
                      <span className={styles.miniPlanetInner} />
                    </span>
                  </div>
                  <div className={styles.devCore}>
                    <span className={styles.codeTag}>&lt;/&gt;</span>
                    <span className={styles.devRing}>
                      <span className={styles.devDot} />
                    </span>
                  </div>
                  <div className={styles.sectionGlyphs}>
                    <span className={styles.glyphBars}>
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className={styles.glyphStack}>
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className={styles.glyphRoute} />
                    <span className={styles.glyphMail} />
                  </div>
                </div>
              </Reveal>
              <Reveal as="h1" className={styles.title} direction="up" delayMs={60}>
                {heroTitle}
              </Reveal>
              <Reveal as="p" className={styles.subtitle} direction="right" delayMs={100}>
                {t("hero.subtitle")}
              </Reveal>
              <Reveal as="p" className={styles.body} direction="up" delayMs={140}>
                {t("hero.body")}
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
                  <div className={styles.miniSolar}>
                    <span className={styles.miniSun} />
                    <span className={styles.miniOrbitOuter}>
                      <span className={styles.miniPlanetOuter} />
                    </span>
                    <span className={styles.miniOrbitInner}>
                      <span className={styles.miniPlanetInner} />
                    </span>
                  </div>
                  <div className={styles.devCore}>
                    <span className={styles.codeTag}>&lt;/&gt;</span>
                    <span className={styles.devRing}>
                      <span className={styles.devDot} />
                    </span>
                  </div>
                  <div className={styles.sectionGlyphs}>
                    <span className={styles.glyphBars}>
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className={styles.glyphStack}>
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className={styles.glyphRoute} />
                    <span className={styles.glyphMail} />
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
              <Reveal className={styles.codeStream} direction="up" delayMs={160} aria-hidden>
                <div className={styles.codeStreamTop}>
                  <span className={styles.codeDot} />
                  <span className={styles.codeDot} />
                  <span className={styles.codeDot} />
                  <span className={styles.codeLabel}>developer mode</span>
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
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
