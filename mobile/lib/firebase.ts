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

  // Real firestore settings only when running natively.
  try {
    _firestore().settings({
      persistence: true,
      cacheSizeBytes: _firestore.CACHE_SIZE_UNLIMITED,
    });
  } catch {
    // settings may already be configured — ignore
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
