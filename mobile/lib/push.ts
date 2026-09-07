/**
 * PUSH REGISTRATION
 * =================
 * Registers this device for the notifications the Cloud Functions already
 * send, and keeps the token on the user document current.
 *
 * WHY THE TOKEN COMES FROM FIREBASE MESSAGING AND NOT FROM EXPO
 * The server sends with admin.messaging().sendEachForMulticast, which takes
 * FCM registration tokens. An Expo push token is a different thing entirely
 * and FCM cannot deliver to one, so storing an Expo token in `fcmTokens` would
 * produce a field that looks correct, passes every test that checks a token
 * was written, and silently delivers nothing forever. @react-native-firebase/
 * messaging was already a dependency, so the real FCM token is available.
 *
 * expo-notifications is still used for the permission prompt and for deciding
 * how a notification presents while the app is in the foreground, which is
 * what it is good at.
 *
 * Registration is DELIBERATELY not automatic on launch. iOS gives an app one
 * permission prompt, and spending it on a cold start before the person knows
 * what the app does is how you get a permanent denial.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { firestore, isExpoGo } from '@/lib/firebase';

/**
 * Loaded the same way lib/firebase.ts loads auth/firestore: a top-level import
 * of @react-native-firebase/messaging touches NativeModules at module-load
 * time and crashes Expo Go before a single screen renders. The mock keeps the
 * preview path alive; a real build takes the native module.
 */
/**
 * The slice of @react-native-firebase/messaging this app uses. Declared here so
 * the Expo Go double below and the native module present the same checked
 * surface instead of an `any`.
 */
type MessagingModule = () => {
  registerDeviceForRemoteMessages: () => Promise<void>;
  getToken: () => Promise<string>;
  onTokenRefresh: (cb: (token: string) => void) => () => void;
};

const messaging: MessagingModule = isExpoGo
  ? () => ({
      registerDeviceForRemoteMessages: async () => {},
      getToken: async () => 'expo-go-preview-token',
      onTokenRefresh: (_cb: (token: string) => void) => () => {},
    })
  : require('@react-native-firebase/messaging').default;

export type PushPermission = 'granted' | 'denied' | 'undetermined';

/** Foreground presentation. Banners only, never a sound the user did not ask for. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getPushPermission(): Promise<PushPermission> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Asks for permission if it has not been decided, then stores the FCM token.
 *
 * Returns the resulting permission so a caller can tell the difference between
 * "the user said no" and "something failed", which need different copy.
 * A denial is respected and never re-prompted: iOS will not show the system
 * dialogue twice anyway, and asking again in-app is nagging.
 */
export async function registerForPush(userId: string): Promise<PushPermission> {
  try {
    let permission = await getPushPermission();

    if (permission === 'undetermined') {
      const { status } = await Notifications.requestPermissionsAsync();
      permission = status === 'granted' ? 'granted' : 'denied';
    }

    if (permission !== 'granted') return permission;

    // iOS needs the APNs registration to complete before FCM can mint a token.
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    if (token) await storeToken(userId, token);

    return 'granted';
  } catch (err) {
    console.warn('[push] registration failed:', err);
    return getPushPermission();
  }
}

/**
 * arrayUnion, because one account can be signed in on more than one device and
 * a plain set would silently unsubscribe the others.
 */
async function storeToken(userId: string, token: string): Promise<void> {
  const { firebase } = require('@react-native-firebase/firestore');
  await firestore()
    .collection('users')
    .doc(userId)
    .update({
      fcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
    });
}

/**
 * Removes this device's token. Called when notifications are switched off and
 * on sign-out; without it a shared or resold handset keeps receiving somebody
 * else's driving notifications.
 */
export async function unregisterPush(userId: string): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (!token) return;
    const { firebase } = require('@react-native-firebase/firestore');
    await firestore()
      .collection('users')
      .doc(userId)
      .update({
        fcmTokens: firebase.firestore.FieldValue.arrayRemove(token),
      });
  } catch (err) {
    console.warn('[push] unregister failed:', err);
  }
}

/**
 * FCM rotates tokens. Without this the stored token goes stale and delivery
 * stops with no error anywhere, which is the hardest kind of outage to notice.
 * Call once from a mounted component; returns the unsubscribe.
 */
export function watchTokenRefresh(userId: string): () => void {
  try {
    return messaging().onTokenRefresh((token: string) => {
      storeToken(userId, token).catch((err) =>
        console.warn('[push] refresh store failed:', err),
      );
    });
  } catch {
    return () => {};
  }
}
