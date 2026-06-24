import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import TheProblem from "@/components/landing/TheProblem";
import HowItWorks from "@/components/landing/HowItWorks";
import Philosophy from "@/components/landing/Philosophy";
import OldWayVsKlaroh from "@/components/landing/OldWayVsKlaroh";
import FAQ from "@/components/landing/FAQ";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TheProblem />
        <HowItWorks />
        <Philosophy />
        <OldWayVsKlaroh />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
