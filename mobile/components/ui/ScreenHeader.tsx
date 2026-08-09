/**
 * ScreenHeader - Back button + title for stacked (non-tab) screens.
 * Shared by every profile sub-screen so the back affordance is identical.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, T, S, R } from './theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle }) => {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
        style={styles.back}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={22} color={C.text.pri} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={{ width: 36 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
    paddingBottom: S.sm,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: R.badge,
    backgroundColor: C.surface1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: S.sm,
  },
  title: { ...T.h1, color: C.text.hero },
  subtitle: { ...T.caption, color: C.text.sec, marginTop: 2 },
});

export default ScreenHeader;
