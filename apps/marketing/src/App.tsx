import { useLenis } from '@/hooks/useLenis';
import { useCursor } from '@/hooks/useCursor';
import { Hero } from '@/sections/Hero';
import { Problem } from '@/sections/Problem';
import { Mechanism } from '@/sections/Mechanism';
import { Product } from '@/sections/Product';
import { Differentiators } from '@/sections/Differentiators';
import { Waitlist } from '@/sections/Waitlist';
import { Footer } from '@/sections/Footer';

export default function App() {
  useLenis();
  useCursor();
  // gradient-layer and ink-layer are rendered statically in index.html so they
  // paint immediately on CSS resolve, before this bundle executes. Helps LCP.
  return (
    <>
      <main>
        <Hero />
        <Problem />
        <Mechanism />
        <Product />
        <Differentiators />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}
