/**
 * Driiva Design System v4 — Mobile
 *
 * Principles (from competitive research):
 * 1. One accent color (#5b4dc9) for interactive elements
 * 2. Score colors ONLY on score data (green/amber/red = earned)
 * 3. Solid dark backgrounds, not rgba() — cleaner on Android
 * 4. Three font weights max: 400, 600, 700
 * 5. Tabular figures on all numbers
 * 6. 270-degree arc gauge (automotive), not 360-degree ring (progress bar)
 * 7. 16px universal card radius, 24px for sheets
 * 8. Fixed row heights: 72px trips, 64px stats, 48px settings
 */
import type { TextStyle } from 'react-native';

// ─── COLOURS ─────────────────────────────────────────────────────────────────

export const C = {
  // Brand gradient (image asset: Gradient_background.png)
  brand: {
    amber: '#d4850a',
    burnt: '#a04c2a',
    violet: '#6b3fa0',
    indigo: '#3b2d8b',
  },

  // Primary interactive (one colour rule — this is the ONLY UI accent)
  primary: '#5b4dc9',
  primaryLight: '#8b7de8',

  // Semantic (earned through data, never decorative)
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  teal: '#2DD4BF',

  // Dark scale (solid shades, not rgba — Rule 7 from research)
  bg: '#0a0a14',           // Near-black, faint blue undertone
  surface1: '#12111f',     // Cards
  surface2: '#1a1830',     // Elevated cards, active states
  surface3: '#241f40',     // Pressed states, inputs

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(255, 255, 255, 0.16)',

  // Glass (reserved for hero elements ONLY — score card, modals)
  glass: {
    card: 'rgba(25, 18, 50, 0.55)',
    border: 'rgba(255, 255, 255, 0.14)',
  },

  // Text (not pure white — Rule 20)
  text: {
    pri: '#e8eaf0',     // Body text, readable
    hero: '#f8fafc',    // Hero numbers only
    sec: '#8b8b9e',     // Labels, secondary info
    mut: '#5c5c70',     // Timestamps, tertiary
  },

  // Score ring gradient stops (amber → indigo, the brand identity)
  ring: [
    { o: '0%', c: '#d4850a' },
    { o: '33%', c: '#a04c2a' },
    { o: '66%', c: '#6b3fa0' },
    { o: '100%', c: '#3b2d8b' },
  ],
} as const;

// Score tier colours (only on score-related elements)
export function scoreColor(s: number): string {
  if (s >= 80) return C.success;
  if (s >= 70) return C.teal;
  if (s >= 50) return C.warning;
  return C.error;
}

// ─── FONT FAMILIES ───────────────────────────────────────────────────────────
// Instrument Sans = body (both platforms). Inter Tight = display.
// JetBrains Mono = eyebrows/labels/stats. Three weights max per family.
// Keys must match the useFonts() map in app/_layout.tsx exactly.

export const F = {
  body: 'InstrumentSans-Regular',
  bodySemiBold: 'InstrumentSans-SemiBold',
  bodyBold: 'InstrumentSans-Bold',
  display: 'InterTight-Bold',
  displaySemiBold: 'InterTight-SemiBold',
  mono: 'JetBrainsMono-Regular',
  monoSemiBold: 'JetBrainsMono-SemiBold',
} as const;

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────────
// Three weights only: 400, 600, 700. Tabular figures on all numbers.

export const T = {
  hero:    { fontFamily: F.monoSemiBold, fontSize: 42, letterSpacing: -1.5, fontVariant: ['tabular-nums' as const] },
  h1:      { fontFamily: F.display, fontSize: 24, letterSpacing: -0.5 },
  h2:      { fontFamily: F.bodySemiBold, fontSize: 17 },
  body:    { fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  label:   { fontFamily: F.monoSemiBold, fontSize: 13 },
  caption: { fontFamily: F.body, fontSize: 11 },
  number:  { fontFamily: F.monoSemiBold, fontSize: 15, fontVariant: ['tabular-nums' as const] },
  stat:    { fontFamily: F.monoSemiBold, fontSize: 22, fontVariant: ['tabular-nums' as const] },
} satisfies Record<string, TextStyle>;

// ─── SPACING ─────────────────────────────────────────────────────────────────

export const S = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── RADII ───────────────────────────────────────────────────────────────────
// 16px for cards (universal), 24px for sheets/modals, 8px for badges only

export const R = {
  badge: 8,
  card: 16,
  sheet: 24,
  full: 9999,
} as const;

// ─── FIXED ROW HEIGHTS ──────────────────────────────────────────────────────
// Consistent list row heights (Rule 3: perceived quality)

export const ROW = {
  trip: 72,
  stat: 64,
  setting: 48,
  notification: 72,
} as const;

// ─── BACKGROUND ──────────────────────────────────────────────────────────────
// The gradient is an IMAGE ASSET. Never recreate with CSS/code.
export let BG_IMAGE: number | null = null;
try { BG_IMAGE = require('../../assets/Gradient_background.png'); } catch { BG_IMAGE = null; }
