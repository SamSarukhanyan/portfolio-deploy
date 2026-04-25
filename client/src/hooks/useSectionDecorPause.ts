import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Pauses heavy decorative layer animations when the section is outside the
 * (margin-expanded) viewport, to avoid continuous compositing work offscreen.
 * Does not change layout; animations resume when the section re-enters view.
 */
export function useSectionDecorPause(): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        setPaused(!entry.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: "12% 0px 12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, paused];
}
