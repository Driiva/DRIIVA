/**
 * TESTS: Trip Recording Page - pause, resume and ending
 * =====================================================
 * Split out of trip-recording-flow.test.tsx, which had grown past the
 * 500-line ceiling. Drives the shared mock rig in
 * helpers/tripRecordingMocks.tsx.
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

describe('Trip Recording Page: pause, resume and ending', () => {
  beforeEach(() => {
    resetTripRecordingMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Pause and Resume', () => {
    async function startAndPause() {
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
        await vi.advanceTimersByTimeAsync(2500);
      });

      // Click Pause
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /pause/i }));
      });
    }

    it('shows "Resume" button after pausing', async () => {
      await startAndPause();
      expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    });

    it('shows "Trip Paused" status text', async () => {
      await startAndPause();
      expect(screen.getByText('Trip Paused')).toBeInTheDocument();
    });

    it('shows correct description when paused', async () => {
      await startAndPause();
      expect(screen.getByText('Tap Resume to continue recording')).toBeInTheDocument();
    });

    it('calls tracker.pause() when pausing', async () => {
      await startAndPause();
      expect(mockTrackerPause).toHaveBeenCalled();
    });

    it('shows a toast when trip is paused', async () => {
      await startAndPause();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Trip Paused' })
      );
    });

    it('calls tracker.resume() when resuming', async () => {
      await startAndPause();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /resume/i }));
      });

      expect(mockTrackerResume).toHaveBeenCalled();
    });

    it('shows "Recording Trip" after resuming', async () => {
      await startAndPause();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /resume/i }));
      });

      expect(screen.getByText('Recording Trip')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Ending a trip
  // =========================================================================

  describe('Ending a trip', () => {
    it('shows "Saving Trip..." status and button when ending', async () => {
      mockRequestPermission.mockResolvedValue(true);
      mockStartTrip.mockResolvedValue({
        tripId: 'trip-001',
        userId: 'test-uid',
        startedAt: { seconds: 1000, nanoseconds: 0 },
        startLocation: { latitude: 51.5074, longitude: -0.1278 },
        pointsCount: 0,
        status: 'recording' as const,
      });

      // Make streamer stop hang so we stay in the stopping state
      mockStreamerInstance.stop.mockImplementation(() => new Promise(() => {}));

      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start trip/i }));
        await vi.advanceTimersByTimeAsync(2500);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /end trip/i }));
      });

      // The status heading shows "Saving Trip..."
      expect(screen.getByText('Calculating your score...')).toBeInTheDocument();
      // The disabled button should be present
      expect(screen.getByRole('button', { name: /saving trip/i })).toBeDisabled();
    });

    it('calls endTrip with trip ID and real trip data (no client score), and shows completion toast', async () => {
      mockRequestPermission.mockResolvedValue(true);
      mockStartTrip.mockResolvedValue({
        tripId: 'trip-001',
        userId: 'test-uid',
        startedAt: { seconds: 1000, nanoseconds: 0 },
        startLocation: { latitude: 51.5074, longitude: -0.1278 },
        pointsCount: 0,
        status: 'recording' as const,
      });
      mockEndTrip.mockResolvedValue(undefined);
      mockStreamerInstance.stop.mockResolvedValue(42);

      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start trip/i }));
        await vi.advanceTimersByTimeAsync(2500);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /end trip/i }));
      });

      // endTrip should have been called with the trip ID as first arg
      expect(mockEndTrip).toHaveBeenCalled();
      const callArgs = mockEndTrip.mock.calls[0];
      expect(callArgs[0]).toBe('trip-001');
      // Second arg is the TripEndInput. The client no longer fabricates a
      // score; the Cloud Function computes it server-side. Assert on the real
      // persisted fields and lock in that no client score leaks through.
      expect(callArgs[1]).toEqual(
        expect.objectContaining({ distanceMeters: expect.any(Number) })
      );
      expect(callArgs[1]).not.toHaveProperty('score');
      expect(callArgs[1]).not.toHaveProperty('scoreBreakdown');

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Trip Completed' })
      );
    });

    it('redirects to dashboard after ending trip', async () => {
      mockRequestPermission.mockResolvedValue(true);
      mockStartTrip.mockResolvedValue({
        tripId: 'trip-001',
        userId: 'test-uid',
        startedAt: { seconds: 1000, nanoseconds: 0 },
        startLocation: { latitude: 51.5074, longitude: -0.1278 },
        pointsCount: 0,
        status: 'recording' as const,
      });
      mockEndTrip.mockResolvedValue(undefined);
      mockStreamerInstance.stop.mockResolvedValue(10);

      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /start trip/i }));
        await vi.advanceTimersByTimeAsync(2500);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /end trip/i }));
      });

      // setLocation('/') is called after a 1500ms timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Cancel trip
  // =========================================================================

});
