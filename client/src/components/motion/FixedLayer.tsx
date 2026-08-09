/**
 * Renders its children into document.body, outside the routed subtree.
 *
 * PageTransition animates transform and filter on the element that wraps the
 * router. Both properties make that element a containing block for every
 * position:fixed descendant, so a bottom nav or a modal rendered inside a page
 * stops being pinned to the viewport and rides the page animation instead:
 * it slides 6px and blurs on every navigation. Portalling to the body puts the
 * fixed chrome back on the viewport where it belongs.
 *
 * Anything inside a routed page that positions itself fixed belongs in here.
 * Radix dialogs and sheets already portal themselves and do not need it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function FixedLayer({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Portals need a DOM target, so wait for the client before rendering.
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}

export default FixedLayer;
