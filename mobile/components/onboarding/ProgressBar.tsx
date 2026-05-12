import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

interface Props {
  step: number;
  total: number;
}

export function ProgressBar({ step, total }: Props) {
  const progress = useSharedValue(step / total);

  useEffect(() => {
    progress.value = withTiming(step / total, { duration: 600 });
  }, [step, total]);

  const fill = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
});
