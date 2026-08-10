import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { 
  ArrowLeft, 
  Trophy, 
  Car, 
  Shield, 
  Target, 
  Users, 
  Zap, 
  Star,
  Lock,
  CheckCircle2,
  Flame,
  Route,
  Moon,
  Gauge,
  Award,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageWrapper } from "../components/PageWrapper";
import { BottomNav } from "../components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { getUserAchievements } from "@/lib/firestore";
import { buildAchievementViews, type AchievementView } from "@driiva/contracts";
import { useUserProfile } from "@/hooks/useUserProfile";
import { isFirebaseConfigured } from "@/lib/firebase";

/**
 * ACHIEVEMENTS PAGE
 * -----------------
 * Displays user achievements. Reads definitions + user unlock records from
 * Firestore for authenticated users; falls back to demo data.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  Car, Shield, Target, Users, Zap, Star, Flame, Route, Moon, Gauge, Award, Trophy,
};

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  unlocked: boolean;
  unlockedDate?: string;
  progress?: number;
  maxProgress?: number;
  category: 'safety' | 'community' | 'refund' | 'milestone';
}

const CATEGORY_STYLES: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  safety:    { color: 'text-blue-400',    bgColor: 'from-blue-500/20 to-blue-600/20',    borderColor: 'border-blue-500/30' },
  community: { color: 'text-pink-400',    bgColor: 'from-pink-500/20 to-pink-600/20',    borderColor: 'border-pink-500/30' },
  refund:    { color: 'text-cyan-400',    bgColor: 'from-cyan-500/20 to-cyan-600/20',    borderColor: 'border-cyan-500/30' },
  milestone: { color: 'text-emerald-400', bgColor: 'from-emerald-500/20 to-emerald-600/20', borderColor: 'border-emerald-500/30' },
};

function viewToAchievement(view: AchievementView): Achievement {
  const style = CATEGORY_STYLES[view.category] ?? CATEGORY_STYLES.milestone;
  return {
    id: view.id,
    title: view.name,
    description: view.description,
    icon: ICON_MAP[view.icon] ?? Trophy,
    ...style,
    unlocked: view.unlocked,
    unlockedDate: view.unlockedAt?.toISOString(),
    progress: view.progress ?? undefined,
    maxProgress: view.maxProgress ?? undefined,
    category: view.category,
  };
}

/*
  Wave 0 (0a): the hardcoded DEMO_ACHIEVEMENTS catalogue was deleted. It
  carried invented unlock dates (2026-01-15) and invented progress counters
  (47/100 trips, 62/100 pounds refunded), and every real user hit it through
  EMPTY_ACHIEVEMENTS on the not-configured, not-seeded and error paths.

  Wave D: the catalogue now comes from @driiva/contracts, the same source the
  unlock engine builds its predicates from, rather than from a top-level
  Firestore collection populated by an admin-only seeding callable. If nobody
  had run that callable in an environment, the page rendered nothing even for a
  user whose unlocks existed. Only the UNLOCKS are read from Firestore, which
  is the part that is genuinely per-user. Progress is computed from the real
  driving profile; nothing here is invented.
*/

const categoryLabels: Record<string, string> = {
  safety: 'Safe Driving',
  community: 'Community',
  refund: 'Refunds',
  milestone: 'Milestones',
};

const categoryColors: Record<string, string> = {
  safety: 'text-blue-400',
  community: 'text-pink-400',
  refund: 'text-cyan-400',
  milestone: 'text-emerald-400',
};

export default function Achievements() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { userDoc: profile } = useUserProfile(user?.id ?? null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    setIsDemoMode(sessionStorage.getItem('driiva-demo-mode') === 'true');

    if (!user?.id || !isFirebaseConfigured) {
      setAchievements([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const userRecords = await getUserAchievements(user.id);
        if (cancelled) return;

        const unlocked = userRecords.map((r) => ({
          achievementId: r.achievementId,
          unlockedAt: r.unlockedAt?.toDate?.() ?? null,
        }));

        const views = buildAchievementViews(unlocked, {
          totalTrips: profile?.drivingProfile?.totalTrips ?? 0,
          totalMiles: profile?.drivingProfile?.totalMiles ?? 0,
          streakDays: profile?.drivingProfile?.streakDays ?? 0,
          currentScore: profile?.drivingProfile?.currentScore ?? 0,
        });

        setAchievements(views.map(viewToAchievement));
      } catch (err) {
        console.error('[Achievements] Failed to load unlocks:', err);
        if (!cancelled) {
          setAchievements([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, profile]);

  const filteredAchievements = selectedCategory
    ? achievements.filter(a => a.category === selectedCategory)
    : achievements;

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  if (loading) {
    return (
      <PageWrapper>
        <div className="pb-24 text-white animate-pulse">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-white/10 rounded-full" />
            <div className="h-7 w-40 bg-white/10 rounded" />
          </div>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 bg-white/10 rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="dashboard-glass-card p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-48 bg-white/10 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="pb-24 text-white">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <button
            onClick={() => setLocation('/dashboard')}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Achievements</h1>
            {isDemoMode && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                Demo Mode
              </span>
            )}
          </div>
        </motion.div>

        {/* Progress Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="dashboard-glass-card mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Your Progress</h2>
              <p className="text-white/60 text-sm">{unlockedCount} of {totalCount} achievements unlocked</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-amber-400" />
            </div>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: totalCount > 0 ? `${(unlockedCount / totalCount) * 100}%` : '0%' }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
            />
          </div>
        </motion.div>

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex gap-2 mb-6 overflow-x-auto pb-2"
        >
          <button
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === null
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === key
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </motion.div>

        {/* Achievements Grid */}
        <div className="space-y-4">
          {filteredAchievements.map((achievement, index) => {
            const Icon = achievement.icon;
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className={`dashboard-glass-card relative overflow-hidden ${
                  !achievement.unlocked ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Achievement Icon */}
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${achievement.bgColor} border ${achievement.borderColor} flex items-center justify-center flex-shrink-0`}
                  >
                    {achievement.unlocked ? (
                      <Icon className={`w-7 h-7 ${achievement.color}`} />
                    ) : (
                      <Lock className="w-6 h-6 text-white/40" />
                    )}
                  </div>

                  {/* Achievement Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white truncate">{achievement.title}</h3>
                      {achievement.unlocked && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-white/60 mb-2">{achievement.description}</p>
                    
                    {/* Category Badge */}
                    <span className={`text-xs ${categoryColors[achievement.category]}`}>
                      {categoryLabels[achievement.category]}
                    </span>

                    {/* Progress Bar (for locked achievements with progress) */}
                    {!achievement.unlocked && achievement.progress !== undefined && achievement.maxProgress && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-white/50 mb-1">
                          <span>Progress</span>
                          <span>{achievement.progress}/{achievement.maxProgress}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${achievement.bgColor.replace(/\/20/g, '/60')} rounded-full`}
                            style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Unlocked Date */}
                    {achievement.unlocked && achievement.unlockedDate && (
                      <p className="text-xs text-white/40 mt-2">
                        Unlocked {new Date(achievement.unlockedDate).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredAchievements.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Trophy className="w-16 h-16 text-white/20 mx-auto mb-4" />
            {loadError ? (
              <>
                <p className="text-white/60">We could not load your achievements.</p>
                <p className="text-white/40 text-sm mt-1">Check your connection and try again.</p>
              </>
            ) : totalCount === 0 ? (
              <>
                <p className="text-white/60">No achievements yet.</p>
                <p className="text-white/40 text-sm mt-1">
                  They unlock as you record trips.
                </p>
              </>
            ) : (
              <p className="text-white/60">No achievements in this category yet</p>
            )}
          </motion.div>
        )}
      </div>

      <BottomNav />
    </PageWrapper>
  );
}
