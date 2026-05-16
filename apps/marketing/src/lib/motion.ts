import { animate as animeAnimate, createTimeline, stagger, svg } from 'animejs';
import type { AnimationParams } from 'animejs';

export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Wrapped animate() that short-circuits to final-state assignment
 * when the user prefers reduced motion. Pass a `to` map to declare
 * the resting style explicitly; otherwise the second value of any
 * [from, to] tuples is treated as the resting value.
 */
export function animate(
  targets: string | Element | NodeListOf<Element> | Element[],
  params: AnimationParams,
): ReturnType<typeof animeAnimate> | null {
  if (prefersReducedMotion()) {
    applyFinalState(targets, params);
    return null;
  }
  return animeAnimate(targets, params);
}

function applyFinalState(
  targets: string | Element | NodeListOf<Element> | Element[],
  params: AnimationParams,
): void {
  const els = resolveTargets(targets);
  for (const el of els) {
    if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) continue;
    for (const [key, value] of Object.entries(params)) {
      if (key === 'duration' || key === 'delay' || key === 'ease' || key === 'easing' || key === 'loop' || key === 'direction' || key === 'autoplay' || key === 'composition') continue;
      const final = Array.isArray(value) ? value[value.length - 1] : value;
      if (final == null) continue;
      if (key === 'opacity') {
        (el.style as CSSStyleDeclaration).opacity = String(final);
      } else if (key === 'translateX' || key === 'translateY' || key === 'scale' || key === 'rotate') {
        // Build a transform string from any final tuple values present
        const t = el.style.transform || '';
        const next = mergeTransform(t, key, final);
        el.style.transform = next;
      } else {
        try {
          (el.style as unknown as Record<string, unknown>)[key] = typeof final === 'number' ? `${final}px` : String(final);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

function mergeTransform(existing: string, key: string, value: unknown): string {
  const v = typeof value === 'number' && (key === 'translateX' || key === 'translateY')
    ? `${value}px`
    : String(value);
  const re = new RegExp(`${key}\\([^)]*\\)`);
  if (re.test(existing)) return existing.replace(re, `${key}(${v})`);
  return `${existing} ${key}(${v})`.trim();
}

function resolveTargets(
  targets: string | Element | NodeListOf<Element> | Element[],
): Element[] {
  if (typeof targets === 'string') return Array.from(document.querySelectorAll(targets));
  if (targets instanceof Element) return [targets];
  if (Array.isArray(targets)) return targets;
  return Array.from(targets);
}

export { createTimeline, stagger, svg };
