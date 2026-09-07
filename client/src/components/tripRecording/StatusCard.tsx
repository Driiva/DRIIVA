/**
 * The trip-recording status card: the state ring, the state text and the live
 * duration. Extracted verbatim from client/src/pages/trip-recording.tsx.
 */
import { ArcTracer, LiveGlow } from '@/components/motion/Instrument';
import { Pause, Play } from 'lucide-react';

import { formatDuration } from './formatters';
import type { RecordingState, TripStats } from './types';

interface StatusCardProps {
  recordingState: RecordingState;
  isRecording: boolean;
  statusTone: string;
  tripStats: TripStats;
}

export function StatusCard({ recordingState, isRecording, statusTone, tripStats }: StatusCardProps) {
  return (
        <div className="glass-morphism rounded-3xl p-6 mb-6">
          <div className="text-center">
            {/* Status Indicator */}
            {/* The one place on the app where a state really is live, so this
                is where the breathing glow belongs. Blue and grey were not
                Driiva colours and are gone: the tone now comes from the state
                the driver is actually in. */}
            <div
              className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center border-2"
              style={{
                borderColor: statusTone,
                background: 'var(--app-surface-2)',
              }}
            >
              {recordingState === 'starting' || recordingState === 'stopping' ? (
                <ArcTracer
                  size={40}
                  label={recordingState === 'starting' ? 'Starting trip' : 'Saving trip'}
                />
              ) : recordingState === 'recording' ? (
                <LiveGlow
                  live
                  size={14}
                  colour="var(--err)"
                  label="Recording"
                />
              ) : recordingState === 'paused' ? (
                <Pause className="w-8 h-8" style={{ color: statusTone }} />
              ) : (
                <Play className="w-8 h-8" style={{ color: statusTone }} />
              )}
            </div>

            {/* Status Text */}
            <h2 className="text-xl font-semibold mb-2">
              {recordingState === 'idle' && 'Ready to Record'}
              {recordingState === 'starting' && 'Starting Trip...'}
              {recordingState === 'recording' && 'Recording Trip'}
              {recordingState === 'paused' && 'Trip Paused'}
              {recordingState === 'stopping' && 'Saving Trip...'}
            </h2>

            {/* Duration */}
            {isRecording && (
              <div className="text-4xl font-bold text-white mb-2 font-mono">
                {formatDuration(tripStats.durationMs)}
              </div>
            )}

            {/* Description */}
            <p className="text-gray-400 text-sm">
              {recordingState === 'idle' && 'Tap Start to begin recording your trip'}
              {recordingState === 'starting' && 'Setting up GPS and sensors...'}
              {recordingState === 'recording' && 'Your driving data is being recorded'}
              {recordingState === 'paused' && 'Tap Resume to continue recording'}
              {recordingState === 'stopping' && 'Calculating your score...'}
            </p>
          </div>
        </div>
  );
}
