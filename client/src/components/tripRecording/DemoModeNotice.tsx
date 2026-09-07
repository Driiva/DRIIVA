/**
 * The warning shown on an unconfigured Firebase: trips stay local. Extracted
 * verbatim from client/src/pages/trip-recording.tsx.
 */
export function DemoModeNotice() {
  return (
          <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl">
            <p className="text-sm text-yellow-300">
              <strong>Demo Mode:</strong> Trip data will not be saved to cloud.
              Configure Firebase to enable cloud sync.
            </p>
          </div>
  );
}
