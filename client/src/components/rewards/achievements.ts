/**
 * The Rewards page's achievement view model and the icon it resolves each one
 * to. Extracted verbatim from client/src/pages/rewards.tsx.
 */
import {
  Trophy,
  Shield,
  Target,
  Award,
  Star,
  Flame,
  Moon,
  Car,
  Route,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DisplayAchievement {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  unlocked: boolean;
  unlockedAt?: string;
  category: string;
}

/*
 * Lucide names from the shared catalogue. The previous table mapped each one
 * to an EMOJI, which the brand bans outright and which rendered as the only
 * visual for a real achievement.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Car, Shield, Target, Star, Flame, Route, Moon, Award, Trophy,
};

