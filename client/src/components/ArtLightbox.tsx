import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import styles from "./ArtLightbox.module.css";
import type { Artwork } from "../content/artworks";

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

type TouchPoint = { x: number; y: number; t: number };
type GestureState = "idle" | "dragging-horizontal" | "dragging-vertical" | "zooming";

const ROOT_ID = "art-lightbox-root";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
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
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [sliderWidth, setSliderWidth] = useState(1);
  const [viewportHeight, setViewportHeight] = useState(0);

  const [zoomActive, setZoomActive] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomX, setZoomX] = useState(0);
  const [zoomY, setZoomY] = useState(0);
  const [zoomUiHidden, setZoomUiHidden] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const naturalSizeRef = useRef<Record<string, { w: number; h: number }>>({});
  const touchSamplesRef = useRef<TouchPoint[]>([]);
  const dragStartRef = useRef<{ x: number; y: number; t: number; baseOffset: number } | null>(null);

  const pinchRef = useRef<{
    distance: number;
    centerX: number;
    centerY: number;
    baseScale: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const panRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);

  const snapRafRef = useRef<number | null>(null);
  const zoomResetRafRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const isDraggingRef = useRef(false);
  const modeRef = useRef<"idle" | "drag" | "snap">("idle");
  const lockedTargetRef = useRef<number | null>(null);
  const gestureStateRef = useRef<GestureState>("idle");
  const backdropTapRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const zoomActiveRef = useRef(false);
  const zoomResettingRef = useRef(false);

  const activeArtwork = artworks[activeIndex];
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < artworks.length - 1;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    zoomActiveRef.current = zoomActive;
  }, [zoomActive]);

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
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    const prevOverflow = document.body.style.overflow;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    const onResize = () => {
      const containerW = viewportRef.current?.getBoundingClientRect().width;
      const visualH = window.visualViewport?.height;
      const width = Math.max(1, containerW ?? window.innerWidth);
      const height = Math.max(1, Math.round(visualH ?? window.innerHeight));
      setSliderWidth(width);
      setViewportHeight(height);
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);

    return () => {
      document.body.classList.remove("art-modal-open");
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      document.body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (zoomActiveRef.current) return;
      const index = activeIndexRef.current;
      if (event.key === "ArrowLeft" && index > 0) onChangeIndex(index - 1);
      if (event.key === "ArrowRight" && index < artworks.length - 1) onChangeIndex(index + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [artworks.length, onChangeIndex, onClose]);

  useEffect(() => {
    return () => {
      if (snapRafRef.current !== null) cancelAnimationFrame(snapRafRef.current);
      if (zoomResetRafRef.current !== null) cancelAnimationFrame(zoomResetRafRef.current);
    };
  }, []);

  function applyTrackOffset(px: number, withTransition: boolean) {
    const precisePx = Number.isFinite(px) ? px : 0;
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = withTransition ? "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)" : "none";
    track.style.transform = `translate3d(${precisePx}px, 0, 0)`;
    if (import.meta.env.DEV) {
      console.debug("[LightboxSlider]", { currentIndex: activeIndexRef.current, translateX: precisePx });
    }
  }

  function getBaseTranslate(index = activeIndexRef.current) {
    return -index * sliderWidth;
  }

  useEffect(() => {
    if (modeRef.current === "idle" && !isDraggingRef.current) {
      applyTrackOffset(getBaseTranslate(activeIndex), false);
    }
  }, [activeIndex, sliderWidth]);

  function stopSliderAnimation() {
    if (snapRafRef.current !== null) cancelAnimationFrame(snapRafRef.current);
    snapRafRef.current = null;
    modeRef.current = "idle";
    lockedTargetRef.current = null;
  }

  function shouldBlockClose() {
    return (
      isDraggingRef.current ||
      modeRef.current !== "idle" ||
      zoomActiveRef.current ||
      zoomResettingRef.current ||
      gestureStateRef.current !== "idle"
    );
  }

  function animateSnapToIndex(targetIndex: number) {
    stopSliderAnimation();
    modeRef.current = "snap";
    lockedTargetRef.current = targetIndex;
    const from = getBaseTranslate(activeIndexRef.current) + dragDeltaRef.current;
    const to = getBaseTranslate(targetIndex);
    const start = performance.now();
    const duration = 240;
    const frame = (now: number) => {
      const p = clamp((now - start) / duration, 0, 1);
      const e = easeOutCubic(p);
      applyTrackOffset(from + (to - from) * e, false);
      if (p < 1) {
        snapRafRef.current = requestAnimationFrame(frame);
      } else {
        snapRafRef.current = null;
        applyTrackOffset(to, false);
        dragDeltaRef.current = 0;
        const lockedTarget = lockedTargetRef.current;
        if (lockedTarget !== null && lockedTarget !== activeIndexRef.current) {
          activeIndexRef.current = lockedTarget;
          onChangeIndex(lockedTarget);
        }
        lockedTargetRef.current = null;
        modeRef.current = "idle";
      }
    };
    snapRafRef.current = requestAnimationFrame(frame);
  }

  function computeVelocity() {
    const now = performance.now();
    const recent = touchSamplesRef.current.filter((p) => now - p.t <= 90);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = Math.max(1, last.t - first.t);
    return (last.x - first.x) / dt;
  }

  function finishSwipe() {
    const width = sliderWidth;
    const velocity = clamp(computeVelocity(), -1.8, 1.8);
    const projectedDrag = dragDeltaRef.current + velocity * 180;
    const progressFromCurrent = projectedDrag / width;

    let target = activeIndexRef.current;
    if ((progressFromCurrent < -0.18 || velocity < -0.42) && canGoNext) {
      target = activeIndexRef.current + 1;
    } else if ((progressFromCurrent > 0.18 || velocity > 0.42) && canGoPrev) {
      target = activeIndexRef.current - 1;
    }
    target = clamp(target, 0, artworks.length - 1);
    animateSnapToIndex(target);
  }

  function handleSliderTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (zoomActive) return;
    if (event.touches.length !== 1) return;
    stopSliderAnimation();
    const t = event.touches[0];
    dragStartRef.current = { x: t.clientX, y: t.clientY, t: performance.now(), baseOffset: getBaseTranslate() };
    touchSamplesRef.current = [{ x: t.clientX, y: t.clientY, t: performance.now() }];
    isDraggingRef.current = false;
    modeRef.current = "idle";
    gestureStateRef.current = "idle";
    dragDeltaRef.current = 0;
  }

  function handleSliderTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (zoomActive) return;
    if (event.touches.length !== 1 || !dragStartRef.current) return;
    const t = event.touches[0];
    const dx = t.clientX - dragStartRef.current.x;
    const dy = t.clientY - dragStartRef.current.y;

    if (gestureStateRef.current === "idle" && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      gestureStateRef.current = Math.abs(dx) > Math.abs(dy) ? "dragging-horizontal" : "dragging-vertical";
    }

    if (gestureStateRef.current === "dragging-vertical") {
      event.preventDefault();
      return;
    }

    if (!isDraggingRef.current && gestureStateRef.current === "dragging-horizontal") {
      isDraggingRef.current = true;
      modeRef.current = "drag";
    }
    if (!isDraggingRef.current) return;

    event.preventDefault();
    const base = dragStartRef.current.baseOffset;
    const rawDelta = dx;
    dragDeltaRef.current = rawDelta;
    if ((!canGoPrev && dx > 0) || (!canGoNext && dx < 0)) {
      applyTrackOffset(base + rawDelta * 0.2, false);
    } else {
      applyTrackOffset(base + rawDelta, false);
    }
    touchSamplesRef.current.push({ x: t.clientX, y: t.clientY, t: performance.now() });
    if (touchSamplesRef.current.length > 10) touchSamplesRef.current.shift();
  }

  function handleSliderTouchEnd() {
    if (zoomActive) return;
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    if (!isDraggingRef.current) {
      dragDeltaRef.current = 0;
      applyTrackOffset(getBaseTranslate(), false);
      gestureStateRef.current = "idle";
      return;
    }
    isDraggingRef.current = false;
    gestureStateRef.current = "idle";
    finishSwipe();
  }

  function baseImageSize() {
    const nat = naturalSizeRef.current[activeArtwork.id];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!nat) return { w: vw, h: vh * 0.7 };
    const fit = Math.min(vw / nat.w, (vh * 0.78) / nat.h);
    return { w: nat.w * fit, h: nat.h * fit };
  }

  function clampZoom(nextScale: number, nextX: number, nextY: number, soft: boolean) {
    const base = baseImageSize();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(0, (base.w * nextScale - vw) / 2);
    const maxY = Math.max(0, (base.h * nextScale - vh) / 2);
    if (!soft) {
      return { x: clamp(nextX, -maxX, maxX), y: clamp(nextY, -maxY, maxY) };
    }
    const damp = (value: number, lim: number) => {
      if (lim <= 0) return 0;
      if (Math.abs(value) <= lim) return value;
      return Math.sign(value) * (lim + (Math.abs(value) - lim) * 0.22);
    };
    return { x: damp(nextX, maxX), y: damp(nextY, maxY) };
  }

  function startZoomFromTouches(t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) {
    setZoomActive(true);
    setZoomUiHidden(true);
    gestureStateRef.current = "zooming";
    const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    pinchRef.current = {
      distance,
      centerX: (t1.clientX + t2.clientX) / 2,
      centerY: (t1.clientY + t2.clientY) / 2,
      baseScale: 1,
      baseX: 0,
      baseY: 0,
    };
    setZoomScale(1);
    setZoomX(0);
    setZoomY(0);
    dragDeltaRef.current = 0;
    applyTrackOffset(getBaseTranslate(), false);
    isDraggingRef.current = false;
  }

  function resetZoomAndClose() {
    if (zoomResetRafRef.current !== null) cancelAnimationFrame(zoomResetRafRef.current);
    zoomResettingRef.current = true;
    const s0 = zoomScale;
    const x0 = zoomX;
    const y0 = zoomY;
    const start = performance.now();
    const duration = 290;
    const frame = (now: number) => {
      const p = clamp((now - start) / duration, 0, 1);
      const e = easeOutCubic(p);
      setZoomScale(s0 + (1 - s0) * e);
      setZoomX(x0 + (0 - x0) * e);
      setZoomY(y0 + (0 - y0) * e);
      if (p < 1) {
        zoomResetRafRef.current = requestAnimationFrame(frame);
      } else {
        zoomResetRafRef.current = null;
        setZoomScale(1);
        setZoomX(0);
        setZoomY(0);
        setZoomUiHidden(false);
        setZoomActive(false);
        zoomResettingRef.current = false;
        gestureStateRef.current = "idle";
      }
    };
    zoomResetRafRef.current = requestAnimationFrame(frame);
  }

  function handleZoomTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (!zoomActive) return;
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]];
      pinchRef.current = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        centerX: (a.clientX + b.clientX) / 2,
        centerY: (a.clientY + b.clientY) / 2,
        baseScale: zoomScale,
        baseX: zoomX,
        baseY: zoomY,
      };
      panRef.current = null;
    } else if (event.touches.length === 1) {
      const t = event.touches[0];
      panRef.current = { x: t.clientX, y: t.clientY, baseX: zoomX, baseY: zoomY };
      pinchRef.current = null;
    }
  }

  function handleZoomTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (!zoomActive) return;
    event.preventDefault();
    if (event.touches.length === 2 && pinchRef.current) {
      const [a, b] = [event.touches[0], event.touches[1]];
      const curDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const p = pinchRef.current;
      const nextScale = clamp(p.baseScale * (curDistance / Math.max(1, p.distance)), 1, 4);
      const cx = (a.clientX + b.clientX) / 2;
      const cy = (a.clientY + b.clientY) / 2;
      const tx = p.baseX + (cx - p.centerX);
      const ty = p.baseY + (cy - p.centerY);
      const bounded = clampZoom(nextScale, tx, ty, true);
      setZoomScale(nextScale);
      setZoomX(bounded.x);
      setZoomY(bounded.y);
      return;
    }
    if (event.touches.length === 1 && panRef.current) {
      const t = event.touches[0];
      const dx = t.clientX - panRef.current.x;
      const dy = t.clientY - panRef.current.y;
      const bounded = clampZoom(zoomScale, panRef.current.baseX + dx, panRef.current.baseY + dy, true);
      setZoomX(bounded.x);
      setZoomY(bounded.y);
    }
  }

  function handleZoomTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    if (!zoomActive) return;
    if (event.touches.length === 0) {
      resetZoomAndClose();
      panRef.current = null;
      pinchRef.current = null;
      return;
    }
    if (event.touches.length === 1) {
      const t = event.touches[0];
      panRef.current = { x: t.clientX, y: t.clientY, baseX: zoomX, baseY: zoomY };
      pinchRef.current = null;
    }
  }

  function onViewportTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (!zoomActive && event.touches.length === 2) {
      startZoomFromTouches(event.touches[0], event.touches[1]);
      return;
    }
    handleSliderTouchStart(event);
  }

  function onBackdropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (shouldBlockClose()) return;
    backdropTapRef.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function onBackdropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const tap = backdropTapRef.current;
    if (!tap) return;
    const dx = event.clientX - tap.x;
    const dy = event.clientY - tap.y;
    if (Math.hypot(dx, dy) > 8) {
      tap.moved = true;
    }
  }

  function onBackdropPointerUp() {
    const tap = backdropTapRef.current;
    backdropTapRef.current = null;
    if (!tap) return;
    if (tap.moved) return;
    if (shouldBlockClose()) return;
    onClose();
  }

  const overlayStyle = {
    height: viewportHeight > 0 ? `${viewportHeight}px` : "100dvh",
    ["--lightbox-vh" as string]: viewportHeight > 0 ? `${viewportHeight}px` : "100dvh",
  } as CSSProperties;

  if (!portalHost) return null;

  return createPortal(
    <div className={styles.overlay} style={overlayStyle} role="dialog" aria-modal="true">
      <div
        className={styles.backdrop}
        onPointerDown={onBackdropPointerDown}
        onPointerMove={onBackdropPointerMove}
        onPointerUp={onBackdropPointerUp}
        onPointerCancel={() => {
          backdropTapRef.current = null;
        }}
      />
      <div className={`${styles.topBar} ${zoomUiHidden ? styles.zoomUiHidden : ""}`}>
        <button className={styles.closeBtn} type="button" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
      <div className={styles.stage} ref={stageRef} onClick={(event) => event.stopPropagation()}>
        <div
          className={styles.viewport}
          ref={viewportRef}
          onTouchStart={onViewportTouchStart}
          onTouchMove={handleSliderTouchMove}
          onTouchEnd={handleSliderTouchEnd}
          onTouchCancel={handleSliderTouchEnd}
        >
          <div className={styles.track} ref={trackRef}>
            {artworks.map((art) => (
              <div className={styles.slide} key={art.id}>
                <img
                  className={styles.slideImg}
                  src={getArtworkSrc(art.filename)}
                  alt={art.title}
                  onLoad={(event) => {
                    naturalSizeRef.current[art.id] = {
                      w: event.currentTarget.naturalWidth || 1,
                      h: event.currentTarget.naturalHeight || 1,
                    };
                  }}
                  onError={(event) => {
                    event.currentTarget.src = fallbackSrc;
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <p className={`${styles.caption} ${zoomUiHidden ? styles.zoomUiHidden : ""}`}>
          {activeArtwork.title} · {activeArtwork.size} · {activeArtwork.medium}
        </p>

        <div className={`${styles.dots} ${zoomUiHidden ? styles.zoomUiHidden : ""}`} aria-label={titleLabel}>
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

        {zoomActive ? (
          <div
            className={styles.zoomLayer}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleZoomTouchStart}
            onTouchMove={handleZoomTouchMove}
            onTouchEnd={handleZoomTouchEnd}
            onTouchCancel={handleZoomTouchEnd}
          >
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
