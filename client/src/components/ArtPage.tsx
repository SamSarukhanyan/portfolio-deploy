import { memo, useCallback, useEffect, useState } from "react";
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

type ArtworkCardProps = {
  art: (typeof artworks)[number];
  index: number;
  onOpen: (index: number) => void;
  getArtworkSrc: (filename: string) => string;
  fallbackImage: string;
  eagerLoad: boolean;
};

const ArtworkCard = memo(function ArtworkCard({
  art,
  index,
  onOpen,
  getArtworkSrc,
  fallbackImage,
  eagerLoad,
}: ArtworkCardProps) {
  const [imageReady, setImageReady] = useState(false);

  return (
    <article className={`glass ${styles.card}`}>
      <button type="button" className={styles.imageBtn} onClick={() => onOpen(index)}>
        <span className={styles.imageFrame}>
          <span className={imageReady ? styles.skeletonOut : styles.skeleton} aria-hidden />
          <img
            className={imageReady ? styles.imageVisible : styles.imagePending}
            src={getArtworkSrc(art.filename)}
            alt={art.title}
            loading={eagerLoad ? "eager" : "lazy"}
            fetchPriority={eagerLoad ? "high" : "auto"}
            decoding="async"
            onLoad={() => {
              setImageReady(true);
            }}
            onError={(event) => {
              event.currentTarget.src = fallbackImage;
              setImageReady(true);
            }}
          />
        </span>
      </button>
      <div className={styles.meta}>
        <h2>{art.title}</h2>
        <p>
          <span>{art.size}</span>
          <span>{art.medium}</span>
        </p>
      </div>
    </article>
  );
});

export function ArtPage() {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeArtwork = activeIndex === null ? null : artworks[activeIndex] ?? null;

  const openAt = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const closeModal = useCallback(() => {
    setActiveIndex(null);
  }, []);

  useEffect(() => {
    // Preload gallery assets so skeletons disappear almost simultaneously.
    artworks.forEach((art) => {
      const img = new Image();
      img.decoding = "async";
      img.src = getArtworkSrc(art.filename);
    });
  }, []);

  return (
    <section className={`section ${styles.section}`}>
      <div className="shell">
        <div className={styles.hero}>
          <div className={styles.heroHalo} aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={styles.heroHaloSeg} />
            ))}
          </div>
          <div className={styles.heroTop}>
            <a href="/" className={styles.backLink} onClick={(event) => onSpaLinkClick(event, "/")}>
              {t("art.backHome")}
            </a>
            <div className={styles.heroAurora} aria-hidden>
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className={styles.heroAuroraMote} />
              ))}
            </div>
          </div>
          <div className={styles.heroBody}>
            <div className={styles.heroText}>
              <h1 className={styles.title}>{t("art.title")}</h1>
              <p className={styles.lead}>{t("art.lead")}</p>
            </div>
            {artworks.length > 0 ? (
              <div className={styles.heroSlideshow}>
                <span className={styles.slideshowLine} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.slideshowBtn}
                  onClick={() => {
                    openAt(0);
                  }}
                >
                  {t("art.openSlideshow")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.gridFullBleed}>
        <div className={styles.grid}>
          {artworks.map((art, index) => (
            <ArtworkCard
              key={art.id}
              art={art}
              index={index}
              onOpen={openAt}
              getArtworkSrc={getArtworkSrc}
              fallbackImage={fallbackImage}
              eagerLoad={index < 12}
            />
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
