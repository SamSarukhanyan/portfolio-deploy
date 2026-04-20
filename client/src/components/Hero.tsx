import styles from "./Hero.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
import { Reveal } from "./Reveal";

const focusKeys = ["hero.focus.0", "hero.focus.1", "hero.focus.2", "hero.focus.3"] as const;
const signalKeys = ["hero.signal.0", "hero.signal.1", "hero.signal.2"] as const;

export function Hero() {
  const { t } = useI18n();

  return (
    <section id="top" className="section">
      <div className="shell">
        <Reveal className={`glass ${styles.card}`} direction="up">
          <div className={styles.grid}>
            <div className={styles.copy}>
              <Reveal as="p" className={styles.domain} direction="left">
                {site.domain}
              </Reveal>
              <Reveal className={styles.orbit} direction="right" delayMs={90} aria-hidden>
                <svg viewBox="0 0 360 240" className={styles.orbitSvg}>
                  <defs>
                    <radialGradient id="solarSun" cx="50%" cy="50%" r="65%">
                      <stop offset="0%" stopColor="#fff4b7" />
                      <stop offset="55%" stopColor="#ffd98f" />
                      <stop offset="100%" stopColor="#ffb76a" />
                    </radialGradient>
                    <radialGradient id="planetBlue" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#def4ff" />
                      <stop offset="100%" stopColor="#58b8ff" />
                    </radialGradient>
                    <radialGradient id="planetGreen" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#dbffee" />
                      <stop offset="100%" stopColor="#63d6b0" />
                    </radialGradient>
                    <radialGradient id="planetLavender" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#f5ecff" />
                      <stop offset="100%" stopColor="#b996ff" />
                    </radialGradient>
                  </defs>
                  <circle cx="180" cy="120" r="26" className={styles.sunHalo} />
                  <circle cx="180" cy="120" r="13" fill="url(#solarSun)" className={styles.sunCore} />

                  <ellipse cx="180" cy="120" rx="24" ry="14" className={styles.orbitMercury} />
                  <ellipse cx="180" cy="120" rx="34" ry="20" className={styles.orbitVenus} />
                  <ellipse cx="180" cy="120" rx="46" ry="27" className={styles.orbitEarth} />
                  <ellipse cx="180" cy="120" rx="58" ry="34" className={styles.orbitMars} />
                  <ellipse cx="180" cy="120" rx="76" ry="44" className={styles.orbitJupiter} />
                  <ellipse cx="180" cy="120" rx="96" ry="56" className={styles.orbitSaturn} />
                  <ellipse cx="180" cy="120" rx="116" ry="66" className={styles.orbitUranus} />
                  <ellipse cx="180" cy="120" rx="134" ry="76" className={styles.orbitNeptune} />

                  <g className={styles.planetMercury}>
                    <circle cx="180" cy="120" r="2.3" fill="#f8dcc2" />
                  </g>
                  <g className={styles.planetVenus}>
                    <circle cx="180" cy="120" r="3.4" fill="#f5d3b0" />
                  </g>
                  <g className={styles.planetEarth}>
                    <circle cx="180" cy="120" r="3.8" fill="url(#planetBlue)" />
                  </g>
                  <g className={styles.planetMars}>
                    <circle cx="180" cy="120" r="3" fill="#e79872" />
                  </g>
                  <g className={styles.planetJupiter}>
                    <circle cx="180" cy="120" r="6.5" fill="#d8b08c" />
                  </g>
                  <g className={styles.planetSaturn}>
                    <ellipse cx="180" cy="120" rx="8.2" ry="2.2" className={styles.saturnRing} />
                    <circle cx="180" cy="120" r="5.7" fill="#d8c29d" />
                  </g>
                  <g className={styles.planetUranus}>
                    <circle cx="180" cy="120" r="4.8" fill="url(#planetGreen)" />
                  </g>
                  <g className={styles.planetNeptune}>
                    <circle cx="180" cy="120" r="4.6" fill="url(#planetLavender)" />
                  </g>
                </svg>
              </Reveal>
              <Reveal as="h1" className={styles.title} direction="up" delayMs={60}>
                {t("hero.title")}
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
