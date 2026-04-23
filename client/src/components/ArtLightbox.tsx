import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { Zoom } from "swiper/modules";
import "swiper/css";
import "swiper/css/zoom";
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
  const [isZooming, setIsZooming] = useState(false);
  const swiperRef = useRef<SwiperType | null>(null);
  const isTransitioningRef = useRef(false);
  const settledIndexRef = useRef(activeIndex);
  const gestureStartIndexRef = useRef(activeIndex);
  const activeIndexRef = useRef(activeIndex);

  const activeArtwork = artworks[activeIndex];

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  function resetZoom(swiper: SwiperType | null) {
    if (!swiper || !swiper.zoom) return;
    if (swiper.zoom.scale <= 1) {
      setIsZooming(false);
      return;
    }
    swiper.zoom.out();
    setIsZooming(false);
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
        <div className={styles.viewport}>
          <Swiper
            className={styles.swiper}
            modules={[Zoom]}
            zoom={{
              maxRatio: 4,
              minRatio: 1,
              toggle: false,
            }}
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
            allowTouchMove={!isTransitioning}
            touchMoveStopPropagation
            initialSlide={activeIndex}
            onSwiper={(swiper: SwiperType) => {
              swiperRef.current = swiper;
              settledIndexRef.current = activeIndexRef.current;
              gestureStartIndexRef.current = activeIndexRef.current;
              swiper.on("zoomChange", (_swiper, scale) => {
                setIsZooming(scale > 1.01);
              });
            }}
            onTouchStart={(swiper: SwiperType) => {
              if (isTransitioningRef.current) {
                swiper.allowTouchMove = false;
                return;
              }
              swiper.allowTouchMove = true;
              gestureStartIndexRef.current = settledIndexRef.current;
            }}
            onSlideChangeTransitionStart={(swiper: SwiperType) => {
              if (isTransitioningRef.current) return;
              resetZoom(swiper);
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
            {artworks.map((art) => (
              <SwiperSlide className={styles.slide} key={art.id}>
                <div
                  className={`${styles.zoomContainer} swiper-zoom-container`}
                  onTouchEndCapture={(event) => {
                    if (event.touches.length === 0) {
                      resetZoom(swiperRef.current);
                    }
                  }}
                  onTouchCancel={() => {
                    resetZoom(swiperRef.current);
                  }}
                >
                  <img
                    className={styles.slideImg}
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
    </div>,
    portalHost,
  );
}
