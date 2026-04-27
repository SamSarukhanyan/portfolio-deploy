import styles from "./Footer.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
import { onSpaLinkClick, usePathname } from "../utils/spaRouter";
import { trackEvent } from "../analytics/ga";

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
              onClick={() => trackEvent("outbound_click", { placement: "footer", target: "github" })}
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
              onClick={() => trackEvent("outbound_click", { placement: "footer", target: "linkedin" })}
            >
              {t("footer.linkLinkedin")}
            </a>
          ) : null}
          <a
            className={styles.link}
            href="/art"
            onClick={(event) => {
              onSpaLinkClick(event, "/art");
              trackEvent("navigation_click", { placement: "footer", target: "art" });
            }}
          >
            {t("footer.linkArt")}
          </a>
          <a
            className={styles.link}
            href={isArtPage ? "/#contact" : "#contact"}
            onClick={(event) => {
              onSpaLinkClick(event, isArtPage ? "/#contact" : "#contact");
              trackEvent("navigation_click", { placement: "footer", target: "contact" });
            }}
          >
            {t("footer.linkContact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
