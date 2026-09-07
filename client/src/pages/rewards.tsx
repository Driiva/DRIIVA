import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { PageWrapper } from '../components/PageWrapper';
import { BottomNav } from '../components/BottomNav';
import { GlassCard } from "@/components/GlassCard";
import RewardsTimeline from "@/components/RewardsTimeline";
import type { RewardState } from "@/components/RewardsTimeline";
import { Gift, TrendingUp, Check, Trophy } from "lucide-react";
import { container, item, timing, easing, microInteractions } from "@/lib/animations";
import { SmoothTabs } from "@/components/SmoothTabs";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from "../hooks/useUserProfile";
import { DEFAULT_DRIVING_PROFILE } from '../../../shared/firestore-types';
import { getUserAchievements } from "@/lib/firestore";
import { buildAchievementViews } from "@driiva/contracts";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from '@/components/ui/EmptyState';

// The achievement view model, the icon map, the shimmer and the header live in
// client/src/components/rewards/.
import {
  ICON_MAP,
  type DisplayAchievement,
} from '@/components/rewards/achievements';
import { Skeleton } from '@/components/rewards/RewardsSkeleton';
import { RewardsHeader } from '@/components/rewards/RewardsHeader';
export default function Rewards() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { userDoc, loading: dataLoading } = useUserProfile(user?.id || null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"achievements" | "rewards" | "progress">("achievements");
  const profile = userDoc?.drivingProfile || DEFAULT_DRIVING_PROFILE;
  const policyNumber = userDoc?.activePolicy?.policyNumber ?? 'Not issued yet';

  const [achievements, setAchievements] = useState<DisplayAchievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [achievementsError, setAchievementsError] = useState<Error | null>(null);
  const { toast } = useToast();

  // Reward milestone states, derived from streakDays + drivingScore
  const rewardStates: RewardState[] = (() => {
    const score = Math.round(profile.currentScore);
    const days = profile.streakDays;
    const states: RewardState[] = [];

    states.push({
      rewardId: 'day5',
      status: days >= 5 && score >= 60 ? 'unlocked' : 'locked',
    });
    states.push({
      rewardId: 'day10',
      status: days >= 10 && score >= 65 ? 'unlocked' : 'locked',
    });
    states.push({
      rewardId: 'team_driiva',
      status: days >= 30 ? 'unlocked' : 'locked',
    });
    states.push({
      rewardId: 'month3',
      status: days >= 90 && score >= 70 ? 'unlocked' : 'locked',
    });
    states.push({
      rewardId: 'anniversary',
      status: days >= 365 && score >= 70 ? 'unlocked' : 'locked',
    });

    return states;
  })();


  useEffect(() => {
    if (!user?.id || !isFirebaseConfigured) {
      setAchievementsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setAchievementsError(null);

      try {
        /*
         * Reads the catalogue from @driiva/contracts and only the UNLOCKS from
         * Firestore, matching /achievements.
         *
         * This page was still calling getAchievementDefinitions(), which reads
         * a top-level collection populated only by an admin seeding callable.
         * Unseeded, it returned nothing, so this screen told a driver with
         * three unlocks that they had "0/-" and "No achievements yet" while
         * /achievements correctly showed 3 of 8. Two screens, one user, two
         * different answers.
         */
        const userRecords = await getUserAchievements(user.id);
        if (cancelled) return;

        const views = buildAchievementViews(
          userRecords.map((r) => ({
            achievementId: r.achievementId,
            unlockedAt: r.unlockedAt?.toDate?.() ?? null,
          })),
          {
            totalTrips: profile.totalTrips ?? 0,
            totalMiles: profile.totalMiles ?? 0,
            streakDays: profile.streakDays ?? 0,
            currentScore: profile.currentScore ?? 0,
          },
        );

        setAchievements(
          views.map((view) => ({
            id: view.id,
            title: view.name,
            description: view.description,
            icon: ICON_MAP[view.icon] ?? Trophy,
            unlocked: view.unlocked,
            unlockedAt: view.unlockedAt?.toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            }),
            category: view.category,
          })),
        );
      } catch (err) {
        // A swallowed read error left `achievements` empty, and the render
        // below then told the driver "No achievements yet. Nothing is hidden
        // here, there is simply nothing to show yet." That is a confident
        // claim about their account made from a read that never landed.
        console.error('[Rewards] Failed to load achievements:', err);
        if (!cancelled) setAchievementsError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setAchievementsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleLogout = () => {
    setShowDropdown(false);
    setLocation("/");
    logout();
  };

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Driver';

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalAchievements = achievements.length;
  const drivingScore = Math.round(profile.currentScore);
  const streakDays = profile.streakDays;
  const projectedRefund = 0; // Requires policy data, so it reads as zero until a policy exists
  const poolShare = userDoc?.poolShare?.currentShareCents ? userDoc.poolShare.currentShareCents / 100 : 0;
  const totalTrips = profile.totalTrips;

  const loading = dataLoading && !userDoc;

  return (
    <PageWrapper>
      <div className="pb-24 text-white">
        {/* Header */}
        <RewardsHeader
          greeting={getGreeting()}
          firstName={firstName}
          avatarInitial={(user?.name?.[0] ?? user?.email?.[0] ?? 'd').toUpperCase()}
          policyNumber={policyNumber}
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          handleLogout={handleLogout}
        />

        <h2 className="text-2xl font-bold text-white mb-4">Rewards</h2>

        {/* Summary Card */}
        <motion.div
          className="mb-6"
          variants={item}
          initial="hidden"
          animate="show"
        >
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <Gift className="w-5 h-5 text-white/60" />
              Rewards Dashboard
            </h3>

            {loading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="text-center p-3 bg-white/5 rounded-xl">
                    <Skeleton className="h-7 w-12 mx-auto mb-2" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <Stagger className="grid grid-cols-2 gap-4">
                {[
                  { value: totalAchievements ? `${unlockedCount}/${totalAchievements}` : String(unlockedCount), label: "Achievements" },
                  { value: streakDays, label: "Day Streak" },
                  { value: `£${projectedRefund}`, label: "Projected Refund", accent: projectedRefund > 0 },
                  { value: totalTrips, label: "Safe Trips" },
                ].map((stat) => (
                  <StaggerItem
                    key={stat.label}
                    className="text-center p-3 bg-white/5 rounded-xl"
                  >
                    <div className={`text-2xl font-semibold tabular ${stat.accent ? 'text-emerald-400' : 'text-white'}`}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-white/50 mt-1">{stat.label}</div>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </GlassCard>
        </motion.div>

        {/* Tab switcher, with a sliding indicator */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: timing.interaction, duration: timing.pageTransition, ease: easing.button }}
        >
          <SmoothTabs
            tabs={[
              { id: 'achievements', label: 'Achievements' },
              { id: 'rewards', label: 'Rewards' },
              { id: 'progress', label: 'Progress' },
            ]}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as "achievements" | "rewards" | "progress")}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: timing.interaction, ease: easing.button }}
          >
            {/* Achievements Tab */}
            {activeTab === "achievements" && (
              <motion.div
                className="space-y-3"
                variants={container}
                initial="hidden"
                animate="show"
              >
                {achievementsLoading ? (
                  [1, 2, 3].map((i) => (
                    <GlassCard key={i} className="p-5">
                      <div className="flex items-start gap-4 animate-pulse">
                        <Skeleton className="w-12 h-12 rounded-xl" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-2" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    </GlassCard>
                  ))
                ) : achievementsError ? (
                  <EmptyState
                    tone="error"
                    icon={<Gift size={24} strokeWidth={2} />}
                    heading="We could not load your achievements"
                    subtext="This is a problem reading them, not a sign you have none. Your unlocks are safe. Try again in a moment."
                  />
                ) : achievements.length === 0 ? (
                  <EmptyState
                    icon={<Gift size={24} strokeWidth={2} />}
                    heading="No achievements yet"
                    subtext="Achievements unlock as you complete scored trips. Nothing is hidden here, there is simply nothing to show yet."
                  />
                ) : (
                  achievements.map((achievement) => (
                    <motion.div
                      key={achievement.id}
                      variants={item}
                      whileHover={microInteractions.hoverSubtle}
                      whileTap={microInteractions.tap}
                    >
                      <GlassCard className="p-5">
                        <div className="flex items-start gap-4">
                          <motion.div
                            className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0"
                            whileHover={{ rotate: 5, scale: 1.05 }}
                            transition={{ duration: timing.interaction }}
                          >
                            <achievement.icon
                              className="w-6 h-6"
                              strokeWidth={2}
                              style={{
                                color: achievement.unlocked
                                  ? 'var(--app-primary-text)'
                                  : 'var(--app-text-sec)',
                              }}
                              aria-hidden="true"
                            />
                          </motion.div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white text-sm">{achievement.title}</h3>
                              {achievement.unlocked && (
                                <motion.div
                                  className="w-5 h-5 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: timing.interaction, type: "spring", stiffness: 380, damping: 30 }}
                                >
                                  <Check className="w-3 h-3 text-emerald-400" />
                                </motion.div>
                              )}
                            </div>

                            <p className="text-xs text-white/60 mb-1">{achievement.description}</p>

                            {achievement.unlocked && achievement.unlockedAt && (
                              <div className="text-xs text-white/60">
                                Unlocked: {achievement.unlockedAt}
                              </div>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {/* Rewards tab: the five-tier milestone timeline */}
            {activeTab === "rewards" && (
              <RewardsTimeline
                daysActive={streakDays}
                rewardStates={rewardStates}
              />
            )}

            {/* Progress Tab */}
            {activeTab === "progress" && (
              <motion.div
                className="space-y-6"
                variants={container}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={item}>
                  <GlassCard className="p-6">
                    <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-white/60" />
                      Your Stats
                    </h3>

                    {loading ? (
                      <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="text-center p-4 bg-white/5 rounded-xl">
                            <Skeleton className="h-7 w-12 mx-auto mb-2" />
                            <Skeleton className="h-3 w-16 mx-auto" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { value: String(drivingScore), label: "Current Score", accent: drivingScore > 0 },
                          { value: String(streakDays), label: "Streak Days" },
                          { value: profile.totalMiles > 0 ? String(Math.round(profile.totalMiles)) : '—', label: "Miles Driven" },
                          { value: projectedRefund > 0 ? `£${projectedRefund}` : '—', label: "Refund Earned", accent: true },
                        ].map((stat, index) => (
                          <motion.div
                            key={index}
                            className="text-center p-4 bg-white/5 rounded-xl"
                            whileHover={microInteractions.hover}
                            transition={{ duration: timing.quick }}
                          >
                            <div className={`text-2xl font-semibold ${stat.accent ? 'text-emerald-400' : 'text-white'}`}>
                              {stat.value}
                            </div>
                            <div className="text-xs text-white/60 mt-1">{stat.label}</div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                </motion.div>

                {/* Refund progress bar */}
                {drivingScore > 0 && (
                  <motion.div variants={item}>
                    <GlassCard className="p-6">
                      <h3 className="font-semibold text-white text-sm mb-3">Refund progress</h3>
                      <div className="flex items-center justify-between mb-2 text-sm">
                        <span className="text-white/60">Current score</span>
                        <span className="text-white font-semibold">{drivingScore}</span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${drivingScore}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                          className={`h-full rounded-full ${
                            drivingScore >= 80 ? 'bg-emerald-500' : drivingScore >= 70 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-white/60">
                        <span>0</span>
                        <span className="text-amber-400/60">70 (qualify)</span>
                        <span>100</span>
                      </div>
                      {projectedRefund > 0 && (
                        <p className="text-emerald-300/70 text-xs text-center mt-3">
                          You're on track for £{projectedRefund} back this period
                        </p>
                      )}
                    </GlassCard>
                  </motion.div>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav />
    </PageWrapper>
  );
}

