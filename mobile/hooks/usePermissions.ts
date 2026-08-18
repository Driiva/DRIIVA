import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { auth, firestore } from '@/lib/firebase';

export function usePermissions() {
  const savePermission = async (
    key: 'location' | 'motion' | 'backgroundLocation',
    granted: boolean,
  ) => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore().collection('users').doc(uid).set({
      [`permissions.${key}`]: granted,
      [`permissions.${key}GrantedAt`]: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  };

  const requestLocation = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    await savePermission('location', granted);
    return granted;
  };

  const requestMotion = async (): Promise<boolean> => {
    const { status } = await DeviceMotion.requestPermissionsAsync();
    const granted = status === 'granted';
    await savePermission('motion', granted);
    return granted;
  };

  /**
   * Triggers the OS "Always" location prompt. Only call this after the
   * driver has seen an explicit, honest explanation of what it is for - see
   * the background-capture card in app/(tabs)/record.tsx.
   */
  const requestBackgroundLocation = async (): Promise<boolean> => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    const granted = status === 'granted';
    await savePermission('backgroundLocation', granted);
    return granted;
  };

  /**
   * Records that the driver was offered background capture and said "not
   * now", without calling the OS permission API. Distinct from
   * `backgroundLocation: false`: that means the OS denied it; this means we
   * never asked the OS at all, so record.tsx knows not to show the card
   * again on the next trip.
   */
  const markBackgroundLocationOffered = async (): Promise<void> => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore().collection('users').doc(uid).set({
      'permissions.backgroundLocationOfferedAt': firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  };

  return {
    requestLocation,
    requestMotion,
    requestBackgroundLocation,
    markBackgroundLocationOffered,
  };
}
