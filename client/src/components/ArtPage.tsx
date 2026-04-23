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
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | "none">("none");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [settling, setSettling] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
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
  const settleTimeoutRef = useRef<number | null>(null);
  const gestureTimeoutRef = useRef<number | null>(null);

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

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current !== null) window.clearTimeout(settleTimeoutRef.current);
      if (gestureTimeoutRef.current !== null) window.clearTimeout(gestureTimeoutRef.current);
    };
  }, []);

  function closeModal() {
    setActiveIndex(null);
    setSlideDirection("none");
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    pointersRef.current.clear();
    setGestureActive(false);
  }

  function openAt(index: number) {
    setActiveIndex(index);
    setSlideDirection("none");
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setGestureActive(false);
  }

  function goToIndex(nextIndex: number, direction: "next" | "prev" | "none") {
    setSlideDirection(direction);
    setActiveIndex(nextIndex);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setGestureActive(false);
  }

  function showNext() {
    if (activeIndex === null) return;
    const next = (activeIndex + 1) % artworks.length;
    goToIndex(next, "next");
  }

  function showPrev() {
    if (activeIndex === null) return;
    const prev = (activeIndex - 1 + artworks.length) % artworks.length;
    goToIndex(prev, "prev");
  }

  function goToDot(index: number) {
    if (activeIndex === null || activeIndex === index) return;
    goToIndex(index, index > activeIndex ? "next" : "prev");
  }

  function applyTransform(nextScale: number, nextOffset: { x: number; y: number }) {
    scaleRef.current = nextScale;
    offsetRef.current = nextOffset;
    setScale(nextScale);
    setOffset(nextOffset);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchStartDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartScale.current = scaleRef.current;
      pinchStartCenter.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinchStartOffset.current = offsetRef.current;
      panStart.current = null;
      setGestureActive(true);
    } else if (pointersRef.current.size === 1 && scaleRef.current > 1.01) {
      panStart.current = { x: event.clientX, y: event.clientY };
      panOffsetStart.current = offsetRef.current;
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

  function settleTransform() {
    setSettling(true);
    applyTransform(1, { x: 0, y: 0 });
    if (settleTimeoutRef.current !== null) window.clearTimeout(settleTimeoutRef.current);
    if (gestureTimeoutRef.current !== null) window.clearTimeout(gestureTimeoutRef.current);
    settleTimeoutRef.current = window.setTimeout(() => setSettling(false), 220);
    gestureTimeoutRef.current = window.setTimeout(() => setGestureActive(false), 240);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const nextDistance = Math.hypot(a.x - b.x, a.y - b.y);
      const startDistance = pinchStartDistance.current ?? nextDistance;
      const rawScale = pinchStartScale.current * (nextDistance / startDistance);
      const boundedScale = Math.max(1, Math.min(3, rawScale));
      const nextScale = scaleRef.current + (boundedScale - scaleRef.current) * 0.32;
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const startCenter = pinchStartCenter.current ?? center;
      const dx = center.x - startCenter.x;
      const dy = center.y - startCenter.y;
      const unclampedOffset = { x: pinchStartOffset.current.x + dx, y: pinchStartOffset.current.y + dy };
      const nextOffset = clampOffset(unclampedOffset, nextScale);
      applyTransform(nextScale, nextOffset);
      setGestureActive(true);
      return;
    }

    if (pointersRef.current.size === 1 && panStart.current && scaleRef.current > 1.01) {
      const dx = event.clientX - panStart.current.x;
      const dy = event.clientY - panStart.current.y;
      const nextOffset = clampOffset({ x: panOffsetStart.current.x + dx, y: panOffsetStart.current.y + dy }, scaleRef.current);
      applyTransform(scaleRef.current, nextOffset);
      setGestureActive(true);
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      settleTransform();
      panStart.current = null;
      pinchStartDistance.current = null;
      pinchStartCenter.current = null;
    } else if (pointersRef.current.size === 1 && scaleRef.current > 1.01) {
      const [point] = Array.from(pointersRef.current.values());
      panStart.current = { x: point.x, y: point.y };
      panOffsetStart.current = offsetRef.current;
    }

    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = event.clientX - touchStartX.current;
    const dy = event.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (scaleRef.current > 1.01 || gestureActive) return;
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
              <div
                key={`${activeArtwork.id}-${slideDirection}`}
                className={`${styles.figureMedia} ${
                  slideDirection === "next"
                    ? styles.figureMediaNext
                    : slideDirection === "prev"
                      ? styles.figureMediaPrev
                      : ""
                }`}
              >
                <img
                  src={getArtworkSrc(activeArtwork.filename)}
                  alt={activeArtwork.title}
                  style={imageStyle}
                  onError={(event) => {
                    event.currentTarget.src = fallbackImage;
                  }}
                />
              </div>
              <figcaption data-hidden={hideUi ? "true" : "false"}>
                {activeArtwork.title} · {activeArtwork.size} · {activeArtwork.medium}
              </figcaption>
            </figure>
            <div className={styles.dots} data-hidden={hideUi ? "true" : "false"} aria-label={t("art.title")}>
              {artworks.map((art, index) => (
                <button
                  key={art.id}
                  type="button"
                  className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ""}`}
                  onClick={() => goToDot(index)}
                  aria-label={`${index + 1}`}
                  aria-current={index === activeIndex ? "true" : "false"}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
