/**
 * Profile - Driiva Mobile
 */
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { C, F, FS, S, R } from '@/components/ui/theme';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        {/* User info */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? 'D'}</Text>
          </View>
          <Text style={styles.name}>{user?.name ?? 'Driver'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Menu items */}
        <View style={styles.card}>
          <MenuItem icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
          <MenuItem icon="car-outline" label="Vehicle" onPress={() => router.push('/vehicle')} />
          <MenuItem icon="shield-checkmark-outline" label="Policy" onPress={() => router.push('/policy')} />
          <MenuItem icon="trophy-outline" label="Achievements" onPress={() => router.push('/achievements')} />
          <MenuItem icon="bar-chart-outline" label="Leaderboard" onPress={() => router.push('/leaderboard')} />
          <MenuItem icon="help-circle-outline" label="Support" onPress={() => router.push('/support')} />
        </View>

        {/* Legal */}
        <View style={styles.card}>
          <MenuItem icon="document-text-outline" label="Privacy Policy" onPress={() => router.push('/privacy')} />
          <MenuItem icon="document-outline" label="Terms of Service" onPress={() => router.push('/terms')} />
          <MenuItem icon="shield-outline" label="Trust Centre" onPress={() => router.push('/trust')} />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={C.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Driiva v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={20} color={C.text.sec} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={C.text.mut} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: S.md, paddingBottom: 100 },
  title: { fontSize: FS.xxl, fontFamily: F.bodyBold, color: C.text.pri, marginTop: S.md, marginBottom: S.md },

  card: {
    backgroundColor: C.surface1, borderRadius: R.card, borderWidth: 1,
    borderColor: C.border, padding: S.md, marginBottom: S.md,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: S.sm,
  },
  avatarText: { fontSize: FS.xxl, fontFamily: F.bodyBold, color: C.text.pri },
  name: { fontSize: FS.xl, fontFamily: F.bodyBold, color: C.text.pri, textAlign: 'center' },
  email: { fontFamily: F.body, fontSize: FS.sm, color: C.text.sec, textAlign: 'center', marginTop: 2 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  menuLabel: { flex: 1, fontFamily: F.body, fontSize: FS.md, color: C.text.pri, marginLeft: S.sm },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: S.sm,
  },
  logoutText: { fontSize: FS.md, color: C.error, fontFamily: F.bodySemiBold },

  version: { fontFamily: F.body, fontSize: FS.xs, color: C.text.mut, textAlign: 'center', marginTop: S.sm },
});
