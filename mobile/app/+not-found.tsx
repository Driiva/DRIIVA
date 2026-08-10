/**
 * Not found - Driiva Mobile
 * A wrong route is a small failure, not an event. It gets the same instrument
 * surface as every other screen and a way back, with no exclamation.
 */
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { C, T, S } from '@/components/ui/theme';
import { ROUTE_DASHBOARD } from '@/lib/routing';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen does not exist.</Text>
        <Text style={styles.body}>
          The link you followed points somewhere Driiva does not have a screen for.
        </Text>

        {/*
          Points at the dashboard directly, not at "/". This screen used to
          link to the root route, which had no file behind it and therefore
          resolved straight back to this screen. The way out was a loop, which
          reads as a dead tap rather than as a bug.
        */}
        <Link href={ROUTE_DASHBOARD} style={styles.link}>
          <Text style={styles.linkText}>Go to the dashboard</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: S.lg,
    backgroundColor: C.bg,
  },
  title: { ...T.h1, color: C.text.hero, textAlign: 'center' },
  body: { ...T.body, color: C.text.sec, textAlign: 'center', marginTop: S.sm },
  link: { marginTop: S.lg, paddingVertical: S.md },
  linkText: { ...T.h2, color: C.primary },
});
