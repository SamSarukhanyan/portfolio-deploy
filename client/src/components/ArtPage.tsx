import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./ArtPage.module.css";
import { artworks, getArtworkSrc } from "../content/artworks";
import { useI18n } from "../i18n/I18nProvider";

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

export function ArtPage() {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const activeArtwork = useMemo(
    () => (activeIndex === null ? null : artworks[activeIndex] ?? null),
    [activeIndex],
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowRight") setActiveIndex((v) => (v === null ? null : (v + 1) % artworks.length));
      if (event.key === "ArrowLeft") setActiveIndex((v) => (v === null ? null : (v - 1 + artworks.length) % artworks.length));
      if (event.key === "+") setZoom((v) => Math.min(3, Number((v + 0.2).toFixed(2))));
      if (event.key === "-") setZoom((v) => Math.max(1, Number((v - 0.2).toFixed(2))));
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex]);

  function closeModal() {
    setActiveIndex(null);
    setZoom(1);
  }

  function openAt(index: number) {
    setActiveIndex(index);
    setZoom(1);
  }

  function showNext() {
    setActiveIndex((v) => (v === null ? null : (v + 1) % artworks.length));
    setZoom(1);
  }

  function showPrev() {
    setActiveIndex((v) => (v === null ? null : (v - 1 + artworks.length) % artworks.length));
    setZoom(1);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    touchStartX.current = event.clientX;
    touchStartY.current = event.clientY;
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = event.clientX - touchStartX.current;
    const dy = event.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) showNext();
    else showPrev();
  }

  return (
    <section className={`section ${styles.section}`}>
      <div className="shell">
        <div className={`glass ${styles.hero}`}>
          <a href="/" className={styles.backLink}>
            {t("art.backHome")}
          </a>
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
                  <span>{art.year}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {activeArtwork ? (
        <div className={styles.modal} role="dialog" aria-modal="true" onClick={closeModal}>
          <div className={styles.modalTop}>
            <button type="button" onClick={closeModal}>
              {t("art.close")}
            </button>
          </div>
          <div
            className={styles.modalStage}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <button type="button" className={styles.navBtn} onClick={showPrev} aria-label={t("art.prev")}>
              ‹
            </button>
            <figure className={styles.figure}>
              <img
                src={getArtworkSrc(activeArtwork.filename)}
                alt={activeArtwork.title}
                style={{ transform: `scale(${zoom})` }}
                onError={(event) => {
                  event.currentTarget.src = fallbackImage;
                }}
              />
              <figcaption>
                {activeArtwork.title} · {activeArtwork.size} · {activeArtwork.medium} · {activeArtwork.year}
              </figcaption>
            </figure>
            <button type="button" className={styles.navBtn} onClick={showNext} aria-label={t("art.next")}>
              ›
            </button>
          </div>
          <div className={styles.modalControls} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setZoom((v) => Math.max(1, Number((v - 0.2).toFixed(2))))}>
              {t("art.zoomOut")}
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((v) => Math.min(3, Number((v + 0.2).toFixed(2))))}>
              {t("art.zoomIn")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
