/**
 * The press-and-hold that ends a drive. Extracted verbatim from
 * mobile/app/(tabs)/record.tsx, including the note on why it is a hold and not
 * a tap.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { C, T, S, R, FS, alpha, RGB } from '@/components/ui/theme';
import { HOLD_TO_END_MS } from './readout';
import { styles } from './styles';

/**
 * A press and hold rather than a tap, because ending a drive closes the trace
 * and cannot be undone, and a phone in a mount gets brushed. The fill is the
 * confirmation: it shows the hold being served, so nobody has to guess how long
 * to keep their thumb down.
 */
export function HoldToEnd({ onEnd, label }: { onEnd: () => void; label: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const onPressIn = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    progress.value = reduceMotion ? 1 : withTiming(1, { duration: HOLD_TO_END_MS, easing: Easing.linear });
    timer.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onEnd();
    }, HOLD_TO_END_MS);
  }, [onEnd, progress, reduceMotion]);

  const onPressOut = useCallback(() => {
    clear();
    progress.value = withTiming(0, { duration: 160 });
  }, [clear, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Press and hold to end the drive"
      style={styles.holdWrap}
    >
      <Animated.View style={[styles.holdFill, fill]} pointerEvents="none" />
      <Text style={styles.holdLabel}>{label}</Text>
    </Pressable>
  );
}
