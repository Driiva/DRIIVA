import { useEffect } from 'react';
import { useInView } from '@/hooks/useInView';
import { animate, prefersReducedMotion } from '@/lib/motion';

interface Options {
  delayStep?: number;
  duration?: number;
  threshold?: number;
}

/**
 * Watches a section element. When it intersects, finds every descendant
 * with `.reveal-init` and runs a staggered translate+fade entrance via
 * anime.js. Under prefers-reduced-motion the elements snap to their
 * final state via the motion wrapper.
 */
export function useReveal<T extends Element = HTMLElement>(opts: Options = {}) {
  const { delayStep = 90, duration = 800, threshold = 0.15 } = opts;
  const [ref, inView] = useInView<T>({ threshold, once: true });

  useEffect(() => {
    if (!inView) return;
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll('.reveal-init')) as Element[];
    if (targets.length === 0) return;
    if (prefersReducedMotion()) {
      for (const el of targets) {
        if (el instanceof HTMLElement || el instanceof SVGElement) {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      }
      return;
    }
    animate(targets, {
      opacity: [0, 1],
      translateY: [36, 0],
      duration,
      ease: 'cubicBezier(0.22, 1, 0.36, 1)',
      delay: (_: unknown, i: number) => i * delayStep,
    } as never);
  }, [inView, delayStep, duration]);

  return ref;
}
