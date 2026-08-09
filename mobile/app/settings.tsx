/**
 * Settings - Driiva Mobile
 * Notification prefs wired to users/{uid}.settings.notificationsEnabled.
 * Appearance is dark only for now (instrument mode has no light theme yet).
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R } from '@/components/ui/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function Settings() {
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .onSnapshot((doc: { data: () => { settings?: { notificationsEnabled?: boolean } } | undefined }) => {
        const data = doc.data();
        setNotificationsEnabled(data?.settings?.notificationsEnabled ?? true);
      });
    return unsubscribe;
  }, [user?.id]);

  const toggleNotifications = async (value: boolean) => {
    if (!user?.id) return;
    setNotificationsEnabled(value);
    setSaving(true);
    try {
      await firestore().collection('users').doc(user.id).update({
        'settings.notificationsEnabled': value,
      });
    } catch {
      setNotificationsEnabled(!value);
      Alert.alert('Could not save', 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <GlassCard padding="none" style={{ marginBottom: S.lg }}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color={C.text.sec} />
            <Text style={styles.rowLabel}>Notifications</Text>
            <Switch
              value={notificationsEnabled ?? true}
              onValueChange={toggleNotifications}
              disabled={notificationsEnabled === null || saving}
              trackColor={{ false: C.surface3, true: C.primary }}
              thumbColor={C.text.hero}
            />
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Ionicons name="moon-outline" size={20} color={C.text.sec} />
            <Text style={styles.rowLabel}>Appearance</Text>
            <Text style={styles.rowValue}>Dark</Text>
          </View>
        </GlassCard>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={C.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },
  sectionTitle: { ...T.label, color: C.text.sec, marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingVertical: 14, paddingHorizontal: S.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { ...T.body, color: C.text.pri, flex: 1 },
  rowValue: { ...T.body, color: C.text.sec },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    paddingVertical: 16, marginTop: S.sm,
  },
  logoutText: { ...T.h2, color: C.error },
});
