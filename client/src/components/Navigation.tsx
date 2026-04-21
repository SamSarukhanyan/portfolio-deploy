import { useEffect, useId, useMemo, useState } from "react";
import styles from "./Navigation.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
import { onSpaLinkClick, usePathname } from "../utils/spaRouter";

export function Navigation() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();
  const isArtPage = pathname.startsWith("/art");

  const links = useMemo(
    () =>
      [
        { href: isArtPage ? "/#highlights" : "#highlights", labelKey: "nav.product" as const },
        { href: isArtPage ? "/#stack" : "#stack", labelKey: "nav.stack" as const },
        { href: isArtPage ? "/#architecture" : "#architecture", labelKey: "nav.architecture" as const },
        { href: isArtPage ? "/#contact" : "#contact", labelKey: "nav.contact" as const },
        { href: "/art", labelKey: "nav.art" as const },
      ] as const,
    [isArtPage],
  );

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={`shell ${styles.navShell} ${styles.inner}`}>
        <a
          className={styles.brand}
          href={isArtPage ? "/" : "#top"}
          onClick={(event) => {
            onSpaLinkClick(event, isArtPage ? "/" : "#top");
            setOpen(false);
          }}
        >
          <span className={styles.brandGlyph} aria-hidden>
            <svg viewBox="0 0 48 48">
              <defs>
                <linearGradient id="navGlyphBg" x1="5" y1="5" x2="43" y2="43" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1f2228" />
                  <stop offset="100%" stopColor="#111418" />
                </linearGradient>
                <linearGradient id="navGlyphLetter" x1="12" y1="10" x2="37" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f2f3f5" />
                  <stop offset="100%" stopColor="#b9bcc2" />
                </linearGradient>
              </defs>
              <rect x="5" y="5" width="38" height="38" rx="10" fill="url(#navGlyphBg)" className={styles.glyphOuter} />
              <text
                x="24"
                y="26"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="url(#navGlyphLetter)"
                className={styles.glyphLetter}
              >
                S
              </text>
            </svg>
          </span>
          <span className={styles.brandTextWrap}>
            <span className={styles.brandText}>{site.displayName}</span>
            <span className={styles.brandSub}>Full-stack product engineer</span>
          </span>
        </a>

        <div className={styles.middle}>
          <nav className={styles.desktop} aria-label={t("nav.ariaPrimary")}>
            <ul className={styles.list}>
              {links.map((l) => (
                <li key={l.href}>
                  <a className={styles.navLink} href={l.href} onClick={(event) => onSpaLinkClick(event, l.href)}>
                    {t(l.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className={styles.end}>
          {!isArtPage ? (
            <a className={styles.mobileArt} href="/art" onClick={(event) => onSpaLinkClick(event, "/art")}>
              {t("nav.art")}
            </a>
          ) : null}
          <a
            className={styles.quickCta}
            href={isArtPage ? "/" : "/art"}
            onClick={(event) => onSpaLinkClick(event, isArtPage ? "/" : "/art")}
          >
            {isArtPage ? t("art.backHome") : t("hero.ctaArt")}
          </a>
          <button
            type="button"
            className={styles.menuBtn}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? t("nav.closeMenu") : t("nav.openMenu")}</span>
            <span className={styles.burger} data-open={open} aria-hidden />
          </button>
        </div>
      </div>

      <div
        id={menuId}
        className={styles.drawer}
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.menuDialog")}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      >
        <div className={styles.drawerPanel} onClick={(e) => e.stopPropagation()}>
          <nav aria-label={t("nav.ariaMobile")}>
            <ul className={styles.drawerList}>
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    className={styles.drawerLink}
                    href={l.href}
                    onClick={(event) => {
                      onSpaLinkClick(event, l.href);
                      setOpen(false);
                    }}
                  >
                    {t(l.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
