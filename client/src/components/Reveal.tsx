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
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Reveal<T extends ElementType = "div">({
  as,
  children,
  className,
  direction = "up",
  delayMs = 0,
  style: userStyle,
  ...rest
}: RevealProps<T>) {
  const Component = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.16,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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
