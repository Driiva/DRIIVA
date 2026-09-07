/**
 * EmptyState - Centred placeholder for empty lists/sections.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { C, T, S } from './theme';
import { DriivButton } from './DriivButton';

interface EmptyStateProps {
  /** An Ionicons glyph name, checked against the set the icon font actually has. */
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, action }) => (
  <View style={styles.container}>
    <Ionicons name={icon} size={48} color={C.text.mut} style={styles.icon} />
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    {action && (
      <DriivButton
        title={action.label}
        onPress={action.onPress}
        variant="secondary"
        block={false}
        style={styles.button}
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: S.xxl,
    paddingHorizontal: S.xl,
  },
  icon: {
    marginBottom: S.md,
    opacity: 0.5,
  },
  title: {
    ...T.h2,
    color: C.text.pri,
    textAlign: 'center',
  },
  subtitle: {
    ...T.body,
    color: C.text.sec,
    textAlign: 'center',
    marginTop: S.xs,
  },
  button: {
    marginTop: S.lg,
    paddingHorizontal: S.xl,
  },
});

export default EmptyState;
