import { animate, prefersReducedMotion } from '@/lib/motion';

/*
 * Text reveals ported from Amicro (github.com/Subhan-code/Amicro--Micro-transitions-,
 * npm @subhanhq/amicro), the micro-transitions library this project was told
 * to build on.
 *
 * PORTED RATHER THAN INSTALLED, on purpose. Amicro's components are built on
 * Motion (the framer-motion successor). This site already ships anime.js and
 * nothing else, and adding a second animation runtime to a marketing page to
 * get two text reveals would cost more in bundle weight than the reveals are
 * worth - on a page whose brief is that it should feel FASTER. So the timings
 * below are lifted verbatim from the Amicro sources rather than reinvented:
 *
 *   blur-text        duration 0.5s, stagger 0.02s, blur 8px -> 0, ease out
 *   character-stagger duration 0.4s, stagger 0.015s, y + scale 0.8 -> 1,
 *                     spring stiffness 300 damping 18
 *
 * anime.js has no spring primitive that matches Motion's, so the character
 * reveal uses the cubic-bezier closest to stiffness 300 / damping 18: a short
 * overshoot that settles without ringing. Everything else is the source value.
 *
 * Both helpers split text into spans. That is destructive to the element's
 * markup, so they take the text from textContent and rebuild it, and they bail
 * out entirely under reduced motion, leaving the original text in place rather
 * than shipping a screen-reader-hostile pile of per-character spans for no
 * visual benefit.
 */

const SPRING_300_18 = 'cubicBezier(0.34, 1.42, 0.52, 1)';

/*
 * Walks child NODES rather than reading textContent. The hero headline wraps
 * half of itself in <span class="italic"> to carry the amber, and rebuilding
 * the element from its flattened text silently threw that span away along with
 * the brand colour on it. Recursing keeps every wrapper exactly where it was
 * and only ever replaces the text nodes inside them.
 */
function splitNode(node: Node, unit: 'word' | 'char', out: HTMLSpanElement[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      splitNode(child, unit, out);
      continue;
    }
    if (child.nodeType !== Node.TEXT_NODE) continue;

    const text = child.textContent ?? '';
    if (!text) continue;

    const frag = document.createDocumentFragment();
    const pieces = unit === 'word' ? text.split(/(\s+)/) : Array.from(text);

    for (const piece of pieces) {
      if (piece === '') continue;
      if (/^\s+$/.test(piece)) {
        frag.appendChild(document.createTextNode(piece));
        continue;
      }
      const span = document.createElement('span');
      span.textContent = piece;
      span.style.display = 'inline-block';
      span.style.whiteSpace = 'pre';
      frag.appendChild(span);
      out.push(span);
    }
    node.replaceChild(frag, child);
  }
}

function splitInto(el: HTMLElement, unit: 'word' | 'char'): HTMLSpanElement[] {
  const text = el.textContent ?? '';
  if (!text.trim()) return [];

  /* The visible text becomes a run of spans, so the accessible name is pinned
   * to the original string and the pieces are hidden from assistive tech. */
  el.setAttribute('aria-label', text);
  const spans: HTMLSpanElement[] = [];
  splitNode(el, unit, spans);
  for (const s of spans) s.setAttribute('aria-hidden', 'true');
  return spans;
}

/** Amicro blur-text: words fade up out of an 8px blur. */
export function blurText(el: HTMLElement | null, delay = 0): void {
  if (!el || prefersReducedMotion()) return;
  const spans = splitInto(el, 'word');
  if (spans.length === 0) return;

  for (const s of spans) {
    s.style.opacity = '0';
    s.style.filter = 'blur(8px)';
  }
  el.style.opacity = '1';

  animate(spans, {
    opacity: [0, 1],
    filter: ['blur(8px)', 'blur(0px)'],
    duration: 500,
    ease: 'out(2)',
    delay: (_: unknown, i: number) => delay + i * 20,
  } as never);
}

/** Amicro character-stagger: characters spring up to full size. */
export function characterStagger(el: HTMLElement | null, delay = 0): void {
  if (!el || prefersReducedMotion()) return;
  const spans = splitInto(el, 'char');
  if (spans.length === 0) return;

  for (const s of spans) {
    s.style.opacity = '0';
    s.style.transform = 'translateY(14px) scale(0.8)';
  }
  el.style.opacity = '1';

  animate(spans, {
    opacity: [0, 1],
    translateY: [14, 0],
    scale: [0.8, 1],
    duration: 400,
    ease: SPRING_300_18,
    delay: (_: unknown, i: number) => delay + i * 15,
  } as never);
}
