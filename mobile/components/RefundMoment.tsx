/**
 * The refund moment.
 *
 * When a trip finishes scoring, this is the payoff: the trip's score counts up,
 * the change to the driver's overall score counts up beside it, and a success
 * haptic lands with them. It is the one screen in the app that says "you got
 * paid to drive well" rather than describing it.
 *
 * WHAT IT WILL NOT DO IS INVENT MONEY. The projected cashback line renders only
 * when the driver holds a policy with a real premium, because the projection is
 * computed from that premium by the same calculateRefundCents the rest of the
 * product uses. With no policy there is no premium, so there is no honest pence
 * figure, and the screen says so plainly instead of animating a number that
 * means nothing. Pool contributions are a separate, still-unwired path (D6), so
 * nothing here claims a share of the pool either.
 *
 * All money is integer pence, formatted at the edge. Never a float pound.
 */
import { useEffect } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, T, S, R, scoreColor } from './ui/theme';
import { CountUp } from './ui/CountUp';
import { DriivButton } from './ui/DriivButton';

export interface RefundMomentProps {
  visible: boolean;
  /** The score the pipeline computed for this trip, 0-100. */
  tripScore: number;
  /** Overall driving score before this trip landed, or null if not known. */
  previousOverallScore: number | null;
  /** Overall driving score after this trip landed, or null if not known. */
  newOverallScore: number | null;
  /**
   * Projected cashback in integer pence before and after this trip. Both null
   * unless the driver holds a policy with a real premium.
   */
  previousProjectedPence: number | null;
  newProjectedPence: number | null;
  onDismiss: () => void;
}

export function formatPence(pence: number): string {
  const abs = Math.abs(pence);
  if (abs < 100) return `${abs}p`;
  return `£${(abs / 100).toFixed(2)}`;
}

export function RefundMoment({
  visible,
  tripScore,
  previousOverallScore,
  newOverallScore,
  previousProjectedPence,
  newProjectedPence,
  onDismiss,
}: RefundMomentProps) {
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible]);

  const scoreDelta =
    previousOverallScore != null && newOverallScore != null
      ? newOverallScore - previousOverallScore
      : null;

  const penceDelta =
    previousProjectedPence != null && newProjectedPence != null
      ? newProjectedPence - previousProjectedPence
      : null;

  const tint = scoreColor(tripScore);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>TRIP SCORED</Text>

          <CountUp
            value={tripScore}
            duration={900}
            style={[styles.score, { color: tint }]}
          />
          <Text style={styles.scoreCaption}>out of 100</Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Overall score</Text>
            {scoreDelta != null ? (
              <CountUp
                value={scoreDelta}
                signed
                duration={900}
                style={[
                  styles.rowValue,
                  { color: scoreDelta >= 0 ? C.success : C.error },
                ]}
              />
            ) : (
              <Text style={[styles.rowValue, { color: C.text.mut }]}>Updating</Text>
            )}
          </View>

          {penceDelta != null && newProjectedPence != null ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Projected cashback</Text>
                <CountUp
                  value={newProjectedPence / 100}
                  decimals={2}
                  prefix="£"
                  duration={900}
                  style={[styles.rowValue, { color: C.text.hero }]}
                />
              </View>
              <Text style={styles.footnote}>
                {penceDelta === 0
                  ? 'This trip did not move your projection.'
                  : `${penceDelta > 0 ? 'Up' : 'Down'} ${formatPence(penceDelta)} on this trip. A projection from your current score and premium, not a guaranteed payout.`}
              </Text>
            </>
          ) : (
            <Text style={styles.footnote}>
              Cashback figures appear once your policy is live. Your score is
              being tracked from now, so nothing you drive today is wasted.
            </Text>
          )}

          <DriivButton title="Done" onPress={onDismiss} style={{ marginTop: S.lg }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: C.scrim,
    justifyContent: 'center',
    padding: S.md,
  },
  sheet: {
    backgroundColor: C.surface1,
    borderRadius: R.sheet,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.lg,
    alignItems: 'center',
  },
  eyebrow: {
    ...T.label,
    color: C.text.sec,
    letterSpacing: 1,
  },
  score: {
    ...T.hero,
    fontSize: 72,
    marginTop: S.sm,
  },
  scoreCaption: {
    ...T.caption,
    color: C.text.mut,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: C.border,
    marginVertical: S.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: S.sm,
  },
  rowLabel: { ...T.body, color: C.text.sec },
  rowValue: { ...T.stat },
  footnote: {
    ...T.caption,
    color: C.text.mut,
    lineHeight: 16,
    marginTop: S.sm,
    alignSelf: 'stretch',
  },
});

export default RefundMoment;
