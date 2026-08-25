import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { C, F, FS, S, R, LH, TR } from '@/components/ui/theme';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch {
      Alert.alert('Error', 'Could not send reset email. Please check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.body}>
              We've sent a password reset link to {email}. Check your inbox and follow the link to reset your password.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/signin')}>
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.body}>
            Enter the email address associated with your account and we'll send you a reset link.
          </Text>
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
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={C.text.pri} /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
          </TouchableOpacity>

          <Link href="/(auth)/signin" asChild>
            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>Back to sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: S.lg },
  card: { backgroundColor: C.surface1, borderRadius: R.sheet, borderWidth: 1, borderColor: C.border, padding: S.lg },
  title: { fontSize: FS.xl, fontFamily: F.bodyBold, lineHeight: LH.xl, letterSpacing: TR.xl, color: C.text.pri, marginBottom: S.sm },
  body: { fontFamily: F.body, fontSize: FS.md, color: C.text.sec, marginBottom: S.lg, lineHeight: LH.md, letterSpacing: TR.md },
  input: { backgroundColor: C.surface3, borderRadius: R.card, paddingHorizontal: S.md, paddingVertical: 14, fontFamily: F.body, fontSize: FS.md, lineHeight: LH.md, letterSpacing: TR.md, color: C.text.pri, borderWidth: 1, borderColor: C.border },
  button: { backgroundColor: C.primary, borderRadius: R.card, paddingVertical: 16, alignItems: 'center', marginTop: S.md },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: C.text.pri, fontSize: FS.lg, fontFamily: F.bodyBold, lineHeight: LH.lg, letterSpacing: TR.lg },
  link: { alignItems: 'center', marginTop: S.md },
  linkText: { color: C.primaryLight, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm },
});
