/**
 * SurfaceCard - the one card surface in the app.
 *
 * This replaces the old glass card. Glassmorphism is the marketing mode and the design
 * system says the two modes are never mixed: an app surface is solid #12111f
 * on #0a0a14, so a translucent purple pane sitting on the tab stack was the
 * marketing site leaking into the instrument. Same props, same radius, same
 * padding ladder, opaque material.
 */
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { C, R, RGB, alpha } from './theme';

type Padding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

const PAD: Record<Padding, number> = {
  none: 0,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
};

interface SurfaceCardProps {
  children: React.ReactNode;
  padding?: Padding;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** One step up the dark scale, for nested or active surfaces. */
  elevated?: boolean;
}

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  children,
  padding = 'md',
  style,
  onPress,
  elevated = false,
}) => {
  const cardStyle: ViewStyle[] = [
    styles.base,
    elevated ? styles.elevated : styles.default,
    { padding: PAD[padding] },
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={[cardStyle, style]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: R.card,
    borderWidth: 1,
    // Depth comes from the shadow, not from letting the ground show through.
    shadowColor: alpha(RGB.black, 1),
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  default: {
    backgroundColor: C.surface1,
    borderColor: C.border,
  },
  elevated: {
    backgroundColor: C.surface2,
    borderColor: C.borderActive,
  },
});

export default SurfaceCard;
