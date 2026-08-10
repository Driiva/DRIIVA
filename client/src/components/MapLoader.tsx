/**
 * The wait while GPS data loads.
 *
 * The spinner here was emerald, which is the colour this product uses to mean
 * a good score. Spending it on "still loading" is exactly the thing the palette
 * rules forbid: colour is earned, and nothing has been earned yet at this point.
 * It now uses the house ArcTracer in the single accent.
 */
import { ArcTracer } from '@/components/motion/Instrument';

const MapLoader = () => (
  <div
    className="flex flex-col items-center justify-center py-12 rounded-xl"
    style={{ background: 'var(--app-surface-1)' }}
  >
    <ArcTracer size={48} label="Loading GPS data" className="mb-4" />
    <p className="text-sm" style={{ color: 'var(--app-text-sec)' }}>
      Loading GPS data
    </p>
  </div>
);

export default MapLoader;
