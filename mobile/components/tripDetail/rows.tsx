/**
 * The trip detail screen's header bar and its two stat rows. Extracted
 * verbatim from mobile/app/trips/[tripId].tsx.
 */
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '@/components/ui/theme';
import { styles } from './styles';

export function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.headerBar}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={C.text.pri} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Trip</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function EventStat({
  label,
  value,
  rate,
}: {
  label: string;
  value: number | string;
  rate: string | null;
}) {
  return (
    <View style={styles.eventStat}>
      <Text style={styles.eventValue}>{value}</Text>
      <Text style={styles.eventLabel}>{label}</Text>
      {rate !== null && <Text style={styles.eventRate}>{rate}</Text>}
    </View>
  );
}
