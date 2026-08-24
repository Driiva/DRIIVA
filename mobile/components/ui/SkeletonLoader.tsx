/**
 * SkeletonLoader - the loading state, at the shape of the thing that is
 * loading.
 *
 * REDUCED MOTION
 * The shimmer used to run unconditionally. A pulsing rectangle is precisely
 * the kind of repeating movement a reader who asked the operating system for
 * less motion is asking not to see, and a loading screen is where they see the
 * most of it. Under the preference the placeholder holds a steady mid opacity
 * instead: still legibly a placeholder, no pulse.
 *
 * The animation is Reanimated rather than the Animated API it used before, so
 * the loop runs on the UI thread and does not compete with the Firestore
 * snapshot that is about to replace it.
 */
import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { C } from './theme';
import { useReduceMotion } from './motion';

interface SkeletonLoaderProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** The two ends of the pulse. Low enough to read as absent, never invisible. */
const DIM = 0.3;
const BRIGHT = 0.6;
const STEADY = 0.45;

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width,
  height,
  borderRadius = 8,
  style,
}) => {
  const reduceMotion = useReduceMotion();
  const shimmer = useSharedValue(reduceMotion ? STEADY : DIM);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(shimmer);
      shimmer.value = STEADY;
      return;
    }

    shimmer.value = withRepeat(
      withTiming(BRIGHT, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );

    return () => cancelAnimation(shimmer);
  }, [reduceMotion, shimmer]);

  const animated = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[styles.base, { width, height, borderRadius }, animated, style]}
    />
  );
};

const styles = StyleSheet.create({
  base: { backgroundColor: C.surface2 },
});

export default SkeletonLoader;
