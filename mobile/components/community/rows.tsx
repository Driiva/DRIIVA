/**
 * The Community screen's small presentational rows: a section heading, a
 * figure with its label, and a standing row. Extracted verbatim from
 * mobile/app/(tabs)/community.tsx.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, scoreColor } from '@/components/ui/theme';
import { anonymise } from './display';
import { styles } from './styles';
import type { Ranking } from './types';

export function SectionHead({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionHead}>
      <Ionicons name={icon as never} size={16} color={C.text.sec} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

export function Figure({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <View style={styles.figure}>
      {value}
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

export function StandingRow({ entry, isMe }: { entry: Ranking; isMe: boolean }) {
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <Text style={[styles.rank, isMe && styles.rankMe]}>{entry.rank}</Text>
      <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
        {isMe ? 'You' : anonymise(entry.displayName)}
      </Text>
      <Text style={[styles.rowScore, { color: scoreColor(entry.score) }]}>
        {Math.round(entry.score)}
      </Text>
    </View>
  );
}
