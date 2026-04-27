import { Suspense, lazy, useEffect, useState } from "react";
import { Navigation } from "./components/Navigation";
import { Hero } from "./components/Hero";
import { Footer } from "./components/Footer";
import { ArtPage } from "./components/ArtPage";
import { usePathname } from "./utils/spaRouter";
import { shouldShowConsentBanner, trackPageView } from "./analytics/ga";
import { AnalyticsConsentBanner } from "./components/AnalyticsConsentBanner";

const HighlightsSection = lazy(() =>
  import("./components/HighlightsSection").then((module) => ({ default: module.HighlightsSection })),
);
const DeliveryFocusSection = lazy(() =>
  import("./components/DeliveryFocusSection").then((module) => ({ default: module.DeliveryFocusSection })),
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

export default function App() {
  const pathname = usePathname();
  const isArtPage = pathname.startsWith("/art");
  const [showConsentBanner, setShowConsentBanner] = useState(() => shouldShowConsentBanner());

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return (
    <div className={`app-shell${isArtPage ? " app-shell--art" : ""}`}>
      <div className="page-bg" aria-hidden />
      <Navigation />
      <main className="app-main">
        {isArtPage ? (
          <ArtPage />
        ) : (
          <>
            <Hero />
            <Suspense fallback={<div className="shell section" aria-hidden />}>
              <HighlightsSection />
              <DeliveryFocusSection />
              <StackSection />
              <ArchitectureSection />
              <ContactSection />
            </Suspense>
          </>
        )}
      </main>
      <Footer />
      {showConsentBanner ? <AnalyticsConsentBanner onResolved={() => setShowConsentBanner(false)} /> : null}
    </div>
  );
}
