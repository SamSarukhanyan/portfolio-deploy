type AnalyticsPrimitive = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsPrimitive>;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? "";
const isProduction = import.meta.env.PROD;
const isAnalyticsEnabled = isProduction && measurementId.length > 0;
const gaScriptId = "ga4-script";

let isInitialized = false;
let lastTrackedPath: string | null = null;

function canUseBrowserApis() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function ensureGtagBootstrap() {
  if (!canUseBrowserApis()) return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }
}

function ensureGaScript() {
  if (!canUseBrowserApis()) return;
  if (document.getElementById(gaScriptId)) return;

  const script = document.createElement("script");
  script.id = gaScriptId;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

export function initAnalytics() {
  if (!isAnalyticsEnabled || !canUseBrowserApis()) return false;
  if (isInitialized) return true;

  ensureGtagBootstrap();
  ensureGaScript();

  window.gtag?.("js", new Date());
  window.gtag?.("config", measurementId, {
    // Page views are dispatched manually to avoid duplicate tracking in SPA transitions.
    send_page_view: false,
    anonymize_ip: true,
  });

  isInitialized = true;
  return true;
}

function getCurrentPath() {
  if (!canUseBrowserApis()) return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function trackPageView(path = getCurrentPath()) {
  if (!initAnalytics()) return;
  if (path === lastTrackedPath) return;

  window.gtag?.("event", "page_view", {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
  });

  lastTrackedPath = path;
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (!initAnalytics()) return;

  // Privacy note:
  // GA4 tracks anonymous behavior signals (sessions/events/traffic sources),
  // not real personal identity out of the box.
  // Do not pass direct personal identifiers (email, phone, etc.) as event params.
  window.gtag?.("event", eventName, params);
}

