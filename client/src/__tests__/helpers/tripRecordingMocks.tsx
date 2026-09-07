/**
 * The mock rig the Trip Recording suites share: every hook and service the
 * page depends on, the mutable state objects the tests drive it with, and the
 * router-wrapped render. Extracted from
 * client/src/__tests__/trip-recording-flow.test.tsx when that file was split
 * by describe block; the mocks are unchanged.
 *
 * This module must be imported BEFORE the page under test, which is why it
 * also owns that import: the vi.mock calls below run as this module is
 * evaluated, and renderPage closes over the component they apply to.
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { Router, Route, Switch } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import React from 'react';

// Ensure React is available globally for components that use automatic JSX transform
globalThis.React = React;

// ---------------------------------------------------------------------------
// Mocks — must be declared before component imports
// ---------------------------------------------------------------------------

// Firebase core
vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: { uid: 'test-uid', getIdToken: vi.fn().mockResolvedValue('test-token') } },
  db: {},
  isFirebaseConfigured: true,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  getFirestore: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ seconds: 1000, nanoseconds: 0 })) },
}));

// Auth context
export const mockUseAuth = vi.fn(() => ({
  user: { id: 'test-uid', name: 'Test User', email: 'test@driiva.co.uk' },
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  setIsAuthenticated: vi.fn(),
  setUser: vi.fn(),
  markEmailVerified: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Online status context
export const mockUseOnlineStatusContext = vi.fn(() => ({
  isOnline: true,
  reportFirestoreError: vi.fn(),
}));

vi.mock('@/contexts/OnlineStatusContext', () => ({
  useOnlineStatusContext: () => mockUseOnlineStatusContext(),
  OnlineStatusProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Toast
export const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Trip location tracker
export const mockTrackerStart = vi.fn().mockResolvedValue(undefined);
export const mockTrackerStop = vi.fn().mockReturnValue([]);
export const mockTrackerPause = vi.fn();
export const mockTrackerResume = vi.fn();
export const mockRequestPermission = vi.fn().mockResolvedValue(true);

export const mockTrackerState: {
  isTracking: boolean; isPaused: boolean; isPermissionGranted: boolean; isPermissionDenied: boolean;
  currentPosition: { latitude: number; longitude: number; accuracy: number; altitude: null; altitudeAccuracy: null; heading: null; speed: number; timestamp: number };
  pointCount: number; totalDistance: number; error: string | null; errorMessage: string | null;
  start: typeof mockTrackerStart; stop: typeof mockTrackerStop; pause: typeof mockTrackerPause; resume: typeof mockTrackerResume;
  clearError: ReturnType<typeof vi.fn>; getPoints: ReturnType<typeof vi.fn>; requestPermission: typeof mockRequestPermission;
} = {
  isTracking: false,
  isPaused: false,
  isPermissionGranted: true,
  isPermissionDenied: false,
  currentPosition: { latitude: 51.5074, longitude: -0.1278, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: 13.4, timestamp: Date.now() },
  pointCount: 0,
  totalDistance: 0,
  error: null,
  errorMessage: null,
  start: mockTrackerStart,
  stop: mockTrackerStop,
  pause: mockTrackerPause,
  resume: mockTrackerResume,
  clearError: vi.fn(),
  getPoints: vi.fn().mockReturnValue([]),
  requestPermission: mockRequestPermission,
};

vi.mock('@/hooks/useTripLocationTracker', () => ({
  useTripLocationTracker: () => mockTrackerState,
  default: () => mockTrackerState,
}));

// Telematics
export const mockTelematicsRequestPermissions = vi.fn().mockResolvedValue({ granted: true, permission: 'granted' });
export const mockTelematicsStartCollection = vi.fn().mockResolvedValue(undefined);
export const mockTelematicsStopCollection = vi.fn().mockResolvedValue({
  gpsPoints: [],
  accelerometerData: [],
  gyroscopeData: [],
  speedData: [],
  timestamp: Date.now(),
});

export const mockTelematicsState: {
  isCollecting: boolean; isPermissionGranted: boolean; currentData: null; metrics: null; error: string | null;
  summary: null; requestPermissions: typeof mockTelematicsRequestPermissions; startCollection: typeof mockTelematicsStartCollection;
  stopCollection: typeof mockTelematicsStopCollection; clearError: ReturnType<typeof vi.fn>; simulateHapticFeedback: ReturnType<typeof vi.fn>;
} = {
  isCollecting: false,
  isPermissionGranted: true,
  currentData: null,
  metrics: null,
  error: null,
  summary: null,
  requestPermissions: mockTelematicsRequestPermissions,
  startCollection: mockTelematicsStartCollection,
  stopCollection: mockTelematicsStopCollection,
  clearError: vi.fn(),
  simulateHapticFeedback: vi.fn(),
};

vi.mock('@/hooks/useTelematics', () => ({
  useTelematics: () => mockTelematicsState,
}));

// Trip service
export const mockStartTrip = vi.fn().mockResolvedValue({
  tripId: 'trip-001',
  userId: 'test-uid',
  startedAt: { seconds: 1000, nanoseconds: 0 },
  startLocation: { latitude: 51.5074, longitude: -0.1278 },
  pointsCount: 0,
  status: 'recording' as const,
});
export const mockEndTrip = vi.fn().mockResolvedValue(undefined);
export const mockCancelTrip = vi.fn().mockResolvedValue(undefined);

export const mockStreamerInstance = {
  start: vi.fn(),
  stop: vi.fn().mockResolvedValue(42),
  addPoint: vi.fn(),
};

vi.mock('@/lib/tripService', () => {
  // Use a proper function (not arrow) so it can be called with `new`
  const MockTripPointStreamer = vi.fn(function(this: Record<string, unknown>) {
    this.start = mockStreamerInstance.start;
    this.stop = mockStreamerInstance.stop;
    this.addPoint = mockStreamerInstance.addPoint;
    return this;
  });
  return {
    TripPointStreamer: MockTripPointStreamer,
    startTrip: (...args: unknown[]) => mockStartTrip(...args),
    endTrip: (...args: unknown[]) => mockEndTrip(...args),
    cancelTrip: (...args: unknown[]) => mockCancelTrip(...args),
    createTripLocation: (lat: number, lng: number) => ({ latitude: lat, longitude: lng }),
  };
});

// UI components — mock Radix-based components to avoid jsdom issues
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <span>{children}</span>,
}));

// Lucide icons — render as simple spans to avoid SVG issues
vi.mock('lucide-react', () => ({
  Play: (props: Record<string, unknown>) => <span data-testid="icon-play" {...props} />,
  Square: (props: Record<string, unknown>) => <span data-testid="icon-square" {...props} />,
  Pause: (props: Record<string, unknown>) => <span data-testid="icon-pause" {...props} />,
  Navigation: (props: Record<string, unknown>) => <span data-testid="icon-navigation" {...props} />,
  Clock: (props: Record<string, unknown>) => <span data-testid="icon-clock" {...props} />,
  Zap: (props: Record<string, unknown>) => <span data-testid="icon-zap" {...props} />,
  MapPin: (props: Record<string, unknown>) => <span data-testid="icon-mappin" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <span data-testid="icon-alertcircle" {...props} />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="icon-loader" {...props} />,
  Route: (props: Record<string, unknown>) => <span data-testid="icon-route" {...props} />,
}));

// ---------------------------------------------------------------------------
// Import component AFTER all mocks are set up
// ---------------------------------------------------------------------------

import TripRecording from '../../pages/trip-recording';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function renderPage(path = '/record') {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <Switch>
        <Route path="/record"><TripRecording /></Route>
        <Route path="/"><div data-testid="dashboard">Dashboard</div></Route>
      </Switch>
    </Router>
  );
}

/**
 * Per-test reset. vi.clearAllMocks() wipes the implementations set up above,
 * so they are reinstated here alongside the default state each suite starts
 * from. Lifted verbatim out of the original shared beforeEach.
 */
export function resetTripRecordingMocks(): void {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Re-setup mock implementations that clearAllMocks resets
    mockStreamerInstance.start.mockImplementation(() => {});
    mockStreamerInstance.stop.mockResolvedValue(0);
    mockStreamerInstance.addPoint.mockImplementation(() => {});

    // Reset tracker state to defaults
    mockTrackerState.isTracking = false;
    mockTrackerState.isPaused = false;
    mockTrackerState.isPermissionGranted = true;
    mockTrackerState.isPermissionDenied = false;
    mockTrackerState.currentPosition = {
      latitude: 51.5074, longitude: -0.1278, accuracy: 10,
      altitude: null, altitudeAccuracy: null, heading: null, speed: 13.4, timestamp: Date.now(),
    };
    mockTrackerState.pointCount = 0;
    mockTrackerState.totalDistance = 0;
    mockTrackerState.error = null;
    mockTrackerState.errorMessage = null;

    // Reset telematics state
    mockTelematicsState.isPermissionGranted = true;
    mockTelematicsState.error = null;

    // Reset online
    mockUseOnlineStatusContext.mockReturnValue({
      isOnline: true,
      reportFirestoreError: vi.fn(),
    });

    // Stub navigator.wakeLock
    vi.stubGlobal('navigator', {
      ...navigator,
      wakeLock: {
        request: vi.fn().mockResolvedValue({ release: vi.fn() }),
      },
    });
}
