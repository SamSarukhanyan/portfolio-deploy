import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
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

type Point = { x: number; y: number };
type PinchState = { distance: number; centerX: number; centerY: number; baseScale: number; baseX: number; baseY: number };
type TouchSample = { x: number; t: number };

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
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomUiHidden, setZoomUiHidden] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomX, setZoomX] = useState(0);
  const [zoomY, setZoomY] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isTransitioningRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchSamplesRef = useRef<TouchSample[]>([]);
  const dragAxisRef = useRef<"horizontal" | "vertical" | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const zoomActiveRef = useRef(false);
  const zoomScaleRef = useRef(1);
  const zoomXRef = useRef(0);
  const zoomYRef = useRef(0);
  const zoomResettingRef = useRef(false);
  const zoomResetRafRef = useRef<number | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const panRef = useRef<{ start: Point; base: Point } | null>(null);
  const naturalSizeRef = useRef<Record<string, { w: number; h: number }>>({});

  const activeArtwork = artworks[activeIndex];

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  useEffect(() => {
    zoomActiveRef.current = zoomActive;
  }, [zoomActive]);
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
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    setPortalHost(root);
  }, []);

  useEffect(() => {
    const detectZoomCapability = () => {
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const touchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      setZoomEnabled((coarsePointer || touchDevice) && window.innerWidth <= 1024);
    };
    detectZoomCapability();
    window.addEventListener("resize", detectZoomCapability);
    return () => window.removeEventListener("resize", detectZoomCapability);
  }, []);

  useEffect(() => {
    if (zoomEnabled || !zoomActiveRef.current) return;
    setZoomActive(false);
    setZoomUiHidden(false);
    setZoomScale(1);
    setZoomX(0);
    setZoomY(0);
    pinchRef.current = null;
    panRef.current = null;
  }, [zoomEnabled]);

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
      const visualH = window.visualViewport?.height;
      setViewportHeight(Math.max(1, Math.round(visualH ?? window.innerHeight)));
      setViewportWidth(Math.max(1, Math.round(viewportRef.current?.clientWidth ?? window.innerWidth)));
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
    return () => {
      if (zoomResetRafRef.current !== null) cancelAnimationFrame(zoomResetRafRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function lockTransition() {
    isTransitioningRef.current = true;
  }

  function unlockTransition() {
    isTransitioningRef.current = false;
  }

  function clampIndex(index: number) {
    return clamp(index, 0, artworks.length - 1);
  }

  function computeVelocity() {
    const now = performance.now();
    const recent = touchSamplesRef.current.filter((sample) => now - sample.t <= 90);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = Math.max(1, last.t - first.t);
    return (last.x - first.x) / dt;
  }

  function handleSliderTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (zoomActive || isTransitioningRef.current) return;
    if (event.touches.length !== 1) return;
    const t = event.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    touchSamplesRef.current = [{ x: t.clientX, t: performance.now() }];
    dragAxisRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }

  function handleSliderTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (zoomActive || isTransitioningRef.current) return;
    if (event.touches.length !== 1 || !touchStartRef.current) return;
    const t = event.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;

    if (dragAxisRef.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      dragAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (dragAxisRef.current !== "horizontal") return;

    event.preventDefault();
    setIsDragging(true);
    const atFirst = activeIndexRef.current === 0 && dx > 0;
    const atLast = activeIndexRef.current === artworks.length - 1 && dx < 0;
    const adjustedDx = atFirst || atLast ? dx * 0.22 : dx;
    setDragOffset(adjustedDx);
    touchSamplesRef.current.push({ x: t.clientX, t: performance.now() });
    if (touchSamplesRef.current.length > 12) touchSamplesRef.current.shift();
  }

  function finishSliderGesture() {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    dragAxisRef.current = null;
    if (!start || !isDragging) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const velocity = clamp(computeVelocity(), -2, 2);
    const projected = dragOffset + velocity * 160;
    const progress = projected / Math.max(1, viewportWidth);
    let target = activeIndexRef.current;
    if (progress < -0.18) target += 1;
    if (progress > 0.18) target -= 1;
    target = clampIndex(target);

    setIsDragging(false);
    setDragOffset(0);
    if (target !== activeIndexRef.current) {
      lockTransition();
      onChangeIndex(target);
    }
  }

  function baseImageSize() {
    const art = artworks[activeIndexRef.current];
    if (!art) return { w: window.innerWidth, h: window.innerHeight * 0.7 };
    const nat = naturalSizeRef.current[art.id];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!nat) return { w: vw, h: vh * 0.72 };
    const fit = Math.min(vw / nat.w, (vh * 0.78) / nat.h);
    return { w: nat.w * fit, h: nat.h * fit };
  }

  function clampZoomPosition(nextScale: number, nextX: number, nextY: number, soft = true) {
    const base = baseImageSize();
    const maxX = Math.max(0, (base.w * nextScale - window.innerWidth) / 2);
    const maxY = Math.max(0, (base.h * nextScale - window.innerHeight) / 2);
    if (!soft) return { x: clamp(nextX, -maxX, maxX), y: clamp(nextY, -maxY, maxY) };
    const damp = (value: number, limit: number) => {
      if (limit <= 0) return 0;
      if (Math.abs(value) <= limit) return value;
      return Math.sign(value) * (limit + (Math.abs(value) - limit) * 0.22);
    };
    return { x: damp(nextX, maxX), y: damp(nextY, maxY) };
  }

  function openZoomLayer() {
    if (!zoomEnabled || zoomActiveRef.current || zoomResettingRef.current) return;
    setZoomActive(true);
    setZoomUiHidden(true);
    setZoomScale(1);
    setZoomX(0);
    setZoomY(0);
  }

  function resetZoomAndClose() {
    if (!zoomActiveRef.current) return;
    if (zoomResetRafRef.current !== null) cancelAnimationFrame(zoomResetRafRef.current);
    zoomResettingRef.current = true;
    const scaleStart = zoomScaleRef.current;
    const xStart = zoomXRef.current;
    const yStart = zoomYRef.current;
    const start = performance.now();

    const frame = (now: number) => {
      const p = clamp((now - start) / 220, 0, 1);
      const e = easeOutCubic(p);
      setZoomScale(scaleStart + (1 - scaleStart) * e);
      setZoomX(xStart + (0 - xStart) * e);
      setZoomY(yStart + (0 - yStart) * e);
      if (p < 1) {
        zoomResetRafRef.current = requestAnimationFrame(frame);
        return;
      }
      zoomResetRafRef.current = null;
      zoomResettingRef.current = false;
      setZoomScale(1);
      setZoomX(0);
      setZoomY(0);
      setZoomUiHidden(false);
      setZoomActive(false);
      pinchRef.current = null;
      panRef.current = null;
    };

    zoomResetRafRef.current = requestAnimationFrame(frame);
  }

  function startZoomFromPinch(event: ReactTouchEvent<HTMLImageElement>) {
    if (!zoomEnabled || event.touches.length !== 2 || isTransitioningRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    openZoomLayer();
    const a = event.touches[0];
    const b = event.touches[1];
    pinchRef.current = {
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      centerX: (a.clientX + b.clientX) / 2,
      centerY: (a.clientY + b.clientY) / 2,
      baseScale: 1,
      baseX: 0,
      baseY: 0,
    };
    panRef.current = null;
  }

  useEffect(() => {
    if (!zoomActive) return;
    const onTouchStart = (event: TouchEvent) => {
      if (!zoomActiveRef.current) return;
      if (event.touches.length === 2) {
        event.preventDefault();
        const a = event.touches[0];
        const b = event.touches[1];
        pinchRef.current = {
          distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          centerX: (a.clientX + b.clientX) / 2,
          centerY: (a.clientY + b.clientY) / 2,
          baseScale: zoomScaleRef.current,
          baseX: zoomXRef.current,
          baseY: zoomYRef.current,
        };
        panRef.current = null;
      } else if (event.touches.length === 1) {
        const t = event.touches[0];
        panRef.current = { start: { x: t.clientX, y: t.clientY }, base: { x: zoomXRef.current, y: zoomYRef.current } };
        pinchRef.current = null;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!zoomActiveRef.current) return;
      event.preventDefault();
      if (event.touches.length === 2 && pinchRef.current) {
        const a = event.touches[0];
        const b = event.touches[1];
        const p = pinchRef.current;
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const nextScale = clamp(p.baseScale * (distance / Math.max(1, p.distance)), 1, 4);
        const cx = (a.clientX + b.clientX) / 2;
        const cy = (a.clientY + b.clientY) / 2;
        const bounded = clampZoomPosition(nextScale, p.baseX + (cx - p.centerX), p.baseY + (cy - p.centerY), true);
        setZoomScale(nextScale);
        setZoomX(bounded.x);
        setZoomY(bounded.y);
        return;
      }
      if (event.touches.length === 1 && panRef.current) {
        const t = event.touches[0];
        const bounded = clampZoomPosition(
          zoomScaleRef.current,
          panRef.current.base.x + (t.clientX - panRef.current.start.x),
          panRef.current.base.y + (t.clientY - panRef.current.start.y),
          true,
        );
        setZoomX(bounded.x);
        setZoomY(bounded.y);
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!zoomActiveRef.current) return;
      event.preventDefault();
      if (event.touches.length === 0) {
        resetZoomAndClose();
        return;
      }
      if (event.touches.length === 1) {
        const t = event.touches[0];
        panRef.current = { start: { x: t.clientX, y: t.clientY }, base: { x: zoomXRef.current, y: zoomYRef.current } };
        pinchRef.current = null;
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [zoomActive]);

  const overlayStyle = useMemo(
    () =>
      ({
        height: viewportHeight > 0 ? `${viewportHeight}px` : "100dvh",
        ["--lightbox-vh" as string]: viewportHeight > 0 ? `${viewportHeight}px` : "100dvh",
      }) as CSSProperties,
    [viewportHeight],
  );

  const trackStyle = {
    width: `${viewportWidth * artworks.length}px`,
    transform: `translate3d(${-activeIndex * viewportWidth + dragOffset}px, 0, 0)`,
    transition: isDragging ? "none" : "transform 260ms ease",
  } as CSSProperties;

  const slideStyle = {
    width: `${viewportWidth}px`,
    minWidth: `${viewportWidth}px`,
    maxWidth: `${viewportWidth}px`,
    flexBasis: `${viewportWidth}px`,
  } as CSSProperties;

  if (!portalHost || !activeArtwork) return null;

  return createPortal(
    <div className={styles.overlay} style={overlayStyle} role="dialog" aria-modal="true">
      <button className={styles.backdrop} type="button" aria-label={closeLabel} onClick={onClose} />
      <div className={`${styles.topBar} ${zoomUiHidden ? styles.zoomUiHidden : ""}`}>
        <button className={styles.closeBtn} type="button" onClick={onClose}>
          {closeLabel}
        </button>
      </div>

      <div className={styles.stage} onClick={(event) => event.stopPropagation()}>
        <div
          className={styles.viewport}
          ref={viewportRef}
          onTouchStart={handleSliderTouchStart}
          onTouchMove={handleSliderTouchMove}
          onTouchEnd={finishSliderGesture}
          onTouchCancel={finishSliderGesture}
        >
          <div
            className={styles.track}
            style={trackStyle}
            onTransitionEnd={() => {
              unlockTransition();
            }}
          >
            {artworks.map((art, index) => (
              <div className={styles.slide} style={slideStyle} key={art.id}>
                <img
                  className={`${styles.slideImg} ${zoomActive && index === activeIndex ? styles.slideImgHidden : ""}`}
                  src={getArtworkSrc(art.filename)}
                  alt={art.title}
                  onTouchStartCapture={startZoomFromPinch}
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
              onClick={() => {
                if (isTransitioningRef.current || index === activeIndexRef.current) return;
                lockTransition();
                onChangeIndex(index);
              }}
              aria-label={`${index + 1}`}
              aria-current={index === activeIndex ? "true" : "false"}
            />
          ))}
        </div>
      </div>

      {zoomEnabled && zoomActive ? (
        <div className={styles.zoomLayer} onClick={(event) => event.stopPropagation()}>
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
    </div>,
    portalHost,
  );
}
