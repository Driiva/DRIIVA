/**
 * The sensor status panel: GPS, motion sensors and cloud sync.
 * Extracted verbatim from client/src/pages/trip-recording.tsx.
 */
interface SensorStatusProps {
  hasPosition: boolean;
  isPermissionDenied: boolean;
  motionPermissionGranted: boolean;
  hasActiveTrip: boolean;
  isRecording: boolean;
}

export function SensorStatus({
  hasPosition,
  isPermissionDenied,
  motionPermissionGranted,
  hasActiveTrip,
  isRecording,
}: SensorStatusProps) {
  return (
        <div className="glass-card rounded-2xl p-4 mb-6">
          <h3 className="font-semibold mb-3">Sensor status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">GPS Location</span>
              <div
                className={`w-3 h-3 rounded-full ${hasPosition
                    ? 'bg-green-500'
                    : isPermissionDenied
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Motion Sensors</span>
              <div
                className={`w-3 h-3 rounded-full ${motionPermissionGranted ? 'bg-green-500' : 'bg-red-500'
                  }`}
              />
            </div>
            {hasActiveTrip && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Cloud Sync</span>
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
            )}
          </div>
          {isRecording && (
            <p className="text-xs text-gray-500 mt-3">
              Keep your screen on during the trip for accurate GPS tracking.
            </p>
          )}
        </div>
  );
}
