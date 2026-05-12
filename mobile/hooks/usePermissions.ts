import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { auth, firestore } from '@/lib/firebase';

export function usePermissions() {
  const savePermission = async (key: 'location' | 'motion', granted: boolean) => {
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

  return { requestLocation, requestMotion };
}
