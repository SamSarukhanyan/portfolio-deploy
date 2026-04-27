type ConsentState = "granted" | "denied";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const CONSENT_STORAGE_KEY = "analytics_consent_v1";
const GA_SCRIPT_ID = "ga4-script";
const MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim() ?? "";
const IS_PRODUCTION = import.meta.env.PROD;
const DEBUG_MODE = import.meta.env.VITE_GA4_DEBUG_MODE === "true";

let isInitialized = false;

function hasWindow() {
  return typeof window !== "undefined";
}

function isAnalyticsEnabled() {
  return IS_PRODUCTION && MEASUREMENT_ID.length > 0;
}

function getStoredConsent(): ConsentState | null {
  if (!hasWindow()) return null;
  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (value === "granted" || value === "denied") return value;
  return null;
}

export function shouldShowConsentBanner() {
  return isAnalyticsEnabled() && getStoredConsent() === null;
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
}

function loadGaScript() {
  if (document.getElementById(GA_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function setConsent(state: ConsentState) {
  window.gtag("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: state,
  });
}

function gaEvent(name: string, params: Record<string, unknown> = {}) {
  if (!isAnalyticsEnabled() || !isInitialized) return;
  const payload = DEBUG_MODE ? { ...params, debug_mode: true } : params;
  window.gtag("event", name, payload);
}

export function initAnalytics() {
  if (!hasWindow() || !isAnalyticsEnabled() || isInitialized) return;

  ensureGtag();
  loadGaScript();
  const storedConsent = getStoredConsent();

  window.gtag("js", new Date());
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: storedConsent === "granted" ? "granted" : "denied",
  });
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(DEBUG_MODE ? { debug_mode: true } : {}),
  });

  isInitialized = true;
}

export function grantAnalyticsConsent() {
  if (!hasWindow() || !isAnalyticsEnabled()) return;
  initAnalytics();
  setConsent("granted");
  window.localStorage.setItem(CONSENT_STORAGE_KEY, "granted");
  gaEvent("consent_updated", { consent_value: "granted" });
}

export function denyAnalyticsConsent() {
  if (!hasWindow() || !isAnalyticsEnabled()) return;
  initAnalytics();
  setConsent("denied");
  window.localStorage.setItem(CONSENT_STORAGE_KEY, "denied");
}

export function trackPageView(pathname: string) {
  if (!isAnalyticsEnabled() || !isInitialized) return;
  window.gtag("event", "page_view", {
    page_path: pathname,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  gaEvent(name, params);
}
