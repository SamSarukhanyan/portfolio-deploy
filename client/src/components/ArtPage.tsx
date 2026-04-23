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

const SNAKE_SEGMENTS = 12;

export function ArtPage() {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [settling, setSettling] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const pinchStartCenter = useRef<{ x: number; y: number } | null>(null);
  const pinchStartOffset = useRef({ x: 0, y: 0 });
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

    document.body.classList.add("art-modal-open");
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("art-modal-open");
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex]);

  function closeModal() {
    setActiveIndex(null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    pointersRef.current.clear();
    setGestureActive(false);
  }

  function openAt(index: number) {
    setActiveIndex(index);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setGestureActive(false);
  }

  function showNext() {
    setActiveIndex((v) => (v === null ? null : (v + 1) % artworks.length));
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setGestureActive(false);
  }

  function showPrev() {
    setActiveIndex((v) => (v === null ? null : (v - 1 + artworks.length) % artworks.length));
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setGestureActive(false);
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
      pinchStartCenter.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinchStartOffset.current = offset;
      panStart.current = null;
      setGestureActive(true);
    } else if (pointersRef.current.size === 1 && scale > 1.01) {
      panStart.current = { x: event.clientX, y: event.clientY };
      panOffsetStart.current = offset;
      setGestureActive(true);
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
    const shouldReset = rawScale > 1.01 || Math.abs(rawOffset.x) > 1 || Math.abs(rawOffset.y) > 1;
    if (shouldReset) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      const targetScale = Math.max(1, Math.min(3, rawScale));
      const targetOffset = clampOffset(rawOffset, targetScale);
      setScale(targetScale);
      setOffset(targetOffset);
    }
    window.setTimeout(() => setSettling(false), 180);
    window.setTimeout(() => setGestureActive(false), 200);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const nextDistance = Math.hypot(a.x - b.x, a.y - b.y);
      const startDistance = pinchStartDistance.current ?? nextDistance;
      const nextScale = Math.max(0.82, Math.min(3.4, pinchStartScale.current * (nextDistance / startDistance)));
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const startCenter = pinchStartCenter.current ?? center;
      const dx = center.x - startCenter.x;
      const dy = center.y - startCenter.y;
      setScale(nextScale);
      setOffset({ x: pinchStartOffset.current.x + dx, y: pinchStartOffset.current.y + dy });
      setGestureActive(true);
      return;
    }

    if (pointersRef.current.size === 1 && panStart.current && scale > 1.01) {
      const dx = event.clientX - panStart.current.x;
      const dy = event.clientY - panStart.current.y;
      setOffset({ x: panOffsetStart.current.x + dx, y: panOffsetStart.current.y + dy });
      setGestureActive(true);
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      settleTransform(scale, offset);
      panStart.current = null;
      pinchStartDistance.current = null;
      pinchStartCenter.current = null;
    } else if (pointersRef.current.size === 1 && scale > 1.01) {
      const [point] = Array.from(pointersRef.current.values());
      panStart.current = { x: point.x, y: point.y };
      panOffsetStart.current = offset;
    }

    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = event.clientX - touchStartX.current;
    const dy = event.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (scale > 1.01 || gestureActive) return;
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

  const hideUi = gestureActive || scale > 1.01;

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
        <div className={styles.modal} role="dialog" aria-modal="true" onClick={closeModal}>
          <div className={styles.modalTop} data-hidden={hideUi ? "true" : "false"}>
            <button type="button" onClick={closeModal}>
              {t("art.close")}
            </button>
          </div>
          <div
            ref={stageRef}
            className={styles.modalStage}
            data-zoomed={hideUi ? "true" : "false"}
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
              <figcaption data-hidden={hideUi ? "true" : "false"}>
                {activeArtwork.title} · {activeArtwork.size} · {activeArtwork.medium}
              </figcaption>
            </figure>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navPrev}`}
              data-hidden={hideUi ? "true" : "false"}
              onClick={showPrev}
              aria-label={t("art.prev")}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navNext}`}
              data-hidden={hideUi ? "true" : "false"}
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
