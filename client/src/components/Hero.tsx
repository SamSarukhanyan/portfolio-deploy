import styles from "./Hero.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";
import { useEffect, useState } from "react";

const focusKeys = ["hero.focus.0", "hero.focus.1", "hero.focus.2", "hero.focus.3"] as const;
const signalKeys = ["hero.signal.0", "hero.signal.1", "hero.signal.2"] as const;

export function Hero() {
  const { t } = useI18n();
  const heroTitle = t("hero.title").replace("Production full-stack", "Production\u00A0full-stack");
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = () => {
      setShowScrollHint(window.scrollY <= 18);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
              <Reveal className={`${styles.codeStream} ${styles.codeStreamMobile}`} direction="up" delayMs={115} aria-hidden>
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
              <Reveal className={`${styles.codeStream} ${styles.codeStreamDesktop}`} direction="up" delayMs={110} aria-hidden>
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
      <div className={styles.scrollHint} data-show={showScrollHint ? "true" : "false"} aria-hidden>
        <span className={styles.scrollHintTrack}>
          <span className={styles.scrollHintHand}>
            <svg className={styles.scrollHintHandSvg} viewBox="0 0 64 64">
              <defs>
                <linearGradient id="handFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(188, 198, 210, 0.86)" />
                  <stop offset="100%" stopColor="rgba(125, 138, 156, 0.74)" />
                </linearGradient>
              </defs>
              <path
                className={styles.scrollHintHandFill}
                d="M26 10c2.4 0 4.4 1.9 4.4 4.3v13.2h2V9.7c0-2.4 2-4.4 4.4-4.4s4.3 2 4.3 4.4v19.8h2.2V14.8c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v19.8h1.4c4.8 0 8.8 3.9 8.8 8.8v1.2c0 11.2-9.1 20.3-20.3 20.3h-7.8c-6.2 0-11.5-4.3-12.7-10.4l-3.3-16.6c-.5-2.3 1-4.6 3.3-5.1 2.4-.5 4.6 1 5.1 3.3l2.1 10.5h1.5V14.3c0-2.4 2-4.3 4.4-4.3Z"
              />
              <path
                className={styles.scrollHintHandStroke}
                d="M26 10c2.4 0 4.4 1.9 4.4 4.3v13.2h2V9.7c0-2.4 2-4.4 4.4-4.4s4.3 2 4.3 4.4v19.8h2.2V14.8c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v19.8h1.4c4.8 0 8.8 3.9 8.8 8.8v1.2c0 11.2-9.1 20.3-20.3 20.3h-7.8c-6.2 0-11.5-4.3-12.7-10.4l-3.3-16.6c-.5-2.3 1-4.6 3.3-5.1 2.4-.5 4.6 1 5.1 3.3l2.1 10.5h1.5V14.3c0-2.4 2-4.3 4.4-4.3Z"
              />
              <circle className={styles.scrollHintFingerTip} cx="26" cy="10" r="3.2" />
            </svg>
          </span>
          <span className={styles.scrollHintTap} />
          <span className={styles.scrollHintRipple} />
          <span className={`${styles.scrollHintRipple} ${styles.scrollHintRippleAlt}`} />
        </span>
      </div>
    </section>
  );
}
