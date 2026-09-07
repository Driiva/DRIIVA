/**
 * TESTS: Trip Recording Page - starting a trip
 * ============================================
 * Integration tests for the first half of the page lifecycle:
 * idle -> starting -> recording. Pause/resume and ending live in
 * trip-recording-controls.test.tsx; cancel, demo mode and the error states
 * live in trip-recording-edge-cases.test.tsx. All three drive the shared mock
 * rig in helpers/tripRecordingMocks.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';

import {
  mockCancelTrip,
  mockEndTrip,
  mockRequestPermission,
  mockStartTrip,
  mockStreamerInstance,
  mockTelematicsRequestPermissions,
  mockTelematicsStartCollection,
  mockTelematicsStopCollection,
  mockTelematicsState,
  mockToast,
  mockTrackerPause,
  mockTrackerResume,
  mockTrackerStart,
  mockTrackerState,
  mockTrackerStop,
  mockUseAuth,
  mockUseOnlineStatusContext,
  renderPage,
  resetTripRecordingMocks,
} from './helpers/tripRecordingMocks';

describe('Trip Recording Page', () => {
  beforeEach(() => {
    resetTripRecordingMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Idle state rendering', () => {
    it('shows "Start Trip" button in idle state', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /start trip/i })).toBeInTheDocument();
    });

    it('shows the page title', () => {
      renderPage();
      expect(screen.getByText('Trip recording')).toBeInTheDocument();
    });

    it('shows "Ready to Record" status text', () => {
      renderPage();
      expect(screen.getByText('Ready to Record')).toBeInTheDocument();
    });

    it('shows sensor status indicators', () => {
      renderPage();
      expect(screen.getByText('GPS Location')).toBeInTheDocument();
      expect(screen.getByText('Motion Sensors')).toBeInTheDocument();
    });

    it('shows idle description text', () => {
      renderPage();
      expect(screen.getByText('Tap Start to begin recording your trip')).toBeInTheDocument();
    });

    it('shows "Back" on the cancel button when idle', () => {
      renderPage();
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Start Trip button state
  // =========================================================================

  describe('Start button enabled/disabled', () => {
    it('Start Trip button is enabled when online and permission granted', () => {
      renderPage();
      const btn = screen.getByRole('button', { name: /start trip/i });
      expect(btn).not.toBeDisabled();
    });

    it('Start Trip button is disabled when location permission is denied', () => {
      mockTrackerState.isPermissionDenied = true;
      renderPage();
      const btn = screen.getByRole('button', { name: /start trip/i });
      expect(btn).toBeDisabled();
    });

    it('Start Trip button is disabled when offline', () => {
      mockUseOnlineStatusContext.mockReturnValue({
        isOnline: false,
        reportFirestoreError: vi.fn(),
      });
      renderPage();
      const btn = screen.getByRole('button', { name: /start trip/i });
      expect(btn).toBeDisabled();
    });
  });

  // =========================================================================
  // Starting a trip
  // =========================================================================

  describe('Starting a trip', () => {
    it('shows "Starting..." button after clicking Start Trip', async () => {
      // Make startTrip hang so we stay in the 'starting' state
      mockStartTrip.mockImplementation(() => new Promise(() => {}));
      mockRequestPermission.mockImplementation(() => new Promise(() => {}));

      renderPage();
      const btn = screen.getByRole('button', { name: /start trip/i });

      await act(async () => {
        fireEvent.click(btn);
      });

      expect(screen.getByRole('button', { name: /starting/i })).toBeInTheDocument();
    });

    it('shows "Starting Trip..." status while starting', async () => {
      mockRequestPermission.mockImplementation(() => new Promise(() => {}));

      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start trip/i }));
      });

      expect(screen.getByText('Starting Trip...')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Recording state
  // =========================================================================

  describe('Recording state', () => {
    async function startRecording() {
      mockRequestPermission.mockResolvedValue(true);
      mockStartTrip.mockResolvedValue({
        tripId: 'trip-001',
        userId: 'test-uid',
        startedAt: { seconds: 1000, nanoseconds: 0 },
        startLocation: { latitude: 51.5074, longitude: -0.1278 },
        pointsCount: 0,
        status: 'recording' as const,
      });

      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start trip/i }));
        // Advance past the 2-second wait for initial position
        await vi.advanceTimersByTimeAsync(2500);
      });
    }

    it('shows "Recording Trip" status text after starting', async () => {
      await startRecording();
      expect(screen.getByText('Recording Trip')).toBeInTheDocument();
    });

    it('shows Pause and End Trip buttons during recording', async () => {
      await startRecording();
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /end trip/i })).toBeInTheDocument();
    });

    it('shows live stats (Distance, Speed, Points) during recording', async () => {
      await startRecording();
      expect(screen.getByText('Distance')).toBeInTheDocument();
      expect(screen.getByText('Speed')).toBeInTheDocument();
      expect(screen.getByText('Points')).toBeInTheDocument();
    });

    it('shows the duration timer', async () => {
      await startRecording();
      // Timer starts at 0:00
      expect(screen.getByText('0:00')).toBeInTheDocument();
    });

    it('shows "Cancel" button instead of "Back" when recording', async () => {
      await startRecording();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.queryByText('Back')).not.toBeInTheDocument();
    });

    it('shows description text for recording', async () => {
      await startRecording();
      expect(screen.getByText('Your driving data is being recorded')).toBeInTheDocument();
    });

    it('calls tracker.start() and telematics.startCollection()', async () => {
      await startRecording();
      expect(mockTrackerStart).toHaveBeenCalled();
      expect(mockTelematicsStartCollection).toHaveBeenCalled();
    });

    it('shows a toast when trip starts', async () => {
      await startRecording();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Trip Started' })
      );
    });
  });

  // =========================================================================
  // Pausing
  // =========================================================================

});
