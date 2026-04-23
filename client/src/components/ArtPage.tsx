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
  const [slideDragX, setSlideDragX] = useState(0);
  const [isSlideDragging, setIsSlideDragging] = useState(false);
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
  const slideStart = useRef<{ x: number; y: number } | null>(null);
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
      if (event.key === "ArrowRight") setActiveIndex((v) => (v === null ? null : Math.min(v + 1, artworks.length - 1)));
      if (event.key === "ArrowLeft") setActiveIndex((v) => (v === null ? null : Math.max(v - 1, 0)));
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
    setSlideDragX(0);
    setIsSlideDragging(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    pointersRef.current.clear();
    setGestureActive(false);
  }

  function openAt(index: number) {
    setActiveIndex(index);
    setSlideDragX(0);
    setIsSlideDragging(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setGestureActive(false);
  }

  function goToIndex(nextIndex: number) {
    setActiveIndex(nextIndex);
    setSlideDragX(0);
    setIsSlideDragging(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setGestureActive(false);
  }

  function showNext() {
    if (activeIndex === null) return;
    const next = Math.min(activeIndex + 1, artworks.length - 1);
    goToIndex(next);
  }

  function showPrev() {
    if (activeIndex === null) return;
    const prev = Math.max(activeIndex - 1, 0);
    goToIndex(prev);
  }

  function goToDot(index: number) {
    if (activeIndex === null || activeIndex === index) return;
    goToIndex(index);
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
      slideStart.current = null;
      setSlideDragX(0);
      setIsSlideDragging(false);
      setGestureActive(true);
    } else if (pointersRef.current.size === 1) {
      if (scaleRef.current > 1.01) {
        panStart.current = { x: event.clientX, y: event.clientY };
        panOffsetStart.current = offsetRef.current;
        setGestureActive(true);
      } else {
        slideStart.current = { x: event.clientX, y: event.clientY };
        setSlideDragX(0);
        setIsSlideDragging(false);
        setGestureActive(false);
      }
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
      return;
    }

    if (pointersRef.current.size === 1 && scaleRef.current <= 1.01 && slideStart.current && activeIndex !== null) {
      const dx = event.clientX - slideStart.current.x;
      const dy = event.clientY - slideStart.current.y;

      if (!isSlideDragging && Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy)) {
        setIsSlideDragging(true);
      }
      if (!isSlideDragging) return;

      const atFirst = activeIndex === 0;
      const atLast = activeIndex === artworks.length - 1;
      const withResistance =
        (atFirst && dx > 0) || (atLast && dx < 0)
          ? dx * 0.35
          : dx;
      setSlideDragX(withResistance);
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) {
      if (scaleRef.current > 1.01) {
        settleTransform();
      }
      panStart.current = null;
      pinchStartDistance.current = null;
      pinchStartCenter.current = null;
      slideStart.current = null;
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

    const stageWidth = stageRef.current?.clientWidth ?? window.innerWidth;
    const threshold = Math.max(42, stageWidth * 0.18);

    if (isSlideDragging) {
      const canGoNext = activeIndex !== null && activeIndex < artworks.length - 1;
      const canGoPrev = activeIndex !== null && activeIndex > 0;
      if (slideDragX <= -threshold && canGoNext) showNext();
      else if (slideDragX >= threshold && canGoPrev) showPrev();
      setSlideDragX(0);
      setIsSlideDragging(false);
      return;
    }

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

  const trackStyle = useMemo(
    () =>
      ({
        transform: `translate3d(calc(${-100 * (activeIndex ?? 0)}% + ${slideDragX}px), 0, 0)`,
        transition: isSlideDragging ? "none" : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
      }) as CSSProperties,
    [activeIndex, isSlideDragging, slideDragX],
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
              <div className={styles.carouselViewport}>
                <div className={styles.carouselTrack} style={trackStyle}>
                  {artworks.map((art, index) => (
                    <div className={styles.carouselSlide} key={art.id} aria-hidden={index !== activeIndex}>
                      <img
                        src={getArtworkSrc(art.filename)}
                        alt={art.title}
                        style={index === activeIndex ? imageStyle : undefined}
                        onError={(event) => {
                          event.currentTarget.src = fallbackImage;
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <figcaption data-hidden={hideUi ? "true" : "false"}>
                {activeArtwork.title} · {activeArtwork.size} · {activeArtwork.medium}
              </figcaption>
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
            </figure>
          </div>
        </div>
      ) : null}
    </section>
  );
}
