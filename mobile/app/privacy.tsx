/**
 * Privacy Policy - Driiva Mobile
 * Ported from client/src/pages/privacy.tsx. Same legal content, native layout.
 */
import type { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, T, S } from '@/components/ui/theme';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Link({ children }: { children: string }) {
  return (
    <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${children}`)}>
      {children}
    </Text>
  );
}

export default function Privacy() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Privacy policy" subtitle="Effective March 2026 · Driiva Ltd (UK)" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SurfaceCard padding="lg">
          <P>
            At Driiva we treat your data as carefully as your no-claims bonus. This
            policy explains what we collect, why, how we protect it, and your
            rights under UK GDPR.
          </P>

          <Section title="Who we are">
            <P>
              Driiva is the data controller for personal data collected through the
              app and related services. We are a UK-based telematics insurance
              platform that rewards safe driving with potential refunds from a
              community pool.
            </P>
          </Section>

          <Section title="What data we collect">
            <P>Driving and telematics data: GPS location during trips, speed, braking, acceleration, cornering, phone usage indicators, and trip metadata. This is used to calculate your driving score and eligibility for community refunds.</P>
            <P>Personal and account data: name, email, phone number, authentication data, and payment details (processed by our payment providers; we do not store full card numbers).</P>
            <P>We do not sell your personal data to third parties.</P>
          </Section>

          <Section title="How we use your data">
            <Bullets
              items={[
                'Reward safe driving with potential refunds from the community pool.',
                'Calculate your driving score and how it affects your premium and refunds.',
                'Price and administer your insurance and handle claims.',
                'Screen drivers at onboarding.',
                'Comply with legal and regulatory obligations (FCA, ICO).',
              ]}
            />
          </Section>

          <Section title="Third parties">
            <P>Firebase/Google Cloud (authentication, database, functions). Root Insurance Platform for insurance operations. Damoov, an EU-based telematics processor, for driving behaviour analytics under a GDPR Article 28 agreement.</P>
          </Section>

          <Section title="How we protect your data">
            <Bullets
              items={[
                'Encrypted in transit and at rest.',
                'Access restricted to authorised personnel and systems.',
                'Regular risk assessments and staff training.',
              ]}
            />
            <P>In the event of a breach that risks your rights, we notify the ICO within 72 hours where required.</P>
          </Section>

          <Section title="Data retention">
            <Bullets
              items={[
                'Trip and driving data: for the duration of your policy and 7 years after, or as required by law.',
                'Account data: until you delete your account or request erasure, subject to legal retention.',
              ]}
            />
          </Section>

          <Section title="Your rights (UK GDPR)">
            <Bullets
              items={[
                'Access a copy of your personal data, including telematics records and scores.',
                'Rectification of inaccurate data.',
                'Erasure of your data, subject to legal retention.',
                'Portability in a machine-readable format.',
                'Restrict or object to certain processing.',
                'Withdraw consent where processing is consent-based.',
                'Lodge a complaint with the ICO (ico.org.uk).',
              ]}
            />
            <P>To exercise these rights, contact us at <Link>info@driiva.co.uk</Link>. We respond within one month.</P>
          </Section>

          <Section title="Contact">
            <P>For privacy questions, email <Link>info@driiva.co.uk</Link>.</P>
          </Section>
        </SurfaceCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },
  section: { marginTop: S.lg },
  sectionTitle: { ...T.h2, color: C.text.hero, marginBottom: S.xs },
  p: { ...T.body, color: C.text.sec, marginBottom: S.xs },
  list: { marginBottom: S.xs, gap: 4 },
  listRow: { flexDirection: 'row', gap: 6 },
  bullet: { ...T.body, color: C.text.mut },
  listText: { ...T.body, color: C.text.sec, flex: 1 },
  link: { color: C.primaryLight, textDecorationLine: 'underline' },
});
