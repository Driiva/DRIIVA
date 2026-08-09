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
import { router } from 'expo-router';
import { C, T, S, R } from '@/components/ui/theme';
import { registerForPush, unregisterPush, getPushPermission, type PushPermission } from '@/lib/push';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function Settings() {
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<PushPermission>('undetermined');

  useEffect(() => {
    getPushPermission().then(setPermission);
  }, []);

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

  /*
   * The flag alone was doing nothing: the weekly cron skips any user with no
   * fcmTokens, so switching this on wrote `true` and still delivered nothing.
   * Turning it on now actually registers this device, and turning it off
   * removes its token so a shared or resold handset stops receiving somebody
   * else's driving notifications.
   *
   * This is also the deliberate moment to ask for permission: the person has
   * just reached for the switch, which is the only point at which the one
   * prompt iOS grants is worth spending.
   */
  const toggleNotifications = async (value: boolean) => {
    if (!user?.id) return;
    setNotificationsEnabled(value);
    setSaving(true);
    try {
      if (value) {
        const result = await registerForPush(user.id);
        setPermission(result);
        if (result !== 'granted') {
          // Do not record a preference the device will not honour.
          setNotificationsEnabled(false);
          Alert.alert(
            'Notifications are off for Driiva',
            'iOS is blocking them. Turn them on for Driiva in Settings, then come back.',
          );
          return;
        }
      } else {
        await unregisterPush(user.id);
      }

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
        <SurfaceCard padding="none" style={{ marginBottom: S.lg }}>
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
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="albums-outline" size={20} color={C.text.sec} />
            <Text style={styles.rowLabel}>Notification history</Text>
            <Ionicons name="chevron-forward" size={18} color={C.text.mut} />
          </TouchableOpacity>
          <View style={[styles.row, styles.rowLast]}>
            <Ionicons name="moon-outline" size={20} color={C.text.sec} />
            <Text style={styles.rowLabel}>Appearance</Text>
            <Text style={styles.rowValue}>Dark</Text>
          </View>
        </SurfaceCard>

        {permission === 'denied' && (
          <Text style={styles.permissionNote}>
            Notifications are blocked for Driiva in iOS Settings. The switch
            above cannot override that.
          </Text>
        )}

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
  permissionNote: { ...T.caption, color: C.text.mut, marginTop: -S.md, marginBottom: S.lg, lineHeight: 16 },
  rowValue: { ...T.body, color: C.text.sec },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    paddingVertical: 16, marginTop: S.sm,
  },
  logoutText: { ...T.h2, color: C.error },
});
