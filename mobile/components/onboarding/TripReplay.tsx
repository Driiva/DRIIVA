import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, withDelay,
  useAnimatedStyle, withSequence,
} from 'react-native-reanimated';
import { C, F, R, RGB, alpha, FS, LH, TR, T } from '@/components/ui/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TRIP_PATH = 'M 20 200 C 40 185 55 175 70 160 S 95 145 115 130 S 140 115 160 105 S 185 90 205 80 S 230 68 255 58 S 272 48 285 42';
const PATH_LENGTH = 330;

interface Event {
  label: string;
  delta: string;
  delay: number;
}

const EVENTS: Event[] = [
  { label: 'Smooth braking detected', delta: '+8', delay: 1200 },
  { label: 'Speed limit observed', delta: '+5', delay: 2000 },
  { label: 'Eco-efficient acceleration', delta: '+4', delay: 2800 },
  { label: 'Night Owl: 11 pm drive detected', delta: '+2', delay: 3600 },
];

interface Props {
  onComplete?: () => void;
}

export function TripReplay({ onComplete }: Props) {
  const pathProgress = useSharedValue(0);
  const dotOpacity = useSharedValue(0);

  useEffect(() => {
    pathProgress.value = withTiming(1, { duration: 4000 });
    dotOpacity.value = withDelay(4200, withTiming(1, { duration: 400 }));
    const timer = setTimeout(() => onComplete?.(), 4500);
    return () => clearTimeout(timer);
  }, []);

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LENGTH * (1 - pathProgress.value),
  }));

  return (
    <View>
      <View style={styles.mapContainer}>
        <Svg width="100%" height={220} viewBox="0 0 305 220" style={styles.svg}>
          <Path
            d={TRIP_PATH}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={3}
            fill="none"
          />
          <AnimatedPath
            d={TRIP_PATH}
            stroke={C.primary}
            strokeWidth={3}
            fill="none"
            strokeDasharray={PATH_LENGTH}
            animatedProps={animatedPathProps}
            strokeLinecap="round"
          />
          <Circle cx={20} cy={200} r={5} fill={C.success} />
          <Circle cx={285} cy={42} r={5} fill={C.primary} />
        </Svg>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Simulated trip</Text>
        </View>
      </View>

      <View style={styles.events}>
        {EVENTS.map((ev, i) => (
          <EventRow key={i} event={ev} index={i} />
        ))}
      </View>
    </View>
  );
}

function EventRow({ event, index }: { event: Event; index: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });
    }, event.delay);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.eventRow, style]}>
      <Text style={styles.eventLabel}>{event.label}</Text>
      <Text style={styles.eventDelta}>{event.delta} pts</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 220,
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  svg: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: alpha(RGB.black, 0.5),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    ...T.eyebrow,
    color: C.text.sec,
  },
  events: { gap: 8 },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.surface1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  eventLabel: { color: C.text.pri, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm },
  eventDelta: { ...T.numberSm, color: C.success },
});
