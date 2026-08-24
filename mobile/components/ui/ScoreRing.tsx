/**
 * ScoreRing - the score as a 270-degree arc gauge.
 *
 * Rule 6 of the design system: an automotive gauge, not a 360-degree progress
 * ring. A full circle reads as "loading" and gives the eye no start and no end;
 * a 270-degree sweep opening at the bottom reads as an instrument, which is
 * what the score is. The stroke carries the brand gradient, which is the one
 * place the gradient is allowed above the ground.
 *
 * Sizes: sm (44px, trip cards), md (80px, inline), lg (150px, dashboard hero).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View, Text, StyleSheet, Animated as A, Platform } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';

import { C, T, F, FS, LH, TR } from './theme';

const AnimatedPath = A.createAnimatedComponent(Path);

/** The gauge sweeps 270 degrees, opening at the bottom: 225deg round to 135deg. */
const SWEEP_DEGREES = 270;
const START_DEGREES = 225;

const SIZES = {
  sm: { diameter: 44, stroke: 3, showLabel: false, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm },
  md: { diameter: 80, stroke: 5, showLabel: true, fontSize: FS.xxl, lineHeight: LH.xxl, letterSpacing: TR.xxl },
  lg: { diameter: 150, stroke: 8, showLabel: true, fontSize: FS.xxxl, lineHeight: LH.xxxl, letterSpacing: TR.xxxl },
} as const;

interface ScoreRingProps {
  /**
   * The score, or null when the driver has no scored trip yet.
   *
   * Null rather than zero, deliberately. A zero renders in the red tier, so a
   * driver who has simply not driven yet would be shown the gauge of somebody
   * who drives badly. "Not scored" is a state; a plausible zero is a lie the
   * gauge tells on the app's behalf.
   */
  score: number | null;
  /** A named step, or an explicit diameter in px for one-off hero layouts. */
  size?: 'sm' | 'md' | 'lg' | number;
  animated?: boolean;
  /** The caption under the figure. Defaults to the denominator. */
  label?: string;
}

/**
 * The figure on a one-off diameter snaps to the nearest ramp step rather than
 * computing a size, so the leading and tracking stay paired with it.
 */
const FIGURE_STEPS = [
  { fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm },
  { fontSize: FS.md, lineHeight: LH.md, letterSpacing: TR.md },
  { fontSize: FS.base, lineHeight: LH.base, letterSpacing: TR.base },
  { fontSize: FS.lg, lineHeight: LH.lg, letterSpacing: TR.lg },
  { fontSize: FS.xl, lineHeight: LH.xl, letterSpacing: TR.xl },
  { fontSize: FS.xxl, lineHeight: LH.xxl, letterSpacing: TR.xxl },
  { fontSize: FS.xxxl, lineHeight: LH.xxxl, letterSpacing: TR.xxxl },
  { fontSize: FS.display, lineHeight: LH.display, letterSpacing: TR.display },
] as const;

function nearestFigureStep(target: number) {
  return FIGURE_STEPS.reduce((best, step) =>
    Math.abs(step.fontSize - target) < Math.abs(best.fontSize - target) ? step : best,
  );
}

/** A one-off diameter still gets proportional stroke and figure sizes. */
function configFor(size: 'sm' | 'md' | 'lg' | number) {
  if (typeof size !== 'number') return SIZES[size];
  const figure = nearestFigureStep(size * 0.26);
  return {
    diameter: size,
    stroke: Math.max(3, Math.round(size * 0.053)),
    showLabel: size >= 80,
    fontSize: figure.fontSize,
    lineHeight: figure.lineHeight,
    letterSpacing: figure.letterSpacing,
  };
}

/** Polar to cartesian on the gauge circle, with 0deg at twelve o'clock. */
function pointAt(centre: number, radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [centre + radius * Math.cos(radians), centre + radius * Math.sin(radians)];
}

/** The full 270-degree track as a single SVG arc path. */
function arcPath(centre: number, radius: number): string {
  const [x1, y1] = pointAt(centre, radius, START_DEGREES);
  const [x2, y2] = pointAt(centre, radius, START_DEGREES + SWEEP_DEGREES);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score: rawScore,
  size = 'lg',
  animated = true,
  label = '/ 100',
}) => {
  const pending = rawScore == null;
  const score = rawScore ?? 0;
  const cfg = configFor(size);
  const radius = (cfg.diameter - cfg.stroke) / 2;
  const centre = cfg.diameter / 2;
  const arcLength = (2 * Math.PI * radius * SWEEP_DEGREES) / 360;
  const pct = Math.min(Math.max(score, 0), 100) / 100;

  const [reduceMotion, setReduceMotion] = useState(false);
  const fillAnim = useRef(new A.Value(arcLength)).current;
  const counterAnim = useRef(new A.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(score);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (mounted) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      if (mounted) setReduceMotion(on);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    // A driver who has asked the system to stop animating gets the figure
    // straight away. The score is information, never withheld for an effect.
    if (pending) {
      fillAnim.setValue(arcLength);
      return;
    }

    if (!animated || reduceMotion) {
      fillAnim.setValue(arcLength * (1 - pct));
      setDisplayScore(score);
      return;
    }

    fillAnim.setValue(arcLength);
    counterAnim.setValue(0);

    A.parallel([
      A.timing(fillAnim, { toValue: arcLength * (1 - pct), duration: 900, useNativeDriver: false }),
      A.timing(counterAnim, { toValue: score, duration: 900, useNativeDriver: false }),
    ]).start(() => {
      if (Platform.OS !== 'web') {
        try {
          const Haptics = require('expo-haptics');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    });

    const listener = counterAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    return () => counterAnim.removeListener(listener);
  }, [score, pending, animated, reduceMotion, arcLength, pct]);

  const track = arcPath(centre, radius);

  return (
    <View
      style={{ width: cfg.diameter, height: cfg.diameter, alignSelf: 'center' }}
      accessibilityRole="image"
      accessibilityLabel={
        pending ? 'Safety score not available yet' : `Safety score ${Math.round(score)} out of 100`
      }
    >
      <Svg width={cfg.diameter} height={cfg.diameter}>
        <Defs>
          <LinearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            {C.ring.map((stop) => (
              <Stop key={stop.o} offset={stop.o} stopColor={stop.c} />
            ))}
          </LinearGradient>
        </Defs>

        <Path
          d={track}
          stroke={C.surface3}
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          fill="none"
        />

        <AnimatedPath
          d={track}
          stroke="url(#scoreGrad)"
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={arcLength}
          strokeDashoffset={fillAnim}
        />
      </Svg>

      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.centre}>
          {pending ? (
            <Text style={styles.pendingText}>Not scored</Text>
          ) : (
            <Text
              style={[
                styles.scoreText,
                { fontSize: cfg.fontSize, lineHeight: cfg.lineHeight, letterSpacing: cfg.letterSpacing },
              ]}
            >
              {displayScore}
            </Text>
          )}
          {cfg.showLabel && (
            <Text style={styles.subtitleText}>{pending ? 'no trips yet' : label}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontFamily: F.monoSemiBold,
    color: C.text.hero,
    fontVariant: ['tabular-nums'],
  },
  pendingText: {
    ...T.label,
    color: C.text.sec,
  },
  subtitleText: {
    ...T.caption,
    color: C.text.mut,
    marginTop: -2,
  },
});

export default ScoreRing;
