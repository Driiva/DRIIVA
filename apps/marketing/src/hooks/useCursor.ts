import { useEffect } from 'react';
import { animate, prefersReducedMotion } from '@/lib/motion';

export function useCursor(): void {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    const el = document.createElement('div');
    el.className = 'cursor-follower';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);

    let mouseX = -100;
    let mouseY = -100;
    let x = -100;
    let y = -100;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const onEnterInteractive = () => {
      animate(el, { scale: 4.66, duration: 220, ease: 'cubicBezier(0.22, 1, 0.36, 1)' });
    };
    const onLeaveInteractive = () => {
      animate(el, { scale: 1, duration: 220, ease: 'cubicBezier(0.22, 1, 0.36, 1)' });
    };

    const interactiveSel = 'a, button, [role="button"], input, textarea';
    const interactiveEls = Array.from(document.querySelectorAll(interactiveSel));
    for (const i of interactiveEls) {
      i.addEventListener('mouseenter', onEnterInteractive);
      i.addEventListener('mouseleave', onLeaveInteractive);
    }

    let raf = 0;
    const tick = () => {
      x += (mouseX - x) * 0.18;
      y += (mouseY - y) * 0.18;
      el.style.transform = `translate3d(${x - 6}px, ${y - 6}px, 0) scale(${(el.style.transform.match(/scale\(([^)]+)\)/) ?? [, '1'])[1]})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      for (const i of interactiveEls) {
        i.removeEventListener('mouseenter', onEnterInteractive);
        i.removeEventListener('mouseleave', onLeaveInteractive);
      }
      el.remove();
    };
  }, []);
}
