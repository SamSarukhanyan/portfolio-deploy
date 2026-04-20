import { useEffect, useState } from "react";
import styles from "./CookieConsentBanner.module.css";

const STORAGE_KEY = "cookie-consent-v1";

type ConsentState = "accepted" | "rejected" | null;

function readConsent(): ConsentState {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "accepted" || stored === "rejected") return stored;
  return null;
}

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentState>(null);

  useEffect(() => {
    setConsent(readConsent());
  }, []);

  function saveConsent(next: Exclude<ConsentState, null>) {
    window.localStorage.setItem(STORAGE_KEY, next);
    setConsent(next);
    window.dispatchEvent(new CustomEvent("cookie-consent-updated", { detail: { consent: next } }));
  }

  if (consent !== null) return null;

  return (
    <aside className={styles.banner} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p className={styles.text}>
        We only use essential site storage by default. Optional analytics cookies are disabled until you
        accept. See our <a href="#cookie-policy">Cookie Policy</a> and <a href="#privacy-policy">Privacy Policy</a>.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.rejectBtn} onClick={() => saveConsent("rejected")}>
          Reject optional cookies
        </button>
        <button type="button" className={styles.acceptBtn} onClick={() => saveConsent("accepted")}>
          Accept optional cookies
        </button>
      </div>
    </aside>
  );
}
