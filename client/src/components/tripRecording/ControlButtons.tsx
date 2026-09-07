/**
 * The trip-recording controls: start, pause/resume, end, and the two disabled
 * in-flight states. Extracted verbatim from client/src/pages/trip-recording.tsx.
 */
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Pause, Play, Square } from 'lucide-react';

import type { RecordingState } from './types';

interface ControlButtonsProps {
  recordingState: RecordingState;
  isRecording: boolean;
  canStart: boolean;
  isOnline: boolean;
  isPermissionDenied: boolean;
  handleStartTrip: () => void;
  handlePauseTrip: () => void;
  handleStopTrip: () => void;
}

export function ControlButtons({
  recordingState,
  isRecording,
  canStart,
  isOnline,
  isPermissionDenied,
  handleStartTrip,
  handlePauseTrip,
  handleStopTrip,
}: ControlButtonsProps) {
  return (
        <div className="space-y-4">
          {recordingState === 'idle' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block w-full">
                    <Button
                      onClick={handleStartTrip}
                      className="w-full h-14 bg-gradient-to-r from-[#8B4513] to-[#B87333] hover:from-[#A0522D] hover:to-[#CD853F] text-white font-semibold rounded-2xl disabled:opacity-60"
                      disabled={!canStart}
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Start Trip
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {!isOnline
                    ? 'Start trip requires an internet connection. Trip data will sync when you\'re back online.'
                    : !isPermissionDenied
                      ? 'Start recording a new trip'
                      : 'Allow location access to start a trip'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {recordingState === 'starting' && (
            <Button
              disabled
              className="w-full h-14 bg-gradient-to-r from-[#8B4513] to-[#B87333] text-white font-semibold rounded-2xl opacity-70"
            >
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Starting...
            </Button>
          )}

          {isRecording && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handlePauseTrip}
                variant="outline"
                className="h-14 glass-card border-gray-600 text-white hover:bg-white/10 rounded-2xl"
              >
                {recordingState === 'paused' ? (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>

              <Button
                onClick={handleStopTrip}
                className="h-14 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl"
              >
                <Square className="w-5 h-5 mr-2" />
                End Trip
              </Button>
            </div>
          )}

          {recordingState === 'stopping' && (
            <Button
              disabled
              className="w-full h-14 bg-red-600/70 text-white font-semibold rounded-2xl"
            >
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving Trip...
            </Button>
          )}
        </div>
  );
}
