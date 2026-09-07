/**
 * The trip detail screen's stylesheet. Extracted verbatim from
 * mobile/app/trips/[tripId].tsx.
 */
import { StyleSheet } from 'react-native';

import { C, T, S, R, FS, LH, TR } from '@/components/ui/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingBottom: S.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: R.badge,
    backgroundColor: C.surface1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...T.h2, color: C.text.pri },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  route: { ...T.h1, color: C.text.hero },
  date: { ...T.caption, color: C.text.sec, marginTop: S.xs },
  scoreBadge: {
    width: 56, height: 56, borderRadius: R.full, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center', backgroundColor: C.surface1,
  },
  scoreText: { ...T.stat },
  statRow: { flexDirection: 'row', marginTop: S.lg, gap: S.lg },
  stat: { flex: 1 },
  statValue: { ...T.number, color: C.text.pri },
  statLabel: { ...T.caption, color: C.text.sec, marginTop: 2, textTransform: 'capitalize' },
  sectionTitle: { ...T.eyebrow, color: C.text.sec, marginBottom: S.sm },
  emptyLine: { ...T.body, color: C.text.mut },
  section: { marginBottom: S.md },
  routeEnds: { ...T.caption, color: C.text.sec, marginTop: S.sm },
  breakdownFootnote: { ...T.caption, color: C.text.mut, marginTop: S.sm },
  eventsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  eventStat: { width: '45%' },
  // Same: T.number is base, so lg needs lg's leading, not base's.
  eventValue: { ...T.number, color: C.text.pri, fontSize: FS.lg, lineHeight: LH.lg, letterSpacing: TR.lg },
  eventLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },
  eventRate: { ...T.numberSm, color: C.text.mut, marginTop: 2 },
});
