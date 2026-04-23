import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { Artwork } from "../content/artworks";
import styles from "./ArtLightbox.module.css";

type Point = { x: number; y: number; t: number };
type PointerPoint = { x: number; y: number };

const ROOT_ID = "art-lightbox-root";
const MAX_SCALE = 4;
const MIN_SCALE = 1;

type Props = {
  artworks: Artwork[];
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
  getArtworkSrc: (filename: string) => string;
  fallbackSrc: string;
  closeLabel: string;
  titleLabel: string;
};

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ArtLightbox({
  artworks,
  activeIndex,
  onChangeIndex,
  onClose,
  getArtworkSrc,
  fallbackSrc,
  closeLabel,
  titleLabel,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  const [stageSize, setStageSize] = useState({ w: 1, h: 1 });
  const [offsetX, setOffsetX] = useState(0);
  const [isDraggingSlide, setIsDraggingSlide] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const [zoomScale, setZoomScale] = useState(1);
  const [zoomX, setZoomX] = useState(0);
  const [zoomY, setZoomY] = useState(0);
  const [isZoomResetting, setIsZoomResetting] = useState(false);

  const pointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const slideStartRef = useRef<Point | null>(null);
  const slideSamplesRef = useRef<Point[]>([]);
  const panStartRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);
  const pinchStartRef = useRef<{
    distance: number;
    centerX: number;
    centerY: number;
    baseScale: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const rafInertiaRef = useRef<number | null>(null);
  const rafSnapRef = useRef<number | null>(null);
  const rafZoomResetRef = useRef<number | null>(null);

  const zoomScaleRef = useRef(1);
  const zoomXRef = useRef(0);
  const zoomYRef = useRef(0);
  const offsetXRef = useRef(0);
  const naturalSizeRef = useRef<Record<string, { w: number; h: number }>>({});

  const activeArtwork = artworks[activeIndex];

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < artworks.length - 1;
  const isZoomed = zoomScale > 1.001;

  const viewItems = useMemo(() => {
    const prev = canGoPrev ? artworks[activeIndex - 1] : null;
    const next = canGoNext ? artworks[activeIndex + 1] : null;
    return [
      { key: prev ? `p-${prev.id}` : "p-empty", art: prev, slot: -1 },
      { key: `c-${activeArtwork.id}`, art: activeArtwork, slot: 0 },
      { key: next ? `n-${next.id}` : "n-empty", art: next, slot: 1 },
    ];
  }, [activeArtwork, activeIndex, artworks, canGoNext, canGoPrev]);

  useEffect(() => {
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);
  useEffect(() => {
    zoomXRef.current = zoomX;
  }, [zoomX]);
  useEffect(() => {
    zoomYRef.current = zoomY;
  }, [zoomY]);
  useEffect(() => {
    offsetXRef.current = offsetX;
  }, [offsetX]);

  useEffect(() => {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    setPortalHost(root);
  }, []);

  useEffect(() => {
    document.body.classList.add("art-modal-open");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canGoPrev && !isZoomed) onChangeIndex(activeIndex - 1);
      if (event.key === "ArrowRight" && canGoNext && !isZoomed) onChangeIndex(activeIndex + 1);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.classList.remove("art-modal-open");
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [activeIndex, canGoNext, canGoPrev, isZoomed, onChangeIndex, onClose]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const update = () => setStageSize({ w: Math.max(1, node.clientWidth), h: Math.max(1, node.clientHeight) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafInertiaRef.current !== null) cancelAnimationFrame(rafInertiaRef.current);
      if (rafSnapRef.current !== null) cancelAnimationFrame(rafSnapRef.current);
      if (rafZoomResetRef.current !== null) cancelAnimationFrame(rafZoomResetRef.current);
    };
  }, []);

  function stopSlideAnimations() {
    if (rafInertiaRef.current !== null) cancelAnimationFrame(rafInertiaRef.current);
    if (rafSnapRef.current !== null) cancelAnimationFrame(rafSnapRef.current);
    rafInertiaRef.current = null;
    rafSnapRef.current = null;
  }

  function stopZoomReset() {
    if (rafZoomResetRef.current !== null) cancelAnimationFrame(rafZoomResetRef.current);
    rafZoomResetRef.current = null;
  }

  function calcBaseSize() {
    const natural = naturalSizeRef.current[activeArtwork.id];
    if (!natural) {
      const fallbackW = stageSize.w;
      const fallbackH = Math.min(stageSize.h, stageSize.w * 0.75);
      return { w: fallbackW, h: fallbackH };
    }
    const fit = Math.min(stageSize.w / natural.w, stageSize.h / natural.h);
    return { w: natural.w * fit, h: natural.h * fit };
  }

  function applySoftBound(value: number, limit: number) {
    if (limit <= 0) return 0;
    if (Math.abs(value) <= limit) return value;
    const over = Math.abs(value) - limit;
    return Math.sign(value) * (limit + over * 0.24);
  }

  function clampZoomTranslation(nextX: number, nextY: number, nextScale: number, withRubber: boolean) {
    const base = calcBaseSize();
    const maxX = Math.max(0, (base.w * nextScale - stageSize.w) / 2);
    const maxY = Math.max(0, (base.h * nextScale - stageSize.h) / 2);
    if (withRubber) {
      return {
        x: applySoftBound(nextX, maxX),
        y: applySoftBound(nextY, maxY),
      };
    }
    return {
      x: clamp(nextX, -maxX, maxX),
      y: clamp(nextY, -maxY, maxY),
    };
  }

  function resetZoomSmooth() {
    stopZoomReset();
    const startScale = zoomScaleRef.current;
    const startX = zoomXRef.current;
    const startY = zoomYRef.current;
    if (startScale <= 1.001 && Math.abs(startX) < 0.5 && Math.abs(startY) < 0.5) {
      setZoomScale(1);
      setZoomX(0);
      setZoomY(0);
      setIsZoomResetting(false);
      return;
    }
    setIsZoomResetting(true);
    const duration = 300;
    const start = performance.now();
    const frame = (now: number) => {
      const p = clamp((now - start) / duration, 0, 1);
      const e = easeOutCubic(p);
      setZoomScale(startScale + (1 - startScale) * e);
      setZoomX(startX + (0 - startX) * e);
      setZoomY(startY + (0 - startY) * e);
      if (p < 1) {
        rafZoomResetRef.current = requestAnimationFrame(frame);
      } else {
        setZoomScale(1);
        setZoomX(0);
        setZoomY(0);
        setIsZoomResetting(false);
        rafZoomResetRef.current = null;
      }
    };
    rafZoomResetRef.current = requestAnimationFrame(frame);
  }

  function snapSlide(targetOffset: number, targetIndex: number) {
    stopSlideAnimations();
    const start = performance.now();
    const duration = 260;
    const from = offsetXRef.current;
    setIsSnapping(true);
    const frame = (now: number) => {
      const p = clamp((now - start) / duration, 0, 1);
      const e = easeOutCubic(p);
      setOffsetX(from + (targetOffset - from) * e);
      if (p < 1) {
        rafSnapRef.current = requestAnimationFrame(frame);
      } else {
        setOffsetX(0);
        setIsSnapping(false);
        rafSnapRef.current = null;
        if (targetIndex !== activeIndex) onChangeIndex(targetIndex);
      }
    };
    rafSnapRef.current = requestAnimationFrame(frame);
  }

  function computeVelocity() {
    const now = performance.now();
    const points = slideSamplesRef.current.filter((p) => now - p.t < 90);
    if (points.length < 2) return 0;
    const first = points[0];
    const last = points[points.length - 1];
    const dt = Math.max(1, last.t - first.t);
    return (last.x - first.x) / dt; // px/ms
  }

  function finishSlide() {
    const width = stageSize.w;
    const x0 = offsetXRef.current;
    const v0 = computeVelocity();

    let x = x0;
    let v = v0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.max(8, now - last);
      last = now;

      x += v * dt;
      v *= Math.pow(0.92, dt / 16);

      if ((!canGoPrev && x > 0) || (!canGoNext && x < 0)) {
        x *= 0.72;
        v *= 0.55;
      }

      setOffsetX(x);

      if (Math.abs(v) > 0.03 && Math.abs(x) < width * 1.2) {
        rafInertiaRef.current = requestAnimationFrame(step);
        return;
      }

      rafInertiaRef.current = null;

      let targetIndex = activeIndex;
      if ((x <= -width * 0.24 || v0 <= -0.42) && canGoNext) targetIndex = activeIndex + 1;
      if ((x >= width * 0.24 || v0 >= 0.42) && canGoPrev) targetIndex = activeIndex - 1;

      const targetOffset =
        targetIndex > activeIndex ? -width : targetIndex < activeIndex ? width : 0;
      snapSlide(targetOffset, targetIndex);
    };

    stopSlideAnimations();
    rafInertiaRef.current = requestAnimationFrame(step);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    stopSlideAnimations();
    stopZoomReset();

    const points = Array.from(pointersRef.current.values());
    if (points.length === 2) {
      const [a, b] = points;
      pinchStartRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        centerX: (a.x + b.x) / 2,
        centerY: (a.y + b.y) / 2,
        baseScale: zoomScaleRef.current,
        baseX: zoomXRef.current,
        baseY: zoomYRef.current,
      };
      panStartRef.current = null;
      slideStartRef.current = null;
      setIsDraggingSlide(false);
      return;
    }

    if (zoomScaleRef.current > 1.001) {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        baseX: zoomXRef.current,
        baseY: zoomYRef.current,
      };
      slideStartRef.current = null;
      setIsDraggingSlide(false);
      return;
    }

    slideStartRef.current = { x: event.clientX, y: event.clientY, t: performance.now() };
    slideSamplesRef.current = [{ x: event.clientX, y: event.clientY, t: performance.now() }];
    setIsDraggingSlide(false);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());

    if (points.length === 2 && pinchStartRef.current) {
      const [a, b] = points;
      const nextDistance = Math.hypot(a.x - b.x, a.y - b.y);
      const start = pinchStartRef.current;
      const rawScale = start.baseScale * (nextDistance / Math.max(1, start.distance));
      const nextScale = clamp(rawScale, MIN_SCALE, MAX_SCALE);

      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      const deltaX = centerX - start.centerX;
      const deltaY = centerY - start.centerY;
      const bounded = clampZoomTranslation(start.baseX + deltaX, start.baseY + deltaY, nextScale, true);
      setZoomScale(nextScale);
      setZoomX(bounded.x);
      setZoomY(bounded.y);
      return;
    }

    if (zoomScaleRef.current > 1.001 && panStartRef.current && points.length === 1) {
      const pan = panStartRef.current;
      const dx = event.clientX - pan.x;
      const dy = event.clientY - pan.y;
      const bounded = clampZoomTranslation(pan.baseX + dx, pan.baseY + dy, zoomScaleRef.current, true);
      setZoomX(bounded.x);
      setZoomY(bounded.y);
      return;
    }

    if (!slideStartRef.current || points.length !== 1) return;
    const dx = event.clientX - slideStartRef.current.x;
    const dy = event.clientY - slideStartRef.current.y;

    if (!isDraggingSlide && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      setIsDraggingSlide(true);
    }
    if (!isDraggingSlide) return;

    if ((!canGoPrev && dx > 0) || (!canGoNext && dx < 0)) {
      setOffsetX(0);
      return;
    }
    setOffsetX(dx);
    slideSamplesRef.current.push({ x: event.clientX, y: event.clientY, t: performance.now() });
    if (slideSamplesRef.current.length > 12) slideSamplesRef.current.shift();
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    const remaining = pointersRef.current.size;

    if (remaining === 0) {
      pinchStartRef.current = null;
      panStartRef.current = null;
      slideStartRef.current = null;

      if (zoomScaleRef.current > 1.001 || isZoomResetting) {
        resetZoomSmooth();
        return;
      }

      if (isDraggingSlide) {
        setIsDraggingSlide(false);
        finishSlide();
      } else {
        setOffsetX(0);
      }
      return;
    }

    if (remaining === 1 && zoomScaleRef.current > 1.001) {
      const [point] = Array.from(pointersRef.current.values());
      panStartRef.current = {
        x: point.x,
        y: point.y,
        baseX: zoomXRef.current,
        baseY: zoomYRef.current,
      };
      pinchStartRef.current = null;
    }
  }

  const uiHiddenClass = isZoomed ? styles.zoomUiHidden : "";
  const trackTransition = isDraggingSlide ? "none" : isSnapping ? "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)" : "none";

  if (!portalHost) return null;

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`${styles.topBar} ${uiHiddenClass}`}>
        <button className={styles.closeBtn} type="button" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
      <div
        ref={stageRef}
        className={styles.stage}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={styles.viewport}>
          {viewItems.map((item) => (
            <div
              key={item.key}
              className={styles.slide}
              style={
                {
                  transform: `translate3d(${item.slot * stageSize.w + offsetX}px, 0, 0)`,
                  transition: trackTransition,
                } as CSSProperties
              }
              aria-hidden={item.art?.id !== activeArtwork.id}
            >
              {item.art ? (
                <img
                  className={styles.slideImg}
                  src={getArtworkSrc(item.art.filename)}
                  alt={item.art.title}
                  onLoad={(event) => {
                    naturalSizeRef.current[item.art!.id] = {
                      w: event.currentTarget.naturalWidth || 1,
                      h: event.currentTarget.naturalHeight || 1,
                    };
                  }}
                  onError={(event) => {
                    event.currentTarget.src = fallbackSrc;
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
        <p className={`${styles.caption} ${uiHiddenClass}`}>
          {activeArtwork.title} · {activeArtwork.size} · {activeArtwork.medium}
        </p>
        <div className={`${styles.dots} ${uiHiddenClass}`} aria-label={titleLabel}>
          {artworks.map((art, index) => (
            <button
              key={art.id}
              type="button"
              className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ""}`}
              onClick={() => onChangeIndex(index)}
              aria-label={`${index + 1}`}
              aria-current={index === activeIndex ? "true" : "false"}
            />
          ))}
        </div>

        {isZoomed ? (
          <div className={styles.zoomLayer} aria-hidden>
            <img
              className={styles.zoomImg}
              src={getArtworkSrc(activeArtwork.filename)}
              alt={activeArtwork.title}
              style={{ transform: `translate3d(${zoomX}px, ${zoomY}px, 0) scale(${zoomScale})` }}
              onError={(event) => {
                event.currentTarget.src = fallbackSrc;
              }}
            />
          </div>
        ) : null}
      </div>
    </div>,
    portalHost,
  );
}
