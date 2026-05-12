import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { auth, firestore } from '@/lib/firebase';

export type DrivingFrequency = 'Daily' | 'A few times a week' | 'Weekends only' | 'Occasionally';
export type DrivingTime = 'Morning commute' | 'Daytime' | 'Evening' | 'Mixed';
export type DrivingRoutes = 'City centre' | 'Suburban' | 'Rural' | 'Mix';

export interface DrivingProfile {
  frequency: DrivingFrequency;
  time: DrivingTime;
  routes: DrivingRoutes;
}

export interface OnboardingState {
  primaryGoal: string | null;
  painPoints: string[];
  painScore: number;
  drivingProfile: DrivingProfile;
  seedScore: number;
  permissions: { location: boolean; motion: boolean };
  step: number;
}

type Action =
  | { type: 'SET_GOAL'; goal: string }
  | { type: 'SET_PAIN_POINTS'; points: string[] }
  | { type: 'ADD_PAIN_SCORE'; delta: number }
  | { type: 'SET_DRIVING_PROFILE'; profile: Partial<DrivingProfile> }
  | { type: 'SET_SEED_SCORE'; score: number }
  | { type: 'SET_PERMISSION'; key: 'location' | 'motion'; granted: boolean }
  | { type: 'SET_STEP'; step: number };

const initialState: OnboardingState = {
  primaryGoal: null,
  painPoints: [],
  painScore: 0,
  drivingProfile: { frequency: 'Daily', time: 'Mixed', routes: 'Mix' },
  seedScore: 82,
  permissions: { location: false, motion: false },
  step: 1,
};

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'SET_GOAL': return { ...state, primaryGoal: action.goal };
    case 'SET_PAIN_POINTS': return { ...state, painPoints: action.points };
    case 'ADD_PAIN_SCORE': return { ...state, painScore: state.painScore + action.delta };
    case 'SET_DRIVING_PROFILE':
      return { ...state, drivingProfile: { ...state.drivingProfile, ...action.profile } };
    case 'SET_SEED_SCORE': return { ...state, seedScore: action.score };
    case 'SET_PERMISSION':
      return { ...state, permissions: { ...state.permissions, [action.key]: action.granted } };
    case 'SET_STEP': return { ...state, step: action.step };
    default: return state;
  }
}

interface OnboardingContextType {
  state: OnboardingState;
  setGoal: (goal: string) => void;
  setPainPoints: (points: string[]) => void;
  addPainScore: (delta: number) => void;
  setDrivingProfile: (profile: Partial<DrivingProfile>) => void;
  setSeedScore: (score: number) => void;
  setPermission: (key: 'location' | 'motion', granted: boolean) => void;
  setStep: (step: number) => void;
  saveToFirestore: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setGoal = useCallback((goal: string) => dispatch({ type: 'SET_GOAL', goal }), []);
  const setPainPoints = useCallback((points: string[]) => dispatch({ type: 'SET_PAIN_POINTS', points }), []);
  const addPainScore = useCallback((delta: number) => dispatch({ type: 'ADD_PAIN_SCORE', delta }), []);
  const setDrivingProfile = useCallback((profile: Partial<DrivingProfile>) => dispatch({ type: 'SET_DRIVING_PROFILE', profile }), []);
  const setSeedScore = useCallback((score: number) => dispatch({ type: 'SET_SEED_SCORE', score }), []);
  const setPermission = useCallback((key: 'location' | 'motion', granted: boolean) => dispatch({ type: 'SET_PERMISSION', key, granted }), []);
  const setStep = useCallback((step: number) => dispatch({ type: 'SET_STEP', step }), []);

  const saveToFirestore = useCallback(async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    await firestore().collection('users').doc(uid).set({
      'onboarding.answers': {
        primaryGoal: state.primaryGoal,
        painPoints: state.painPoints,
        painScore: state.painScore,
        drivingProfile: state.drivingProfile,
        seedScore: state.seedScore,
      },
      'onboarding.permissions': state.permissions,
      'onboarding.startedAt': firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }, [state]);

  return (
    <OnboardingContext.Provider value={{
      state, setGoal, setPainPoints, addPainScore,
      setDrivingProfile, setSeedScore, setPermission,
      setStep, saveToFirestore,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
