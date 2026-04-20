import styles from "./ContactSection.module.css";
import { site } from "../config/site";
import { useI18n } from "../i18n/I18nProvider";
import type { MouseEvent } from "react";
import { Reveal } from "./Reveal";

type Social = { label: string; href: string; icon: "gh" | "in" | "tg" };

function Icon({ kind }: { kind: Social["icon"] }) {
  const common = { width: 22, height: 22, fill: "currentColor" as const };
  if (kind === "gh") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...common}>
        <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.17-1.11-1.48-1.11-1.48-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85.004 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.48A10.01 10.01 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
      </svg>
    );
  }
  if (kind === "in") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...common}>
        <path d="M6.94 6.5a1.63 1.63 0 1 1 0-3.26 1.63 1.63 0 0 1 0 3.26ZM2.5 20.5h8.88V9H2.5v11.5ZM12.81 9h8.5v1.9h.12c1.18-2.24 4.07-2.6 5.32-.55 1.12 1.86 1.06 8.15 1.06 8.15H19.9s.07-6.5-1.44-6.5c-1.45 0-1.73 1.7-1.73 2.73v4.77h-4.92V9Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...common}>
      <path d="M21.92 5.62 12.35 20.38c-.14.23-.45.24-.6.02l-2.45-3.55-4.9 2.27a.38.38 0 0 1-.57-.35l1.15-5.7L2.08 9.9a.38.38 0 0 1 .22-.68l18.5-1.12c.33-.02.52.37.32.62Z" />
    </svg>
  );
}

export function ContactSection() {
  const { t } = useI18n();
  const socials: Social[] = [
    site.githubUrl ? { label: "GitHub", href: site.githubUrl, icon: "gh" } : null,
    site.linkedinUrl ? { label: "LinkedIn", href: site.linkedinUrl, icon: "in" } : null,
    site.telegramUrl ? { label: "Telegram", href: site.telegramUrl, icon: "tg" } : null,
  ].filter(Boolean) as Social[];

  const hasEmail = site.email.trim().length > 0;
  const mailtoUrl = hasEmail ? `mailto:${site.email}` : "";
  const gmailWebComposeUrl = hasEmail
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(site.email)}`
    : "";
  const gmailAppComposeUrl = hasEmail
    ? `googlegmail:///co?to=${encodeURIComponent(site.email)}`
    : "";

  function openEmailClient(event: MouseEvent<HTMLAnchorElement>) {
    if (!hasEmail) return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      event.preventDefault();
      const opened = window.open(gmailWebComposeUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        window.location.href = mailtoUrl;
      }
      return;
    }

    event.preventDefault();

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // iOS: never schedule mailto after Gmail — Cancel on the system sheet still
    // leaves the page visible, so a delayed mailto incorrectly opens Mail/Gmail.
    if (isIOS) {
      window.location.href = gmailAppComposeUrl;
      return;
    }

    // Android: optional mailto fallback after a short delay if the app handoff fails.
    const fallback = window.setTimeout(() => {
      window.location.href = mailtoUrl;
    }, 900);

    const cancelFallback = () => {
      if (document.hidden) {
        window.clearTimeout(fallback);
        document.removeEventListener("visibilitychange", cancelFallback);
      }
    };

    document.addEventListener("visibilitychange", cancelFallback);
    window.location.href = gmailAppComposeUrl;
  }

  return (
    <section id="contact" className={`section ${styles.section}`}>
      <div className="shell">
        <Reveal className={`glass ${styles.card}`} direction="up">
          <div className={styles.layout}>
            <div>
              <Reveal
                as="h2"
                className="section-title"
                direction="left"
                style={{ marginBottom: "0.5rem" }}
              >
                {t("contact.title")}
              </Reveal>
              <Reveal as="p" className={styles.lead} direction="up" delayMs={50}>
                {t("contact.lead")}
              </Reveal>
              {!hasEmail && socials.length === 0 ? (
                <Reveal as="p" className={styles.hint} direction="right" delayMs={90}>
                  {t("contact.hint")}
                </Reveal>
              ) : null}
            </div>
            <Reveal className={styles.actions} direction="right" delayMs={90}>
              {hasEmail ? (
                <a className="btn-primary" href={mailtoUrl} onClick={openEmailClient}>
                  {t("contact.emailCta")}
                </a>
              ) : null}
              <div className={styles.socialRow}>
                {socials.map((s, idx) => (
                  <Reveal
                    key={s.label}
                    as="a"
                    className={styles.social}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    direction={idx % 2 === 0 ? "left" : "right"}
                    delayMs={120 + idx * 40}
                  >
                    <Icon kind={s.icon} />
                    <span>{s.label}</span>
                  </Reveal>
                ))}
              </div>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
