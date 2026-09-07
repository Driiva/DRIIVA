/**
 * The vehicle card, in both its read and edit shapes. Extracted verbatim from
 * client/src/pages/profile.tsx.
 */
import type { DashboardData } from '@/hooks/useDashboardData';

import { DetailRow, Skeleton } from './primitives';
import type { EditableFields } from './types';

interface VehicleCardProps {
  isEditing: boolean;
  loading: boolean;
  editFields: EditableFields;
  setEditFields: (update: (f: EditableFields) => EditableFields) => void;
  dashboardData: DashboardData | null;
}

export function VehicleCard({ isEditing, loading, editFields, setEditFields, dashboardData }: VehicleCardProps) {
  return (
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span>🚗</span>
            Vehicle
          </h3>

          {isEditing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Make</span>
                <input
                  type="text"
                  value={editFields.vehicleMake}
                  onChange={(e) => setEditFields(f => ({ ...f, vehicleMake: e.target.value }))}
                  className="text-sm font-medium text-white text-right bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 w-40 focus:outline-none focus:border-emerald-500/50"
                  placeholder="e.g. Toyota"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Model</span>
                <input
                  type="text"
                  value={editFields.vehicleModel}
                  onChange={(e) => setEditFields(f => ({ ...f, vehicleModel: e.target.value }))}
                  className="text-sm font-medium text-white text-right bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 w-40 focus:outline-none focus:border-emerald-500/50"
                  placeholder="e.g. Corolla"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Year</span>
                <input
                  type="number"
                  value={editFields.vehicleYear}
                  onChange={(e) => setEditFields(f => ({ ...f, vehicleYear: e.target.value }))}
                  className="text-sm font-medium text-white text-right bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 w-24 focus:outline-none focus:border-emerald-500/50"
                  placeholder="2024"
                  min="1980"
                  max={new Date().getFullYear() + 1}
                />
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : dashboardData?.vehicle?.make ? (
            <div className="space-y-1">
              <DetailRow label="Make" value={dashboardData.vehicle.make} />
              <DetailRow label="Model" value={dashboardData.vehicle.model || '--'} />
              <DetailRow label="Year" value={dashboardData.vehicle.year ? String(dashboardData.vehicle.year) : '--'} />
            </div>
          ) : (
            <p className="text-sm text-white/60">
              No vehicle added yet. Tap Edit to add your car details.
            </p>
          )}
        </div>
  );
}
