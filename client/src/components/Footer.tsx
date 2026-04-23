import styles from "./Footer.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
import { onSpaLinkClick, usePathname } from "../utils/spaRouter";
import { trackEvent } from "../lib/analytics";

export function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const pathname = usePathname();
  const isArtPage = pathname.startsWith("/art");

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
            <a
              className={styles.link}
              href={site.githubUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => trackEvent("social_link_click", { source: "footer", network: "github" })}
            >
              {t("footer.linkGithub")}
            </a>
          ) : null}
          {site.linkedinUrl ? (
            <a
              className={styles.link}
              href={site.linkedinUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => trackEvent("social_link_click", { source: "footer", network: "linkedin" })}
            >
              {t("footer.linkLinkedin")}
            </a>
          ) : null}
          <a
            className={styles.link}
            href="/art"
            onClick={(event) => {
              trackEvent("open_art_page", { source: "footer" });
              onSpaLinkClick(event, "/art");
            }}
          >
            {t("footer.linkArt")}
          </a>
          <a
            className={styles.link}
            href={isArtPage ? "/#contact" : "#contact"}
            onClick={(event) => {
              trackEvent("navigate_to_contact", { source: "footer" });
              onSpaLinkClick(event, isArtPage ? "/#contact" : "#contact");
            }}
          >
            {t("footer.linkContact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
