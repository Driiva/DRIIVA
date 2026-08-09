/**
 * Achievements - Driiva Mobile
 * Real reward definitions/unlocks are Wave D scope. Until then this is an
 * honest placeholder, not fake milestone data.
 */
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, S } from '@/components/ui/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Achievements() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Achievements" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.wrap}>
          <EmptyState
            icon="trophy-outline"
            title="Coming this week"
            subtitle="Achievements tied to your real driving milestones are on the way. Nothing to fake here in the meantime."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: S.md },
  wrap: { flex: 1, justifyContent: 'center' },
});
