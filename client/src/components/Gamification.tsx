import { Award, Zap, Star, Trophy, Target, Users, Gift, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { GlassCard } from './GlassCard';

interface GamificationProps {
  achievements: any[];
  leaderboard: any[];
  currentUser: any;
  profile?: {
    currentScore: number;
    projectedRefund: number;
    totalMiles: number;
  };
  premiumAmount?: number;
}

export default function Gamification({ achievements, leaderboard, currentUser, profile, premiumAmount }: GamificationProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const unlockedAchievements = [
    { name: "Safe Driver", description: "30 days", icon: Award },
    { name: "Speed Master", description: "No violations", icon: Zap },
  ];

  const lockedAchievements = [
    { name: "Night Owl", description: "Locked", icon: Star },
  ];

  const refundTiers = profile && premiumAmount ? {
    silver: { score: 85, refund: premiumAmount * 0.10, label: "Silver" },
    gold: { score: 90, refund: premiumAmount * 0.12, label: "Gold" },
    platinum: { score: 95, refund: premiumAmount * 0.15, label: "Platinum" }
  } : null;

  const topLeaderboard = [
    { name: "driiva1", score: 72, rank: 1, weeklyChange: "+2%" },
    { name: "speedracer42", score: 71, rank: 2, weeklyChange: "+3%" },
    { name: "safejenny", score: 70, rank: 3, weeklyChange: "-1%" },
  ];

  const userRank = { name: "You", score: 72, rank: 14 };

  const handleViewRewards = () => {
    setLocation('/rewards');
  };

  const handleLeaderboardClick = () => {
    setLocation('/leaderboard');
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold flex items-center gap-2 text-white">
          <Trophy className="w-5 h-5 text-white/60" />
          Achievements & Goals
        </h3>
        <button
          onClick={handleViewRewards}
          className="px-4 py-2 min-h-[44px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-xl transition-all duration-200 ease-out flex items-center gap-1.5 hover:bg-emerald-500/30 active:scale-95"
        >
          <Gift className="w-3.5 h-3.5" />
          View Achievements
        </button>
      </div>

      {/* Refund Progress Section */}
      {refundTiers && profile && (
        <GlassCard className="p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center text-white">
              <Target className="w-4 h-4 mr-2 text-white/60" />
              Refund Goals
            </h4>
            <div className="text-xs text-white/60">Current: {profile.currentScore}/100</div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(refundTiers).map(([tier, data]) => {
              const isAchieved = profile.currentScore >= data.score;
              const isEligible = profile.currentScore >= 70;
              return (
                <div 
                  key={tier} 
                  className={`text-center p-3 rounded-xl transition-all duration-200 ease-out min-h-[44px] ${
                    isAchieved 
                      ? 'bg-emerald-500/20 border border-emerald-500/30' 
                      : isEligible 
                        ? 'bg-white/5' 
                        : 'bg-white/5 opacity-50'
                  }`}
                >
                  <div className={`text-xs font-medium ${isAchieved ? 'text-emerald-400' : 'text-white/70'}`}>
                    {data.label}
                  </div>
                  <div className="text-xs text-white/60">{data.score}+ score</div>
                  <div className="text-sm font-semibold text-white mt-1">£{data.refund.toFixed(0)}</div>
                  {isAchieved && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Unlocked</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        {unlockedAchievements.map((achievement, index) => (
          <GlassCard key={index} className="p-4 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center mx-auto mb-2">
              <achievement.icon className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-xs font-medium text-white">{achievement.name}</div>
            <div className="text-xs text-white/60">{achievement.description}</div>
          </GlassCard>
        ))}

        {lockedAchievements.map((achievement, index) => (
          <GlassCard key={index} className="p-4 text-center opacity-40">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-2">
              <achievement.icon className="w-5 h-5 text-white/60" />
            </div>
            <div className="text-xs font-medium text-white/60">{achievement.name}</div>
            <div className="text-xs text-white/60">{achievement.description}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium flex items-center gap-2 text-white">
            <Users className="w-4 h-4 text-white/60" />
            Community Leaderboard
          </h4>
          <button
            onClick={handleLeaderboardClick}
            className="text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1.5 min-h-[44px] hover:bg-white/5 rounded-xl transition-all duration-200 ease-out border border-emerald-500/30"
          >
            See All Driivas
          </button>
        </div>

        <div className="space-y-2">
          {topLeaderboard.map((entry, index) => (
            <button
              key={index}
              onClick={handleLeaderboardClick}
              className="flex items-center justify-between w-full p-3 min-h-[44px] hover:bg-white/5 rounded-xl transition-all duration-200 ease-out active:scale-[0.98]"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  entry.rank === 1 ? 'bg-white/20 text-white' : 
                  entry.rank === 2 ? 'bg-white/15 text-white/80' : 
                  'bg-white/10 text-white/70'
                }`}>
                  {entry.rank}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-white">{entry.name}</span>
                  <span className="text-xs text-white/60">{entry.weeklyChange} this week</span>
                </div>
              </div>
              <span className="text-sm font-semibold text-white/80">{entry.score}</span>
            </button>
          ))}

          <div className="border-t border-white/5 pt-3 mt-3">
            <button
              onClick={() => toast({
                title: "Your Ranking",
                description: "You're currently #14 with a score of 72. Drive safely to improve your ranking!",
              })}
              className="flex items-center justify-between w-full p-3 min-h-[44px] hover:bg-emerald-500/10 rounded-xl transition-all duration-200 ease-out active:scale-[0.98]"
            >
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center text-xs font-semibold text-emerald-400">
                  {userRank.rank}
                </div>
                <span className="text-sm font-medium text-emerald-400">{userRank.name}</span>
              </div>
              <span className="text-sm font-semibold text-emerald-400">{userRank.score}</span>
            </button>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
