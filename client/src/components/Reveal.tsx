import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Direction = "up" | "left" | "right";

type RevealProps<T extends ElementType = "div"> = {
  as?: T;
  children: ReactNode;
  className?: string;
  direction?: Direction;
  delayMs?: number;
  skipInitialVisibilityCheck?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Reveal<T extends ElementType = "div">({
  as,
  children,
  className,
  direction = "up",
  delayMs = 0,
  skipInitialVisibilityCheck = false,
  style: userStyle,
  ...rest
}: RevealProps<T>) {
  const Component = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const inViewRef = useRef(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    if (typeof window === "undefined") return;

    const enterRatio = 0.1;
    const exitRatio = 0.03;

    const initialRect = target.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    if (!skipInitialVisibilityCheck) {
      const shouldStartVisible =
        initialRect.top < viewportHeight * 0.98 && initialRect.bottom > viewportHeight * 0.02;

      if (shouldStartVisible) {
        inViewRef.current = true;
        setInView(true);
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry.intersectionRatio;
        const isIntersecting = entry.isIntersecting;
        const shouldBeInView = inViewRef.current
          ? isIntersecting && ratio > exitRatio
          : isIntersecting && ratio >= enterRatio;

        if (inViewRef.current !== shouldBeInView) {
          inViewRef.current = shouldBeInView;
          setInView(shouldBeInView);
        }
      },
      {
        root: null,
        threshold: [0, exitRatio, enterRatio, 0.35],
        rootMargin: "0px 0px -2% 0px",
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [skipInitialVisibilityCheck]);

  const mergedClassName = useMemo(
    () => [className, "reveal-item"].filter(Boolean).join(" "),
    [className],
  );

  const style = useMemo(
    () =>
      ({
        ...(userStyle as CSSProperties | undefined),
        "--reveal-delay": `${delayMs}ms`,
      }) as CSSProperties,
    [delayMs, userStyle],
  );

  return (
    <Component
      {...rest}
      ref={ref}
      className={mergedClassName}
      data-reveal-in={inView ? "true" : "false"}
      data-reveal-dir={direction}
      style={style}
    >
      {children}
    </Component>
  );
}
