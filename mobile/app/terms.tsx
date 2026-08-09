/**
 * Terms of Service - Driiva Mobile
 * Ported from client/src/pages/terms.tsx, trimmed for mobile.
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

function Link({ children }: { children: string }) {
  return (
    <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${children}`)}>
      {children}
    </Text>
  );
}

export default function Terms() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Terms of service" subtitle="Effective March 2026 · Driiva Ltd (UK)" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SurfaceCard padding="lg">
          <P>
            Driiva is intelligent car insurance where safe driving can earn you back
            a portion of your premium, year after year. By using our app, you agree
            to these terms.
          </P>

          <Section title="Our service">
            <P>
              Driiva offers telematics-based car insurance and a community rewards
              programme. We use your driving data to calculate a personal score and
              your share of the community pool. The service is offered in the UK
              and subject to FCA and Consumer Duty.
            </P>
          </Section>

          <Section title="How refunds work">
            <P>
              The pool is funded by premiums and other sources. Qualified drivers
              may receive a refund based on behaviour and actuarial principles.
              Rewards, cashback, and community pool refunds are community-based
              behaviour incentives. They do not constitute a guaranteed reduction
              in your insurance premium, a regulated financial benefit, or a
              contractual entitlement. Eligibility and amounts are determined at
              Driiva's discretion based on driving behaviour, pool performance, and
              actuarial sustainability.
            </P>
          </Section>

          <Section title="Driving score">
            <P>
              We analyse speed, braking, acceleration, cornering, and phone usage.
              You get clear feedback on how your driving affects your score and
              refunds. Unsafe habits may lead to higher premiums or declined
              coverage.
            </P>
          </Section>

          <Section title="Your obligations">
            <P>
              Provide accurate information, use the app lawfully, don't misuse the
              service or manipulate scores, and keep your account credentials
              secure.
            </P>
          </Section>

          <Section title="Telematics data and consent">
            <P>
              By using the app you consent to the passive detection of driving
              trips and collection of telematics data from your device's GPS,
              accelerometer, and gyroscope. This is processed for insurance risk
              scoring, safety analysis, and community pool eligibility. You may
              withdraw consent at any time by deleting your account, though this
              ends your access to the service and any accrued rewards.
            </P>
          </Section>

          <Section title="Termination">
            <P>
              You may close your account anytime via the app or by contacting us.
              We may suspend or terminate if you breach these terms, fail to pay,
              provide false information, or misuse the app.
            </P>
          </Section>

          <Section title="Liability">
            <P>
              We don't exclude liability for death or personal injury caused by our
              negligence, or fraud. Otherwise, we're not liable for indirect,
              consequential, or special loss. You use the app and drive at your own
              risk.
            </P>
          </Section>

          <Section title="Changes">
            <P>We may update these terms and will notify you of material changes.</P>
          </Section>

          <Section title="General">
            <P>Governed by the laws of England and Wales.</P>
          </Section>

          <Section title="Contact">
            <P>
              Questions? Contact us at <Link>info@driiva.co.uk</Link>. For full policy
              terms, see your policy document.
            </P>
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
  p: { ...T.body, color: C.text.sec },
  link: { color: C.primaryLight, textDecorationLine: 'underline' },
});
