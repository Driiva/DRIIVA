/**
 * CountUp - the mobile twin of the web AnimatedNumber.
 *
 * Same three behaviours the web component settled on, in reanimated terms:
 *
 * 1. It respects reduced motion. A driver who has asked the system to stop
 *    animating gets the final figure immediately. The number is information;
 *    it is never withheld for the sake of an effect.
 * 2. Tabular figures, so digits hold their columns instead of the number
 *    jittering wider and narrower on every frame of the count.
 * 3. It counts from the previous value on change, not from zero, so a score
 *    that moves 82 -> 84 animates two points rather than replaying the whole
 *    number.
 *
 * The web version also gates on IntersectionObserver so a figure below the fold
 * does not finish counting before it is seen. There is no equivalent here
 * because every screen that uses it counts a figure that is already on screen
 * (the refund moment is a full-screen overlay); an off-screen count-up on
 * mobile should be driven by the caller mounting this late instead.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, type StyleProp, type TextStyle } from 'react-native';
import { Easing, cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';

/** --ease-fast: the reveal curve, matching the web tokens. */
const EASE_FAST = Easing.bezier(0.22, 1, 0.36, 1);

interface CountUpProps {
  value: number;
  /** Duration in ms. Kept inside the 150-450ms motion band by default. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Renders a leading + on positive values. For deltas. */
  signed?: boolean;
  style?: StyleProp<TextStyle>;
}

export function formatCountValue(
  n: number,
  decimals: number,
  prefix: string,
  suffix: string,
  signed: boolean,
): string {
  const rounded = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
  // Guard the -0 that toFixed produces for tiny negatives.
  const normalised = Number(rounded) === 0 ? (decimals > 0 ? (0).toFixed(decimals) : '0') : rounded;
  const sign = signed && Number(normalised) > 0 ? '+' : '';
  return `${sign}${prefix}${normalised}${suffix}`;
}

export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  signed = false,
  style,
}: CountUpProps) {
  const progress = useSharedValue(value);
  const previous = useRef(value);
  const [display, setDisplay] = useState(() =>
    formatCountValue(value, decimals, prefix, suffix, signed),
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useAnimatedReaction(
    () => progress.value,
    (current) => {
      runOnJS(setDisplay)(formatCountValue(current, decimals, prefix, suffix, signed));
    },
    [decimals, prefix, suffix, signed],
  );

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    if (from === value || reduceMotion) {
      cancelAnimation(progress);
      progress.value = value;
      setDisplay(formatCountValue(value, decimals, prefix, suffix, signed));
      return;
    }

    progress.value = from;
    progress.value = withTiming(value, { duration, easing: EASE_FAST });

    return () => cancelAnimation(progress);
  }, [value, duration, decimals, prefix, suffix, signed, reduceMotion, progress]);

  return (
    <Text
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      accessibilityLabel={formatCountValue(value, decimals, prefix, suffix, signed)}
    >
      {display}
    </Text>
  );
}

export default CountUp;
