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
                <svg viewBox="0 0 320 220" className={styles.orbitSvg}>
                  <defs>
                    <linearGradient id="orbitA" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#55c7ff" />
                      <stop offset="100%" stopColor="#71e7c1" />
                    </linearGradient>
                    <linearGradient id="orbitB" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7bc3ff" />
                      <stop offset="100%" stopColor="#c7a5ff" />
                    </linearGradient>
                  </defs>
                  <ellipse cx="160" cy="110" rx="126" ry="56" className={styles.orbitTrack} />
                  <ellipse cx="160" cy="110" rx="86" ry="34" className={styles.orbitTrackInner} />
                  <ellipse cx="160" cy="110" rx="148" ry="72" className={styles.orbitTrackFar} />
                  <ellipse cx="160" cy="110" rx="62" ry="24" className={styles.orbitTrackCore} />
                  <circle cx="160" cy="110" r="18" className={styles.orbitCore} />
                  <circle cx="160" cy="110" r="7" fill="url(#orbitA)" className={styles.orbitDotA} />
                  <circle cx="160" cy="110" r="5" fill="#d5f4ff" className={styles.orbitDotB} />
                  <circle cx="160" cy="110" r="4.2" fill="url(#orbitB)" className={styles.orbitDotC} />
                  <circle cx="160" cy="110" r="3.2" fill="#9ef4db" className={styles.orbitDotD} />
                  <circle cx="160" cy="110" r="2.8" fill="#8acbff" className={styles.orbitDotE} />
                  <circle cx="160" cy="110" r="3.6" fill="#c9b6ff" className={styles.orbitDotF} />
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
