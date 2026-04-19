import { Navigation } from "./components/Navigation";
import { Hero } from "./components/Hero";
import { StackSection } from "./components/StackSection";
import { ArchitectureSection } from "./components/ArchitectureSection";
import { HighlightsSection } from "./components/HighlightsSection";
import { ContactSection } from "./components/ContactSection";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <div className="page-bg" aria-hidden />
      <Navigation />
      <main className="app-main">
        <Hero />
        <StackSection />
        <ArchitectureSection />
        <HighlightsSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
