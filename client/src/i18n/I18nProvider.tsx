import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Bundles, MessageMap } from "./types";
import { interpolate } from "./interpolate";
import defaultJson from "./bundles.default.json";

const defaultBundles = defaultJson as Bundles;

function mergeLocale(base: MessageMap, overlay: MessageMap | undefined): MessageMap {
  if (!overlay) return { ...base };
  return { ...base, ...overlay };
}

function mergeBundles(remote: Partial<Bundles> | null): Bundles {
  return {
    en: mergeLocale(defaultBundles.en, remote?.en),
  };
}

type I18nContextValue = {
  t: (key: string, vars?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function translationsUrl(): string {
  const skip = import.meta.env.VITE_SKIP_SERVER_I18N === "true";
  if (skip) return "";
  const base = import.meta.env.VITE_API_BASE_URL;
  if (typeof base === "string" && base.length > 0) {
    return `${base.replace(/\/$/, "")}/api/translations`;
  }
  return "/api/translations";
}

async function fetchRemoteBundles(url: string): Promise<Partial<Bundles> | null> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as { bundles?: Partial<Bundles> };
  return data.bundles ?? null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [bundles, setBundles] = useState<Bundles>(() => mergeBundles(null));

  useEffect(() => {
    document.documentElement.lang = "en";
  }, []);

  useEffect(() => {
    const url = translationsUrl();
    if (!url) return;

    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchRemoteBundles(url);
        if (cancelled) return;
        setBundles(mergeBundles(remote));
      } catch {
        /* static hosting or API down — keep bundled defaults */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      const raw = bundles.en[key] ?? key;
      return vars ? interpolate(raw, vars) : raw;
    },
    [bundles],
  );

  const value = useMemo(() => ({ t }), [t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
