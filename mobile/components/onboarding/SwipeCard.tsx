import { useRef, useState } from 'react';
import {
  View, Text, PanResponder, Animated, StyleSheet, Dimensions,
} from 'react-native';
import { Colors, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

interface Props {
  statement: string;
  index: number;
  total: number;
  onSwipe: (agreed: boolean) => void;
}

export function SwipeCard({ statement, index, total, onSwipe }: Props) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [swiped, setSwiped] = useState(false);

  const rotate = pan.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const agreeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const disagreeOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !swiped,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, { dx }) => {
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        setSwiped(true);
        Animated.timing(pan, {
          toValue: { x: dx > 0 ? width * 1.5 : -width * 1.5, y: 0 },
          duration: 250,
          useNativeDriver: false,
        }).start(() => onSwipe(dx > 0));
      } else {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    },
  });

  return (
    <Animated.View
      style={[styles.card, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[styles.label, styles.agreeLabel, { opacity: agreeOpacity }]}>
        <Text style={styles.labelText}>Yes, that's me</Text>
      </Animated.View>
      <Animated.View style={[styles.label, styles.disagreeLabel, { opacity: disagreeOpacity }]}>
        <Text style={styles.labelText}>Not really</Text>
      </Animated.View>

      <Text style={styles.counter}>{index + 1} of {total}</Text>
      <Text style={styles.statement}>{statement}</Text>

      <View style={styles.hints}>
        <Text style={styles.hint}>← Not really</Text>
        <Text style={styles.hint}>Yes, that's me →</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: width - 48,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 32,
    minHeight: 220,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  counter: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.06,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  statement: {
    color: '#fafafa',
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 29,
    letterSpacing: -0.01,
  },
  hints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  hint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  label: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
  },
  agreeLabel: {
    right: 20,
    borderColor: Colors.success,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  disagreeLabel: {
    left: 20,
    borderColor: Colors.error,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  labelText: {
    color: '#fafafa',
    fontSize: 13,
    fontWeight: '700',
  },
});
