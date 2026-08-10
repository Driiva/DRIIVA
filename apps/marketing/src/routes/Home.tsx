import { Hero } from '@/sections/Hero';
import { TrustRibbon } from '@/sections/TrustRibbon';
import { HowItWorks } from '@/sections/HowItWorks';
import { ScoreBreakdown } from '@/sections/ScoreBreakdown';
import { ScoreCalculator } from '@/sections/ScoreCalculator';
import { Pool } from '@/sections/Pool';
import { BetaCountdown } from '@/sections/BetaCountdown';
import { BrandStatement } from '@/sections/BrandStatement';
import { Comparison } from '@/sections/Comparison';
import { Security } from '@/sections/Security';
import { About } from '@/sections/About';
import { FAQ } from '@/sections/FAQ';
import { FinalCTA } from '@/sections/FinalCTA';

export function Home() {
  return (
    <main id="main-content">
      <Hero />
      <TrustRibbon />
      <HowItWorks />
      <ScoreBreakdown />
      <ScoreCalculator />
      <Pool />
      <BetaCountdown />
      <BrandStatement />
      <Comparison />
      <Security />
      <About />
      <FAQ />
      <FinalCTA />
    </main>
  );
}
