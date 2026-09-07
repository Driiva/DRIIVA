import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PageWrapper } from '../components/PageWrapper';
import { BottomNav } from '../components/BottomNav';
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useHaptics } from '@/hooks/useHaptics';

// The presentational pieces this page is assembled from live in
// client/src/components/profile/.
import { DetailRow, Skeleton, StatCard } from '@/components/profile/primitives';
import { CoverageTypeSection } from '@/components/profile/CoverageTypeSection';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { VehicleCard } from '@/components/profile/VehicleCard';
import { PreferencesCard } from '@/components/profile/PreferencesCard';
import { PrivacyCard } from '@/components/profile/PrivacyCard';
import type { EditableFields } from '@/components/profile/types';

/** The vehicle sub-document the edit form writes back. */
interface ProfileVehicleUpdate {
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vin: string | null;
}

/** Everything the profile edit form is allowed to write to the user document. */
type ProfileUpdate = Record<string, string | Timestamp | ProfileVehicleUpdate>;
export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const haptics = useHaptics();
  const [showDropdown, setShowDropdown] = useState(false);
  const [locationTracking, setLocationTracking] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: dashboardData, loading, error, refresh } = useDashboardData(user?.id ?? null);

  const [editFields, setEditFields] = useState<EditableFields>({
    displayName: '',
    phoneNumber: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
  });

  const startEditing = useCallback(() => {
    setEditFields({
      displayName: dashboardData?.displayName || user?.name || '',
      phoneNumber: dashboardData?.phoneNumber || '',
      vehicleMake: dashboardData?.vehicle?.make || '',
      vehicleModel: dashboardData?.vehicle?.model || '',
      vehicleYear: dashboardData?.vehicle?.year ? String(dashboardData.vehicle.year) : '',
    });
    setSaveError(null);
    setIsEditing(true);
  }, [dashboardData, user]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setSaveError(null);
  }, []);

  const saveChanges = useCallback(async () => {
    if (!user?.id || !db) return;
    setSaving(true);
    setSaveError(null);

    try {
      const userRef = doc(db, 'users', user.id);
      const updates: ProfileUpdate = {
        updatedAt: Timestamp.now(),
        updatedBy: user.id,
      };

      if (editFields.displayName.trim()) {
        updates.displayName = editFields.displayName.trim();
      }
      if (editFields.phoneNumber.trim()) {
        updates.phoneNumber = editFields.phoneNumber.trim();
      }
      if (editFields.vehicleMake.trim() || editFields.vehicleModel.trim() || editFields.vehicleYear.trim()) {
        const yearNum = parseInt(editFields.vehicleYear, 10);
        updates.vehicle = {
          make: editFields.vehicleMake.trim() || null,
          model: editFields.vehicleModel.trim() || null,
          year: !isNaN(yearNum) && yearNum > 1900 && yearNum <= new Date().getFullYear() + 1 ? yearNum : null,
          color: null,
          vin: null,
        };
      }

      await updateDoc(userRef, updates);
      setIsEditing(false);
      refresh();
    } catch (err) {
      console.error('[Profile] Save error:', err);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [user, editFields, refresh]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleLogout = () => {
    haptics.medium();
    setShowDropdown(false);
    setLocation("/");
    logout();
  };

  const firstName = user?.name?.split(' ')[0] ?? '';
  const lastName = user?.name?.split(' ').slice(1).join(' ') ?? '';
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`
    : (firstName ? firstName[0] : (user?.email?.[0] ?? '?')).toUpperCase();
  const greetingName = firstName || user?.email?.split('@')[0] || 'Driver';
  const avatarInitial = (user?.name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  const currentScore = dashboardData?.drivingScore ?? 0;
  const totalTrips = dashboardData?.totalTrips ?? 0;
  const totalMiles = dashboardData?.totalMiles ?? 0;
  const premiumAmount = dashboardData?.premiumAmount
    ? dashboardData.premiumAmount.toFixed(2)
    : '—';
  /*
   * WAVE H: `displayPolicyNumber = policyNumber ?? memberId` filled a slot with
   * whichever value happened to exist. Two problems. The member ID wore a
   * `DRV-` prefix, which is the shape this system mints POLICY numbers in, so
   * an account identifier read as a policy reference. And a real policy number
   * was being rendered under a "Member ID" label whenever one existed.
   *
   * They are different things about different objects, so they are separate
   * values now. The member ID is derived from the account and always exists;
   * the policy number belongs to a policy and is shown where policies are.
   */
  const memberId = user?.id ? user.id.slice(0, 8).toUpperCase() : '—';
  const scoreBreakdown = dashboardData?.scoreBreakdown;
  const memberSince = dashboardData?.memberSince ?? '—';

  if (error && !dashboardData) {
    return (
      <PageWrapper>
        <div className="pb-24 text-white flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <span className="text-4xl">⚠️</span>
          <p className="text-white/70 text-sm font-medium">Something went wrong loading your profile.</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium hover:bg-emerald-500/30 transition-colors min-h-[44px]"
          >
            Try Again
          </button>
        </div>
        <BottomNav />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="pb-24 text-white space-y-6">
        {/* Header */}
        <ProfileHeader
          greeting={getGreeting()}
          greetingName={greetingName}
          avatarInitial={avatarInitial}
          memberId={memberId}
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          handleLogout={handleLogout}
        />

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Profile</h2>
          {!isEditing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors min-h-[44px]"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-white/60 hover:text-white rounded-lg transition-colors min-h-[44px]"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors min-h-[44px] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          )}
        </div>

        {saveError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
            {saveError}
          </div>
        )}

        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4 border-2 border-emerald-500/60"
              style={{
                background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 70%, transparent 100%)',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.15), inset 0 0 20px rgba(16, 185, 129, 0.1)'
              }}
            >
              {loading ? (
                <Skeleton className="w-10 h-6 rounded" />
              ) : (
                <span className="text-2xl font-semibold text-white/80">{initials.toUpperCase()}</span>
              )}
            </div>
            {loading ? (
              <>
                <Skeleton className="h-6 w-36 mb-2" />
                <Skeleton className="h-4 w-48" />
              </>
            ) : isEditing ? (
              <>
                <input
                  type="text"
                  value={editFields.displayName}
                  onChange={(e) => setEditFields(f => ({ ...f, displayName: e.target.value }))}
                  className="text-xl font-semibold text-white mb-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 text-center w-48 focus:outline-none focus:border-emerald-500/50"
                  placeholder="Your name"
                />
                <p className="text-sm text-white/60">{user?.email || '—'}</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-white mb-1">
                  {dashboardData?.displayName || user?.name || user?.email?.split('@')[0] || 'Driver'}
                </h2>
                <p className="text-sm text-white/60">{user?.email || '—'}</p>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <span className="text-xs text-white/60">Score</span>
              {loading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="text-sm font-semibold text-white">{totalTrips === 0 ? '—' : currentScore}</span>
              )}
            </div>
            <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <span className="text-xs text-white/60">Trips</span>
              {loading ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="text-sm font-semibold text-white">{totalTrips}</span>
              )}
            </div>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span>📋</span>
            Account Details
          </h3>

          <div className="space-y-1">
            <DetailRow label="Email" value={user?.email || '—'} loading={loading} />

            {isEditing ? (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-white/60">Phone</span>
                <input
                  type="tel"
                  value={editFields.phoneNumber}
                  onChange={(e) => setEditFields(f => ({ ...f, phoneNumber: e.target.value }))}
                  className="text-sm font-medium text-white text-right bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 w-40 focus:outline-none focus:border-emerald-500/50"
                  placeholder="+44 7..."
                />
              </div>
            ) : (
              <DetailRow label="Phone" value={dashboardData?.phoneNumber || '—'} loading={loading} />
            )}

            <DetailRow label="Premium" value={premiumAmount !== '—' ? `£${premiumAmount}` : '—'} loading={loading} />
            <DetailRow label="Member ID" value={memberId} loading={loading} />
            <DetailRow label="Member since" value={memberSince} loading={loading} />
            {(loading || dashboardData?.age) && (
              <DetailRow label="Age" value={dashboardData?.age ? String(dashboardData.age) : '—'} loading={loading} />
            )}
            {(loading || dashboardData?.postcode) && (
              <DetailRow label="Postcode" value={dashboardData?.postcode ?? '—'} loading={loading} />
            )}
            {(loading || dashboardData?.annualMileage) && (
              <DetailRow label="Annual Mileage" value={dashboardData?.annualMileage ?? '—'} loading={loading} />
            )}
            {(loading || dashboardData?.currentInsurer) && (
              <DetailRow label="Current Insurer" value={dashboardData?.currentInsurer ?? '—'} loading={loading} />
            )}
          </div>
        </div>

        {/* Vehicle Information */}
        <VehicleCard
          isEditing={isEditing}
          loading={loading}
          editFields={editFields}
          setEditFields={setEditFields}
          dashboardData={dashboardData}
        />

        <CoverageTypeSection
          currentScore={currentScore}
          coverageType={dashboardData?.coverageType ?? null}
          premiumAmount={dashboardData?.premiumAmount ?? 0}
          loading={loading}
        />

        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span>📊</span>
            Driving Statistics
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <StatCard value={totalMiles > 0 ? totalMiles.toFixed(1) : '—'} label="Total Miles" loading={loading} />
            <StatCard value={totalTrips} label="Total Trips" loading={loading} />
            <StatCard value={scoreBreakdown ? scoreBreakdown.braking : '—'} label="Braking Score" loading={loading} />
            <StatCard value={scoreBreakdown ? scoreBreakdown.speed : '—'} label="Speed Score" loading={loading} />
          </div>
        </div>

        <PreferencesCard
          locationTracking={locationTracking}
          setLocationTracking={setLocationTracking}
          pushNotifications={pushNotifications}
          setPushNotifications={setPushNotifications}
        />

        <PrivacyCard userId={user?.id ?? ''} setLocation={setLocation} />
      </div>

      <BottomNav />
    </PageWrapper>
  );
}
