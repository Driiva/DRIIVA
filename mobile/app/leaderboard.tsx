/**
 * Leaderboard - Driiva Mobile
 * The real read against the leaderboard collection is Wave B scope. Until
 * then this is an honest placeholder, not a demo/fake ranking table.
 */
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, S } from '@/components/ui/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Leaderboard() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Leaderboard" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.wrap}>
          <EmptyState
            icon="bar-chart-outline"
            title="Coming this week"
            subtitle="Global and friends rankings are on the way, built on real scores. Nothing to fake here in the meantime."
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
