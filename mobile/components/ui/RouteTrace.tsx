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
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
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

/**
 * Marker shapes, NOT marker colours.
 *
 * Four event types need four distinguishable marks, and four different hues on
 * a near-monochrome instrument is a rainbow. Colour here is earned once and
 * means one thing: amber, and amber warns. What separates a hard stop from a
 * sharp turn is the shape of the mark, which also survives being read by
 * somebody who cannot separate the hues.
 */
export type MarkerShape = 'circle' | 'triangle' | 'diamond' | 'bar';

export interface TraceMarker {
  /** Index into the ORIGINAL points array, before any thinning. */
  index: number;
  shape: MarkerShape;
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
            // The marker index is into the array BEFORE thinning, so it has to
            // be divided by the step. Without that every marker past the
            // thinning threshold piles up on the final point.
            const at =
              projected.xy[Math.min(Math.floor(marker.index / step), projected.xy.length - 1)];
            if (!at) return null;
            return (
              <Mark
                key={`${marker.shape}-${marker.index}`}
                shape={marker.shape}
                x={at[0]}
                y={at[1]}
              />
            );
          })}

          <Circle cx={start[0]} cy={start[1]} r={4} fill={C.success} />
          <Circle cx={end[0]} cy={end[1]} r={4} fill={C.text.hero} />
        </Svg>
      </View>

      <View style={styles.legend}>
        <LegendItem label="Start" colour={C.success} />
        <LegendItem label="End" colour={C.text.hero} />
        {[...new Map(markers.map((m) => [m.shape, m])).values()].map((m) => (
          <LegendItem key={m.shape} label={m.label} shape={m.shape} />
        ))}
      </View>
    </View>
  );
}

/** One event mark, drawn in the single earned colour at a fixed weight. */
function Mark({ shape, x, y }: { shape: MarkerShape; x: number; y: number }) {
  const common = { fill: C.warning, stroke: C.bg, strokeWidth: 1.25 };
  if (shape === 'circle') return <Circle cx={x} cy={y} r={3.6} {...common} />;
  if (shape === 'triangle') {
    const r = 4.2;
    return <Polygon points={`${x},${y - r} ${x + r},${y + r} ${x - r},${y + r}`} {...common} />;
  }
  if (shape === 'diamond') {
    const r = 4.2;
    return <Polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} {...common} />;
  }
  return <Rect x={x - 1.4} y={y - 5} width={2.8} height={10} rx={1.2} {...common} />;
}

/** The legend swatch is the mark itself, at the size it is drawn on the trace. */
function LegendItem({
  label,
  colour,
  shape,
}: {
  label: string;
  colour?: string;
  shape?: MarkerShape;
}) {
  return (
    <View style={styles.legendItem}>
      {shape ? (
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Mark shape={shape} x={6} y={6} />
        </Svg>
      ) : (
        <View style={[styles.dot, { backgroundColor: colour }]} />
      )}
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
