import type { Bundles, MessageMap } from "./types.js";

function mergeLocale(base: MessageMap, overlay: MessageMap | undefined): MessageMap {
  if (!overlay) return { ...base };
  return { ...base, ...overlay };
}

export function mergeBundles(base: Bundles, overlay: Partial<Bundles> | null): Bundles {
  return {
    en: mergeLocale(base.en, overlay?.en),
  };
}
