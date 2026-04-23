import { useState, type CSSProperties } from "react";
import styles from "./ArtPage.module.css";
import { artworks, getArtworkSrc } from "../content/artworks";
import { useI18n } from "../i18n/I18nProvider";
import { onSpaLinkClick } from "../utils/spaRouter";
import { ArtLightbox } from "./ArtLightbox";

const fallbackImage =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1b2434"/>
          <stop offset="100%" stop-color="#263247"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#g)"/>
      <text x="50%" y="48%" fill="#a9b7c9" font-size="54" text-anchor="middle" font-family="Inter, Arial">Add your painting image</text>
      <text x="50%" y="56%" fill="#8091a7" font-size="34" text-anchor="middle" font-family="Inter, Arial">/public/artworks/filename.jpg</text>
    </svg>`,
  );

const SNAKE_SEGMENTS = 12;

export function ArtPage() {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeArtwork = activeIndex === null ? null : artworks[activeIndex] ?? null;

  function openAt(index: number) {
    setActiveIndex(index);
  }

  function closeModal() {
    setActiveIndex(null);
  }

  return (
    <section className={`section ${styles.section}`}>
      <div className="shell">
        <div className={`glass ${styles.hero}`}>
          <div className={styles.heroTop}>
            <a href="/" className={styles.backLink} onClick={(event) => onSpaLinkClick(event, "/")}>
              {t("art.backHome")}
            </a>
            <div className={styles.heroMonoMotion} aria-hidden>
              <span className={styles.shapeCircle} />
              <span className={styles.shapeDiamond} />
              <span className={styles.shapeSnake}>
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
          </div>
          <h1 className={styles.title}>{t("art.title")}</h1>
          <p className={styles.lead}>{t("art.lead")}</p>
        </div>

        <div className={styles.grid}>
          {artworks.map((art, index) => (
            <article key={art.id} className={`glass ${styles.card}`}>
              <button type="button" className={styles.imageBtn} onClick={() => openAt(index)}>
                <img
                  src={getArtworkSrc(art.filename)}
                  alt={art.title}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = fallbackImage;
                  }}
                />
              </button>
              <div className={styles.meta}>
                <h2>{art.title}</h2>
                <p>
                  <span>{art.size}</span>
                  <span>{art.medium}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {activeArtwork ? (
        <ArtLightbox
          artworks={artworks}
          activeIndex={activeIndex!}
          onChangeIndex={setActiveIndex}
          onClose={closeModal}
          getArtworkSrc={getArtworkSrc}
          fallbackSrc={fallbackImage}
          closeLabel={t("art.close")}
          titleLabel={t("art.title")}
        />
      ) : null}
    </section>
  );
}
