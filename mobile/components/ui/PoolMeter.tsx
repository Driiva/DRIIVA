/**
 * POOL METER
 * ==========
 * The community score as an instrument, with the driver's own score marked
 * against it.
 *
 * WHY A METER AND NOT A RING
 * The 270 degree ring is the driver's own score and carries the brand
 * gradient. Giving the pool the same instrument would say the two figures are
 * the same kind of thing. They are not: the pool average only means anything
 * relative to where the driver sits on it, and that comparison is what sets
 * their share. A linear scale with two marks on it says that in one glance and
 * a ring cannot say it at all.
 *
 * WHAT IT REFUSES TO SHOW
 * A pound figure. The money model is undefined and the pool has never been
 * funded, so a balance here would be a number nobody has committed to. Score,
 * participants and share percentage are all computed server-side and real.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { C, T, S, scoreColor } from './theme';
import { useDrawOn, MOTION } from './motion';

interface PoolMeterProps {
  /** communityPool/current.averagePoolScore, 0-100. */
  poolScore: number;
  /** The viewer's own current score, or null when they have not been scored. */
  yourScore: number | null;
}

const TRACK_HEIGHT = 10;

export function PoolMeter({ poolScore, yourScore }: PoolMeterProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useDrawOn(MOTION.duration.count);

  const poolPct = Math.min(Math.max(poolScore, 0), 100) / 100;
  const yourPct = yourScore == null ? null : Math.min(Math.max(yourScore, 0), 100) / 100;

  const fill = useAnimatedStyle(() => ({
    width: trackWidth * poolPct * progress.value,
  }));

  const marker = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (yourPct ?? 0) * trackWidth * progress.value }],
  }));

  return (
    <View>
      <View
        style={styles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(poolScore) }}
        accessibilityLabel={
          yourScore == null
            ? `Community score ${Math.round(poolScore)} out of 100`
            : `Community score ${Math.round(poolScore)} out of 100. Your score ${Math.round(yourScore)}.`
        }
      >
        <Animated.View
          style={[styles.fill, { backgroundColor: scoreColor(poolScore) }, fill]}
        />
        {yourPct != null && trackWidth > 0 && (
          <Animated.View style={[styles.marker, marker]} />
        )}
      </View>

      <View style={styles.legend}>
        <Legend
          swatch={scoreColor(poolScore)}
          label="Community"
          value={poolScore.toFixed(1)}
        />
        <Legend
          swatch={C.text.hero}
          label="You"
          value={yourScore == null ? 'Not scored' : String(Math.round(yourScore))}
        />
      </View>
    </View>
  );
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: swatch }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: C.surface3,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  /**
   * The driver's own position, as a hairline rather than a blob: it is a
   * reading off a scale, and a wide marker would make the reading vaguer than
   * the number it represents.
   */
  marker: {
    position: 'absolute',
    left: 0,
    width: 2,
    top: 0,
    bottom: 0,
    marginLeft: -1,
    backgroundColor: C.text.hero,
  },

  legend: {
    flexDirection: 'row',
    gap: S.md,
    marginTop: S.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { ...T.caption, color: C.text.sec },
  legendValue: { ...T.numberSm, color: C.text.pri },
});

export default PoolMeter;
