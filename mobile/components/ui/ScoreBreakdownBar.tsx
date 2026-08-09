/**
 * ScoreBreakdownBar — One scoring dimension as a labelled progress bar.
 *
 * Rule 6: Score colours earned through data only.
 * Rule 4: Tabular figures on the value.
 * Research: 8px bar height, 4px radius (thicker = more substantial).
 * Research: Drop the weight% - it adds cognitive load without actionable info.
 *
 * The weight is optional and off by default for exactly that reason. Trip
 * detail opts in, because a driver looking at why one trip scored what it did
 * needs to know that braking counts for more than phone use; anywhere the
 * breakdown is glanceable rather than diagnostic, leave it off. Callers must
 * pass SCORE_WEIGHTS from @driiva/scoring, never a retyped number.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, T, S, scoreColor } from './theme';

interface ScoreBreakdownBarProps {
  label: string;
  value: number;
  /** Share of the composite score, 0-1. Omit to hide. */
  weight?: number;
}

export const ScoreBreakdownBar: React.FC<ScoreBreakdownBarProps> = ({ label, value, weight }) => {
  const color = scoreColor(value);
  const width = `${Math.min(Math.max(value, 0), 100)}%`;

  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        {weight !== undefined && (
          <Text style={styles.weight}>{Math.round(weight * 100)}% of score</Text>
        )}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: width as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  labelWrap: {
    width: 88,
  },
  label: {
    ...T.caption,
    color: C.text.sec,
  },
  weight: {
    ...T.caption,
    fontSize: 10,
    color: C.text.mut,
    marginTop: 1,
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: C.surface2,
    borderRadius: 4,
    marginHorizontal: S.sm,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  value: {
    width: 28,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export default ScoreBreakdownBar;
