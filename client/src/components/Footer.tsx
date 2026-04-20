import styles from "./Footer.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const isArtPage = typeof window !== "undefined" && window.location.pathname.startsWith("/art");

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
          <a className={styles.link} href="/art">
            {t("footer.linkArt")}
          </a>
          <a className={styles.link} href={isArtPage ? "/#contact" : "#contact"}>
            {t("footer.linkContact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
