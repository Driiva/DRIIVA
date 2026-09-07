/**
 * Community display rules: the achievement icon map and the name mask.
 * Extracted verbatim from mobile/app/(tabs)/community.tsx.
 */
/** Icons for the shared achievement catalogue. Ionicons, never emoji. */
export const ICONS: Record<string, string> = {
  Car: 'car-sport-outline',
  Shield: 'shield-checkmark-outline',
  Target: 'locate-outline',
  Star: 'star-outline',
  Route: 'map-outline',
  Flame: 'flame-outline',
  Moon: 'moon-outline',
  Award: 'ribbon-outline',
};

/** Same masking rule as web and the full board, so nobody is named two ways. */
export function anonymise(displayName: string): string {
  if (!displayName) return 'Driver';
  const shown = Math.min(5, Math.ceil(displayName.length * 0.4));
  const hidden = Math.min(displayName.length - shown, 3);
  return displayName.slice(0, shown) + '*'.repeat(Math.max(hidden, 0));
}
