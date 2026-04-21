import { Suspense, lazy } from "react";
import { Navigation } from "./components/Navigation";
import { Hero } from "./components/Hero";
import { Footer } from "./components/Footer";
import { ArtPage } from "./components/ArtPage";
import { usePathname } from "./utils/spaRouter";

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

export default function App() {
  const pathname = usePathname();
  const isArtPage = pathname.startsWith("/art");

  return (
    <div className={isArtPage ? "app-shell app-shell--art" : "app-shell app-shell--mono"}>
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
              <StackSection />
              <ArchitectureSection />
              <ContactSection />
            </Suspense>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
