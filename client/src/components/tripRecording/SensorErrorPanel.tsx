/**
 * The sensor-error panel and its permission retry. Extracted verbatim from
 * client/src/pages/trip-recording.tsx.
 */
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface SensorErrorPanelProps {
  message: string;
  isPermissionDenied: boolean;
  requestPermission: () => void;
}

export function SensorErrorPanel({ message, isPermissionDenied, requestPermission }: SensorErrorPanelProps) {
  return (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl">
            <h4 className="font-semibold text-red-400 mb-2 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Sensor Error
            </h4>
            <p className="text-sm text-red-300">
              {message}
            </p>
            {isPermissionDenied && (
              <Button
                onClick={requestPermission}
                variant="outline"
                size="sm"
                className="mt-3 border-red-500/50 text-red-300 hover:bg-red-500/20"
              >
                Retry Permission
              </Button>
            )}
          </div>
  );
}
