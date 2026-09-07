/**
 * The breathing 270 degree arc behind the live speed readout. Extracted
 * verbatim from mobile/app/(tabs)/record.tsx.
 */
import { useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { C, alpha, RGB } from '@/components/ui/theme';
import { ARC_SIZE, ARC_STROKE, arcPath } from './arcGeometry';
import { styles } from './styles';

/**
 * The breathing arc. It is not a gauge and does not encode a value: it says
 * capture is alive, which is the one thing a driver glancing at a mounted phone
 * needs. Reduce-motion holds it steady rather than removing it, because it is
 * the only thing on screen saying the trip is running.
 */
export function LiveArc({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (active && !reduceMotion) {
      breath.value = 0;
      breath.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breath);
      breath.value = 0;
    }
    return () => cancelAnimation(breath);
  }, [active, reduceMotion, breath]);

  const style = useAnimatedStyle(() => ({ opacity: 0.35 + breath.value * 0.45 }));
  const centre = ARC_SIZE / 2;
  const radius = (ARC_SIZE - ARC_STROKE) / 2;

  return (
    <Animated.View style={[styles.arc, style]} pointerEvents="none">
      <Svg width={ARC_SIZE} height={ARC_SIZE}>
        <Path
          d={arcPath(centre, radius)}
          stroke={C.primary}
          strokeWidth={ARC_STROKE}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
