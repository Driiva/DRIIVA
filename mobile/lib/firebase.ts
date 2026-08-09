/**
 * Firebase shim — conditional native vs Expo Go.
 *
 * In Expo Go (`Constants.appOwnership === 'expo'`) we cannot load
 * `@react-native-firebase/*` because those packages access NativeModules at
 * module-load time and will throw. Instead we hand back minimal mocks that
 * keep the UI flow working for visual preview.
 *
 * In a dev client / standalone build the real native packages are loaded
 * via `require()` so they are only evaluated when needed.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const isExpoGo = Constants.appOwnership === 'expo';

// --- Mocks --------------------------------------------------------------

const mockUser = {
  uid: 'preview-user',
  email: 'preview@driiva.local',
  displayName: 'Preview Driver',
  emailVerified: true,
  updateProfile: async () => {},
};

const mockDocRef = {
  set: async () => {},
  update: async () => {},
  get: async () => ({
    exists: true,
    data: () => ({
      displayName: 'Preview Driver',
      fullName: 'Preview Driver',
      onboardingComplete: false,
      isAdmin: false,
    }),
  }),
  onSnapshot: (cb: (snap: { data: () => any }) => void) => {
    setTimeout(() => cb({ data: () => ({}) }), 0);
    return () => {};
  },
};

const mockCollection = {
  doc: (_id?: string) => mockDocRef,
  add: async () => mockDocRef,
};

const mockAuth: any = () => ({
  currentUser: mockUser,
  onAuthStateChanged: (cb: (u: any) => void) => {
    setTimeout(() => cb(mockUser), 0);
    return () => {};
  },
  signInWithEmailAndPassword: async () => ({ user: mockUser }),
  createUserWithEmailAndPassword: async () => ({ user: mockUser }),
  signOut: async () => {},
  sendPasswordResetEmail: async () => {},
});

const mockFirestore: any = () => ({
  collection: (_name: string) => mockCollection,
  settings: () => {},
});
mockFirestore.FieldValue = {
  serverTimestamp: () => new Date(),
};
mockFirestore.CACHE_SIZE_UNLIMITED = 0;

// --- Conditional export --------------------------------------------------

let _auth: any;
let _firestore: any;

if (isExpoGo) {
  _auth = mockAuth;
  _firestore = mockFirestore;
} else {
  // Lazy native loads. Metro bundles these but they only execute on this branch.
  _auth = require('@react-native-firebase/auth').default;
  _firestore = require('@react-native-firebase/firestore').default;

  // Point a native build at the local Firebase emulators.
  //
  // Opt-in and dev-only: it needs EXPO_PUBLIC_FIREBASE_EMULATOR set AND a dev
  // build (__DEV__), so a release build can never be pointed at a machine on
  // somebody's desk. It exists because a native build otherwise needs real
  // project credentials to render a single authenticated screen, which made
  // every mobile surface unreviewable.
  //
  // 10.0.2.2 is the Android emulator's alias for the host; iOS simulators
  // share the host's own loopback.
  if (__DEV__ && process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === '1') {
    const host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
    try {
      _auth().useEmulator(`http://${host}:9099`);
      _firestore().useEmulator(host, 8080);
      console.log(`[firebase] using emulators at ${host}`);
    } catch (err) {
      console.warn('[firebase] could not attach emulators', err);
    }
  }

  // Real firestore settings only when running natively.
  try {
    _firestore().settings({
      // Offline persistence caches emulator data across reloads, which makes a
      // reset emulator look like it still has data.
      persistence: !(__DEV__ && process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === '1'),
      cacheSizeBytes: _firestore.CACHE_SIZE_UNLIMITED,
    });
  } catch {
    // settings may already be configured - ignore
  }
}

export const auth = _auth;
export const firestore = _firestore;

// Type re-export for AuthContext etc.
export type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  updateProfile?: (p: { displayName?: string }) => Promise<void>;
};
