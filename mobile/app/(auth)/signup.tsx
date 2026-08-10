import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { C, F, FS, S, R } from '@/components/ui/theme';
import * as Haptics from 'expo-haptics';

export default function SignUp() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await signup(email.trim(), password, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        Alert.alert('Account exists', 'An account with this email already exists.');
      } else if (code === 'auth/invalid-email') {
        Alert.alert('Invalid email', 'Please enter a valid email address.');
      } else {
        Alert.alert('Sign up failed', 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Driiva</Text>
          <Text style={styles.tagline}>Join the safe driving revolution</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create account</Text>

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={C.text.mut}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            textContentType="name"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={C.text.mut}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={C.text.mut}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={C.text.pri} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.terms}>
            By signing up you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/signin" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: S.lg },
  logoContainer: { alignItems: 'center', marginBottom: S.xxl },
  logoText: { fontSize: FS.display, fontFamily: F.display, color: C.text.pri, letterSpacing: -1 },
  tagline: { fontFamily: F.body, fontSize: FS.md, color: C.text.sec, marginTop: S.xs },
  card: { backgroundColor: C.surface1, borderRadius: R.sheet, borderWidth: 1, borderColor: C.border, padding: S.lg },
  title: { fontSize: FS.xl, fontFamily: F.bodyBold, color: C.text.pri, marginBottom: S.lg },
  input: { backgroundColor: C.surface3, borderRadius: R.card, paddingHorizontal: S.md, paddingVertical: 14, fontFamily: F.body, fontSize: FS.md, color: C.text.pri, marginBottom: S.sm, borderWidth: 1, borderColor: C.border },
  button: { backgroundColor: C.primary, borderRadius: R.card, paddingVertical: 16, alignItems: 'center', marginTop: S.md },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: C.text.pri, fontSize: FS.lg, fontFamily: F.bodyBold },
  terms: { color: C.text.mut, fontFamily: F.body, fontSize: FS.xs, textAlign: 'center', marginTop: S.md, lineHeight: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: S.lg, paddingBottom: S.xxl },
  footerText: { color: C.text.sec, fontFamily: F.body, fontSize: FS.md },
  footerLink: { color: C.primaryLight, fontSize: FS.md, fontFamily: F.bodySemiBold },
});
