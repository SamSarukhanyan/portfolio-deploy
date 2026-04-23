import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from "react";
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
const MAX_ZOOM_SCALE = 4;
const RESET_ANIMATION_MS = 220;

type Point = { x: number; y: number };
type TouchPoint = { identifier: number; clientX: number; clientY: number };
type TouchCollection = { length: number; [index: number]: TouchPoint };

type ZoomLayer = {
  src: string;
  alt: string;
};

type ZoomMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  baseWidth: number;
  baseHeight: number;
};

type ZoomRuntime = {
  mode: "pinch" | "pan";
  metrics: ZoomMetrics;
  startScale: number;
  startX: number;
  startY: number;
  startDistance: number;
  startCenter: Point;
  panStartTouch: Point;
};

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
  const [zoomLayer, setZoomLayer] = useState<ZoomLayer | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);
  const slideImageRefs = useRef<Array<HTMLImageElement | null>>([]);
  const zoomImgRef = useRef<HTMLImageElement | null>(null);
  const zoomRuntimeRef = useRef<ZoomRuntime | null>(null);
  const zoomRafRef = useRef<number | null>(null);
  const resetRafRef = useRef<number | null>(null);
  const pinchTouchIdsRef = useRef<[number, number] | null>(null);
  const isClosingZoomRef = useRef(false);
  const isZoomActiveRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const settledIndexRef = useRef(activeIndex);
  const gestureStartIndexRef = useRef(activeIndex);
  const activeIndexRef = useRef(activeIndex);
  const zoomMotionRef = useRef({
    scale: 1,
    x: 0,
    y: 0,
    targetScale: 1,
    targetX: 0,
    targetY: 0,
  });
  const isZooming = zoomLayer !== null;

  const activeArtwork = artworks[activeIndex];

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  function setBackgroundLock(isLocked: boolean) {
    const swiper = swiperRef.current;
    console.log("swiper locked?", swiper ? !swiper.allowTouchMove : "no-swiper");
    if (swiper) {
      swiper.allowTouchMove = !isLocked;
    }
    if (isLocked) {
      document.body.classList.add("art-zoom-active");
      return;
    }
    document.body.classList.remove("art-zoom-active");
  }

  function clampZoomPan(x: number, y: number, scale: number, metrics: ZoomMetrics) {
    const maxX = Math.max(0, (metrics.baseWidth * scale - metrics.viewportWidth) / 2);
    const maxY = Math.max(0, (metrics.baseHeight * scale - metrics.viewportHeight) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  function applyZoomTransform() {
    zoomRafRef.current = null;
    const zoomImg = zoomImgRef.current;
    if (!zoomImg) return;
    const motion = zoomMotionRef.current;
    motion.scale = motion.targetScale;
    motion.x = motion.targetX;
    motion.y = motion.targetY;
    zoomImg.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0) scale(${motion.scale})`;
  }

  function scheduleTransformFrame() {
    if (zoomRafRef.current !== null) return;
    zoomRafRef.current = window.requestAnimationFrame(applyZoomTransform);
  }

  function cancelZoomFrames() {
    if (zoomRafRef.current !== null) {
      window.cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }
    if (resetRafRef.current !== null) {
      window.cancelAnimationFrame(resetRafRef.current);
      resetRafRef.current = null;
    }
  }

  function resetZoomState() {
    cancelZoomFrames();
    zoomRuntimeRef.current = null;
    pinchTouchIdsRef.current = null;
    isClosingZoomRef.current = false;
    isZoomActiveRef.current = false;
    zoomMotionRef.current = {
      scale: 1,
      x: 0,
      y: 0,
      targetScale: 1,
      targetX: 0,
      targetY: 0,
    };
  }

  function distanceBetweenTouches(touchA: TouchPoint, touchB: TouchPoint) {
    const dx = touchB.clientX - touchA.clientX;
    const dy = touchB.clientY - touchA.clientY;
    return Math.hypot(dx, dy);
  }

  function centerBetweenTouches(touchA: TouchPoint, touchB: TouchPoint): Point {
    return {
      x: (touchA.clientX + touchB.clientX) * 0.5,
      y: (touchA.clientY + touchB.clientY) * 0.5,
    };
  }

  function setZoomTargets(scale: number, x: number, y: number, metrics: ZoomMetrics) {
    const clampedScale = Math.max(1, Math.min(MAX_ZOOM_SCALE, scale));
    const clampedPan = clampZoomPan(x, y, clampedScale, metrics);
    const motion = zoomMotionRef.current;
    motion.targetScale = clampedScale;
    motion.targetX = clampedPan.x;
    motion.targetY = clampedPan.y;
    scheduleTransformFrame();
  }

  function animateResetAndCloseLayer() {
    if (isClosingZoomRef.current) return;
    isClosingZoomRef.current = true;
    isZoomActiveRef.current = false;
    cancelZoomFrames();
    const metrics = zoomRuntimeRef.current?.metrics;
    const start = performance.now();
    const from = { ...zoomMotionRef.current };
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / RESET_ANIMATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      zoomMotionRef.current.targetScale = from.scale + (1 - from.scale) * eased;
      zoomMotionRef.current.targetX = from.x + (0 - from.x) * eased;
      zoomMotionRef.current.targetY = from.y + (0 - from.y) * eased;
      if (metrics) {
        const clamped = clampZoomPan(
          zoomMotionRef.current.targetX,
          zoomMotionRef.current.targetY,
          zoomMotionRef.current.targetScale,
          metrics,
        );
        zoomMotionRef.current.targetX = clamped.x;
        zoomMotionRef.current.targetY = clamped.y;
      }
      applyZoomTransform();
      if (progress < 1) {
        resetRafRef.current = window.requestAnimationFrame(animate);
        return;
      }
      setBackgroundLock(false);
      setZoomLayer(null);
      resetZoomState();
    };
    if (Math.abs(from.scale - 1) < 0.001 && Math.abs(from.x) < 0.01 && Math.abs(from.y) < 0.01) {
      setBackgroundLock(false);
      setZoomLayer(null);
      resetZoomState();
      return;
    }
    resetRafRef.current = window.requestAnimationFrame(animate);
  }

  function beginPan(touch: TouchPoint, runtime: ZoomRuntime) {
    runtime.mode = "pan";
    runtime.startScale = zoomMotionRef.current.scale;
    runtime.startX = zoomMotionRef.current.x;
    runtime.startY = zoomMotionRef.current.y;
    runtime.panStartTouch = { x: touch.clientX, y: touch.clientY };
  }

  function beginPinch(touchA: TouchPoint, touchB: TouchPoint, resetMotion = false) {
    const runtime = zoomRuntimeRef.current;
    if (!runtime) return;
    const initialDistance = distanceBetweenTouches(touchA, touchB);
    if (initialDistance <= 0) return;
    const initialCenter = centerBetweenTouches(touchA, touchB);
    pinchTouchIdsRef.current = [touchA.identifier, touchB.identifier];
    runtime.mode = "pinch";
    if (resetMotion) {
      zoomMotionRef.current.scale = 1;
      zoomMotionRef.current.x = 0;
      zoomMotionRef.current.y = 0;
      zoomMotionRef.current.targetScale = 1;
      zoomMotionRef.current.targetX = 0;
      zoomMotionRef.current.targetY = 0;
      runtime.startScale = 1;
      runtime.startX = 0;
      runtime.startY = 0;
    } else {
      runtime.startScale = zoomMotionRef.current.scale;
      runtime.startX = zoomMotionRef.current.x;
      runtime.startY = zoomMotionRef.current.y;
    }
    runtime.startDistance = initialDistance;
    runtime.startCenter = initialCenter;
  }

  function getTrackedTouchPair(touches: TouchCollection): [TouchPoint, TouchPoint] | null {
    const trackedIds = pinchTouchIdsRef.current;
    if (!trackedIds) return null;
    let touchA: TouchPoint | null = null;
    let touchB: TouchPoint | null = null;
    for (let i = 0; i < touches.length; i += 1) {
      const touch = touches[i];
      if (touch.identifier === trackedIds[0]) {
        touchA = touch;
      } else if (touch.identifier === trackedIds[1]) {
        touchB = touch;
      }
    }
    if (!touchA || !touchB) return null;
    return [touchA, touchB];
  }

  function startZoomLayerFromImage(image: HTMLImageElement, touchA: TouchPoint, touchB: TouchPoint) {
    // Hard lock Swiper before any pinch baseline calculations.
    setBackgroundLock(true);
    resetZoomState();
    const initialDistance = distanceBetweenTouches(touchA, touchB);
    if (initialDistance <= 0) {
      setBackgroundLock(false);
      return false;
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const naturalWidth = Math.max(1, image.naturalWidth || image.clientWidth);
    const naturalHeight = Math.max(1, image.naturalHeight || image.clientHeight);
    const fitRatio = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
    const baseWidth = naturalWidth * fitRatio;
    const baseHeight = naturalHeight * fitRatio;
    zoomRuntimeRef.current = {
      mode: "pinch",
      metrics: {
        viewportWidth,
        viewportHeight,
        baseWidth,
        baseHeight,
      },
      startScale: 1,
      startX: 0,
      startY: 0,
      startDistance: initialDistance,
      startCenter: centerBetweenTouches(touchA, touchB),
      panStartTouch: { x: viewportWidth * 0.5, y: viewportHeight * 0.5 },
    };
    pinchTouchIdsRef.current = [touchA.identifier, touchB.identifier];
    isZoomActiveRef.current = true;
    setZoomLayer({
      src: image.currentSrc || image.src,
      alt: image.alt,
    });
    scheduleTransformFrame();
    return true;
  }

  function handleViewportTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2 || zoomLayer || isZoomActiveRef.current) return;
    const activeImage = slideImageRefs.current[activeIndexRef.current];
    if (!activeImage) return;
    const target = event.target as Node | null;
    if (!target || !activeImage.contains(target)) return;
    const touchA = event.touches[0];
    const touchB = event.touches[1];
    const initialDistance = distanceBetweenTouches(touchA, touchB);
    if (initialDistance <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    const started = startZoomLayerFromImage(activeImage, touchA, touchB);
    if (!started) return;
    beginPinch(touchA, touchB, true);
  }

  function handlePinchTouchesMove(touches: TouchCollection) {
    const runtime = zoomRuntimeRef.current;
    if (!runtime || !isZoomActiveRef.current) return;
    const trackedPair = getTrackedTouchPair(touches);
    if (!trackedPair) return;
    const [touchA, touchB] = trackedPair;
    const center = centerBetweenTouches(touchA, touchB);
    const distance = distanceBetweenTouches(touchA, touchB);
    const pinchRatio = runtime.startDistance > 0 ? distance / runtime.startDistance : 1;
    const nextScale = Math.max(1, Math.min(MAX_ZOOM_SCALE, runtime.startScale * pinchRatio));
    console.log({
      initialDistance: runtime.startDistance,
      newDistance: distance,
      scale: nextScale,
    });
    const viewportCenterX = runtime.metrics.viewportWidth * 0.5;
    const viewportCenterY = runtime.metrics.viewportHeight * 0.5;
    const scaleRatio = runtime.startScale > 0 ? nextScale / runtime.startScale : 1;
    const nextX = runtime.startX + (center.x - runtime.startCenter.x) + (runtime.startCenter.x - viewportCenterX) * (1 - scaleRatio);
    const nextY = runtime.startY + (center.y - runtime.startCenter.y) + (runtime.startCenter.y - viewportCenterY) * (1 - scaleRatio);
    setZoomTargets(nextScale, nextX, nextY, runtime.metrics);
  }

  function handleViewportTouchMoveCapture(event: TouchEvent<HTMLDivElement>) {
    if (!isZoomActiveRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    handlePinchTouchesMove(event.touches);
  }

  function handleViewportTouchEndCapture(event: TouchEvent<HTMLDivElement>) {
    if (!isZoomActiveRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.touches.length >= 2) {
      beginPinch(event.touches[0], event.touches[1]);
      return;
    }
    animateResetAndCloseLayer();
  }

  function handleViewportTouchCancelCapture(event: TouchEvent<HTMLDivElement>) {
    if (!isZoomActiveRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    animateResetAndCloseLayer();
  }

  function handleZoomTouchStart(event: TouchEvent<HTMLDivElement>) {
    const runtime = zoomRuntimeRef.current;
    if (!runtime || !isZoomActiveRef.current) return;
    if (event.touches.length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      beginPinch(event.touches[0], event.touches[1]);
      return;
    }
    if (event.touches.length === 1 && zoomMotionRef.current.scale > 1.001) {
      event.preventDefault();
      event.stopPropagation();
      beginPan(event.touches[0], runtime);
    }
  }

  function handleZoomTouchMove(event: TouchEvent<HTMLDivElement>) {
    const runtime = zoomRuntimeRef.current;
    if (!runtime || !isZoomActiveRef.current) return;
    const trackedPair = getTrackedTouchPair(event.touches);
    if (trackedPair) {
      event.preventDefault();
      event.stopPropagation();
      handlePinchTouchesMove(event.touches);
      return;
    }
    if (event.touches.length === 1 && runtime.mode === "pan" && zoomMotionRef.current.scale > 1.001) {
      event.preventDefault();
      event.stopPropagation();
      const touch = event.touches[0];
      const nextX = runtime.startX + (touch.clientX - runtime.panStartTouch.x);
      const nextY = runtime.startY + (touch.clientY - runtime.panStartTouch.y);
      setZoomTargets(zoomMotionRef.current.scale, nextX, nextY, runtime.metrics);
    }
  }

  function handleZoomTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!zoomRuntimeRef.current || !isZoomActiveRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.touches.length >= 2) {
      const touchA = event.touches[0];
      const touchB = event.touches[1];
      beginPinch(touchA, touchB);
      return;
    }
    animateResetAndCloseLayer();
  }

  function handleZoomTouchCancel() {
    if (!zoomRuntimeRef.current || !isZoomActiveRef.current) return;
    animateResetAndCloseLayer();
  }

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
      const visualH = window.visualViewport?.height;
      const height = Math.max(1, Math.round(visualH ?? window.innerHeight));
      setViewportHeight(height);
    };

    onResize();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);

    return () => {
      setBackgroundLock(false);
      resetZoomState();
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
      if (event.key !== "Escape") return;
      if (zoomLayer) {
        animateResetAndCloseLayer();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, zoomLayer]);

  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    if (swiper.activeIndex === activeIndex) return;
    settledIndexRef.current = activeIndex;
    gestureStartIndexRef.current = activeIndex;
    swiper.slideTo(activeIndex, 0);
  }, [activeIndex]);

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
    <div className={`${styles.overlay} ${isZooming ? styles.zooming : ""}`} style={overlayStyle} role="dialog" aria-modal="true">
      <button className={styles.backdrop} type="button" aria-label={closeLabel} onClick={onClose} />

      <div className={styles.stage} onClick={(event) => event.stopPropagation()}>
        <div
          className={styles.viewport}
          onTouchStartCapture={handleViewportTouchStart}
          onTouchMoveCapture={handleViewportTouchMoveCapture}
          onTouchEndCapture={handleViewportTouchEndCapture}
          onTouchCancelCapture={handleViewportTouchCancelCapture}
        >
          <Swiper
            className={styles.swiper}
            slidesPerView={1}
            slidesPerGroup={1}
            slidesPerGroupSkip={0}
            spaceBetween={0}
            centeredSlides
            roundLengths
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
            allowTouchMove={!isTransitioning && !isZooming}
            touchMoveStopPropagation
            initialSlide={activeIndex}
            onSwiper={(swiper: SwiperType) => {
              swiperRef.current = swiper;
              settledIndexRef.current = activeIndexRef.current;
              gestureStartIndexRef.current = activeIndexRef.current;
            }}
            onTouchStart={(swiper: SwiperType) => {
              if (isTransitioningRef.current) {
                swiper.allowTouchMove = false;
                return;
              }
              if (isZooming) {
                swiper.allowTouchMove = false;
                return;
              }
              swiper.allowTouchMove = true;
              gestureStartIndexRef.current = settledIndexRef.current;
            }}
            onSlideChangeTransitionStart={(swiper: SwiperType) => {
              if (isTransitioningRef.current) return;
              lockTransition();
              const nextIndex = enforceSingleStep(swiper);
              if (nextIndex !== activeIndexRef.current) onChangeIndex(nextIndex);
            }}
            onSlideChangeTransitionEnd={(swiper: SwiperType) => {
              const nextIndex = clampIndex(swiper.activeIndex);
              settledIndexRef.current = nextIndex;
              gestureStartIndexRef.current = nextIndex;
              if (nextIndex !== activeIndexRef.current) onChangeIndex(nextIndex);
              unlockTransition();
            }}
            onTransitionEnd={(swiper: SwiperType) => {
              settledIndexRef.current = clampIndex(swiper.activeIndex);
              unlockTransition();
            }}
          >
            {artworks.map((art, index) => (
              <SwiperSlide className={styles.slide} key={art.id}>
                <div className={styles.slideMedia}>
                  <img
                    className={`${styles.slideImg} ${isZooming && activeIndex === index ? styles.slideImgHidden : ""}`}
                    ref={(node) => {
                      slideImageRefs.current[index] = node;
                    }}
                    src={getArtworkSrc(art.filename)}
                    alt={art.title}
                    onError={(event) => {
                      event.currentTarget.src = fallbackSrc;
                    }}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      <div className={styles.uiLayer}>
        <div className={styles.topBar}>
          <button className={styles.closeBtn} type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>

        <div className={styles.bottomUi}>
          <p className={styles.caption}>
            {activeArtwork.title} · {activeArtwork.size} · {activeArtwork.medium}
          </p>

          <div className={styles.dots} aria-label={titleLabel}>
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
      </div>

      {zoomLayer ? (
        <div
          className={styles.zoomLayer}
          onTouchStart={handleZoomTouchStart}
          onTouchMove={handleZoomTouchMove}
          onTouchEnd={handleZoomTouchEnd}
          onTouchCancel={handleZoomTouchCancel}
        >
          <img ref={zoomImgRef} className={styles.zoomLayerImage} src={zoomLayer.src} alt={zoomLayer.alt} draggable={false} />
        </div>
      ) : null}
    </div>,
    portalHost,
  );
}
