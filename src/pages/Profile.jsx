/**
 * Profile.jsx  —  /profile
 *
 * Personal command center. Sections:
 *   1. Hero — avatar, name, identity title, XP bar, streak
 *   2. Lifetime Stats — sessions, focus time, avg, streaks, XP, level
 *   3. Achievements Showcase — reuses FocusInsights system + same overlay
 *   4. Growth Section — heatmap, best day, consistency, AI insight
 *   5. Focus Personality — archetype card derived from behaviour
 *   6. Activity Timeline — last 10 sessions
 *   7. Settings Panel — edit name, theme
 *   8. Danger Zone — delete account with typed confirmation
 *
 * Auth: Clerk (useUser, useClerk)
 * DB:   Supabase via useSupabase hook (RLS-scoped)
 * XP / Level / Achievement logic copied from FocusInsights — no extra deps.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import { createPortal } from 'react-dom';
import {
  Flame,
  Clock,
  BookOpen,
  Brain,
  Target,
  TrendingUp,
  Award,
  Star,
  CheckCircle2,
  Zap,
  Crown,
  Shield,
  Sun,
  Moon,
  Edit2,
  Check,
  X,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Trophy,
  Lock,
  Info,
  ArrowUpRight,
  Minus,
  BarChart2,
  Calendar,
  Layers,
  Play,
  LogOut,
  Trash2,
  AlertTriangle,
  User,
  Settings,
  Download,
  Copy,
  ExternalLink,
  LayoutDashboard,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   SHARED HELPERS  (mirrors FocusInsights exactly)
═══════════════════════════════════════════════════════════════ */
const fmtMins = (m) => {
  if (!m) return '0m';
  const h = Math.floor(m / 60),
    r = m % 60;
  return h ? `${h}h${r > 0 ? ` ${r}m` : ''}` : `${r}m`;
};
const dateStr = (d) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const todayISO = () => new Date().toISOString().slice(0, 10);

function sessionXP(s) {
  let xp = (s.duration || 0) * 2;
  if (s.completed || s.is_completed) xp += 50;
  if (s.difficulty === 'hard') xp *= 1.5;
  else if (s.difficulty === 'medium') xp *= 1.2;
  return Math.round(xp);
}
function xpToLevel(xp) {
  return Math.min(Math.floor(Math.sqrt(xp / 100)) + 1, 50);
}
function xpForLevel(l) {
  return (l - 1) ** 2 * 100;
}
function xpForNextLevel(l) {
  return l ** 2 * 100;
}
function calcStreak(sessions) {
  if (!sessions.length) return 0;
  const days = new Set(
    sessions.map((s) => new Date(s.created_at).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) streak++;
    else if (i > 0) break;
  }
  return streak;
}
function calcLongestStreak(sessions) {
  if (!sessions.length) return 0;
  const days = [
    ...new Set(
      sessions.map((s) => new Date(s.created_at).toISOString().slice(0, 10)),
    ),
  ].sort();
  let max = 1,
    cur = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i]) - new Date(days[i - 1])) / 86400000;
    if (diff === 1) {
      cur++;
      max = Math.max(max, cur);
    } else cur = 1;
  }
  return max;
}
function buildHeatmap(sessions) {
  const dayMap = {};
  sessions.forEach((s) => {
    const k = new Date(s.created_at).toISOString().slice(0, 10);
    dayMap[k] = (dayMap[k] || 0) + (s.duration || 0);
  });
  const weeks = [],
    today = new Date(),
    start = new Date(today);
  start.setDate(today.getDate() - 111);
  for (let w = 0; w < 16; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const k = dt.toISOString().slice(0, 10);
      const mins = dayMap[k] || 0;
      week.push({
        date: k,
        mins,
        level:
          mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 90 ? 3 : 4,
      });
    }
    weeks.push(week);
  }
  return weeks;
}
function bestStudyDay(sessions) {
  const map = {},
    labels = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
  sessions.forEach((s) => {
    const d = labels[new Date(s.created_at).getDay()];
    map[d] = (map[d] || 0) + (s.duration || 0);
  });
  if (!Object.keys(map).length) return null;
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0];
}
function levelTitle(l) {
  if (l < 3) return 'Newcomer';
  if (l < 6) return 'Apprentice';
  if (l < 10) return 'Scholar';
  if (l < 15) return 'Focused';
  if (l < 20) return 'Adept';
  if (l < 30) return 'Expert';
  if (l < 40) return 'Master';
  return 'Grandmaster';
}
function focusIdentityTitle(l, streak) {
  if (l >= 30 || streak >= 60) return 'Focus Grandmaster';
  if (l >= 20 || streak >= 30) return 'Deep Work Master';
  if (l >= 10 || streak >= 14) return 'Dedicated Scholar';
  if (l >= 5 || streak >= 7) return 'Focus Apprentice';
  return 'Aspiring Learner';
}
function deriveArchetype(sessions, streak) {
  if (!sessions.length)
    return {
      name: 'The Beginner',
      desc: 'Your journey is just starting. Every expert was once a beginner.',
      traits: ['Curious', 'Fresh Start', 'Potential'],
    };
  const total = sessions.length;
  const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const avgMins = totalMins / total;
  const hardCount = sessions.filter((s) => s.difficulty === 'hard').length;
  const hardRatio = hardCount / total;
  const morningCount = sessions.filter(
    (s) => new Date(s.created_at).getHours() < 12,
  ).length;
  const nightCount = sessions.filter(
    (s) => new Date(s.created_at).getHours() >= 21,
  ).length;
  const completedRatio =
    sessions.filter((s) => s.completed || s.is_completed).length / total;
  const aiCount = sessions.filter((s) => s.ai_plan?.steps?.length > 0).length;
  if (streak >= 21 && completedRatio >= 0.8)
    return {
      name: 'The Iron Scholar',
      desc: "Relentless, consistent, and disciplined. You show up even when it's hard.",
      traits: ['Consistency', 'Iron Will', 'High Completion'],
    };
  if (hardRatio >= 0.6)
    return {
      name: 'The Gladiator',
      desc: "You seek difficulty on purpose. Hard problems don't scare you — they energise you.",
      traits: ['Loves Challenge', 'Resilient', 'High Intensity'],
    };
  if (nightCount > morningCount * 2)
    return {
      name: 'The Night Scholar',
      desc: 'You come alive when the world sleeps. The quiet of night is your focus fuel.',
      traits: ['Night Owl', 'Deep Focus', 'Solitary'],
    };
  if (morningCount > nightCount * 2)
    return {
      name: 'The Early Riser',
      desc: 'Morning is your arena. You tackle your hardest goals before the world wakes up.',
      traits: ['Morning Person', 'Proactive', 'Disciplined'],
    };
  if (aiCount >= total * 0.6)
    return {
      name: 'The AI Collaborator',
      desc: 'You leverage AI to plan and execute. You work smarter, not just harder.',
      traits: ['Tech-Savvy', 'Structured', 'AI-Powered'],
    };
  if (avgMins >= 75)
    return {
      name: 'The Deep Diver',
      desc: "You don't do shallow work. Long, deep sessions where you lose track of time.",
      traits: ['Deep Focus', 'Marathon Sessions', 'Flow State'],
    };
  if (total >= 50 && completedRatio >= 0.75)
    return {
      name: 'The Consistent Climber',
      desc: 'Steady, reliable progress every single day. The tortoise always wins.',
      traits: ['Consistent', 'Reliable', 'Long-Game Thinker'],
    };
  return {
    name: 'The Explorer',
    desc: "You're still finding your study style. Experiment, iterate, and grow.",
    traits: ['Curious', 'Adaptable', 'Growing'],
  };
}

/* ═══════════════════════════════════════════════════════════════
   RARITY SYSTEM  (mirrors FocusInsights)
═══════════════════════════════════════════════════════════════ */
const RARITY = {
  COMMON: {
    label: 'Common',
    color: '#9c9283',
    glow: 'rgba(156,146,131,.22)',
    ring: '#9c9283',
  },
  RARE: {
    label: 'Rare',
    color: '#5b8fa8',
    glow: 'rgba(91,143,168,.28)',
    ring: '#5b8fa8',
  },
  EPIC: {
    label: 'Epic',
    color: '#9b6bae',
    glow: 'rgba(155,107,174,.32)',
    ring: '#9b6bae',
  },
  LEGENDARY: {
    label: 'Legendary',
    color: '#c9a84c',
    glow: 'rgba(201,168,76,.38)',
    ring: '#c9a84c',
  },
};
function rarityClass(r) {
  if (r === RARITY.LEGENDARY) return 'rarity-legendary';
  if (r === RARITY.EPIC) return 'rarity-epic';
  if (r === RARITY.RARE) return 'rarity-rare';
  return 'rarity-common';
}

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENTS LIST — identical subset from FocusInsights
   (Only the checks needed for profile — full list on overlay)
═══════════════════════════════════════════════════════════════ */
const ah_totalMins = (s) => s.reduce((a, x) => a + (x.duration || 0), 0);
const ah_countDone = (s) =>
  s.filter((x) => x.completed || x.is_completed).length;
const ah_uniqueDays = (s) =>
  new Set(s.map((x) => new Date(x.created_at).toISOString().slice(0, 10))).size;
const ah_hardCount = (s) => s.filter((x) => x.difficulty === 'hard').length;
const ah_medCount = (s) => s.filter((x) => x.difficulty === 'medium').length;
const ah_aiCount = (s) => s.filter((x) => x.ai_plan?.steps?.length > 0).length;
const ah_subjectSet = (s) => new Set(s.map((x) => x.subject).filter(Boolean));
const ah_focusSet = (s) => new Set(s.map((x) => x.focus_type).filter(Boolean));
const ah_maxSingle = (s) => Math.max(0, ...s.map((x) => x.duration || 0));
const ah_totalXP = (s) => s.reduce((a, x) => a + sessionXP(x), 0);
const ah_level = (s) =>
  Math.min(Math.floor(Math.sqrt(ah_totalXP(s) / 100)) + 1, 50);

const ALL_ACHIEVEMENTS = [
  {
    id: 'first_session',
    category: 'First Steps',
    rarity: RARITY.COMMON,
    icon: '🌱',
    label: 'First Step',
    desc: 'Complete your very first session',
    hint: 'Create any session.',
    check: (s) => s.length >= 1,
    progress: (s) => Math.min(1, s.length),
    max: 1,
  },
  {
    id: 'third_session',
    category: 'First Steps',
    rarity: RARITY.COMMON,
    icon: '🌿',
    label: 'Getting Started',
    desc: 'Complete 3 sessions',
    hint: '',
    check: (s) => s.length >= 3,
    progress: (s) => Math.min(3, s.length),
    max: 3,
  },
  {
    id: 'first_complete',
    category: 'First Steps',
    rarity: RARITY.COMMON,
    icon: '✅',
    label: 'Done Deal',
    desc: 'Mark your first session complete',
    hint: 'Hit the checkmark.',
    check: (s) => ah_countDone(s) >= 1,
    progress: (s) => Math.min(1, ah_countDone(s)),
    max: 1,
  },
  {
    id: 'first_plan',
    category: 'First Steps',
    rarity: RARITY.COMMON,
    icon: '📋',
    label: 'Planner',
    desc: 'Create a session with an AI study plan',
    hint: 'Choose AI Plan mode.',
    check: (s) => ah_aiCount(s) >= 1,
    progress: (s) => Math.min(1, ah_aiCount(s)),
    max: 1,
  },
  {
    id: 'first_hour',
    category: 'First Steps',
    rarity: RARITY.COMMON,
    icon: '⏰',
    label: 'First Hour',
    desc: 'Accumulate 60 minutes of total focus',
    hint: '',
    check: (s) => ah_totalMins(s) >= 60,
    progress: (s) => Math.min(60, ah_totalMins(s)),
    max: 60,
  },
  {
    id: 's10',
    category: 'Sessions',
    rarity: RARITY.COMMON,
    icon: '🔟',
    label: 'Ten Down',
    desc: 'Complete 10 sessions',
    hint: '',
    check: (s) => s.length >= 10,
    progress: (s) => Math.min(10, s.length),
    max: 10,
  },
  {
    id: 's25',
    category: 'Sessions',
    rarity: RARITY.COMMON,
    icon: '🎯',
    label: 'Quarter Century',
    desc: 'Complete 25 sessions',
    hint: '',
    check: (s) => s.length >= 25,
    progress: (s) => Math.min(25, s.length),
    max: 25,
  },
  {
    id: 's50',
    category: 'Sessions',
    rarity: RARITY.RARE,
    icon: '💫',
    label: 'Half Century',
    desc: 'Complete 50 sessions',
    hint: '',
    check: (s) => s.length >= 50,
    progress: (s) => Math.min(50, s.length),
    max: 50,
  },
  {
    id: 's100',
    category: 'Sessions',
    rarity: RARITY.EPIC,
    icon: '💯',
    label: 'The Century',
    desc: 'Complete 100 sessions',
    hint: '',
    check: (s) => s.length >= 100,
    progress: (s) => Math.min(100, s.length),
    max: 100,
  },
  {
    id: 's200',
    category: 'Sessions',
    rarity: RARITY.LEGENDARY,
    icon: '👑',
    label: 'Legend',
    desc: 'Complete 200 sessions',
    hint: '',
    check: (s) => s.length >= 200,
    progress: (s) => Math.min(200, s.length),
    max: 200,
  },
  {
    id: 'c10',
    category: 'Sessions',
    rarity: RARITY.COMMON,
    icon: '✔️',
    label: 'Closer',
    desc: 'Mark 10 sessions complete',
    hint: '',
    check: (s) => ah_countDone(s) >= 10,
    progress: (s) => Math.min(10, ah_countDone(s)),
    max: 10,
  },
  {
    id: 'c50',
    category: 'Sessions',
    rarity: RARITY.RARE,
    icon: '🏆',
    label: 'Completionist',
    desc: 'Mark 50 sessions complete',
    hint: '',
    check: (s) => ah_countDone(s) >= 50,
    progress: (s) => Math.min(50, ah_countDone(s)),
    max: 50,
  },
  {
    id: 'streak2',
    category: 'Streaks',
    rarity: RARITY.COMMON,
    icon: '🔥',
    label: 'Kindling',
    desc: 'Maintain a 2-day streak',
    hint: 'Study 2 consecutive days.',
    check: (_, str) => str >= 2,
    progress: (_, str) => Math.min(2, str),
    max: 2,
  },
  {
    id: 'streak7',
    category: 'Streaks',
    rarity: RARITY.RARE,
    icon: '⚡',
    label: 'Week Warrior',
    desc: 'Maintain a 7-day streak',
    hint: 'Study every day for a week.',
    check: (_, str) => str >= 7,
    progress: (_, str) => Math.min(7, str),
    max: 7,
  },
  {
    id: 'streak14',
    category: 'Streaks',
    rarity: RARITY.RARE,
    icon: '⚡',
    label: 'Fortnight',
    desc: 'Maintain a 14-day streak',
    hint: '',
    check: (_, str) => str >= 14,
    progress: (_, str) => Math.min(14, str),
    max: 14,
  },
  {
    id: 'streak30',
    category: 'Streaks',
    rarity: RARITY.EPIC,
    icon: '👑',
    label: 'Month Master',
    desc: 'Maintain a 30-day streak',
    hint: '',
    check: (_, str) => str >= 30,
    progress: (_, str) => Math.min(30, str),
    max: 30,
  },
  {
    id: 'streak60',
    category: 'Streaks',
    rarity: RARITY.LEGENDARY,
    icon: '🌟',
    label: 'Iron Will',
    desc: 'Maintain a 60-day streak',
    hint: '',
    check: (_, str) => str >= 60,
    progress: (_, str) => Math.min(60, str),
    max: 60,
  },
  {
    id: 'streak100',
    category: 'Streaks',
    rarity: RARITY.LEGENDARY,
    icon: '🏅',
    label: 'Centurion',
    desc: 'Maintain a 100-day streak',
    hint: '',
    check: (_, str) => str >= 100,
    progress: (_, str) => Math.min(100, str),
    max: 100,
  },
  {
    id: 'days30',
    category: 'Streaks',
    rarity: RARITY.RARE,
    icon: '📅',
    label: 'Habitual',
    desc: 'Study on 30 unique days',
    hint: '',
    check: (s) => ah_uniqueDays(s) >= 30,
    progress: (s) => Math.min(30, ah_uniqueDays(s)),
    max: 30,
  },
  {
    id: 't1000',
    category: 'Focus Time',
    rarity: RARITY.RARE,
    icon: '🕐',
    label: 'Time Lord',
    desc: 'Log 1,000 minutes of focus',
    hint: '',
    check: (s) => ah_totalMins(s) >= 1000,
    progress: (s) => Math.min(1000, ah_totalMins(s)),
    max: 1000,
  },
  {
    id: 't6000',
    category: 'Focus Time',
    rarity: RARITY.EPIC,
    icon: '🕒',
    label: '100 Hours',
    desc: 'Log 6,000 minutes of focus',
    hint: '',
    check: (s) => ah_totalMins(s) >= 6000,
    progress: (s) => Math.min(6000, ah_totalMins(s)),
    max: 6000,
  },
  {
    id: 't60000',
    category: 'Focus Time',
    rarity: RARITY.LEGENDARY,
    icon: '⌛',
    label: '1000 Hours',
    desc: 'Log 60,000 minutes of focus',
    hint: 'The Malcolm Gladwell badge.',
    check: (s) => ah_totalMins(s) >= 60000,
    progress: (s) => Math.min(60000, ah_totalMins(s)),
    max: 60000,
  },
  {
    id: 's90',
    category: 'Focus Time',
    rarity: RARITY.RARE,
    icon: '🧠',
    label: 'Deep Worker',
    desc: 'Complete a 90-minute session',
    hint: 'Set duration ≥90 min.',
    check: (s) => ah_maxSingle(s) >= 90,
    progress: (s) => Math.min(90, ah_maxSingle(s)),
    max: 90,
  },
  {
    id: 's120',
    category: 'Focus Time',
    rarity: RARITY.EPIC,
    icon: '💪',
    label: 'Marathon Mind',
    desc: 'Complete a 2-hour session',
    hint: '',
    check: (s) => ah_maxSingle(s) >= 120,
    progress: (s) => Math.min(120, ah_maxSingle(s)),
    max: 120,
  },
  {
    id: 's180',
    category: 'Focus Time',
    rarity: RARITY.LEGENDARY,
    icon: '🔮',
    label: 'The Monk',
    desc: 'Complete a 3-hour session',
    hint: '',
    check: (s) => ah_maxSingle(s) >= 180,
    progress: (s) => Math.min(180, ah_maxSingle(s)),
    max: 180,
  },
  {
    id: 'hard5',
    category: 'Difficulty',
    rarity: RARITY.RARE,
    icon: '💪',
    label: 'Hard Mode',
    desc: 'Complete 5 hard sessions',
    hint: '',
    check: (s) => ah_hardCount(s) >= 5,
    progress: (s) => Math.min(5, ah_hardCount(s)),
    max: 5,
  },
  {
    id: 'hard20',
    category: 'Difficulty',
    rarity: RARITY.EPIC,
    icon: '🔥',
    label: 'Gladiator',
    desc: 'Complete 20 hard sessions',
    hint: '',
    check: (s) => ah_hardCount(s) >= 20,
    progress: (s) => Math.min(20, ah_hardCount(s)),
    max: 20,
  },
  {
    id: 'hard50',
    category: 'Difficulty',
    rarity: RARITY.LEGENDARY,
    icon: '⚔️',
    label: 'Ironclad',
    desc: 'Complete 50 hard sessions',
    hint: '',
    check: (s) => ah_hardCount(s) >= 50,
    progress: (s) => Math.min(50, ah_hardCount(s)),
    max: 50,
  },
  {
    id: 'ai10',
    category: 'AI Mastery',
    rarity: RARITY.RARE,
    icon: '⚡',
    label: 'AI Collaborator',
    desc: 'Use AI plan in 10 sessions',
    hint: '',
    check: (s) => ah_aiCount(s) >= 10,
    progress: (s) => Math.min(10, ah_aiCount(s)),
    max: 10,
  },
  {
    id: 'ai25',
    category: 'AI Mastery',
    rarity: RARITY.EPIC,
    icon: '🌟',
    label: 'AI Partner',
    desc: 'Use AI plan in 25 sessions',
    hint: '',
    check: (s) => ah_aiCount(s) >= 25,
    progress: (s) => Math.min(25, ah_aiCount(s)),
    max: 25,
  },
  {
    id: 'ai50',
    category: 'AI Mastery',
    rarity: RARITY.LEGENDARY,
    icon: '🔮',
    label: 'AI Symbiote',
    desc: 'Use AI plan in 50 sessions',
    hint: '',
    check: (s) => ah_aiCount(s) >= 50,
    progress: (s) => Math.min(50, ah_aiCount(s)),
    max: 50,
  },
  {
    id: 'sub5',
    category: 'Subjects',
    rarity: RARITY.COMMON,
    icon: '🎓',
    label: 'Polymath',
    desc: 'Study 5 different subjects',
    hint: '',
    check: (s) => ah_subjectSet(s).size >= 5,
    progress: (s) => Math.min(5, ah_subjectSet(s).size),
    max: 5,
  },
  {
    id: 'sub10',
    category: 'Subjects',
    rarity: RARITY.RARE,
    icon: '🌐',
    label: 'Renaissance',
    desc: 'Study 10 different subjects',
    hint: '',
    check: (s) => ah_subjectSet(s).size >= 10,
    progress: (s) => Math.min(10, ah_subjectSet(s).size),
    max: 10,
  },
  {
    id: 'ft_all',
    category: 'Subjects',
    rarity: RARITY.LEGENDARY,
    icon: '💎',
    label: 'Full Spectrum',
    desc: 'Use all 8 focus types',
    hint: '',
    check: (s) => ah_focusSet(s).size >= 8,
    progress: (s) => Math.min(8, ah_focusSet(s).size),
    max: 8,
  },
  {
    id: 'xp5000',
    category: 'XP & Levels',
    rarity: RARITY.RARE,
    icon: '💠',
    label: 'Brilliant',
    desc: 'Earn 5,000 XP',
    hint: '',
    check: (s) => ah_totalXP(s) >= 5000,
    progress: (s) => Math.min(5000, ah_totalXP(s)),
    max: 5000,
  },
  {
    id: 'xp10k',
    category: 'XP & Levels',
    rarity: RARITY.EPIC,
    icon: '💫',
    label: 'Radiant',
    desc: 'Earn 10,000 XP',
    hint: '',
    check: (s) => ah_totalXP(s) >= 10000,
    progress: (s) => Math.min(10000, ah_totalXP(s)),
    max: 10000,
  },
  {
    id: 'xp50k',
    category: 'XP & Levels',
    rarity: RARITY.LEGENDARY,
    icon: '🌠',
    label: 'Transcendent',
    desc: 'Earn 50,000 XP',
    hint: '',
    check: (s) => ah_totalXP(s) >= 50000,
    progress: (s) => Math.min(50000, ah_totalXP(s)),
    max: 50000,
  },
  {
    id: 'lvl10',
    category: 'XP & Levels',
    rarity: RARITY.RARE,
    icon: '🔷',
    label: 'Scholar',
    desc: 'Reach Level 10',
    hint: '',
    check: (s) => ah_level(s) >= 10,
    progress: (s) => Math.min(10, ah_level(s)),
    max: 10,
  },
  {
    id: 'lvl20',
    category: 'XP & Levels',
    rarity: RARITY.EPIC,
    icon: '🔶',
    label: 'Expert',
    desc: 'Reach Level 20',
    hint: '',
    check: (s) => ah_level(s) >= 20,
    progress: (s) => Math.min(20, ah_level(s)),
    max: 20,
  },
  {
    id: 'lvl50',
    category: 'XP & Levels',
    rarity: RARITY.LEGENDARY,
    icon: '🏆',
    label: 'Grandmaster',
    desc: 'Reach Level 50',
    hint: 'The pinnacle.',
    check: (s) => ah_level(s) >= 50,
    progress: (s) => Math.min(50, ah_level(s)),
    max: 50,
  },
  {
    id: 'mast_eff80',
    category: 'Mastery',
    rarity: RARITY.RARE,
    icon: '🎯',
    label: 'Sharp',
    desc: 'Achieve 80% completion rate (min 10)',
    hint: '',
    check: (s) => s.length >= 10 && ah_countDone(s) / s.length >= 0.8,
    progress: (s) =>
      s.length < 10 ? 0 : Math.round((ah_countDone(s) / s.length) * 100),
    max: 80,
  },
  {
    id: 'mast_eff100',
    category: 'Mastery',
    rarity: RARITY.LEGENDARY,
    icon: '💎',
    label: 'Flawless',
    desc: 'Complete every session (min 20 total)',
    hint: '',
    check: (s) => s.length >= 20 && ah_countDone(s) === s.length,
    progress: (s) =>
      s.length < 1 ? 0 : Math.round((ah_countDone(s) / s.length) * 100),
    max: 100,
  },
  {
    id: 'sp_nonstop',
    category: 'Special',
    rarity: RARITY.EPIC,
    icon: '⚡',
    label: 'Non-Stop',
    desc: 'Create 5 sessions in one week',
    hint: '',
    check: (s) => {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      return s.filter((x) => new Date(x.created_at) >= w).length >= 5;
    },
    progress: (s) => {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      return Math.min(5, s.filter((x) => new Date(x.created_at) >= w).length);
    },
    max: 5,
  },
  {
    id: 'sp_comeback',
    category: 'Special',
    rarity: RARITY.RARE,
    icon: '🦅',
    label: 'The Comeback',
    desc: 'Return after 7+ days of inactivity',
    hint: '',
    check: (s) => {
      if (s.length < 2) return false;
      const sorted = [...s].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      );
      for (let i = 1; i < sorted.length; i++) {
        if (
          (new Date(sorted[i].created_at) -
            new Date(sorted[i - 1].created_at)) /
            86400000 >=
          7
        )
          return true;
      }
      return false;
    },
    progress: (s) => {
      if (s.length < 2) return 0;
      const sorted = [...s].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      );
      let max = 0;
      for (let i = 1; i < sorted.length; i++) {
        const g =
          (new Date(sorted[i].created_at) -
            new Date(sorted[i - 1].created_at)) /
          86400000;
        if (g > max) max = g;
      }
      return Math.min(7, Math.round(max));
    },
    max: 7,
  },
];

function computeAchievements(sessions, streak) {
  return ALL_ACHIEVEMENTS.map((a) => ({
    ...a,
    earned: a.check(sessions, streak),
    progressVal: a.progress(sessions, streak),
  }));
}

/* ═══════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

:root{
  color-scheme:light;
  --bg:#f5f0e8;--surface:#faf7f2;--surface2:#f0ebe0;--surface3:#e8e0d0;
  --border:#ddd5c4;--border2:#ccc0a8;
  --ink:#1e1a14;--ink2:#5c5445;--ink3:#9c9283;
  --gold:#c4913a;--gold2:#e8b96a;--gold3:rgba(196,145,58,.1);--gold-glow:rgba(196,145,58,.2);
  --red:#b85c4a;--red2:rgba(184,92,74,.1);--red3:rgba(184,92,74,.2);
  --green:#6b8c6b;--green2:rgba(107,140,107,.1);--green3:rgba(107,140,107,.22);
  --blue:#5b8fa8;--purple:#9b6bae;
  --shadow:0 2px 16px rgba(30,26,20,.08);--shadow-md:0 6px 28px rgba(30,26,20,.12);--shadow-lg:0 16px 56px rgba(30,26,20,.16);
  --f-display:'Cormorant Garamond',Georgia,serif;
  --f-ui:'Cabinet Grotesk',sans-serif;
  --f-mono:'JetBrains Mono',monospace;
  --ease:cubic-bezier(.16,1,.3,1);--spring:cubic-bezier(.34,1.56,.64,1);--r:12px;
}
.dark{
  color-scheme:dark;
  --bg:#0c0b09;--surface:#131210;--surface2:#1a1815;--surface3:#222019;
  --border:#2a2722;--border2:#35312b;
  --ink:#f0ead8;--ink2:#a89880;--ink3:#6b5f4e;
  --shadow:0 2px 16px rgba(0,0,0,.35);--shadow-md:0 6px 28px rgba(0,0,0,.45);--shadow-lg:0 16px 56px rgba(0,0,0,.6);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── PAGE ── */
.pf{min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--f-ui);position:relative;overflow-x:hidden;transition:background .35s,color .35s}
.pf-orbs{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.pf-orb{position:absolute;border-radius:50%;filter:blur(200px)}
.pf-orb1{width:800px;height:800px;background:var(--gold);top:-300px;right:-250px;opacity:.04}
.pf-orb2{width:600px;height:600px;background:#4a5a9a;bottom:-250px;left:-200px;opacity:.035}
.pf-grain{pointer-events:none;position:fixed;inset:0;z-index:1;opacity:.02;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode:multiply}
.dark .pf-grain{mix-blend-mode:screen;opacity:.03}

.pf-wrap{max-width:1040px;margin:0 auto;padding:40px 28px 100px;position:relative;z-index:2}
@media(max-width:768px){.pf-wrap{padding:24px 16px 80px}}

/* ── SECTION ── */
.pf-section{margin-bottom:40px}
.pf-section-eye{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:7px;margin-bottom:10px}
.pf-section-eye::before{content:'';display:block;width:16px;height:1px;background:currentColor;opacity:.5}
.pf-section-title{font-family:var(--f-display);font-size:1.6rem;font-weight:300;letter-spacing:-.02em;color:var(--ink);margin-bottom:20px}
.pf-section-title em{font-style:italic;color:var(--gold)}

/* ── CARD ── */
.pf-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;transition:background .35s,border-color .35s,box-shadow .2s}
.pf-card-head{padding:14px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px}
.pf-card-label{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:6px}
.pf-card-body{padding:22px}

/* ── HERO ── */
.pf-hero{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;padding:0;margin-bottom:32px}
.pf-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:160px;background:linear-gradient(135deg,color-mix(in srgb,var(--gold) 12%,var(--surface)),color-mix(in srgb,var(--blue) 8%,var(--surface)));opacity:.8}
.dark .pf-hero::before{background:linear-gradient(135deg,rgba(196,145,58,.09),rgba(74,90,154,.06))}
.pf-hero-top-bar{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;position:relative;z-index:2}
.pf-hero-top-bar-label{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:6px}
.pf-hero-body{position:relative;z-index:2;padding:0 28px 28px;display:grid;grid-template-columns:auto 1fr auto;gap:28px;align-items:center;flex-wrap:wrap}
@media(max-width:640px){.pf-hero-body{grid-template-columns:1fr;text-align:center;place-items:center;gap:16px}}

/* Avatar */
.pf-avatar-wrap{position:relative;flex-shrink:0}
.pf-avatar{width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--gold2));border:3px solid var(--gold);display:grid;place-items:center;font-family:var(--f-display);font-size:2.2rem;font-weight:600;color:#fff;flex-shrink:0;user-select:none;position:relative}
.pf-avatar-ring{position:absolute;inset:-6px;border-radius:50%;border:1.5px dashed rgba(196,145,58,.4);animation:slow-spin 14s linear infinite}
@keyframes slow-spin{to{transform:rotate(360deg)}}
.pf-avatar-level{position:absolute;bottom:-4px;right:-4px;width:26px;height:26px;border-radius:50%;background:var(--gold);border:2px solid var(--surface);display:grid;place-items:center;font-family:var(--f-mono);font-size:.52rem;font-weight:500;color:#fff}

/* Identity */
.pf-identity{}
.pf-name{font-family:var(--f-display);font-size:2rem;font-weight:600;letter-spacing:-.03em;color:var(--ink);line-height:1}
.pf-email{font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;color:var(--ink3);margin-top:5px}
.pf-join{font-family:var(--f-mono);font-size:.57rem;letter-spacing:.06em;color:var(--ink3);margin-top:3px}
.pf-identity-title{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);padding:4px 10px;border-radius:20px;background:var(--gold3);border:1px solid rgba(196,145,58,.25);margin-top:10px}
.pf-streak-hero{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0}
.pf-streak-val{font-family:var(--f-display);font-size:2rem;font-weight:300;color:var(--gold);line-height:1}
.pf-streak-lbl{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}

/* XP bar in hero */
.pf-xp-section{border-top:1px solid var(--border);padding:16px 28px;display:flex;align-items:center;gap:20px;gap:16px;position:relative;z-index:2;flex-wrap:wrap}
.pf-xp-info{flex:1;min-width:200px}
.pf-xp-label{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:6px}
.pf-xp-track{height:7px;background:var(--border);border-radius:4px;overflow:hidden}
.pf-xp-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:4px;transition:width 1.2s var(--ease)}
.pf-xp-sub{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);margin-top:5px}
.pf-xp-chips{display:flex;gap:10px;flex-wrap:wrap}
.pf-xp-chip{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:8px}
.pf-xp-chip-val{font-family:var(--f-display);font-size:1.3rem;font-weight:300;color:var(--ink);line-height:1}
.pf-xp-chip-lbl{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}

/* ── STATS GRID ── */
.pf-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}
@media(max-width:900px){.pf-stats-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:420px){.pf-stats-grid{grid-template-columns:1fr}}
.pf-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 16px;position:relative;overflow:hidden;transition:all .2s var(--ease);cursor:default}
.pf-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--stat-accent,var(--gold));opacity:.75}
.pf-stat:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:var(--stat-accent,var(--gold))}
.pf-stat-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;margin-bottom:10px;background:color-mix(in srgb,var(--stat-accent,var(--gold)) 12%,transparent);color:var(--stat-accent,var(--gold))}
.pf-stat-label{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px}
.pf-stat-val{font-family:var(--f-display);font-size:1.8rem;font-weight:300;letter-spacing:-.03em;color:var(--ink);line-height:1}
.pf-stat-bg{position:absolute;right:10px;bottom:-10px;font-size:4rem;opacity:.04;font-family:var(--f-display);pointer-events:none;line-height:1}

/* ── ACHIEVEMENT MINI-BADGES ── */
.rarity-common    {--rc:#9c9283;--rg:rgba(156,146,131,.22);--rr:#9c9283}
.rarity-rare      {--rc:#5b8fa8;--rg:rgba(91,143,168,.28);--rr:#5b8fa8}
.rarity-epic      {--rc:#9b6bae;--rg:rgba(155,107,174,.32);--rr:#9b6bae}
.rarity-legendary {--rc:#c9a84c;--rg:rgba(201,168,76,.38);--rr:#c9a84c}
.ach-mini{display:flex;flex-direction:column;align-items:center;gap:5px;padding:14px 10px;border-radius:10px;border:1px solid var(--border);background:var(--surface);text-align:center;transition:all .22s var(--spring);position:relative;cursor:default}
.ach-mini.earned{border-color:var(--rr,var(--gold));background:color-mix(in srgb,var(--rc,var(--gold)) 7%,var(--surface));box-shadow:0 0 14px var(--rg,rgba(196,145,58,.15))}
.ach-mini.earned:hover{transform:translateY(-4px) scale(1.06);box-shadow:0 8px 24px var(--rg,rgba(196,145,58,.25))}
.ach-mini.locked{opacity:.4;filter:grayscale(.8)}
.ach-mini-icon{font-size:1.8rem;line-height:1}
.ach-mini-label{font-family:var(--f-mono);font-size:.46rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3);line-height:1.4}
.ach-mini.earned .ach-mini-label{color:var(--rc,var(--gold))}
.ach-mini-rarity{font-size:.38rem;font-family:var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--rc,var(--ink3));opacity:.75}

/* View-all button */
.ach-view-all-btn{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;border-radius:7px;border:1px solid var(--border2);background:transparent;color:var(--ink2);cursor:pointer;transition:all .22s var(--spring)}
.ach-view-all-btn:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3);transform:translateY(-1px)}

/* ── ACHIEVEMENT OVERLAY ── */
.ach-backdrop{position:fixed;inset:0;z-index:9000;background:rgba(20,17,12,.72);backdrop-filter:blur(18px) saturate(1.3);display:flex;align-items:flex-start;justify-content:center;padding:32px 20px;animation:bd-in .3s var(--ease) both;overflow-y:auto}
.dark .ach-backdrop{background:rgba(8,7,5,.85)}
@keyframes bd-in{from{opacity:0}to{opacity:1}}
.ach-panel{width:100%;max-width:960px;background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.18);animation:panel-in .4s var(--ease) both;position:relative;flex-shrink:0}
.dark .ach-panel{box-shadow:0 40px 120px rgba(0,0,0,.65)}
@keyframes panel-in{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:none}}
.ach-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),var(--purple),transparent);opacity:.5;z-index:1}
.ach-panel-hd{padding:26px 30px 18px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--gold) 4%,var(--surface));position:relative;overflow:hidden}
.ach-panel-hd::after{content:'✦';position:absolute;right:30px;top:50%;transform:translateY(-50%);font-size:7rem;color:var(--gold);opacity:.04;font-family:var(--f-display);line-height:1;pointer-events:none}
.ach-panel-title{font-family:var(--f-display);font-size:1.9rem;font-weight:300;letter-spacing:-.02em;color:var(--ink)}
.ach-panel-title em{font-style:italic;color:var(--gold)}
.ach-panel-sub{font-family:var(--f-mono);font-size:.57rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-top:5px}
.ach-close-btn{width:34px;height:34px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .2s;flex-shrink:0}
.ach-close-btn:hover{border-color:var(--red);color:var(--red);transform:rotate(90deg)}
.ach-sum-row{display:flex;gap:16px;flex-wrap:wrap;padding:12px 30px;border-bottom:1px solid var(--border);background:var(--surface2)}
.ach-sum-item{display:flex;flex-direction:column;gap:2px}
.ach-sum-val{font-family:var(--f-display);font-size:1.3rem;font-weight:300;color:var(--ink);line-height:1}
.ach-sum-lbl{font-family:var(--f-mono);font-size:.49rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.ach-overall-wrap{flex:1;min-width:140px;display:flex;flex-direction:column;justify-content:flex-end;gap:4px}
.ach-controls{display:flex;align-items:center;gap:8px;padding:10px 30px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.ach-tabs{display:flex;gap:4px}
.ach-tab{font-family:var(--f-mono);font-size:.53rem;letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--ink3);cursor:pointer;transition:all .15s}
.ach-tab:hover{border-color:var(--gold);color:var(--gold)}
.ach-tab.on{background:var(--gold3);border-color:var(--gold);color:var(--gold)}
.ach-sort-sel{font-family:var(--f-mono);font-size:.53rem;letter-spacing:.06em;padding:5px 24px 5px 10px;border-radius:20px;border:1px solid var(--border2);background:var(--surface2);color:var(--ink3);cursor:pointer;outline:none;appearance:none;margin-left:auto;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239c9283' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.ach-panel-body{padding:22px 30px;max-height:58vh;overflow-y:auto}
.ach-cat-section{margin-bottom:24px}
.ach-cat-label{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;display:flex;align-items:center;gap:7px}
.ach-cat-label::before{content:'';display:block;width:13px;height:1px;background:currentColor;opacity:.5}
.ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.ach-card{border-radius:12px;border:1px solid var(--border);background:var(--surface);overflow:visible;transition:all .22s var(--ease);position:relative}
.ach-card.earned{border-color:var(--rr,var(--gold));background:color-mix(in srgb,var(--rc,var(--gold)) 5%,var(--surface))}
.ach-card.earned:hover{transform:translateY(-3px) scale(1.012);box-shadow:0 10px 30px var(--rg,rgba(196,145,58,.25))}
.ach-card.locked{opacity:.5}
.ach-card.locked:hover{opacity:.7;transform:translateY(-2px)}
.ach-card.earned::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 50%);pointer-events:none;border-radius:12px}
.ach-card-inner{padding:14px}
.ach-card-top{display:flex;align-items:flex-start;gap:10px;margin-bottom:9px}
.ach-card-icon{width:40px;height:40px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);display:grid;place-items:center;flex-shrink:0;font-size:1.35rem;line-height:1;transition:transform .2s var(--spring)}
.ach-card.earned .ach-card-icon{background:color-mix(in srgb,var(--rc,var(--gold)) 14%,var(--surface2));border-color:var(--rr,var(--gold));box-shadow:0 0 10px var(--rg,rgba(196,145,58,.18))}
.ach-card.earned:hover .ach-card-icon{transform:scale(1.1) rotate(-4deg)}
.ach-card-title{font-family:var(--f-ui);font-size:.83rem;font-weight:700;color:var(--ink);line-height:1.2}
.ach-card-desc{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.03em;color:var(--ink3);margin-top:3px;line-height:1.5}
.ach-rarity-tag{font-family:var(--f-mono);font-size:.46rem;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:20px;border:1px solid var(--rr,var(--border));color:var(--rc,var(--ink3));background:color-mix(in srgb,var(--rc,var(--ink3)) 8%,transparent);align-self:flex-start;white-space:nowrap;flex-shrink:0}
.ach-prog-hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
.ach-prog-lbl{font-family:var(--f-mono);font-size:.48rem;letter-spacing:.06em;color:var(--ink3)}
.ach-prog-nums{font-family:var(--f-mono);font-size:.5rem;font-weight:500;color:var(--rc,var(--gold))}
.ach-prog-track{height:4px;background:var(--border);border-radius:3px;overflow:hidden}
.ach-prog-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--rc,var(--gold)),color-mix(in srgb,var(--rc,var(--gold)) 70%,white));transition:width 1s var(--ease)}
.ach-earned-stamp{display:flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.48rem;letter-spacing:.06em;text-transform:uppercase;color:var(--rc,var(--green));padding:3px 7px;border-radius:5px;background:color-mix(in srgb,var(--rc,var(--green)) 10%,transparent);border:1px solid color-mix(in srgb,var(--rc,var(--green)) 28%,transparent);margin-top:7px;width:fit-content}
.ach-lock{position:absolute;top:8px;right:8px;color:var(--ink3);opacity:.35}
.ach-info-btn{position:absolute;bottom:8px;right:8px;width:18px;height:18px;border-radius:50%;background:var(--surface3);border:1px solid var(--border);color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s}
.ach-info-btn:hover{border-color:var(--gold);color:var(--gold)}
.ach-popover{position:absolute;bottom:30px;right:5px;background:var(--ink);color:var(--surface);border-radius:9px;padding:9px 12px;font-family:var(--f-mono);font-size:.52rem;line-height:1.65;max-width:190px;z-index:30;box-shadow:0 8px 28px rgba(0,0,0,.28);animation:pop .15s var(--ease)}
@keyframes pop{from{opacity:0;transform:scale(.9) translateY(4px)}to{opacity:1;transform:none}}
.ach-overall-track{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.ach-overall-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:3px;transition:width 1s var(--ease)}

/* ── GROWTH SECTION ── */
.pf-growth-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:768px){.pf-growth-grid{grid-template-columns:1fr}}
.pf-heatmap{display:flex;gap:2px;overflow-x:auto;padding-bottom:4px}
.pf-hm-week{display:flex;flex-direction:column;gap:2px}
.pf-hm-cell{width:11px;height:11px;border-radius:2px;cursor:default;transition:transform .12s;flex-shrink:0}
.pf-hm-cell:hover{transform:scale(1.4)}
.pf-hm-cell.l0{background:var(--border)}
.pf-hm-cell.l1{background:color-mix(in srgb,var(--gold) 30%,var(--border))}
.pf-hm-cell.l2{background:color-mix(in srgb,var(--gold) 55%,var(--border))}
.pf-hm-cell.l3{background:color-mix(in srgb,var(--gold) 78%,var(--border))}
.pf-hm-cell.l4{background:var(--gold);box-shadow:0 0 4px rgba(196,145,58,.4)}
.pf-insight-pill{display:flex;align-items:center;gap:10px;padding:12px 16px;background:color-mix(in srgb,var(--gold) 6%,var(--surface));border:1px solid rgba(196,145,58,.2);border-radius:8px}
.pf-insight-icon{width:30px;height:30px;border-radius:7px;background:var(--gold3);border:1px solid rgba(196,145,58,.25);display:grid;place-items:center;color:var(--gold);flex-shrink:0}
.pf-insight-text{font-family:var(--f-ui);font-size:.82rem;color:var(--ink2);line-height:1.5}
.pf-insight-text strong{color:var(--ink);font-weight:700}

/* ── ARCHETYPE CARD ── */
.pf-archetype{background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--gold) 8%,var(--surface)));border:1px solid rgba(196,145,58,.25);border-radius:16px;padding:28px 26px;position:relative;overflow:hidden}
.dark .pf-archetype{background:linear-gradient(135deg,#131210,#1a1508)}
.pf-archetype::after{content:'◈';position:absolute;right:20px;bottom:-14px;font-size:7rem;color:var(--gold);opacity:.05;font-family:var(--f-display);line-height:1;pointer-events:none}
.pf-archetype-name{font-family:var(--f-display);font-size:1.8rem;font-weight:600;letter-spacing:-.03em;color:var(--ink);line-height:1}
.pf-archetype-name em{font-style:italic;color:var(--gold)}
.pf-archetype-desc{font-family:var(--f-ui);font-size:.85rem;color:var(--ink2);line-height:1.65;margin-top:10px;max-width:500px}
.pf-trait-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.pf-trait-chip{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;padding:4px 12px;border-radius:20px;border:1px solid rgba(196,145,58,.28);background:var(--gold3);color:var(--gold)}

/* ── TIMELINE ROWS ── */
.pf-timeline{display:flex;flex-direction:column;gap:0}
.pf-tl-row{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);cursor:default;transition:background .15s;border-radius:4px;padding-left:4px;padding-right:4px}
.pf-tl-row:last-child{border-bottom:none}
.pf-tl-row:hover{background:var(--surface2)}
.pf-tl-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0}
.pf-tl-dot.done{background:var(--green)}
.pf-tl-info{flex:1;min-width:0}
.pf-tl-title{font-family:var(--f-ui);font-size:.84rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-tl-meta{font-family:var(--f-mono);font-size:.54rem;color:var(--ink3);margin-top:2px}
.pf-tl-badge{font-family:var(--f-mono);font-size:.53rem;padding:2px 8px;border-radius:20px;background:var(--surface2);border:1px solid var(--border);color:var(--ink3);white-space:nowrap;flex-shrink:0}

/* ── SETTINGS ── */
.pf-field-group{display:flex;flex-direction:column;gap:14px}
.pf-field-label{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:5px}
.pf-field-row{display:flex;gap:10px;align-items:center}
.pf-input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 14px;font-family:var(--f-ui);font-size:.88rem;color:var(--ink);outline:none;transition:border-color .2s,box-shadow .2s}
.pf-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold3)}
.pf-input:read-only{opacity:.55;cursor:default}
.pf-btn{display:inline-flex;align-items:center;gap:6px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;border-radius:7px;border:none;cursor:pointer;transition:all .22s var(--spring);white-space:nowrap}
.pf-btn-gold{background:var(--gold);color:#fff}
.pf-btn-gold:hover{background:var(--gold2);transform:translateY(-1px);box-shadow:0 4px 14px rgba(196,145,58,.3)}
.pf-btn-outline{background:transparent;border:1px solid var(--border2);color:var(--ink2)}
.pf-btn-outline:hover{border-color:var(--gold);color:var(--gold)}
.pf-btn-ghost{background:transparent;border:none;color:var(--ink3);padding:6px 10px}
.pf-btn-ghost:hover{color:var(--ink)}
.pf-btn-danger{background:var(--red2);border:1px solid rgba(184,92,74,.3);color:var(--red)}
.pf-btn-danger:hover{background:var(--red3);border-color:var(--red)}
.pf-save-bar{display:flex;gap:8px;margin-top:8px}
.pf-theme-row{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)}
.pf-theme-row:last-child{border-bottom:none}
.pf-theme-label{font-family:var(--f-ui);font-size:.84rem;font-weight:500;color:var(--ink);flex:1}
.pf-theme-sub{font-family:var(--f-mono);font-size:.55rem;color:var(--ink3)}
.pf-toggle{position:relative;width:40px;height:22px;flex-shrink:0}
.pf-toggle input{opacity:0;width:0;height:0}
.pf-toggle-track{position:absolute;inset:0;background:var(--border);border-radius:11px;cursor:pointer;transition:background .2s}
.pf-toggle input:checked + .pf-toggle-track{background:var(--gold)}
.pf-toggle-thumb{position:absolute;width:16px;height:16px;background:#fff;border-radius:50%;top:3px;left:3px;transition:left .2s var(--spring);pointer-events:none}
.pf-toggle input:checked ~ .pf-toggle-thumb{left:21px}

/* ── DANGER ZONE ── */
.pf-danger-zone{background:color-mix(in srgb,var(--red) 5%,var(--surface));border:1px solid rgba(184,92,74,.25);border-radius:var(--r);padding:22px;margin-bottom:40px}
.pf-danger-title{font-family:var(--f-display);font-size:1.1rem;font-weight:600;color:var(--red);display:flex;align-items:center;gap:8px;margin-bottom:6px}
.pf-danger-desc{font-family:var(--f-mono);font-size:.6rem;color:var(--ink3);line-height:1.7;letter-spacing:.03em;margin-bottom:16px;max-width:500px}
.pf-danger-actions{display:flex;gap:10px;flex-wrap:wrap}
.pf-delete-modal-backdrop{position:fixed;inset:0;z-index:8000;background:rgba(20,17,12,.75);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:20px;animation:bd-in .25s var(--ease)}
.pf-delete-modal{background:var(--surface);border:1px solid rgba(184,92,74,.3);border-radius:16px;padding:32px 28px;max-width:440px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,.25);animation:panel-in .35s var(--ease)}
.pf-delete-modal-icon{width:52px;height:52px;border-radius:50%;background:var(--red2);border:1px solid rgba(184,92,74,.3);display:grid;place-items:center;color:var(--red);margin:0 auto 18px}
.pf-delete-modal-title{font-family:var(--f-display);font-size:1.5rem;font-weight:600;color:var(--red);text-align:center;margin-bottom:10px}
.pf-delete-modal-desc{font-family:var(--f-mono);font-size:.6rem;color:var(--ink3);line-height:1.75;text-align:center;margin-bottom:20px}
.pf-delete-modal-warnings{display:flex;flex-direction:column;gap:8px;margin-bottom:22px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px}
.pf-delete-warning{display:flex;align-items:center;gap:8px;font-family:var(--f-mono);font-size:.58rem;color:var(--ink2)}
.pf-delete-warning-dot{width:5px;height:5px;border-radius:50%;background:var(--red);flex-shrink:0}
.pf-delete-confirm-label{font-family:var(--f-mono);font-size:.58rem;color:var(--ink3);margin-bottom:8px;letter-spacing:.04em}
.pf-delete-confirm-label span{color:var(--red);font-weight:500}
.pf-delete-confirm-input{width:100%;background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;padding:10px 14px;font-family:var(--f-mono);font-size:.85rem;color:var(--ink);outline:none;letter-spacing:.1em;transition:border-color .2s,box-shadow .2s;margin-bottom:16px;text-transform:uppercase}
.pf-delete-confirm-input:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(184,92,74,.15)}
.pf-delete-modal-actions{display:flex;gap:10px}

/* ── ANIMATIONS ── */
@keyframes fi-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.pf-a1{animation:fi-up .55s .03s var(--ease) both}
.pf-a2{animation:fi-up .55s .09s var(--ease) both}
.pf-a3{animation:fi-up .55s .15s var(--ease) both}
.pf-a4{animation:fi-up .55s .21s var(--ease) both}
.pf-a5{animation:fi-up .55s .27s var(--ease) both}
.pf-a6{animation:fi-up .55s .33s var(--ease) both}

::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
`;

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENT CARD (overlay)
═══════════════════════════════════════════════════════════════ */
function AchievementCard({ a }) {
  const [info, setInfo] = useState(false);
  const pct = a.max > 0 ? Math.round((a.progressVal / a.max) * 100) : 0;
  const rc = rarityClass(a.rarity);
  return (
    <div className={`ach-card ${a.earned ? 'earned' : 'locked'} ${rc}`}>
      {!a.earned && <Lock size={11} className="ach-lock" />}
      <div className="ach-card-inner">
        <div className="ach-card-top">
          <div className="ach-card-icon">{a.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ach-card-title">{a.label}</div>
            <div className="ach-card-desc">{a.desc}</div>
          </div>
          <div className="ach-rarity-tag">{a.rarity.label}</div>
        </div>
        {a.earned ? (
          <div className="ach-earned-stamp">
            <CheckCircle2 size={9} /> Unlocked
          </div>
        ) : (
          <div>
            <div className="ach-prog-hd">
              <span className="ach-prog-lbl">Progress</span>
              <span className="ach-prog-nums">
                {a.progressVal.toLocaleString()} / {a.max.toLocaleString()}
              </span>
            </div>
            <div className="ach-prog-track">
              <div className="ach-prog-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
      {a.hint && (
        <>
          <button
            className="ach-info-btn"
            onMouseEnter={() => setInfo(true)}
            onMouseLeave={() => setInfo(false)}
          >
            <Info size={9} />
          </button>
          {info && (
            <div className="ach-popover">
              <strong
                style={{
                  display: 'block',
                  marginBottom: 4,
                  color: 'var(--gold)',
                }}
              >
                How to unlock
              </strong>
              {a.hint}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENTS OVERLAY
═══════════════════════════════════════════════════════════════ */
function AchievementsOverlay({ achievements, onClose, isDark }) {
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('default');

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const earned = achievements.filter((a) => a.earned).length;
  const total = achievements.length;
  const pct = Math.round((earned / total) * 100);

  const filtered = useMemo(() => {
    let list = [...achievements];
    if (tab === 'earned') list = list.filter((a) => a.earned);
    if (tab === 'locked') list = list.filter((a) => !a.earned);
    const ro = [RARITY.LEGENDARY, RARITY.EPIC, RARITY.RARE, RARITY.COMMON];
    if (sort === 'rarity')
      list.sort((a, b) => ro.indexOf(a.rarity) - ro.indexOf(b.rarity));
    if (sort === 'earned') list.sort((a, b) => b.earned - a.earned);
    if (sort === 'progress')
      list.sort(
        (a, b) =>
          (b.max > 0 ? b.progressVal / b.max : 0) -
          (a.max > 0 ? a.progressVal / a.max : 0),
      );
    return list;
  }, [achievements, tab, sort]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach((a) => {
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    });
    return g;
  }, [filtered]);

  return (
    <div
      className={`ach-backdrop${isDark ? ' dark' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ach-panel">
        <div className="ach-panel-hd">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <div className="ach-panel-title">
                All <em>Achievements</em>
              </div>
              <div className="ach-panel-sub">
                {earned} unlocked · {total - earned} remaining · {total} total
              </div>
            </div>
            <button className="ach-close-btn" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="ach-sum-row">
          {[
            { v: earned, l: 'Unlocked' },
            { v: total - earned, l: 'Remaining' },
            {
              v: achievements.filter(
                (a) => a.earned && a.rarity === RARITY.LEGENDARY,
              ).length,
              l: 'Legendary',
            },
            {
              v: achievements.filter(
                (a) => a.earned && a.rarity === RARITY.EPIC,
              ).length,
              l: 'Epic',
            },
            {
              v: achievements.filter(
                (a) => a.earned && a.rarity === RARITY.RARE,
              ).length,
              l: 'Rare',
            },
          ].map(({ v, l }) => (
            <div key={l} className="ach-sum-item">
              <div className="ach-sum-val">{v}</div>
              <div className="ach-sum-lbl">{l}</div>
            </div>
          ))}
          <div className="ach-overall-wrap">
            <div
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: '.49rem',
                color: 'var(--ink3)',
                letterSpacing: '.08em',
                marginBottom: 4,
              }}
            >
              Overall — {pct}%
            </div>
            <div className="ach-overall-track">
              <div className="ach-overall-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="ach-controls">
          <div className="ach-tabs">
            {[
              ['all', 'All'],
              ['earned', 'Earned'],
              ['locked', 'Locked'],
            ].map(([v, l]) => (
              <button
                key={v}
                className={`ach-tab${tab === v ? ' on' : ''}`}
                onClick={() => setTab(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <select
            className="ach-sort-sel"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="default">Default</option>
            <option value="earned">Earned First</option>
            <option value="progress">Most Progress</option>
            <option value="rarity">By Rarity</option>
          </select>
        </div>
        <div className="ach-panel-body">
          {Object.entries(grouped).map(([name, items]) => (
            <div key={name} className="ach-cat-section">
              <div className="ach-cat-label">{name}</div>
              <div className="ach-grid">
                {items.map((a) => (
                  <AchievementCard key={a.id} a={a} />
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                fontFamily: 'var(--f-mono)',
                fontSize: '.6rem',
                color: 'var(--ink3)',
              }}
            >
              No achievements match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN — Profile
═══════════════════════════════════════════════════════════════ */
export default function Profile() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { supabase, loading: sbLoading } = useSupabase();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameEditing, setNameEditing] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [copied, setCopied] = useState(false);

  /* Fetch sessions */
  const fetchSessions = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false });
    setSessions(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    fetchSessions();
  }, [supabase, fetchSessions]);

  // 🌐 Global sync — refetch whenever FocusMode saves a new session
  useEffect(() => {
    const handler = () => fetchSessions();
    window.addEventListener('session:created', handler);
    return () => window.removeEventListener('session:created', handler);
  }, [fetchSessions]);

  /* Pre-fill name editor */
  useEffect(() => {
    if (user) setEditName(user.fullName || user.firstName || '');
  }, [user]);

  /* All derived stats */
  const stats = useMemo(() => {
    const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);
    const completed = sessions.filter(
      (s) => s.completed || s.is_completed,
    ).length;
    const streak = calcStreak(sessions);
    const longestStreak = calcLongestStreak(sessions);
    const totalXP = sessions.reduce((a, s) => a + sessionXP(s), 0);
    const level = xpToLevel(totalXP);
    const avgMins = sessions.length
      ? Math.round(totalMins / sessions.length)
      : 0;
    const heatmapWeeks = buildHeatmap(sessions);
    const topDay = bestStudyDay(sessions);
    const archetype = deriveArchetype(sessions, streak);
    const achievements = computeAchievements(sessions, streak);
    const uniqueDays = new Set(
      sessions.map((s) => new Date(s.created_at).toISOString().slice(0, 10)),
    ).size;
    const consistencyScore = sessions.length
      ? Math.round(
          (uniqueDays /
            Math.max(
              1,
              Math.ceil(
                (Date.now() -
                  new Date(
                    sessions[sessions.length - 1]?.created_at || Date.now(),
                  ).getTime()) /
                  86400000,
              ),
            )) *
            100,
        )
      : 0;
    const topFocusType = (() => {
      const map = {};
      sessions.forEach((s) => {
        const k = s.focus_type || 'General';
        map[k] = (map[k] || 0) + (s.duration || 0);
      });
      if (!Object.keys(map).length) return null;
      return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0];
    })();
    return {
      totalMins,
      completed,
      streak,
      longestStreak,
      totalXP,
      level,
      avgMins,
      heatmapWeeks,
      topDay,
      archetype,
      achievements,
      uniqueDays,
      consistencyScore,
      topFocusType,
      total: sessions.length,
    };
  }, [sessions]);

  /* XP calculations */
  const lvl = stats.level;
  const xpCur = stats.totalXP - xpForLevel(lvl);
  const xpNeeded = xpForNextLevel(lvl) - xpForLevel(lvl);
  const xpPct = Math.round((xpCur / xpNeeded) * 100);

  /* Avatar initials */
  const initials = user
    ? (user.firstName?.[0] || '') + (user.lastName?.[0] || '')
    : '?';
  const joinDate = user?.createdAt ? dateStr(user.createdAt) : '—';

  /* Preview achievements — earned first, then rarity order */
  const achievementPreview = useMemo(() => {
    const ro = [RARITY.LEGENDARY, RARITY.EPIC, RARITY.RARE, RARITY.COMMON];
    return [...stats.achievements]
      .sort((a, b) => {
        if (a.earned !== b.earned) return b.earned - a.earned;
        return ro.indexOf(a.rarity) - ro.indexOf(b.rarity);
      })
      .slice(0, 16);
  }, [stats.achievements]);

  /* Save name to Clerk */
  const handleSaveName = async () => {
    if (!user || !editName.trim()) return;
    setNameSaving(true);
    try {
      const parts = editName.trim().split(' ');
      await user.update({
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || '',
      });
    } catch (e) {
      console.error('Name update error:', e);
    }
    setNameSaving(false);
    setNameEditing(false);
  };

  /* Delete account */
  const handleDelete = async () => {
    if (deleteInput.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    try {
      // Delete all user data from Supabase first
      if (supabase) {
        await supabase.from('focus_logs').delete().eq('user_id', user.id);
        await supabase.from('sessions').delete().eq('user_id', user.id);
        await supabase.from('users').delete().eq('id', user.id);
      }
      // Then delete the Clerk account
      await user.delete();
      navigate('/');
    } catch (e) {
      console.error('Delete error:', e);
      setDeleteError('Failed to delete account. Please contact support.');
    }
    setDeleting(false);
  };

  /* Copy user ID */
  const handleCopyId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (sbLoading || loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className={`pf${isDark ? ' dark' : ''}`}>
          <div
            style={{
              minHeight: '100vh',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--f-display)',
                  fontSize: '3rem',
                  color: 'var(--gold)',
                  animation: 'slow-spin 4s linear infinite',
                  display: 'inline-block',
                }}
              >
                ◈
              </div>
              <div
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: '.62rem',
                  letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  color: 'var(--ink3)',
                  marginTop: 14,
                }}
              >
                Loading profile…
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className={`pf${isDark ? ' dark' : ''}`}>
        <div className="pf-orbs" aria-hidden>
          <div className="pf-orb pf-orb1" />
          <div className="pf-orb pf-orb2" />
        </div>
        <div className="pf-grain" aria-hidden />

        <div className="pf-wrap">
          {/* ══════════════════════════════════════
                        1. HERO PROFILE SECTION
                    ══════════════════════════════════════ */}
          <div className="pf-hero pf-a1">
            <div className="pf-hero-top-bar">
              <div className="pf-hero-top-bar-label">
                <Crown size={10} /> Profile
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="pf-btn pf-btn-ghost"
                  onClick={toggleTheme}
                  title="Toggle theme"
                >
                  {isDark ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button
                  className="pf-btn pf-btn-ghost"
                  onClick={() => navigate('/dashboard')}
                >
                  <LayoutDashboard size={13} /> Dashboard
                </button>
                <button
                  className="pf-btn pf-btn-ghost"
                  onClick={() => navigate('/insights')}
                >
                  <BarChart2 size={13} /> Insights
                </button>
              </div>
            </div>

            <div className="pf-hero-body">
              {/* Avatar */}
              <div className="pf-avatar-wrap">
                <div className="pf-avatar">{initials || '?'}</div>
                <div className="pf-avatar-ring" />
                <div className="pf-avatar-level">{lvl}</div>
              </div>

              {/* Identity */}
              <div className="pf-identity">
                <div className="pf-name">
                  {user?.fullName || user?.firstName || 'Scholar'}
                </div>
                <div className="pf-email">
                  {user?.emailAddresses?.[0]?.emailAddress || ''}
                </div>
                <div className="pf-join">Member since {joinDate}</div>
                <div className="pf-identity-title">
                  <Crown size={10} />
                  {focusIdentityTitle(lvl, stats.streak)} · Level {lvl}{' '}
                  {levelTitle(lvl)}
                </div>
              </div>

              {/* Streak */}
              <div className="pf-streak-hero">
                <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>🔥</div>
                <div className="pf-streak-val">{stats.streak}</div>
                <div className="pf-streak-lbl">Day Streak</div>
              </div>
            </div>

            {/* XP Bar */}
            <div className="pf-xp-section">
              <div className="pf-xp-info">
                <div className="pf-xp-label">
                  XP Progress — Level {lvl} → {lvl + 1}
                </div>
                <div className="pf-xp-track">
                  <div className="pf-xp-fill" style={{ width: `${xpPct}%` }} />
                </div>
                <div className="pf-xp-sub">
                  {xpCur.toLocaleString()} / {xpNeeded.toLocaleString()} XP ·{' '}
                  {(xpNeeded - xpCur).toLocaleString()} remaining
                </div>
              </div>
              <div className="pf-xp-chips">
                {[
                  { val: stats.totalXP.toLocaleString(), lbl: 'Total XP' },
                  { val: `Lv. ${lvl}`, lbl: 'Current Level' },
                  {
                    val:
                      stats.achievements.filter((a) => a.earned).length +
                      '/' +
                      stats.achievements.length,
                    lbl: 'Badges',
                  },
                ].map(({ val, lbl }) => (
                  <div key={lbl} className="pf-xp-chip">
                    <div className="pf-xp-chip-val">{val}</div>
                    <div className="pf-xp-chip-lbl">{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
                        2. LIFETIME STATS
                    ══════════════════════════════════════ */}
          <div className="pf-section pf-a2">
            <div className="pf-section-eye">
              <Layers size={10} /> Lifetime Stats
            </div>
            <div className="pf-stats-grid">
              {[
                {
                  icon: BookOpen,
                  label: 'Total Sessions',
                  val: stats.total,
                  accent: 'var(--gold)',
                  glyph: '◈',
                },
                {
                  icon: Clock,
                  label: 'Total Focus',
                  val: fmtMins(stats.totalMins),
                  accent: 'var(--green)',
                  glyph: '⏱',
                },
                {
                  icon: TrendingUp,
                  label: 'Avg Session',
                  val: fmtMins(stats.avgMins),
                  accent: 'var(--blue)',
                  glyph: '↗',
                },
                {
                  icon: CheckCircle2,
                  label: 'Completed',
                  val: stats.completed,
                  accent: 'var(--green)',
                  glyph: '✓',
                },
                {
                  icon: Flame,
                  label: 'Current Streak',
                  val: `${stats.streak}d`,
                  accent: 'var(--gold)',
                  glyph: '🔥',
                },
                {
                  icon: Award,
                  label: 'Longest Streak',
                  val: `${stats.longestStreak}d`,
                  accent: 'var(--purple)',
                  glyph: '🏅',
                },
                {
                  icon: Zap,
                  label: 'Total XP',
                  val: stats.totalXP.toLocaleString(),
                  accent: 'var(--gold)',
                  glyph: '⚡',
                },
                {
                  icon: Crown,
                  label: 'Level',
                  val: `Lv. ${lvl}`,
                  accent: 'var(--gold)',
                  glyph: '👑',
                },
              ].map(({ icon: Icon, label, val, accent, glyph }) => (
                <div
                  key={label}
                  className="pf-stat"
                  style={{ '--stat-accent': accent }}
                >
                  <div className="pf-stat-icon">
                    <Icon size={14} strokeWidth={1.8} />
                  </div>
                  <div className="pf-stat-label">{label}</div>
                  <div className="pf-stat-val">{val}</div>
                  <div className="pf-stat-bg">{glyph}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════
                        3. ACHIEVEMENTS SHOWCASE
                    ══════════════════════════════════════ */}
          <div className="pf-section pf-a3">
            <div className="pf-section-eye">
              <Trophy size={10} /> Achievements
            </div>
            <div className="pf-section-title">
              Your <em>Badges</em>
            </div>
            <div className="pf-card">
              <div className="pf-card-head">
                <span className="pf-card-label">
                  <Award size={11} /> Earned Achievements
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: 'var(--f-mono)',
                      fontSize: '.52rem',
                      color: 'var(--ink3)',
                    }}
                  >
                    {stats.achievements.filter((a) => a.earned).length} /{' '}
                    {stats.achievements.length} unlocked
                  </span>
                  {/* overall progress bar */}
                  <div
                    style={{
                      width: 64,
                      height: 4,
                      background: 'var(--border)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.round((stats.achievements.filter((a) => a.earned).length / stats.achievements.length) * 100)}%`,
                        background:
                          'linear-gradient(90deg,var(--gold),var(--gold2))',
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="pf-card-body">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(88px,1fr))',
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  {achievementPreview.map((a) => (
                    <div
                      key={a.id}
                      className={`ach-mini ${a.earned ? 'earned' : 'locked'} ${rarityClass(a.rarity)}`}
                      title={a.desc}
                    >
                      <div className="ach-mini-icon">{a.icon}</div>
                      <div className="ach-mini-label">{a.label}</div>
                      <div className="ach-mini-rarity">{a.rarity.label}</div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--f-mono)',
                      fontSize: '.53rem',
                      color: 'var(--ink3)',
                      letterSpacing: '.04em',
                    }}
                  >
                    Showing 16 of {stats.achievements.length} · Visit Insights
                    for full details
                  </span>
                  <button
                    className="ach-view-all-btn"
                    onClick={() => setOverlayOpen(true)}
                  >
                    <Trophy size={12} /> View All <ArrowUpRight size={11} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
                        4. GROWTH SECTION
                    ══════════════════════════════════════ */}
          <div className="pf-section pf-a4">
            <div className="pf-section-eye">
              <TrendingUp size={10} /> Growth
            </div>
            <div className="pf-section-title">
              Personal <em>Patterns</em>
            </div>
            <div className="pf-growth-grid">
              {/* Heatmap */}
              <div className="pf-card">
                <div className="pf-card-head">
                  <span className="pf-card-label">
                    <Calendar size={11} /> 16-Week Activity
                  </span>
                </div>
                <div className="pf-card-body">
                  <div className="pf-heatmap">
                    {stats.heatmapWeeks.map((wk, wi) => (
                      <div key={wi} className="pf-hm-week">
                        {wk.map((c, di) => (
                          <div
                            key={di}
                            className={`pf-hm-cell l${c.level}`}
                            title={`${c.date}: ${fmtMins(c.mins)}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.5rem',
                        color: 'var(--ink3)',
                      }}
                    >
                      Less
                    </span>
                    {[0, 1, 2, 3, 4].map((l) => (
                      <div
                        key={l}
                        className={`pf-hm-cell l${l}`}
                        style={{ flexShrink: 0 }}
                      />
                    ))}
                    <span
                      style={{
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.5rem',
                        color: 'var(--ink3)',
                      }}
                    >
                      More
                    </span>
                  </div>
                </div>
              </div>

              {/* Insights pills */}
              <div className="pf-card">
                <div className="pf-card-head">
                  <span className="pf-card-label">
                    <Sparkles size={11} /> AI Summary
                  </span>
                </div>
                <div
                  className="pf-card-body"
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  {[
                    stats.topDay
                      ? {
                          icon: Calendar,
                          text: (
                            <>
                              You study best on <strong>{stats.topDay}s</strong>{' '}
                              — schedule your hardest sessions then.
                            </>
                          ),
                        }
                      : null,
                    stats.topFocusType
                      ? {
                          icon: Brain,
                          text: (
                            <>
                              Your most common focus type is{' '}
                              <strong>{stats.topFocusType}</strong>. You
                              gravitate toward this naturally.
                            </>
                          ),
                        }
                      : null,
                    stats.longestStreak > 0
                      ? {
                          icon: Flame,
                          text: (
                            <>
                              Your longest streak was{' '}
                              <strong>{stats.longestStreak} days</strong>. You
                              know you can beat that.
                            </>
                          ),
                        }
                      : null,
                    stats.total > 0
                      ? {
                          icon: Target,
                          text: (
                            <>
                              You've completed{' '}
                              <strong>
                                {Math.round(
                                  (stats.completed / Math.max(1, stats.total)) *
                                    100,
                                )}
                                %
                              </strong>{' '}
                              of your sessions.{' '}
                              {stats.completed >= stats.total * 0.8
                                ? 'Exceptional follow-through.'
                                : 'Finishing more sessions will compound your XP.'}
                            </>
                          ),
                        }
                      : null,
                  ]
                    .filter(Boolean)
                    .map(({ icon: Icon, text }, i) => (
                      <div key={i} className="pf-insight-pill">
                        <div className="pf-insight-icon">
                          <Icon size={14} />
                        </div>
                        <div className="pf-insight-text">{text}</div>
                      </div>
                    ))}
                  {!stats.total && (
                    <div
                      style={{
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.6rem',
                        color: 'var(--ink3)',
                        textAlign: 'center',
                        padding: '20px 0',
                      }}
                    >
                      Complete sessions to unlock insights.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
                        5. FOCUS PERSONALITY
                    ══════════════════════════════════════ */}
          <div className="pf-section pf-a4">
            <div className="pf-section-eye">
              <Star size={10} /> Focus Personality
            </div>
            <div className="pf-section-title">
              Your <em>Archetype</em>
            </div>
            <div className="pf-archetype">
              <div
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: '.56rem',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  marginBottom: 8,
                  opacity: 0.7,
                }}
              >
                Focus Identity
              </div>
              <div className="pf-archetype-name">
                {stats.archetype.name.includes('"') || true ? (
                  <em>{stats.archetype.name.replace(/The /, '')}</em>
                ) : (
                  stats.archetype.name
                )}
              </div>
              <div className="pf-archetype-desc">{stats.archetype.desc}</div>
              <div className="pf-trait-chips">
                {stats.archetype.traits.map((t) => (
                  <span key={t} className="pf-trait-chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
                        6. ACTIVITY TIMELINE
                    ══════════════════════════════════════ */}
          <div className="pf-section pf-a5">
            <div className="pf-section-eye">
              <Clock size={10} /> Recent Activity
            </div>
            <div className="pf-section-title">
              Session <em>Timeline</em>
            </div>
            <div className="pf-card">
              <div className="pf-card-body" style={{ padding: 0 }}>
                {sessions.length === 0 ? (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      fontFamily: 'var(--f-mono)',
                      fontSize: '.6rem',
                      color: 'var(--ink3)',
                    }}
                  >
                    No sessions yet. Start your first one!
                  </div>
                ) : (
                  <div className="pf-timeline" style={{ padding: '0 20px' }}>
                    {sessions.slice(0, 10).map((s) => {
                      const done = s.completed || s.is_completed;
                      return (
                        <div
                          key={s.id}
                          className="pf-tl-row"
                          onClick={() => navigate(`/session/${s.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className={`pf-tl-dot${done ? ' done' : ''}`} />
                          <div className="pf-tl-info">
                            <div className="pf-tl-title">{s.title}</div>
                            <div className="pf-tl-meta">
                              {s.focus_type || 'General'} ·{' '}
                              {fmtMins(s.duration)} · +{sessionXP(s)} XP
                            </div>
                          </div>
                          <div className="pf-tl-badge">
                            {dateStr(s.created_at)}
                          </div>
                          {done && (
                            <div
                              className="pf-tl-badge"
                              style={{
                                color: 'var(--green)',
                                borderColor: 'rgba(107,140,107,.3)',
                                background: 'var(--green2)',
                              }}
                            >
                              ✓
                            </div>
                          )}
                          <ChevronRight
                            size={13}
                            style={{ color: 'var(--ink3)', flexShrink: 0 }}
                          />
                        </div>
                      );
                    })}
                    {sessions.length > 10 && (
                      <div
                        style={{
                          padding: '12px 0',
                          fontFamily: 'var(--f-mono)',
                          fontSize: '.55rem',
                          color: 'var(--ink3)',
                          textAlign: 'center',
                          letterSpacing: '.06em',
                        }}
                      >
                        + {sessions.length - 10} more sessions ·{' '}
                        <span
                          style={{ color: 'var(--gold)', cursor: 'pointer' }}
                          onClick={() => navigate('/sessions')}
                        >
                          View All
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
                        7. SETTINGS
                    ══════════════════════════════════════ */}
          <div className="pf-section pf-a5">
            <div className="pf-section-eye">
              <Settings size={10} /> Account Settings
            </div>
            <div className="pf-section-title">
              Your <em>Preferences</em>
            </div>
            <div className="pf-card">
              <div
                className="pf-card-body"
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                {/* Display Name */}
                <div>
                  <div className="pf-field-label">Display Name</div>
                  <div className="pf-field-row">
                    <input
                      className="pf-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      readOnly={!nameEditing}
                      placeholder="Your name"
                    />
                    {!nameEditing ? (
                      <button
                        className="pf-btn pf-btn-outline"
                        onClick={() => setNameEditing(true)}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    ) : (
                      <>
                        <button
                          className="pf-btn pf-btn-gold"
                          onClick={handleSaveName}
                          disabled={nameSaving}
                        >
                          <Check size={12} /> {nameSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          className="pf-btn pf-btn-ghost"
                          onClick={() => {
                            setNameEditing(false);
                            setEditName(user?.fullName || '');
                          }}
                        >
                          <X size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Email — read only */}
                <div>
                  <div className="pf-field-label">Email Address</div>
                  <div className="pf-field-row">
                    <input
                      className="pf-input"
                      value={user?.emailAddresses?.[0]?.emailAddress || ''}
                      readOnly
                    />
                    <span
                      style={{
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.52rem',
                        color: 'var(--ink3)',
                        whiteSpace: 'nowrap',
                        padding: '0 8px',
                      }}
                    >
                      Managed by Clerk
                    </span>
                  </div>
                </div>

                {/* User ID */}
                <div>
                  <div className="pf-field-label">User ID</div>
                  <div className="pf-field-row">
                    <input
                      className="pf-input"
                      value={user?.id || ''}
                      readOnly
                      style={{
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.7rem',
                        letterSpacing: '.04em',
                      }}
                    />
                    <button
                      className="pf-btn pf-btn-outline"
                      onClick={handleCopyId}
                    >
                      {copied ? (
                        <>
                          <Check size={12} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <hr
                  style={{
                    border: 'none',
                    borderTop: '1px solid var(--border)',
                  }}
                />

                {/* Theme */}
                <div>
                  <div className="pf-field-label">Appearance</div>
                  <div className="pf-theme-row">
                    <div>
                      <div className="pf-theme-label">
                        {isDark ? 'Dark Mode' : 'Light Mode'}
                      </div>
                      <div className="pf-theme-sub">
                        {isDark
                          ? 'Easy on the eyes at night.'
                          : 'Classic parchment look.'}
                      </div>
                    </div>
                    <label className="pf-toggle">
                      <input
                        type="checkbox"
                        checked={isDark}
                        onChange={toggleTheme}
                      />
                      <div className="pf-toggle-track" />
                      <div className="pf-toggle-thumb" />
                    </label>
                  </div>
                </div>

                <hr
                  style={{
                    border: 'none',
                    borderTop: '1px solid var(--border)',
                  }}
                />

                {/* Sign Out */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="pf-theme-label">Sign Out</div>
                    <div className="pf-theme-sub">
                      You'll be redirected to the home page.
                    </div>
                  </div>
                  <button
                    className="pf-btn pf-btn-outline"
                    onClick={() => signOut(() => navigate('/'))}
                  >
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
                        8. DANGER ZONE
                    ══════════════════════════════════════ */}
          <div className="pf-a6">
            <div className="pf-section-eye">
              <AlertTriangle size={10} /> Danger Zone
            </div>
            <div className="pf-danger-zone">
              <div className="pf-danger-title">
                <AlertTriangle size={15} /> Delete Account
              </div>
              <div className="pf-danger-desc">
                Once you delete your account, there is no going back. All your
                sessions, focus logs, achievements, and XP will be permanently
                erased. This action cannot be undone.
              </div>
              <div className="pf-danger-actions">
                <button
                  className="pf-btn pf-btn-danger"
                  onClick={() => {
                    setDeleteOpen(true);
                    setDeleteInput('');
                    setDeleteError('');
                  }}
                >
                  <Trash2 size={13} /> Delete My Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ACHIEVEMENTS OVERLAY ══ */}
      {overlayOpen &&
        createPortal(
          <AchievementsOverlay
            achievements={stats.achievements}
            onClose={() => setOverlayOpen(false)}
            isDark={isDark}
          />,
          document.body,
        )}

      {/* ══ DELETE CONFIRMATION MODAL ══ */}
      {deleteOpen &&
        createPortal(
          <div
            className={`pf-delete-modal-backdrop${isDark ? ' dark' : ''}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteOpen(false);
            }}
          >
            <div className="pf-delete-modal">
              <div className="pf-delete-modal-icon">
                <AlertTriangle size={22} />
              </div>
              <div className="pf-delete-modal-title">Delete Account?</div>
              <div className="pf-delete-modal-desc">
                This will permanently erase everything associated with your
                FocusFlow AI account. This action cannot be reversed.
              </div>
              <div className="pf-delete-modal-warnings">
                {[
                  'All study sessions will be deleted',
                  'All focus logs will be removed',
                  'Your XP, level, and achievements will be lost',
                  'Your account cannot be recovered',
                ].map((w) => (
                  <div key={w} className="pf-delete-warning">
                    <div className="pf-delete-warning-dot" />
                    {w}
                  </div>
                ))}
              </div>
              <div className="pf-delete-confirm-label">
                Type <span>DELETE</span> to confirm:
              </div>
              <input
                className="pf-delete-confirm-input"
                placeholder="DELETE"
                value={deleteInput}
                onChange={(e) => {
                  setDeleteInput(e.target.value);
                  setDeleteError('');
                }}
                autoFocus
              />
              {deleteError && (
                <div
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: '.58rem',
                    color: 'var(--red)',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AlertTriangle size={11} /> {deleteError}
                </div>
              )}
              <div className="pf-delete-modal-actions">
                <button
                  className="pf-btn pf-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  className="pf-btn pf-btn-danger"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleDelete}
                  disabled={
                    deleting || deleteInput.trim().toUpperCase() !== 'DELETE'
                  }
                >
                  <Trash2 size={12} />{' '}
                  {deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
