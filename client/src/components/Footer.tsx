import styles from "./Footer.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={`shell ${styles.shell}`}>
        <div className={styles.primary}>
          <p className={styles.copy}>
            © {year} · {site.domain}
          </p>
          <p className={styles.tagline}>{t("footer.tagline")}</p>
        </div>
        <nav className={styles.links} aria-label={t("footer.aria")}>
          <a className={styles.link} href="#top">
            Home
          </a>
          <a className={styles.link} href="#highlights">
            Impact
          </a>
          <a className={styles.link} href="#stack">
            Stack
          </a>
          <a className={styles.link} href="#architecture">
            Architecture
          </a>
          {site.githubUrl ? (
            <a className={styles.link} href={site.githubUrl} target="_blank" rel="noreferrer noopener">
              {t("footer.linkGithub")}
            </a>
          ) : null}
          {site.linkedinUrl ? (
            <a className={styles.link} href={site.linkedinUrl} target="_blank" rel="noreferrer noopener">
              {t("footer.linkLinkedin")}
            </a>
          ) : null}
          <a className={styles.link} href="#contact">
            {t("footer.linkContact")}
          </a>
          {site.email ? (
            <a className={styles.link} href={`mailto:${site.email}`}>
              Email
            </a>
          ) : null}
          <a className={styles.link} href="#privacy-policy">
            Privacy
          </a>
          <a className={styles.link} href="#cookie-policy">
            Cookies
          </a>
          <a className={styles.link} href="#gdpr-rights">
            GDPR
          </a>
          <a className={styles.link} href="#terms-of-service">
            Terms
          </a>
          <a className={styles.link} href="#accessibility-statement">
            Accessibility
          </a>
        </nav>
      </div>
    </footer>
  );
}
