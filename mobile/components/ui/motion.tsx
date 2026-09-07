/**
 * MOTION
 * ======
 * The three motion primitives every screen uses, over the arithmetic in
 * motionCore.ts. Nothing here decides a duration or a distance; it only wires
 * the values in that module to Reanimated.
 *
 * WHAT MOTION IS FOR IN THIS APP
 * Four purposes, and a component that cannot name one of them does not get to
 * animate: feedback (a press was heard), preventing a jarring change (content
 * arriving with no bridge), state indication (a figure that has moved), and
 * spatial consistency (a thing leaves the way it came).
 *
 * REDUCED MOTION IS READ FROM REANIMATED, NOT FROM ACCESSIBILITYINFO
 * useReducedMotion() resolves synchronously on first render. The
 * AccessibilityInfo.isReduceMotionEnabled() promise (which CountUp still uses,
 * because it predates this) resolves a frame or two late, so a driver who
 * asked for less motion watches the first entrance play before the preference
 * lands. A guard that arrives after the animation is not a guard.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MOTION, enterFrom, pressFeedback, staggerDelay } from './motionCore';

/**
 * The reveal curve. Strong ease-out: it starts fast, which is the moment the
 * eye is actually watching. Never ease-in on a UI element; it delays the only
 * part of the motion anybody perceives and reads as lag.
 */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export { MOTION, staggerDelay } from './motionCore';

/** Synchronous on first render, unlike the AccessibilityInfo promise. */
export function useReduceMotion(): boolean {
  return useReducedMotion();
}

/**
 * A light haptic tick, safely.
 *
 * Loaded lazily and swallowed on failure for the same reason DriivButton does
 * it: haptics are unavailable on web and on a simulator, and a missing native
 * module must never be the reason a button stops working.
 */
export function tick(kind: 'select' | 'press' | 'success' = 'press'): void {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = require('expo-haptics');
    if (kind === 'select') {
      Haptics.selectionAsync();
    } else if (kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    /* no haptic engine here, which is not an error worth surfacing */
  }
}

// ─── ENTER ───────────────────────────────────────────────────────────────────

interface EnterProps {
  children: React.ReactNode;
  /** Position within a staggered group. Omit for a lone element. */
  index?: number;
  /** Size of the group, so the stagger can be capped against it. */
  count?: number;
  /** Extra delay in ms, on top of the stagger. For a section below the fold. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * One element arriving.
 *
 * Once per mount, deliberately: this is a decoration on first paint, not a
 * transition the driver drives. Re-running it on every state change would make
 * a live-updating dashboard flicker every time a Firestore snapshot lands.
 */
export function Enter({ children, index = 0, count = 1, delay = 0, style }: EnterProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const from = useMemo(() => enterFrom(reduceMotion), [reduceMotion]);
  const wait = staggerDelay(index, count, reduceMotion) + (reduceMotion ? 0 : delay);

  // The entrance plays once, from the delay as it stood at mount. Holding that
  // in a ref is what lets the dependency list be honest: `progress` is a shared
  // value with a stable identity, so naming it does not make this rerun.
  const waitOnMount = useRef(wait);

  useEffect(() => {
    progress.value = withDelay(
      waitOnMount.current,
      withTiming(1, { duration: MOTION.duration.enter, easing: EASE_OUT }),
    );
  }, [progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: from.opacity + (1 - from.opacity) * progress.value,
    transform: [
      { translateY: from.translateY * (1 - progress.value) },
      { scale: from.scale + (1 - from.scale) * progress.value },
    ],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

// ─── STAGGER ─────────────────────────────────────────────────────────────────

interface StaggerProps {
  children: React.ReactNode;
  /** Delay before the first child, for a group that sits below another one. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A group arriving one after another.
 *
 * Index and count are supplied here rather than typed at each call site, so a
 * card inserted in the middle of a screen cannot leave the cascade with two
 * items on the same beat and a gap after them.
 */
export function Stagger({ children, delay = 0, style }: StaggerProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={style}>
      {items.map((child, i) => (
        <Enter key={i} index={i} count={items.length} delay={delay}>
          {child}
        </Enter>
      ))}
    </View>
  );
}

// ─── PRESS ───────────────────────────────────────────────────────────────────

interface PressableCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Which haptic the press fires. 'select' for a list row, 'press' for a card. */
  haptic?: 'select' | 'press' | 'none';
  /** Style for the animated surface itself. */
  style?: StyleProp<ViewStyle>;
  /**
   * Layout style for the touch target around it. A pressable that has to take
   * part in a flex row needs the flex on the target, not on the thing that
   * scales, or the row collapses the moment a card becomes tappable.
   */
  outerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * A card that answers the finger.
 *
 * A spring rather than a timing curve: a press released mid-animation has to
 * reverse from where the card actually is, and a spring keeps its velocity
 * through the interruption where a timing curve restarts from zero.
 */
export function PressableCard({
  children,
  onPress,
  disabled = false,
  haptic = 'press',
  style,
  outerStyle,
  accessibilityLabel,
  accessibilityHint,
}: PressableCardProps) {
  const reduceMotion = useReduceMotion();
  const held = useSharedValue(0);
  const target = useMemo(() => pressFeedback(reduceMotion), [reduceMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: 1 + (target.opacity - 1) * held.value,
    transform: [{ scale: 1 + (target.scale - 1) * held.value }],
  }));

  if (!onPress || disabled) {
    return <View style={[outerStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      style={outerStyle}
      onPressIn={() => {
        held.value = withSpring(1, MOTION.spring.press);
      }}
      onPressOut={() => {
        held.value = withSpring(0, MOTION.spring.press);
      }}
      onPress={() => {
        if (haptic !== 'none') tick(haptic);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// ─── DRAW ON ─────────────────────────────────────────────────────────────────

/**
 * The 0 to 1 progress a route trace or a gauge arc is drawn against.
 *
 * Reduced motion lands the whole figure immediately. A gauge is information,
 * and information is never withheld for the sake of an effect.
 */
export function useDrawOn(duration: number, delay = 0) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  // The draw runs once, from the timing as it stood at mount, and again only if
  // the reduced-motion preference flips. A trace redrawing itself on every
  // snapshot is a distraction, so the timings are pinned in a ref rather than
  // named as dependencies.
  const timingOnMount = useRef({ duration, delay });

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      timingOnMount.current.delay,
      withTiming(1, { duration: timingOnMount.current.duration, easing: EASE_OUT }),
    );
  }, [reduceMotion, progress]);

  return progress;
}

export const motionStyles = StyleSheet.create({
  fill: { flex: 1 },
});
