/**
 * INVITE
 * ======
 * The one social act the product asks for: give someone your code, or enter
 * theirs. This is the screen that closes the community loop on mobile.
 *
 * Until now the circle board was readable but unreachable: mobile could
 * subscribe to friendships and offered the scope, but nothing on mobile could
 * create one. The empty state said "invite someone from the web app", which is
 * not an answer for a beta that ships as an app.
 *
 * All the behaviour is in mobile/lib/community.ts. This file is the surface.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { DriivButton } from '@/components/ui/DriivButton';
import { C, F, S, R, FS, LH, TR } from '@/components/ui/theme';
import { INVITE_CODE_LENGTH, INVITE_TTL_DAYS } from '@driiva/contracts';
import {
  createInvite,
  redeemInvite,
  subscribeFriends,
  REDEEM_MESSAGES,
  type Friend,
} from '@/lib/community';
import { track } from '@/lib/analytics';

export default function Invite() {
  const { user } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  const [entered, setEntered] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeFriends(user.id, setFriends);
  }, [user?.id]);

  const handleMint = useCallback(async () => {
    if (!user?.id || minting) return;
    setMinting(true);
    setMintError(null);

    const next = await createInvite(user.id);
    if (next) setCode(next);
    // Says what happened rather than showing an empty box that looks broken.
    else setMintError('We could not create a code just now. Try again.');

    setMinting(false);
  }, [user?.id, minting]);

  const handleShare = useCallback(async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Add me on Driiva. My code is ${code}.`,
      });
      track('invite_shared');
    } catch {
      // The user dismissing the share sheet is not an error worth surfacing.
    }
  }, [code]);

  const handleRedeem = useCallback(async () => {
    if (!user?.id || redeeming) return;
    setRedeeming(true);
    setRedeemError(null);

    const result = await redeemInvite(user.id, entered);

    if (result.ok) {
      setEntered('');
      router.push('/leaderboard');
    } else {
      setRedeemError(REDEEM_MESSAGES[result.failure ?? 'write-failed']);
    }

    setRedeeming(false);
  }, [user?.id, entered, redeeming, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Bring someone in"
        subtitle="They appear in your circle and on the same board as everyone else."
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your code</Text>
          <Text style={styles.cardSub}>
            Share this with someone you drive near. It works for {INVITE_TTL_DAYS} days.
          </Text>

          {code ? (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.codeText} accessibilityLabel={`Your code is ${code}`}>
                  {code}
                </Text>
              </View>
              <DriivButton title="Share code" onPress={handleShare} />
            </>
          ) : (
            <DriivButton
              title="Create my code"
              onPress={handleMint}
              loading={minting}
              disabled={minting}
            />
          )}

          {mintError !== null && <Text style={styles.error}>{mintError}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Got a code?</Text>
          <Text style={styles.cardSub}>Enter their code to connect.</Text>

          <TextInput
            style={styles.input}
            value={entered}
            onChangeText={(next) => {
              setEntered(next.toUpperCase());
              // Clearing on edit: an error about the previous attempt sitting
              // under a field the user has already changed reads as a rejection
              // of what they are typing now.
              if (redeemError) setRedeemError(null);
            }}
            placeholder="ABCD2345"
            placeholderTextColor={C.text.mut}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={INVITE_CODE_LENGTH}
            accessibilityLabel="Their invite code"
            accessibilityHint={`${INVITE_CODE_LENGTH} characters, letters and numbers`}
          />

          <DriivButton
            title="Connect"
            onPress={handleRedeem}
            loading={redeeming}
            disabled={redeeming || entered.length !== INVITE_CODE_LENGTH}
          />

          {redeemError !== null && <Text style={styles.error}>{redeemError}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {friends.length === 0
              ? 'Your circle is empty'
              : `${friends.length} in your circle`}
          </Text>
          <Text style={styles.cardSub}>
            {friends.length === 0
              ? 'Once someone accepts your code they show up in your circle.'
              : 'They appear under Your circle on the Community tab.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl, gap: S.md },

  card: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    gap: S.sm,
  },
  cardTitle: {
    color: C.text.hero,
    fontFamily: F.bodySemiBold,
    fontSize: FS.base,
    lineHeight: LH.base,
    letterSpacing: TR.base,
  },
  cardSub: {
    color: C.text.mut,
    fontFamily: F.body,
    fontSize: FS.sm,
    lineHeight: LH.sm,
    letterSpacing: TR.sm,
    marginBottom: S.xs,
  },

  codeBox: {
    backgroundColor: C.surface2,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: S.md,
    alignItems: 'center',
    marginBottom: S.sm,
  },
  codeText: {
    color: C.text.hero,
    fontFamily: F.mono,
    fontSize: FS.xxl,
    lineHeight: LH.xxl,
    // Tracking: the code gets read aloud and retyped, so the characters need
    // to be separable at a glance.
    letterSpacing: 4,
  },

  input: {
    backgroundColor: C.surface2,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: F.mono,
    fontSize: FS.lg,
    lineHeight: LH.lg,
    letterSpacing: 3,
    color: C.text.hero,
    marginBottom: S.sm,
  },

  error: {
    color: C.error,
    fontFamily: F.body,
    fontSize: FS.sm,
    lineHeight: LH.sm,
    letterSpacing: TR.sm,
    marginTop: S.xs,
  },
});
