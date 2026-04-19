import styles from "./LanguageSwitcher.module.css";
import type { Locale } from "../i18n/types";
import { useI18n } from "../i18n/I18nProvider";

const locales: { id: Locale; short: string }[] = [
  { id: "en", short: "EN" },
  { id: "ru", short: "RU" },
  { id: "hy", short: "HY" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className={styles.wrap} role="group" aria-label={t("lang.switch")}>
      {locales.map((l) => (
        <button
          key={l.id}
          type="button"
          className={styles.btn}
          data-active={locale === l.id}
          onClick={() => setLocale(l.id)}
          aria-pressed={locale === l.id}
          title={t(`lang.${l.id}`)}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
