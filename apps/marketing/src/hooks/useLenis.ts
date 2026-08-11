import { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import { prefersReducedMotion } from '@/lib/motion';

export function useLenis(): void {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    /* Was duration 0.9 with a 1.1 multiplier, which is a long tail on a small
     * push: every flick coasted for the better part of a second and the page
     * felt like it was catching up with the reader. Shorter ramp, more travel
     * per notch, so it still glides but arrives when you expect it to. */
    const lenis = new Lenis({
      duration: 0.55,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.45,
      touchMultiplier: 1.8,
    });

    let raf = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
}
