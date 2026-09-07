/**
 * Dashboard copy and derivation helpers: the time-of-day greeting, the score
 * message, the static AI Driiva tips and the surplus projection.
 * Extracted verbatim from client/src/pages/dashboard.tsx.
 */
import {
  Eye, Footprints, Gauge, CornerUpLeft, PhoneOff, Moon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { projectedRefundCents, SCORE_WEIGHTS } from '@driiva/scoring';

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getScoreMessage(score: number): string {
  // No exclamation marks. The brand voice is plain-English confident, and a
  // telematics score is information, not a cheer.
  if (score >= 80) return "Strong driving. Keep this up to maximise your refund.";
  if (score >= 70) return "Good progress. A few more safe trips will lift your score.";
  return "Keep practising safe driving to unlock rewards.";
}

/** Lucide icons for the coaching tips, resolved by name. Never emoji. */
const TIP_ICONS: Record<string, LucideIcon> = {
  Eye, Footprints, Gauge, CornerUpLeft, PhoneOff, Moon,
};

export function TipIcon({ name }: { name: string }) {
  const Icon = TIP_ICONS[name] ?? Eye;
  return <Icon className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden="true" />;
}

/*
 * Coaching tips.
 *
 * The icons were EMOJI, which this brand bans outright, and the copy carried
 * three em dashes and an equals sign standing in for a word. Icons are Lucide
 * names resolved at render.
 *
 * The cornering figure is quoted from SCORE_WEIGHTS in @driiva/scoring rather
 * than retyped: cornering is 0.2, and the marketing site has already shipped
 * transposed weights once because somebody typed them by hand.
 */
const AI_DRIIVA_TIPS = [
  { headline: "Anticipate the road ahead", tip: "Look 10 to 15 seconds forward. Spotting hazards early means smoother, gentler braking, which directly improves your score.", icon: "Eye" },
  { headline: "Lift off gently", tip: "Releasing the accelerator gradually before a junction saves fuel and avoids the hard-braking penalty that chips away at your score.", icon: "Footprints" },
  { headline: "Speed limits are scoring limits", tip: "Even brief periods above the limit add speeding seconds to your score. Staying within limits is the single biggest score multiplier.", icon: "Gauge" },
  { headline: "Smooth cornering pays", tip: `Enter bends at a steady speed rather than braking mid-corner. Cornering is worth ${Math.round(SCORE_WEIGHTS.cornering * 100)}% of your total score.`, icon: "CornerUpLeft" },
  { headline: "Keep your phone face down", tip: "Phone pickups are logged and count against your score. Use Do Not Disturb before you start the engine, since every pickup costs points.", icon: "PhoneOff" },
  { headline: "Night driving costs more", tip: "Fatigue and reduced visibility increase risk at night. Keeping night trips short and smooth helps your overall risk profile.", icon: "Moon" },
];

export function getAiDriivaTip(score: number): typeof AI_DRIIVA_TIPS[0] {
  if (score === 0) return AI_DRIIVA_TIPS[0];
  const idx = Math.floor(score * 7.3) % AI_DRIIVA_TIPS.length;
  return AI_DRIIVA_TIPS[idx];
}

export function calculateSurplus(score: number, premiumPounds: number): number {
  // Pounds for display (WEB-13): projectedRefundCents returns pence, and every
  // downstream render site (the refund figure, the pounds-denominated bar-width
  // calc, the "on track for" copy) treats surplusProjection as pounds.
  // projectedRefundCents returns null when there is no premium to project a
  // refund against, which is a different thing from a refund of zero. This
  // surface reads the two the same way: every consumer downstream already
  // gates on "> 0" before it renders a figure, so null collapses to 0 here and
  // the existing empty states carry it. The mobile app reads the null itself
  // and renders "Not started".
  const cents = projectedRefundCents(score, Math.round(premiumPounds * 100));
  return cents === null ? 0 : cents / 100;
}

