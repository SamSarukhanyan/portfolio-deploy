import styles from "./Footer.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className={styles.footer}>
      <div className={`shell ${styles.inner}`}>
        <p className={styles.copy}>© {new Date().getFullYear()} · {site.domain}</p>
        <p className={styles.meta}>{t("footer.meta")}</p>
      </div>
    </footer>
  );
}
