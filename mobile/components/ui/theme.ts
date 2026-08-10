/**
 * Driiva Design System v4 - Mobile
 *
 * The single theme for every app surface. Instrument mode only: solid dark
 * surfaces on a near-black ground, one accent, colour earned through data.
 * Glassmorphism belongs to the marketing site and never appears in here.
 *
 * Principles (from competitive research):
 * 1. One accent colour (#5b4dc9) for interactive elements
 * 2. Score colours ONLY on score data (green/amber/red = earned)
 * 3. Solid dark backgrounds, not rgba(), cleaner on Android
 * 4. Three font weights max: 400, 600, 700, carried by the FAMILY not fontWeight
 * 5. Tabular figures on all numbers
 * 6. 270-degree arc gauge (automotive), not 360-degree ring (progress bar)
 * 7. 16px universal card radius, 24px for sheets
 * 8. Fixed row heights: 72px trips, 64px stats, 48px settings
 */
import type { TextStyle } from 'react-native';

/**
 * Raw rgb triplets, so a translucent tint of a brand colour is derived rather
 * than pasted. Retuning C.primary without these leaves every hand-written
 * rgba() glow pointing at the old hue, which is exactly how the app ended up
 * with rgba(107, 95, 220, ...) tints of an accent that is #5b4dc9.
 */
export const RGB = {
  primary: '91, 77, 201',
  success: '16, 185, 129',
  error: '239, 68, 68',
  white: '255, 255, 255',
  black: '0, 0, 0',
} as const;

/** Compose a translucent colour from a token triplet. Never inline an rgba(). */
export function alpha(rgb: string, a: number): string {
  return `rgba(${rgb}, ${a})`;
}

// ─── COLOURS ─────────────────────────────────────────────────────────────────

export const C = {
  // Brand gradient (image asset: Gradient_background.png)
  brand: {
    amber: '#d4850a',
    burnt: '#a04c2a',
    violet: '#6b3fa0',
    indigo: '#3b2d8b',
  },

  // Primary interactive (one colour rule - this is the ONLY UI accent)
  primary: '#5b4dc9',
  primaryLight: '#8b7de8',

  // Semantic (earned through data, never decorative)
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  teal: '#2DD4BF',

  // Dark scale (solid shades, not rgba - Rule 7 from research)
  bg: '#0a0a14',           // Near-black, faint blue undertone
  surface1: '#12111f',     // Cards
  surface2: '#1a1830',     // Elevated cards, active states
  surface3: '#241f40',     // Pressed states, inputs

  // Borders
  hairline: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(255, 255, 255, 0.16)',

  // Scrim for overlays and sheets sitting above a screen
  scrim: 'rgba(0, 0, 0, 0.55)',

  // Text (not pure white, Rule 20)
  text: {
    pri: '#e8eaf0',     // Body text, readable
    hero: '#f8fafc',    // Hero numbers only
    sec: '#8b8b9e',     // Labels, secondary info
    mut: '#5c5c70',     // Timestamps, tertiary
  },

  // Score ring gradient stops (amber to indigo, the brand identity)
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

// ─── TYPE SCALE ──────────────────────────────────────────────────────────────
// The size ladder the T presets are cut from. Screens that need a size outside
// a preset take it from here rather than typing a number.
//
// Nine steps, and every step earns its place: xs and sm are the two tertiary
// registers, md and base are the two reading sizes (md for a dense list row,
// base for anything a driver actually reads), lg through display are the
// structural numbers. Anything between two steps is a step that was typed
// rather than chosen.

export const FS = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  display: 48,
} as const;

/**
 * Leading, paired to the size it belongs with. Leading tightens as size grows:
 * body needs air between lines to be read, a hero number needs none because it
 * is perceived rather than read.
 */
export const LH = {
  xs: 15,
  sm: 18,
  md: 22,
  base: 24,
  lg: 24,
  xl: 28,
  xxl: 32,
  xxxl: 38,
  display: 48,
} as const;

/**
 * Tracking, in px because that is the unit React Native takes. The curve is
 * roughly -0.03em at display easing to zero at reading sizes, then positive on
 * mono labels, which are set in capitals and need the air.
 */
export const TR = {
  display: -1.4,
  xxxl: -1.0,
  xxl: -0.7,
  xl: -0.5,
  lg: -0.25,
  base: -0.1,
  md: -0.08,
  sm: 0,
  label: 0.3,
  eyebrow: 0.9,
} as const;

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────────
// Three weights only: 400, 600, 700, and the WEIGHT IS THE FAMILY. React Native
// picks a face by family name, so a fontWeight on top of a named face either
// does nothing or synthesises a fake bold. Every text style therefore sets
// fontFamily and never fontWeight.

// Every preset states size, leading and tracking. A preset that sets only a
// size inherits whatever leading the font file happens to carry, which differs
// per family, so a screen mixing Instrument Sans and JetBrains Mono ends up
// with two different rhythms and reads as untuned.
//
// Three registers, in the order a cockpit reads: the hero and stat numbers are
// primary and structural, h1 and h2 name what a number means, body and caption
// carry everything else. Numbers are tabular so a digit changing never moves
// the one beside it.

const tabular = ['tabular-nums' as const];

export const T = {
  hero:     { fontFamily: F.monoSemiBold, fontSize: FS.display, lineHeight: LH.display, letterSpacing: TR.display, fontVariant: tabular },
  statLg:   { fontFamily: F.monoSemiBold, fontSize: FS.xxl, lineHeight: LH.xxl, letterSpacing: TR.xxl, fontVariant: tabular },
  stat:     { fontFamily: F.monoSemiBold, fontSize: FS.xl, lineHeight: LH.xl, letterSpacing: TR.xl, fontVariant: tabular },
  number:   { fontFamily: F.monoSemiBold, fontSize: FS.base, lineHeight: LH.base, letterSpacing: TR.base, fontVariant: tabular },
  numberSm: { fontFamily: F.monoSemiBold, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm, fontVariant: tabular },

  h1:       { fontFamily: F.display, fontSize: FS.xl, lineHeight: LH.xl, letterSpacing: TR.xl },
  h2:       { fontFamily: F.bodySemiBold, fontSize: FS.lg, lineHeight: LH.lg, letterSpacing: TR.lg },

  body:     { fontFamily: F.body, fontSize: FS.base, lineHeight: LH.base, letterSpacing: TR.base },
  bodySm:   { fontFamily: F.body, fontSize: FS.md, lineHeight: LH.md, letterSpacing: TR.md },
  caption:  { fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm },

  label:    { fontFamily: F.monoSemiBold, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.label },
  eyebrow:  { fontFamily: F.monoSemiBold, fontSize: FS.xs, lineHeight: LH.xs, letterSpacing: TR.eyebrow, textTransform: 'uppercase' as const },
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
