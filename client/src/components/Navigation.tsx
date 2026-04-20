import { useEffect, useId, useMemo, useState } from "react";
import styles from "./Navigation.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
export function Navigation() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const links = useMemo(
    () =>
      [
        { href: "#highlights", labelKey: "nav.product" as const },
        { href: "#stack", labelKey: "nav.stack" as const },
        { href: "#architecture", labelKey: "nav.architecture" as const },
        { href: "#contact", labelKey: "nav.contact" as const },
        { href: "#legal", labelKey: "nav.legal" as const },
      ] as const,
    [],
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
        <a className={styles.brand} href="#top" onClick={() => setOpen(false)}>
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.brandText}>{site.displayName}</span>
        </a>

        <div className={styles.middle}>
          <nav className={styles.desktop} aria-label={t("nav.ariaPrimary")}>
            <ul className={styles.list}>
              {links.map((l) => (
                <li key={l.href}>
                  <a className={styles.navLink} href={l.href}>
                    {t(l.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className={styles.end}>
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
                    onClick={() => setOpen(false)}
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
