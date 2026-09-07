/**
 * The Community screen's stylesheet. Extracted verbatim from
 * mobile/app/(tabs)/community.tsx.
 */
import { StyleSheet } from 'react-native';

import { C, T, F, S, R, FS, LH, TR, alpha, RGB } from '@/components/ui/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: S.md, paddingBottom: 100 },

  header: { marginTop: S.md, marginBottom: S.lg },
  title: { ...T.h1, color: C.text.hero },
  subtitle: { ...T.bodySm, color: C.text.sec, marginTop: S.xs },

  card: { marginBottom: S.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: S.sm },
  sectionLabel: { ...T.eyebrow, color: C.text.sec },

  poolHead: { alignItems: 'center', marginBottom: S.md },
  poolScore: { ...T.hero },
  poolScoreCaption: { ...T.eyebrow, color: C.text.mut, marginTop: -2 },

  poolFigures: { flexDirection: 'row', gap: S.lg, marginTop: S.md },
  figure: { flex: 1, minWidth: 0 },
  figureValue: { ...T.stat, color: C.text.hero },
  figureLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },

  pending: { ...T.h2, color: C.text.sec },
  note: { ...T.caption, color: C.text.mut, marginTop: S.sm },

  segmented: {
    flexDirection: 'row',
    backgroundColor: C.surface2,
    borderRadius: R.badge,
    padding: 3,
    marginBottom: S.md,
  },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: C.primary },
  segmentLabel: { ...T.label, color: C.text.sec },
  segmentLabelActive: { color: C.text.hero },

  rows: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingVertical: S.sm,
    paddingHorizontal: S.sm,
    borderRadius: R.badge,
    backgroundColor: C.surface2,
  },
  rowMe: { backgroundColor: alpha(RGB.primary, 0.16) },
  rank: { ...T.numberSm, color: C.text.mut, width: 22 },
  rankMe: { color: C.primaryLight },
  name: { ...T.bodySm, color: C.text.pri, flex: 1, minWidth: 0 },
  nameMe: { color: C.text.hero },
  rowScore: { ...T.number },
  pinDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: S.xs,
  },

  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingVertical: 6,
  },
  circleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInitial: { ...T.numberSm, color: C.text.sec },
  circleName: { ...T.bodySm, color: C.text.pri, flex: 1, minWidth: 0 },
  circleScore: { ...T.numberSm },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: S.md,
    paddingTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  /**
   * The body face, not the mono label face.
   *
   * Mono names a STATE: an eyebrow, a segment, a figure. "Bring someone in" is
   * an ACTION, and set in JetBrains Mono it reads like a terminal command
   * rather than a control. The segmented Everyone / Your circle above it stays
   * mono because those are mode labels, which is the distinction worth holding.
   */
  linkText: {
    ...T.bodySm,
    fontFamily: F.bodySemiBold,
    color: C.primary,
  },

  earnedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earnedCount: { ...T.numberSm, color: C.text.sec, marginBottom: S.sm },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  badge: {
    width: '30%',
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: S.sm,
    paddingHorizontal: 6,
    borderRadius: R.badge,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    opacity: 0.6,
  },
  badgeUnlocked: { opacity: 1, borderColor: alpha(RGB.primary, 0.3) },
  badgeName: {
    ...T.caption,
    fontSize: FS.xs,
    lineHeight: LH.xs,
    letterSpacing: TR.sm,
    color: C.text.pri,
    textAlign: 'center',
  },
  badgeNameLocked: { color: C.text.mut },
});
