import { useEffect, useState, type MouseEvent } from "react";

function isModifiedEvent(event: MouseEvent<HTMLElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

export function navigate(to: string) {
  const url = new URL(to, window.location.origin);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;

  window.history.pushState({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));

  if (url.hash) {
    window.requestAnimationFrame(() => {
      const id = url.hash.replace("#", "");
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } else {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

export function onSpaLinkClick(event: MouseEvent<HTMLElement>, to: string) {
  if (event.button !== 0) return;
  if (isModifiedEvent(event)) return;
  if (!to.startsWith("/")) return;
  event.preventDefault();
  navigate(to);
}

export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return pathname;
}
