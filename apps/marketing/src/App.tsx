import { useLenis } from '@/hooks/useLenis';
import { Nav } from '@/sections/Nav';
import { Hero } from '@/sections/Hero';
import { HowItWorks } from '@/sections/HowItWorks';
import { Pool } from '@/sections/Pool';
import { Security } from '@/sections/Security';
import { About } from '@/sections/About';
import { FAQ } from '@/sections/FAQ';
import { FinalCTA } from '@/sections/FinalCTA';
import { Footer } from '@/sections/Footer';

export default function App() {
  useLenis();
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Pool />
        <Security />
        <About />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
