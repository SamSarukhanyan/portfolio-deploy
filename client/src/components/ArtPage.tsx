import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./ArtPage.module.css";
import { artworks, getArtworkSrc } from "../content/artworks";
import { useI18n } from "../i18n/I18nProvider";
import { onSpaLinkClick } from "../utils/spaRouter";

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
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [settling, setSettling] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const panOffsetStart = useRef({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);

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
    setScale(1);
    setOffset({ x: 0, y: 0 });
    pointersRef.current.clear();
  }

  function openAt(index: number) {
    setActiveIndex(index);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function showNext() {
    setActiveIndex((v) => (v === null ? null : (v + 1) % artworks.length));
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function showPrev() {
    setActiveIndex((v) => (v === null ? null : (v - 1 + artworks.length) % artworks.length));
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchStartDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartScale.current = scale;
      panStart.current = null;
    } else if (pointersRef.current.size === 1 && scale > 1.01) {
      panStart.current = { x: event.clientX, y: event.clientY };
      panOffsetStart.current = offset;
    }

    touchStartX.current = event.clientX;
    touchStartY.current = event.clientY;
  }

  function clampOffset(rawOffset: { x: number; y: number }, nextScale: number) {
    const stage = stageRef.current;
    if (!stage || nextScale <= 1) return { x: 0, y: 0 };

    const maxX = (stage.clientWidth * (nextScale - 1)) / 2;
    const maxY = (stage.clientHeight * (nextScale - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, rawOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, rawOffset.y)),
    };
  }

  function settleTransform(rawScale: number, rawOffset: { x: number; y: number }) {
    setSettling(true);
    const targetScale = Math.max(1, Math.min(3, rawScale));
    const targetOffset = clampOffset(rawOffset, targetScale);
    setScale(targetScale);
    setOffset(targetOffset);
    window.setTimeout(() => setSettling(false), 180);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const nextDistance = Math.hypot(a.x - b.x, a.y - b.y);
      const startDistance = pinchStartDistance.current ?? nextDistance;
      const nextScale = Math.max(0.82, Math.min(3.4, pinchStartScale.current * (nextDistance / startDistance)));
      setScale(nextScale);
      return;
    }

    if (pointersRef.current.size === 1 && panStart.current && scale > 1.01) {
      const dx = event.clientX - panStart.current.x;
      const dy = event.clientY - panStart.current.y;
      setOffset(clampOffset({ x: panOffsetStart.current.x + dx, y: panOffsetStart.current.y + dy }, scale));
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      settleTransform(scale, offset);
      panStart.current = null;
      pinchStartDistance.current = null;
    }

    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = event.clientX - touchStartX.current;
    const dy = event.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (scale > 1.01) return;
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) showNext();
    else showPrev();
  }

  const imageStyle = useMemo(
    () =>
      ({
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
        transition: settling ? "transform 0.18s cubic-bezier(0.2, 0.9, 0.35, 1)" : "none",
      }) as CSSProperties,
    [offset.x, offset.y, scale, settling],
  );

  return (
    <section className={`section ${styles.section}`}>
      <div className="shell">
        <div className={`glass ${styles.hero}`}>
          <a href="/" className={styles.backLink} onClick={(event) => onSpaLinkClick(event, "/")}>
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
            ref={stageRef}
            className={styles.modalStage}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <figure className={styles.figure}>
              <img
                src={getArtworkSrc(activeArtwork.filename)}
                alt={activeArtwork.title}
                style={imageStyle}
                onError={(event) => {
                  event.currentTarget.src = fallbackImage;
                }}
              />
              <figcaption>
                {activeArtwork.title} · {activeArtwork.size} · {activeArtwork.medium} · {activeArtwork.year}
              </figcaption>
            </figure>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navPrev}`}
              onClick={showPrev}
              aria-label={t("art.prev")}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navNext}`}
              onClick={showNext}
              aria-label={t("art.next")}
            >
              ›
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
