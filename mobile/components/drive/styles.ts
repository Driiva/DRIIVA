/**
 * The Drive screen's stylesheet. Extracted verbatim from
 * mobile/app/(tabs)/record.tsx.
 */
import { StyleSheet } from 'react-native';

import { C, T, S, R, FS, LH, alpha, RGB } from '@/components/ui/theme';
import { ARC_SIZE } from './arcGeometry';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: S.md },
  header: { ...T.h1, color: C.text.hero, marginTop: S.md, marginBottom: S.xl },

  live: { flex: 1, alignItems: 'center' },
  arcWrap: {
    width: ARC_SIZE,
    height: ARC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: S.lg,
  },
  arc: { position: 'absolute' },
  speedBlock: { alignItems: 'center' },
  speed: {
    fontFamily: 'InterTight-Bold',
    fontSize: FS.mega,
    lineHeight: LH.mega,
    color: C.text.hero,
    fontVariant: ['tabular-nums'],
  },
  speedWaiting: { color: C.text.mut },
  speedUnit: { ...T.label, color: C.text.sec, marginTop: -S.xs },
  speedNote: { ...T.numberSm, color: C.text.mut, marginTop: S.xs },

  readout: { flexDirection: 'row', alignItems: 'center', marginTop: S.xl },
  readoutItem: { ...T.number, color: C.text.pri },
  readoutDivider: { ...T.number, color: C.text.mut, marginHorizontal: S.sm },
  handling: { ...T.numberSm, color: C.text.sec, marginTop: S.md },
  quiet: { ...T.caption, color: C.text.sec, marginTop: S.md, textAlign: 'center' },

  holdWrap: {
    marginTop: 'auto',
    marginBottom: S.xxl,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  holdFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: alpha(RGB.error, 0.22),
  },
  holdLabel: { ...T.label, color: C.text.pri },

  armedView: { flex: 1 },
  watchRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: R.full },
  dotLive: { backgroundColor: C.success },
  dotOff: { backgroundColor: C.text.mut },
  watchLabel: { ...T.h2, color: C.text.pri, marginLeft: S.sm },
  watchBody: { ...T.body, color: C.text.sec, marginTop: S.sm, maxWidth: 340 },

  lastDrive: { marginTop: S.xl },
  lastDriveLabel: { ...T.eyebrow, color: C.text.mut },
  lastDriveRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: S.sm },
  lastDriveDate: { ...T.body, color: C.text.pri },
  lastDriveMiles: { ...T.number, color: C.text.sec, marginLeft: S.md },
  lastDriveScore: { ...T.stat, marginLeft: 'auto' },

  notice: { ...T.caption, color: C.text.sec, marginTop: S.lg, maxWidth: 340 },

  textAction: { marginTop: 'auto', marginBottom: S.xxl, alignSelf: 'flex-start' },
  textActionLabel: { ...T.label, color: C.primary },
});
