import { Truck, TrendingUp, Gauge, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GlassCard } from './GlassCard';

interface MetricsGridProps {
  profile: {
    hardBrakingScore: number;
    accelerationScore: number;
    speedAdherenceScore: number;
    nightDrivingScore: number;
  };
}

export default function MetricsGrid({ profile }: MetricsGridProps) {
  const { toast } = useToast();

  const handleMetricClick = (metric: any) => {
    toast({
      title: `${metric.label} Details`,
      description: `Current value: ${metric.value} ${metric.unit}\nWeight in scoring: ${metric.weight}\nTip: ${getImprovementTip(metric.label)}`,
    });
  };

  const getImprovementTip = (label: string) => {
    switch (label) {
      case "Hard Braking": return "Maintain steady speeds and anticipate traffic changes";
      case "Acceleration": return "Gradually increase speed and avoid rapid acceleration";
      case "Speed": return "Stay within speed limits and follow traffic regulations";
      case "Night Driving": return "Limit night trips when possible for better safety scores";
      default: return "Continue safe driving practices";
    }
  };

  const metrics = [
    {
      icon: Truck,
      label: "Hard Braking",
      value: profile.hardBrakingScore,
      weight: "25% weight",
      color: "#EF4444",
      unit: profile.hardBrakingScore === 1 ? "harsh event this month" : "harsh events this month"
    },
    {
      icon: TrendingUp,
      label: "Acceleration",
      value: profile.accelerationScore,
      weight: "20% weight",
      color: "#F59E0B",
      unit: profile.accelerationScore === 1 ? "harsh event this month" : "harsh events this month"
    },
    {
      icon: Gauge,
      label: "Speed",
      value: profile.speedAdherenceScore,
      weight: "20% weight",
      color: "var(--app-primary)",
      unit: profile.speedAdherenceScore === 1 ? "violation this month" : "violations this month"
    },
    {
      icon: Moon,
      label: "Night Driving",
      value: profile.nightDrivingScore,
      weight: "15% weight",
      color: "#A855F7",
      unit: profile.nightDrivingScore === 1 ? "night trip this month" : "night trips this month"
    }
  ];

  return (
    <section>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, index) => (
          <GlassCard key={index} className="p-5">
            <button 
              onClick={() => handleMetricClick(metric)} 
              className="w-full text-left min-h-[44px] transition-all duration-200 ease-out active:scale-95" 
              data-testid={`metric-${metric.label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="flex items-center space-x-2 mb-2">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${metric.color}20` }}
                >
                  <metric.icon className="w-4 h-4" style={{ color: metric.color }} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-sm">
                    {metric.label}
                  </div>
                  <div className="text-white/60 text-xs">
                    {metric.weight}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold text-2xl">
                  {metric.value}
                </div>
                <div className="text-white/60 text-xs mt-1">
                  {metric.unit}
                </div>
              </div>
            </button>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
