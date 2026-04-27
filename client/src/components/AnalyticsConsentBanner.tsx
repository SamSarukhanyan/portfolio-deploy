import styles from "./AnalyticsConsentBanner.module.css";
import { denyAnalyticsConsent, grantAnalyticsConsent } from "../analytics/ga";

type Props = {
  onResolved: () => void;
};

export function AnalyticsConsentBanner({ onResolved }: Props) {
  return (
    <aside className={styles.banner} role="dialog" aria-live="polite" aria-label="Analytics consent">
      <div className={styles.content}>
        <p className={styles.text}>
          We use privacy-friendly analytics to understand portfolio traffic and interactions. No ads tracking is enabled.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              denyAnalyticsConsent();
              onResolved();
            }}
          >
            Decline
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={() => {
              grantAnalyticsConsent();
              onResolved();
            }}
          >
            Accept analytics
          </button>
        </div>
      </div>
    </aside>
  );
}
