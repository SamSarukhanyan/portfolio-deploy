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
                    <radialGradient id="solarHalo" cx="50%" cy="50%" r="78%">
                      <stop offset="0%" stopColor="rgba(255, 200, 120, 0.55)" />
                      <stop offset="45%" stopColor="rgba(255, 176, 96, 0.22)" />
                      <stop offset="75%" stopColor="rgba(255, 155, 82, 0.08)" />
                      <stop offset="100%" stopColor="rgba(255, 140, 74, 0)" />
                    </radialGradient>
                    <radialGradient id="solarSun" cx="50%" cy="50%" r="65%">
                      <stop offset="0%" stopColor="#fff8cf" />
                      <stop offset="50%" stopColor="#ffd48e" />
                      <stop offset="100%" stopColor="#ff9f57" />
                    </radialGradient>
                    <radialGradient id="planetMercuryGrad" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#ece9e4" />
                      <stop offset="100%" stopColor="#9e9a96" />
                    </radialGradient>
                    <radialGradient id="planetVenusGrad" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#f8eac1" />
                      <stop offset="100%" stopColor="#cfa86d" />
                    </radialGradient>
                    <radialGradient id="planetEarthGrad" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#bff0ff" />
                      <stop offset="100%" stopColor="#2f82cb" />
                    </radialGradient>
                    <radialGradient id="planetMarsGrad" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#f6b089" />
                      <stop offset="100%" stopColor="#b4543d" />
                    </radialGradient>
                    <linearGradient id="planetJupiterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#e9d4bd" />
                      <stop offset="20%" stopColor="#cda98a" />
                      <stop offset="38%" stopColor="#ddb99a" />
                      <stop offset="56%" stopColor="#c39274" />
                      <stop offset="74%" stopColor="#dfc1a6" />
                      <stop offset="100%" stopColor="#bc8f71" />
                    </linearGradient>
                    <radialGradient id="planetSaturnGrad" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#f0e0b8" />
                      <stop offset="100%" stopColor="#b99967" />
                    </radialGradient>
                    <radialGradient id="planetUranusGrad" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#dbffff" />
                      <stop offset="100%" stopColor="#5ebac8" />
                    </radialGradient>
                    <radialGradient id="planetNeptuneGrad" cx="35%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#bdd8ff" />
                      <stop offset="100%" stopColor="#2c4ea5" />
                    </radialGradient>

                    <path
                      id="orbit-mercury"
                      d="M 206 120 A 26 16 0 1 1 154 120 A 26 16 0 1 1 206 120"
                    />
                    <path
                      id="orbit-venus"
                      d="M 224 120 A 44 26 0 1 1 136 120 A 44 26 0 1 1 224 120"
                    />
                    <path
                      id="orbit-earth"
                      d="M 242 120 A 62 36 0 1 1 118 120 A 62 36 0 1 1 242 120"
                    />
                    <path
                      id="orbit-mars"
                      d="M 260 120 A 80 46 0 1 1 100 120 A 80 46 0 1 1 260 120"
                    />
                    <path
                      id="orbit-jupiter"
                      d="M 280 120 A 100 58 0 1 1 80 120 A 100 58 0 1 1 280 120"
                    />
                    <path
                      id="orbit-saturn"
                      d="M 300 120 A 120 70 0 1 1 60 120 A 120 70 0 1 1 300 120"
                    />
                    <path
                      id="orbit-uranus"
                      d="M 320 120 A 140 82 0 1 1 40 120 A 140 82 0 1 1 320 120"
                    />
                    <path
                      id="orbit-neptune"
                      d="M 340 120 A 160 94 0 1 1 20 120 A 160 94 0 1 1 340 120"
                    />
                  </defs>

                  <circle cx="180" cy="120" r="46" fill="url(#solarHalo)" className={styles.sunHalo} />
                  <circle cx="180" cy="120" r="16" fill="url(#solarSun)" className={styles.sunCore} />

                  <use href="#orbit-mercury" className={`${styles.orbitLine} ${styles.orbitMercury}`} />
                  <use href="#orbit-mercury" className={`${styles.orbitTrail} ${styles.orbitTrailMercury}`} />
                  <use href="#orbit-venus" className={`${styles.orbitLine} ${styles.orbitVenus}`} />
                  <use href="#orbit-venus" className={`${styles.orbitTrail} ${styles.orbitTrailVenus}`} />
                  <use href="#orbit-earth" className={`${styles.orbitLine} ${styles.orbitEarth}`} />
                  <use href="#orbit-earth" className={`${styles.orbitTrail} ${styles.orbitTrailEarth}`} />
                  <use href="#orbit-mars" className={`${styles.orbitLine} ${styles.orbitMars}`} />
                  <use href="#orbit-mars" className={`${styles.orbitTrail} ${styles.orbitTrailMars}`} />
                  <use href="#orbit-jupiter" className={`${styles.orbitLine} ${styles.orbitJupiter}`} />
                  <use href="#orbit-jupiter" className={`${styles.orbitTrail} ${styles.orbitTrailJupiter}`} />
                  <use href="#orbit-saturn" className={`${styles.orbitLine} ${styles.orbitSaturn}`} />
                  <use href="#orbit-saturn" className={`${styles.orbitTrail} ${styles.orbitTrailSaturn}`} />
                  <use href="#orbit-uranus" className={`${styles.orbitLine} ${styles.orbitUranus}`} />
                  <use href="#orbit-uranus" className={`${styles.orbitTrail} ${styles.orbitTrailUranus}`} />
                  <use href="#orbit-neptune" className={`${styles.orbitLine} ${styles.orbitNeptune}`} />
                  <use href="#orbit-neptune" className={`${styles.orbitTrail} ${styles.orbitTrailNeptune}`} />

                  <g className={styles.planetSprite}>
                    <circle r="3.1" fill="url(#planetMercuryGrad)" className={styles.planetStroke} />
                    <animateMotion dur="4s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-mercury" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="4.4" fill="url(#planetVenusGrad)" className={styles.planetStroke} />
                    <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-venus" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="4.9" fill="url(#planetEarthGrad)" className={styles.planetStroke} />
                    <path d="M-2 -2 C 0 -3, 2 -2, 2 0 C 1 1, 0 2, -2 1 Z" className={styles.earthLand} />
                    <path d="M-4 1 C -3 0, -2 0, -1 1 C -2 2, -3 2, -4 1 Z" className={styles.earthLand} />
                    <animateMotion dur="10.5s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-earth" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="4.1" fill="url(#planetMarsGrad)" className={styles.planetStroke} />
                    <animateMotion dur="14.5s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-mars" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="8.8" fill="url(#planetJupiterGrad)" className={styles.planetStroke} />
                    <animateMotion dur="22.5s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-jupiter" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <ellipse rx="11.8" ry="3.2" className={styles.saturnRing} />
                    <circle r="7.1" fill="url(#planetSaturnGrad)" className={styles.planetStroke} />
                    <animateMotion dur="29.5s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-saturn" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="6.2" fill="url(#planetUranusGrad)" className={styles.planetStroke} />
                    <animateMotion dur="35.5s" repeatCount="indefinite" rotate="auto">
                      <mpath href="#orbit-uranus" />
                    </animateMotion>
                  </g>
                  <g className={styles.planetSprite}>
                    <circle r="6" fill="url(#planetNeptuneGrad)" className={styles.planetStroke} />
                    <animateMotion dur="41.5s" repeatCount="indefinite" rotate="auto">
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
