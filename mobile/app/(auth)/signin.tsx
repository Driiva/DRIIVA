/**
 * Sign In - Driiva Mobile
 * Matches the web app's glassmorphic sign-in page.
 */
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { C, F, FS, S, R, LH, TR } from '@/components/ui/theme';
import * as Haptics from 'expo-haptics';

export default function SignIn() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-credential') {
        Alert.alert('Sign in failed', 'Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        Alert.alert('Too many attempts', 'Please try again later.');
      } else {
        Alert.alert('Sign in failed', 'Something went wrong. Please try again.');
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
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Driiva</Text>
          <Text style={styles.tagline}>Drive safe. Get rewarded.</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>

          <TextInput
            style={styles.input}
            placeholder="Email or username"
            placeholderTextColor={C.text.mut}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={C.text.mut}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={C.text.pri} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Sign up link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: S.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: S.xxl,
  },
  logoText: {
    fontSize: FS.display,
    fontFamily: F.display,
    color: C.text.pri,
    lineHeight: LH.display,
    letterSpacing: TR.display,
  },
  tagline: {
    fontFamily: F.body,
    fontSize: FS.md,
    lineHeight: LH.md,
    letterSpacing: TR.md,
    color: C.text.sec,
    marginTop: S.xs,
  },
  card: {
    backgroundColor: C.surface1,
    borderRadius: R.sheet,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.lg,
  },
  title: {
    fontSize: FS.xl,
    fontFamily: F.bodyBold,
    lineHeight: LH.xl,
    letterSpacing: TR.xl,
    color: C.text.pri,
    marginBottom: S.lg,
  },
  input: {
    backgroundColor: C.surface3,
    borderRadius: R.card,
    paddingHorizontal: S.md,
    paddingVertical: 14,
    fontFamily: F.body,
    fontSize: FS.md,
    lineHeight: LH.md,
    letterSpacing: TR.md,
    color: C.text.pri,
    marginBottom: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  button: {
    backgroundColor: C.primary,
    borderRadius: R.card,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: S.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: C.text.pri,
    fontSize: FS.lg,
    fontFamily: F.bodyBold,
    lineHeight: LH.lg,
    letterSpacing: TR.lg,
  },
  link: {
    alignItems: 'center',
    marginTop: S.md,
  },
  linkText: {
    color: C.primaryLight,
    fontFamily: F.body,
    fontSize: FS.sm,
    lineHeight: LH.sm,
    letterSpacing: TR.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: S.lg,
  },
  footerText: {
    color: C.text.sec,
    fontFamily: F.body,
    fontSize: FS.md,
    lineHeight: LH.md,
    letterSpacing: TR.md,
  },
  footerLink: {
    color: C.primaryLight,
    fontSize: FS.md,
    fontFamily: F.bodySemiBold,
    lineHeight: LH.md,
    letterSpacing: TR.md,
  },
});
