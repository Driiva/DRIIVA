/**
 * ROUTE TRACE
 * ===========
 * The recorded GPS trace of one trip, drawn as an instrument rather than
 * plotted on somebody else's map tiles.
 *
 * WHY NOT A MAP
 * Three reasons, in order of how much they matter.
 *
 * 1. A basemap is another company's design language dropped into the middle of
 *    an instrument panel. The philosophy for this app is that nothing
 *    ornamental survives and every surviving element justifies itself; street
 *    labels, park polygons and points of interest justify nothing about how
 *    the trip was driven.
 * 2. The shape of the drive is the information. Where the driver braked, how
 *    much of the trip was straight, whether the route doubled back. A trace at
 *    full contrast says that; a thin line over a beige city does not.
 * 3. react-native-maps is not in Expo Go, so the map panel was permanently a
 *    fallback string in every preview build, which is where most of this
 *    screen has ever been looked at.
 *
 * The projection is equirectangular with a cosine correction on longitude,
 * which is accurate enough over the few kilometres a trip covers and is honest
 * about being a shape rather than a map.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedProps } from 'react-native-reanimated';

import { C, T, S, R, RGB, alpha } from './theme';
import { useDrawOn } from './motion';
import {
  BOX,
  MAX_TRACE_POINTS,
  projectTrace,
  thinTrace,
  type TracePoint,
} from './routeGeometry';

export type { TracePoint };

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface TraceMarker {
  /** Index into the ORIGINAL points array, before any thinning. */
  index: number;
  colour: string;
  label: string;
}

interface RouteTraceProps {
  points: TracePoint[];
  markers?: TraceMarker[];
  /** How long the trace takes to draw itself, in ms. */
  duration?: number;
}

export function RouteTrace({ points, markers = [], duration = 1400 }: RouteTraceProps) {
  const { items: sampled, step } = useMemo(() => thinTrace(points, MAX_TRACE_POINTS), [points]);
  const projected = useMemo(() => projectTrace(sampled), [sampled]);
  const progress = useDrawOn(duration);

  const animated = useAnimatedProps(() => ({
    strokeDashoffset: (projected?.length ?? 0) * (1 - progress.value),
  }));

  if (!projected) {
    return (
      <View style={styles.frame}>
        <Text style={styles.empty}>No route was recorded for this trip.</Text>
      </View>
    );
  }

  const start = projected.xy[0];
  const end = projected.xy[projected.xy.length - 1];

  return (
    <View>
      <View style={styles.frame}>
        <Svg
          width="100%"
          height={BOX.height}
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          accessibilityLabel={`Recorded route, ${points.length} GPS points`}
        >
          {/* The full shape at low contrast, so the trace draws INTO something
              rather than out of nothing. */}
          <Path
            d={projected.path}
            stroke={alpha(RGB.white, 0.07)}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          <AnimatedPath
            d={projected.path}
            stroke={C.primary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={projected.length}
            animatedProps={animated}
          />

          {markers.map((marker) => {
            const at = projected.xy[Math.min(Math.floor(marker.index / step), projected.xy.length - 1)];
            if (!at) return null;
            return (
              <Circle
                key={`${marker.label}-${marker.index}`}
                cx={at[0]}
                cy={at[1]}
                r={4}
                fill={marker.colour}
                stroke={C.bg}
                strokeWidth={1.5}
              />
            );
          })}

          <Circle cx={start[0]} cy={start[1]} r={5} fill={C.success} />
          <Circle cx={end[0]} cy={end[1]} r={5} fill={C.primaryLight} />
        </Svg>
      </View>

      <View style={styles.legend}>
        <LegendItem colour={C.success} label="Start" />
        <LegendItem colour={C.primaryLight} label="End" />
        {[...new Map(markers.map((m) => [m.label, m])).values()].map((m) => (
          <LegendItem key={m.label} colour={m.colour} label={m.label} />
        ))}
      </View>
    </View>
  );
}

function LegendItem({ colour, label }: { colour: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: colour }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: C.surface2,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    justifyContent: 'center',
    minHeight: BOX.height,
  },
  empty: { ...T.body, color: C.text.mut, textAlign: 'center', padding: S.md },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md, marginTop: S.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { ...T.caption, color: C.text.sec },
});

export default RouteTrace;
