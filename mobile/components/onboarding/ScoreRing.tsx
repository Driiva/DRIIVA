import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming,
} from 'react-native-reanimated';
import { scoreColor } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number;
  size?: number;
  label?: string;
  animate?: boolean;
}

export function ScoreRing({ score, size = 160, label = 'Score', animate = true }: Props) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const progress = useSharedValue(animate ? 0 : score / 100);

  useEffect(() => {
    if (!animate) return;
    progress.value = withTiming(score / 100, { duration: 1200 });
  }, [score, animate]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const color = scoreColor(score);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={8}
          fill="none"
        />
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.score, { color }]}>{score}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
  score: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -0.04,
    lineHeight: 48,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.08,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
