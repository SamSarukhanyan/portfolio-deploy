import styles from "./LegalSection.module.css";

const internalLinks = [
  { href: "#top", label: "Back to top" },
  { href: "#highlights", label: "Project outcomes overview" },
  { href: "#stack", label: "Technical stack details" },
  { href: "#architecture", label: "Delivery architecture" },
  { href: "#contact", label: "Contact section" },
  { href: "#contact-form", label: "Contact form" },
  { href: "#contact-methods", label: "Contact methods" },
  { href: "#privacy-policy", label: "Privacy policy" },
  { href: "#cookie-policy", label: "Cookie policy" },
  { href: "#gdpr-rights", label: "GDPR rights and requests" },
  { href: "#terms-of-service", label: "Terms of service" },
  { href: "#accessibility-statement", label: "Accessibility statement" },
  { href: "/#top", label: "Homepage hero" },
  { href: "/#highlights", label: "Homepage highlights" },
  { href: "/#stack", label: "Homepage stack section" },
  { href: "/#architecture", label: "Homepage architecture section" },
  { href: "/#contact", label: "Homepage contact section" },
];

const externalLinks = [
  { href: "https://gdpr.eu/", label: "GDPR overview" },
  { href: "https://gdpr-info.eu/", label: "GDPR legal text" },
  { href: "https://ico.org.uk/for-organisations/guide-to-pecr/", label: "PECR cookie guidance (ICO)" },
  { href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP", label: "CSP implementation reference (MDN)" },
  {
    href: "https://web.dev/articles/tap-targets",
    label: "Touch target accessibility guidance (web.dev)",
  },
];

export function LegalSection() {
  return (
    <section id="legal" className={`section ${styles.section}`}>
      <div className="shell">
        <h2 className="section-title">Legal, privacy, and user rights</h2>
        <p className="section-lead">
          This portfolio follows privacy-first principles. Optional analytics and tracking are disabled
          until explicit consent is provided.
        </p>

        <div className={styles.grid}>
          <article id="privacy-policy" className={`glass ${styles.card}`}>
            <h3>Privacy Policy</h3>
            <p>
              We may process contact information you provide (name, email, message) to respond to your
              request. We do not sell personal data. Data is stored only for communication and security
              purposes.
            </p>
            <p>
              Lawful basis: legitimate interest (professional communication) and consent where required.
              Retention: only as long as needed to resolve your inquiry.
            </p>
          </article>

          <article id="cookie-policy" className={`glass ${styles.card}`}>
            <h3>Cookie Policy</h3>
            <p>
              Essential storage may be used for core site functionality. Optional analytics cookies are
              blocked by default and enabled only after you accept via the consent banner.
            </p>
            <p>
              You can change your preference at any time by clearing site storage in your browser and
              selecting a new option.
            </p>
          </article>

          <article id="gdpr-rights" className={`glass ${styles.card}`}>
            <h3>GDPR and data subject rights</h3>
            <p>
              If you are in the EU/EEA, you may request access, rectification, deletion, processing
              restriction, objection, or portability of your personal data.
            </p>
            <p>
              To submit a request, email <a href="mailto:sarukhanyandev@gmail.com">sarukhanyandev@gmail.com</a>
              . We aim to respond within 30 days.
            </p>
          </article>

          <article id="terms-of-service" className={`glass ${styles.card}`}>
            <h3>Terms of Service</h3>
            <p>
              This website is provided for professional portfolio and communication purposes. You agree
              not to misuse the site, attempt unauthorized access, or interfere with normal operation.
            </p>
            <p>
              Content is provided as-is without warranties. External links are included for reference and
              may be updated without notice.
            </p>
          </article>

          <article id="accessibility-statement" className={`glass ${styles.card}`}>
            <h3>Accessibility Statement</h3>
            <p>
              We continuously improve keyboard access, touch usability, and contrast/readability. If you
              experience accessibility barriers, please report them by email so we can fix them quickly.
            </p>
            <p>
              Contact: <a href="mailto:sarukhanyandev@gmail.com">sarukhanyandev@gmail.com</a>
            </p>
          </article>

          <article className={`glass ${styles.card}`}>
            <h3>Site navigation links</h3>
            <ul className={styles.linkList}>
              {internalLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className={`glass ${styles.references}`}>
          <h3>References</h3>
          <ul className={styles.linkList}>
            {externalLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noreferrer noopener">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
