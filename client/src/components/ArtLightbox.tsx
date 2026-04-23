import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
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

const ROOT_ID = "art-lightbox-root";

type Point = {
  x: number;
  y: number;
};

type PinchState = {
  distance: number;
  centerX: number;
  centerY: number;
  baseScale: number;
  baseX: number;
  baseY: number;
};

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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomUiHidden, setZoomUiHidden] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomX, setZoomX] = useState(0);
  const [zoomY, setZoomY] = useState(0);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const swiperRef = useRef<SwiperType | null>(null);
  const isTransitioningRef = useRef(false);
  const settledIndexRef = useRef(activeIndex);
  const gestureStartIndexRef = useRef(activeIndex);
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
      const tabletOrPhoneWidth = window.innerWidth <= 1024;
      setZoomEnabled((coarsePointer || touchDevice) && tabletOrPhoneWidth);
    };
    detectZoomCapability();
    window.addEventListener("resize", detectZoomCapability);
    return () => {
      window.removeEventListener("resize", detectZoomCapability);
    };
  }, []);

  useEffect(() => {
    if (zoomEnabled) return;
    if (!zoomActiveRef.current) return;
    setZoomScale(1);
    setZoomX(0);
    setZoomY(0);
    setZoomUiHidden(false);
    setZoomActive(false);
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
      const height = Math.max(1, Math.round(visualH ?? window.innerHeight));
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
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    if (swiper.activeIndex === activeIndex) return;
    settledIndexRef.current = activeIndex;
    gestureStartIndexRef.current = activeIndex;
    swiper.slideTo(activeIndex, 0);
  }, [activeIndex]);

  useEffect(() => {
    return () => {
      if (zoomResetRafRef.current !== null) {
        cancelAnimationFrame(zoomResetRafRef.current);
      }
    };
  }, []);

  function lockTransition() {
    isTransitioningRef.current = true;
    setIsTransitioning(true);
  }

  function unlockTransition() {
    isTransitioningRef.current = false;
    setIsTransitioning(false);
  }

  function clampIndex(index: number) {
    return Math.max(0, Math.min(artworks.length - 1, index));
  }

  function getSingleStepTarget(fromIndex: number, rawTarget: number) {
    const direction = Math.sign(rawTarget - fromIndex);
    if (direction === 0) return fromIndex;
    return clampIndex(fromIndex + direction);
  }

  function enforceSingleStep(swiper: SwiperType) {
    const fromIndex = gestureStartIndexRef.current;
    const rawTarget = clampIndex(swiper.activeIndex);
    const forcedTarget = getSingleStepTarget(fromIndex, rawTarget);
    if (forcedTarget === rawTarget) return forcedTarget;
    swiper.slideTo(forcedTarget, Number(swiper.params.speed) || 260);
    return forcedTarget;
  }

  function baseImageSize() {
    const art = artworks[activeIndexRef.current];
    if (!art) return { w: window.innerWidth, h: window.innerHeight * 0.7 };
    const nat = naturalSizeRef.current[art.id];
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    if (!nat) return { w: viewportW, h: viewportH * 0.72 };
    const fit = Math.min(viewportW / nat.w, (viewportH * 0.78) / nat.h);
    return { w: nat.w * fit, h: nat.h * fit };
  }

  function clampZoomPosition(nextScale: number, nextX: number, nextY: number, soft = true) {
    const base = baseImageSize();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const maxX = Math.max(0, (base.w * nextScale - viewportW) / 2);
    const maxY = Math.max(0, (base.h * nextScale - viewportH) / 2);
    if (!soft) {
      return {
        x: clamp(nextX, -maxX, maxX),
        y: clamp(nextY, -maxY, maxY),
      };
    }

    const damp = (value: number, limit: number) => {
      if (limit <= 0) return 0;
      if (Math.abs(value) <= limit) return value;
      return Math.sign(value) * (limit + (Math.abs(value) - limit) * 0.22);
    };

    return {
      x: damp(nextX, maxX),
      y: damp(nextY, maxY),
    };
  }

  function openZoomLayer() {
    if (!zoomEnabled) return;
    if (zoomActiveRef.current || zoomResettingRef.current) return;
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
    const duration = 220;

    const frame = (now: number) => {
      const p = clamp((now - start) / duration, 0, 1);
      const e = easeOutCubic(p);
      const nextScale = scaleStart + (1 - scaleStart) * e;
      const nextX = xStart + (0 - xStart) * e;
      const nextY = yStart + (0 - yStart) * e;
      setZoomScale(nextScale);
      setZoomX(nextX);
      setZoomY(nextY);

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
    if (!zoomEnabled) return;
    if (event.touches.length !== 2) return;
    if (isTransitioningRef.current) return;
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

  function handleZoomTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (!zoomActiveRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.touches.length === 2) {
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
      panRef.current = {
        start: { x: t.clientX, y: t.clientY },
        base: { x: zoomXRef.current, y: zoomYRef.current },
      };
      pinchRef.current = null;
    }
  }

  function handleZoomTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (!zoomActiveRef.current) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.touches.length === 2 && pinchRef.current) {
      const a = event.touches[0];
      const b = event.touches[1];
      const currentDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const p = pinchRef.current;
      const nextScale = clamp(p.baseScale * (currentDistance / Math.max(1, p.distance)), 1, 4);
      const centerX = (a.clientX + b.clientX) / 2;
      const centerY = (a.clientY + b.clientY) / 2;
      const offsetX = p.baseX + (centerX - p.centerX);
      const offsetY = p.baseY + (centerY - p.centerY);
      const bounded = clampZoomPosition(nextScale, offsetX, offsetY, true);
      setZoomScale(nextScale);
      setZoomX(bounded.x);
      setZoomY(bounded.y);
      return;
    }

    if (event.touches.length === 1 && panRef.current) {
      const t = event.touches[0];
      const dx = t.clientX - panRef.current.start.x;
      const dy = t.clientY - panRef.current.start.y;
      const nextX = panRef.current.base.x + dx;
      const nextY = panRef.current.base.y + dy;
      const bounded = clampZoomPosition(zoomScaleRef.current, nextX, nextY, true);
      setZoomX(bounded.x);
      setZoomY(bounded.y);
    }
  }

  function handleZoomTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    if (!zoomActiveRef.current) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.touches.length === 0) {
      resetZoomAndClose();
      return;
    }

    if (event.touches.length === 1) {
      const t = event.touches[0];
      panRef.current = {
        start: { x: t.clientX, y: t.clientY },
        base: { x: zoomXRef.current, y: zoomYRef.current },
      };
      pinchRef.current = null;
    }
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
        panRef.current = {
          start: { x: t.clientX, y: t.clientY },
          base: { x: zoomXRef.current, y: zoomYRef.current },
        };
        pinchRef.current = null;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!zoomActiveRef.current) return;
      event.preventDefault();
      if (event.touches.length === 2 && pinchRef.current) {
        const a = event.touches[0];
        const b = event.touches[1];
        const currentDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const p = pinchRef.current;
        const nextScale = clamp(p.baseScale * (currentDistance / Math.max(1, p.distance)), 1, 4);
        const centerX = (a.clientX + b.clientX) / 2;
        const centerY = (a.clientY + b.clientY) / 2;
        const offsetX = p.baseX + (centerX - p.centerX);
        const offsetY = p.baseY + (centerY - p.centerY);
        const bounded = clampZoomPosition(nextScale, offsetX, offsetY, true);
        setZoomScale(nextScale);
        setZoomX(bounded.x);
        setZoomY(bounded.y);
        return;
      }

      if (event.touches.length === 1 && panRef.current) {
        const t = event.touches[0];
        const dx = t.clientX - panRef.current.start.x;
        const dy = t.clientY - panRef.current.start.y;
        const nextX = panRef.current.base.x + dx;
        const nextY = panRef.current.base.y + dy;
        const bounded = clampZoomPosition(zoomScaleRef.current, nextX, nextY, true);
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
        panRef.current = {
          start: { x: t.clientX, y: t.clientY },
          base: { x: zoomXRef.current, y: zoomYRef.current },
        };
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
        <div className={styles.viewport}>
          <Swiper
            className={styles.swiper}
            slidesPerView={1}
            slidesPerGroup={1}
            slidesPerGroupSkip={0}
            spaceBetween={0}
            centeredSlides
            loop={false}
            freeMode={false}
            allowSlideNext
            allowSlidePrev
            resistance
            resistanceRatio={0.85}
            followFinger
            longSwipes
            longSwipesRatio={0.4}
            longSwipesMs={260}
            shortSwipes
            threshold={12}
            speed={260}
            watchOverflow
            preventInteractionOnTransition
            allowTouchMove={!isTransitioning && !(zoomEnabled && zoomActive)}
            touchMoveStopPropagation
            initialSlide={activeIndex}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
              settledIndexRef.current = activeIndexRef.current;
              gestureStartIndexRef.current = activeIndexRef.current;
            }}
            onTouchStart={(swiper) => {
              if (isTransitioningRef.current) {
                swiper.allowTouchMove = false;
                return;
              }
              swiper.allowTouchMove = true;
              gestureStartIndexRef.current = settledIndexRef.current;
            }}
            onSlideChangeTransitionStart={(swiper) => {
              if (isTransitioningRef.current) return;
              lockTransition();
              const nextIndex = enforceSingleStep(swiper);
              if (nextIndex !== activeIndexRef.current) onChangeIndex(nextIndex);
            }}
            onSlideChangeTransitionEnd={(swiper) => {
              const nextIndex = clampIndex(swiper.activeIndex);
              settledIndexRef.current = nextIndex;
              gestureStartIndexRef.current = nextIndex;
              if (nextIndex !== activeIndexRef.current) onChangeIndex(nextIndex);
              unlockTransition();
            }}
            onTransitionEnd={(swiper) => {
              settledIndexRef.current = clampIndex(swiper.activeIndex);
              unlockTransition();
            }}
          >
            {artworks.map((art, index) => (
              <SwiperSlide className={styles.slide} key={art.id}>
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
              </SwiperSlide>
            ))}
          </Swiper>
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
                if (isTransitioningRef.current) return;
                swiperRef.current?.slideTo(index);
              }}
              aria-label={`${index + 1}`}
              aria-current={index === activeIndex ? "true" : "false"}
            />
          ))}
        </div>
      </div>

      {zoomEnabled && zoomActive ? (
        <div
          className={styles.zoomLayer}
          onTouchStart={handleZoomTouchStart}
          onTouchMove={handleZoomTouchMove}
          onTouchEnd={handleZoomTouchEnd}
          onTouchCancel={handleZoomTouchEnd}
          onClick={(event) => {
            event.stopPropagation();
          }}
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
    </div>,
    portalHost,
  );
}
