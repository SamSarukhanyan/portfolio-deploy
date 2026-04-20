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

                    <path
                      id="orbit-mercury"
                      d="M 204 120 A 24 14 0 1 1 156 120 A 24 14 0 1 1 204 120"
                    />
                    <path
                      id="orbit-venus"
                      d="M 216 120 A 36 21 0 1 1 144 120 A 36 21 0 1 1 216 120"
                    />
                    <path
                      id="orbit-earth"
                      d="M 230 120 A 50 29 0 1 1 130 120 A 50 29 0 1 1 230 120"
                    />
                    <path
                      id="orbit-mars"
                      d="M 244 120 A 64 37 0 1 1 116 120 A 64 37 0 1 1 244 120"
                    />
                    <path
                      id="orbit-jupiter"
                      d="M 262 120 A 82 47 0 1 1 98 120 A 82 47 0 1 1 262 120"
                    />
                    <path
                      id="orbit-saturn"
                      d="M 282 120 A 102 59 0 1 1 78 120 A 102 59 0 1 1 282 120"
                    />
                    <path
                      id="orbit-uranus"
                      d="M 300 120 A 120 69 0 1 1 60 120 A 120 69 0 1 1 300 120"
                    />
                    <path
                      id="orbit-neptune"
                      d="M 316 120 A 136 78 0 1 1 44 120 A 136 78 0 1 1 316 120"
                    />
                  </defs>

                  <circle cx="180" cy="120" r="26" className={styles.sunHalo} />
                  <circle cx="180" cy="120" r="13" fill="url(#solarSun)" className={styles.sunCore} />

                  <use href="#orbit-mercury" className={`${styles.orbitLine} ${styles.orbitMercury}`} />
                  <use href="#orbit-venus" className={`${styles.orbitLine} ${styles.orbitVenus}`} />
                  <use href="#orbit-earth" className={`${styles.orbitLine} ${styles.orbitEarth}`} />
                  <use href="#orbit-mars" className={`${styles.orbitLine} ${styles.orbitMars}`} />
                  <use href="#orbit-jupiter" className={`${styles.orbitLine} ${styles.orbitJupiter}`} />
                  <use href="#orbit-saturn" className={`${styles.orbitLine} ${styles.orbitSaturn}`} />
                  <use href="#orbit-uranus" className={`${styles.orbitLine} ${styles.orbitUranus}`} />
                  <use href="#orbit-neptune" className={`${styles.orbitLine} ${styles.orbitNeptune}`} />

                  <g className={styles.planetSprite}>
                    <circle r="2.2" fill="#f8dcc2" />
                    <animateMotion dur="4s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-mercury" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="3.3" fill="#f5d3b0" />
                    <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-venus" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="3.7" fill="url(#planetBlue)" />
                    <animateMotion dur="10s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-earth" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="2.9" fill="#e79872" />
                    <animateMotion dur="14.5s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-mars" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="6.3" fill="#d8b08c" />
                    <animateMotion dur="22s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-jupiter" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <ellipse rx="8.2" ry="2.2" className={styles.saturnRing} />
                    <circle r="5.7" fill="#d8c29d" />
                    <animateMotion dur="29s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-saturn" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="4.7" fill="url(#planetGreen)" />
                    <animateMotion dur="35s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-uranus" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="4.5" fill="url(#planetLavender)" />
                    <animateMotion dur="41s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-neptune" />
                    </animateMotion>
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
