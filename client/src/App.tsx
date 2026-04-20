import { Suspense, lazy } from "react";
import { Navigation } from "./components/Navigation";
import { Hero } from "./components/Hero";
import { Footer } from "./components/Footer";
import { CookieConsentBanner } from "./components/CookieConsentBanner";

const HighlightsSection = lazy(() =>
  import("./components/HighlightsSection").then((module) => ({ default: module.HighlightsSection })),
);
const StackSection = lazy(() =>
  import("./components/StackSection").then((module) => ({ default: module.StackSection })),
);
const ArchitectureSection = lazy(() =>
  import("./components/ArchitectureSection").then((module) => ({ default: module.ArchitectureSection })),
);
const ContactSection = lazy(() =>
  import("./components/ContactSection").then((module) => ({ default: module.ContactSection })),
);
const LegalSection = lazy(() =>
  import("./components/LegalSection").then((module) => ({ default: module.LegalSection })),
);

export default function App() {
  return (
    <>
      <div className="page-bg" aria-hidden />
      <Navigation />
      <main className="app-main">
        <Hero />
        <Suspense fallback={<div className="shell section" aria-hidden />}>
          <HighlightsSection />
          <StackSection />
          <ArchitectureSection />
          <ContactSection />
          <LegalSection />
        </Suspense>
      </main>
      <Footer />
      <CookieConsentBanner />
    </>
  );
}
