import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Stats from "@/components/landing/Stats";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { BottomNav } from "@/components/landing/BottomNav";

const Index = () => {
  return (
    // pb-14 på mobil: bottennavigeringen är fast och får inte täcka foten.
    <div className="min-h-screen bg-background pb-14 md:pb-0">
      <Header />
      <main className="pt-16 md:pt-20">
        <Hero />
        <section id="features">
          <Features />
        </section>
        <section id="how-it-works">
          <HowItWorks />
        </section>
        <Pricing />
        <Stats />
        <CTA />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default Index;
