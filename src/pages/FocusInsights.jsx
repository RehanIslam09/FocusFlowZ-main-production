/**
 * FocusInsights.jsx  —  /insights
 *
 * UPGRADES vs original:
 *   1. Premium topbar — Back to Dashboard, bold title, prominent level + XP
 *   2. Hero stats band — large glanceable numbers across full width
 *   3. XP / Level hero card — game-dashboard feel (Duolingo-style)
 *   4. All existing logic, components, and CSS classes 100% preserved
 *
 * Schema confirmed from Supabase export:
 *   sessions: id, user_id, title, subject, goal, notes, duration,
 *             difficulty, date, is_completed, created_at, updated_at,
 *             focus_type, ai_plan, completed
 * XP / achievements: correctly computed client-side — no DB writes needed.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import { createPortal } from 'react-dom';
import {
  Zap,
  Flame,
  Clock,
  Target,
  TrendingUp,
  Award,
  Star,
  CheckCircle2,
  Circle,
  BookOpen,
  Brain,
  BarChart2,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Trophy,
  Shield,
  Sun,
  Moon,
  RefreshCw,
  Play,
  Layers,
  Crown,
  ArrowUpRight,
  Minus,
  Lock,
  Info,
  ArrowLeft,
  LayoutDashboard,
} from 'lucide-react';
import Chart from 'chart.js/auto';

import DailyCommissions from '../components/DailyCommissions';
import BadgeStore from '../components/BadgeStore';
import SubjectBreakdown from '../components/SubjectBreakdown';

import useLevelUp from '../hooks/useLevelUp';
import LevelUpModal from '../components/LevelUpModal';
import { BADGE_CATALOGUE } from '../components/BadgeStore';

// ── Shared progress system ──
import {
  calcSessionXP,
  computeXPFromSessions,
  xpToLevel as sharedXpToLevel,
  xpForLevel as sharedXpForLevel,
  xpForNextLevel as sharedXpForNextLevel,
  getLevelInfo as getSharedLevelInfo,
  calcStreakFromSessions,
} from '../hooks/useUserProgress';

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS  (unchanged)
═══════════════════════════════════════════════════════════════ */
const fmtMins = (m) => {
  if (!m) return '0m';
  const h = Math.floor(m / 60),
    r = m % 60;
  return h ? `${h}h${r > 0 ? ` ${r}m` : ''}` : `${r}m`;
};
const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const dateStr = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const todayISO = () => new Date().toISOString().slice(0, 10);

function calcFocusScore(session) {
  let score = 60;
  if (session.completed || session.is_completed) score += 20;
  const dur = session.duration || 0;
  if (dur >= 90) score += 10;
  else if (dur >= 45) score += 7;
  else if (dur >= 25) score += 4;
  if (session.difficulty === 'hard') score += 10;
  else if (session.difficulty === 'medium') score += 5;
  if (session.ai_plan?.steps?.length > 0) score += 5;
  return Math.min(100, score);
}
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
function buildWeekly(sessions) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    map = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    map[k] = { day: labels[d.getDay()], mins: 0, count: 0, date: k };
  }
  sessions.forEach((s) => {
    const k = new Date(s.created_at).toISOString().slice(0, 10);
    if (map[k]) {
      map[k].mins += s.duration || 0;
      map[k].count++;
    }
  });
  return Object.values(map);
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

/* ═══════════════════════════════════════════════════════════════
   RARITY SYSTEM  (unchanged)
═══════════════════════════════════════════════════════════════ */
const RARITY = {
  COMMON: {
    label: 'Common',
    color: '#9c9283',
    glow: 'rgba(156,146,131,.25)',
    ring: '#9c9283',
  },
  RARE: {
    label: 'Rare',
    color: '#5b8fa8',
    glow: 'rgba(91,143,168,.3)',
    ring: '#5b8fa8',
  },
  EPIC: {
    label: 'Epic',
    color: '#9b6bae',
    glow: 'rgba(155,107,174,.35)',
    ring: '#9b6bae',
  },
  LEGENDARY: {
    label: 'Legendary',
    color: '#c9a84c',
    glow: 'rgba(201,168,76,.4)',
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
   ACHIEVEMENT HELPERS  (unchanged)
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

/* ═══════════════════════════════════════════════════════════════
   ALL ACHIEVEMENTS  (120 — unchanged)
═══════════════════════════════════════════════════════════════ */
const ALL_ACHIEVEMENTS = [
  {
    id: 'first_session',
    category: 'First Steps',
    rarity: RARITY.COMMON,
    icon: '🌱',
    label: 'First Step',
    desc: 'Complete your very first session',
    hint: 'Create any session to unlock this.',
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
    hint: 'Keep the momentum going.',
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
    hint: 'Hit the checkmark on any session.',
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
    hint: 'Choose AI Plan mode when creating.',
    check: (s) => ah_aiCount(s) >= 1,
    progress: (s) => Math.min(1, ah_aiCount(s)),
    max: 1,
  },
  {
    id: 'first_subject',
    category: 'First Steps',
    rarity: RARITY.COMMON,
    icon: '📚',
    label: 'Subject Matter',
    desc: 'Study 2 different subjects',
    hint: 'Vary your subjects.',
    check: (s) => ah_subjectSet(s).size >= 2,
    progress: (s) => Math.min(2, ah_subjectSet(s).size),
    max: 2,
  },
  {
    id: 'first_hour',
    category: 'First Steps',
    rarity: RARITY.COMMON,
    icon: '⏰',
    label: 'First Hour',
    desc: 'Accumulate 60 minutes of total focus',
    hint: 'Any combination of sessions.',
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
    id: 's500',
    category: 'Sessions',
    rarity: RARITY.LEGENDARY,
    icon: '🌌',
    label: 'Infinite',
    desc: 'Complete 500 sessions',
    hint: '',
    check: (s) => s.length >= 500,
    progress: (s) => Math.min(500, s.length),
    max: 500,
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
    id: 'c100',
    category: 'Sessions',
    rarity: RARITY.EPIC,
    icon: '🎖️',
    label: 'Perfectionist',
    desc: 'Mark 100 sessions complete',
    hint: '',
    check: (s) => ah_countDone(s) >= 100,
    progress: (s) => Math.min(100, ah_countDone(s)),
    max: 100,
  },
  {
    id: 'streak2',
    category: 'Streaks',
    rarity: RARITY.COMMON,
    icon: '🔥',
    label: 'Kindling',
    desc: 'Maintain a 2-day streak',
    hint: 'Study on 2 consecutive days.',
    check: (_, str) => str >= 2,
    progress: (_, str) => Math.min(2, str),
    max: 2,
  },
  {
    id: 'streak3',
    category: 'Streaks',
    rarity: RARITY.COMMON,
    icon: '🔥',
    label: 'On Fire',
    desc: 'Maintain a 3-day streak',
    hint: '',
    check: (_, str) => str >= 3,
    progress: (_, str) => Math.min(3, str),
    max: 3,
  },
  {
    id: 'streak7',
    category: 'Streaks',
    rarity: RARITY.RARE,
    icon: '⚡',
    label: 'Week Warrior',
    desc: 'Maintain a 7-day streak',
    hint: 'Study every day for a full week.',
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
    id: 'streak21',
    category: 'Streaks',
    rarity: RARITY.EPIC,
    icon: '💥',
    label: 'Three Weeks',
    desc: 'Maintain a 21-day streak',
    hint: '',
    check: (_, str) => str >= 21,
    progress: (_, str) => Math.min(21, str),
    max: 21,
  },
  {
    id: 'streak30',
    category: 'Streaks',
    rarity: RARITY.EPIC,
    icon: '👑',
    label: 'Month Master',
    desc: 'Maintain a 30-day streak',
    hint: 'Study every day for a month.',
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
    id: 'days10',
    category: 'Streaks',
    rarity: RARITY.COMMON,
    icon: '📅',
    label: 'Regular',
    desc: 'Study on 10 unique days',
    hint: '',
    check: (s) => ah_uniqueDays(s) >= 10,
    progress: (s) => Math.min(10, ah_uniqueDays(s)),
    max: 10,
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
    id: 'days100',
    category: 'Streaks',
    rarity: RARITY.EPIC,
    icon: '📅',
    label: 'Dedicated',
    desc: 'Study on 100 unique days',
    hint: '',
    check: (s) => ah_uniqueDays(s) >= 100,
    progress: (s) => Math.min(100, ah_uniqueDays(s)),
    max: 100,
  },
  {
    id: 't60',
    category: 'Focus Time',
    rarity: RARITY.COMMON,
    icon: '⏱️',
    label: 'First Hour',
    desc: 'Log 1 hour of total focus',
    hint: '',
    check: (s) => ah_totalMins(s) >= 60,
    progress: (s) => Math.min(60, ah_totalMins(s)),
    max: 60,
  },
  {
    id: 't300',
    category: 'Focus Time',
    rarity: RARITY.COMMON,
    icon: '⏱️',
    label: 'Five Hours',
    desc: 'Log 5 hours of total focus',
    hint: '',
    check: (s) => ah_totalMins(s) >= 300,
    progress: (s) => Math.min(300, ah_totalMins(s)),
    max: 300,
  },
  {
    id: 't500',
    category: 'Focus Time',
    rarity: RARITY.COMMON,
    icon: '⏰',
    label: '500 Club',
    desc: 'Log 500 minutes of focus',
    hint: '',
    check: (s) => ah_totalMins(s) >= 500,
    progress: (s) => Math.min(500, ah_totalMins(s)),
    max: 500,
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
    id: 't3000',
    category: 'Focus Time',
    rarity: RARITY.RARE,
    icon: '🕑',
    label: '50 Hours',
    desc: 'Log 3,000 minutes of focus',
    hint: '',
    check: (s) => ah_totalMins(s) >= 3000,
    progress: (s) => Math.min(3000, ah_totalMins(s)),
    max: 3000,
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
    id: 't18000',
    category: 'Focus Time',
    rarity: RARITY.EPIC,
    icon: '🕓',
    label: '300 Hours',
    desc: 'Log 18,000 minutes of focus',
    hint: '',
    check: (s) => ah_totalMins(s) >= 18000,
    progress: (s) => Math.min(18000, ah_totalMins(s)),
    max: 18000,
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
    hint: 'Set duration ≥120 min.',
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
    id: 'hard1',
    category: 'Difficulty',
    rarity: RARITY.COMMON,
    icon: '💢',
    label: 'Brave',
    desc: 'Complete 1 hard session',
    hint: 'Set difficulty to Hard.',
    check: (s) => ah_hardCount(s) >= 1,
    progress: (s) => Math.min(1, ah_hardCount(s)),
    max: 1,
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
    id: 'med10',
    category: 'Difficulty',
    rarity: RARITY.COMMON,
    icon: '🎯',
    label: 'Balanced',
    desc: 'Complete 10 medium sessions',
    hint: '',
    check: (s) => ah_medCount(s) >= 10,
    progress: (s) => Math.min(10, ah_medCount(s)),
    max: 10,
  },
  {
    id: 'med50',
    category: 'Difficulty',
    rarity: RARITY.RARE,
    icon: '⚖️',
    label: 'Steady',
    desc: 'Complete 50 medium sessions',
    hint: '',
    check: (s) => ah_medCount(s) >= 50,
    progress: (s) => Math.min(50, ah_medCount(s)),
    max: 50,
  },
  {
    id: 'ai1',
    category: 'AI Mastery',
    rarity: RARITY.COMMON,
    icon: '🤖',
    label: 'AI Curious',
    desc: 'Use AI plan in 1 session',
    hint: 'Choose Generate with AI mode.',
    check: (s) => ah_aiCount(s) >= 1,
    progress: (s) => Math.min(1, ah_aiCount(s)),
    max: 1,
  },
  {
    id: 'ai3',
    category: 'AI Mastery',
    rarity: RARITY.COMMON,
    icon: '🧠',
    label: 'AI Apprentice',
    desc: 'Use AI plan in 3 sessions',
    hint: '',
    check: (s) => ah_aiCount(s) >= 3,
    progress: (s) => Math.min(3, ah_aiCount(s)),
    max: 3,
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
    hint: 'Let the machine guide you.',
    check: (s) => ah_aiCount(s) >= 50,
    progress: (s) => Math.min(50, ah_aiCount(s)),
    max: 50,
  },
  {
    id: 'sub2',
    category: 'Subjects',
    rarity: RARITY.COMMON,
    icon: '📖',
    label: 'Curious',
    desc: 'Study 2 different subjects',
    hint: '',
    check: (s) => ah_subjectSet(s).size >= 2,
    progress: (s) => Math.min(2, ah_subjectSet(s).size),
    max: 2,
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
    id: 'sub20',
    category: 'Subjects',
    rarity: RARITY.EPIC,
    icon: '🌌',
    label: 'Encyclopedist',
    desc: 'Study 20 different subjects',
    hint: '',
    check: (s) => ah_subjectSet(s).size >= 20,
    progress: (s) => Math.min(20, ah_subjectSet(s).size),
    max: 20,
  },
  {
    id: 'ft3',
    category: 'Subjects',
    rarity: RARITY.COMMON,
    icon: '🎨',
    label: 'Multi-Modal',
    desc: 'Use 3 different focus types',
    hint: 'e.g. Deep Work, Revision, Reading.',
    check: (s) => ah_focusSet(s).size >= 3,
    progress: (s) => Math.min(3, ah_focusSet(s).size),
    max: 3,
  },
  {
    id: 'ft6',
    category: 'Subjects',
    rarity: RARITY.RARE,
    icon: '🔭',
    label: 'Type Master',
    desc: 'Use 6 different focus types',
    hint: '',
    check: (s) => ah_focusSet(s).size >= 6,
    progress: (s) => Math.min(6, ah_focusSet(s).size),
    max: 6,
  },
  {
    id: 'ft_all',
    category: 'Subjects',
    rarity: RARITY.LEGENDARY,
    icon: '💎',
    label: 'Full Spectrum',
    desc: 'Use all 8 focus types',
    hint: 'Try every focus mode.',
    check: (s) => ah_focusSet(s).size >= 8,
    progress: (s) => Math.min(8, ah_focusSet(s).size),
    max: 8,
  },
  {
    id: 'xp100',
    category: 'XP & Levels',
    rarity: RARITY.COMMON,
    icon: '✨',
    label: 'First XP',
    desc: 'Earn 100 XP',
    hint: '',
    check: (s) => ah_totalXP(s) >= 100,
    progress: (s) => Math.min(100, ah_totalXP(s)),
    max: 100,
  },
  {
    id: 'xp500',
    category: 'XP & Levels',
    rarity: RARITY.COMMON,
    icon: '🌟',
    label: 'Rising',
    desc: 'Earn 500 XP',
    hint: '',
    check: (s) => ah_totalXP(s) >= 500,
    progress: (s) => Math.min(500, ah_totalXP(s)),
    max: 500,
  },
  {
    id: 'xp1000',
    category: 'XP & Levels',
    rarity: RARITY.RARE,
    icon: '⭐',
    label: 'Shining',
    desc: 'Earn 1,000 XP',
    hint: '',
    check: (s) => ah_totalXP(s) >= 1000,
    progress: (s) => Math.min(1000, ah_totalXP(s)),
    max: 1000,
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
    id: 'lvl5',
    category: 'XP & Levels',
    rarity: RARITY.COMMON,
    icon: '🌱',
    label: 'Rising Star',
    desc: 'Reach Level 5',
    hint: 'Keep earning XP.',
    check: (s) => ah_level(s) >= 5,
    progress: (s) => Math.min(5, ah_level(s)),
    max: 5,
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
    id: 'con_morning',
    category: 'Consistency',
    rarity: RARITY.RARE,
    icon: '🌅',
    label: 'Early Bird',
    desc: 'Create 10 sessions before 9 AM',
    hint: 'Morning sessions.',
    check: (s) =>
      s.filter((x) => new Date(x.created_at).getHours() < 9).length >= 10,
    progress: (s) =>
      Math.min(
        10,
        s.filter((x) => new Date(x.created_at).getHours() < 9).length,
      ),
    max: 10,
  },
  {
    id: 'con_night',
    category: 'Consistency',
    rarity: RARITY.RARE,
    icon: '🌙',
    label: 'Night Owl',
    desc: 'Create 10 sessions after 9 PM',
    hint: '',
    check: (s) =>
      s.filter((x) => new Date(x.created_at).getHours() >= 21).length >= 10,
    progress: (s) =>
      Math.min(
        10,
        s.filter((x) => new Date(x.created_at).getHours() >= 21).length,
      ),
    max: 10,
  },
  {
    id: 'con_3day',
    category: 'Consistency',
    rarity: RARITY.COMMON,
    icon: '📊',
    label: '3-a-Day',
    desc: 'Have 3 sessions in a single day',
    hint: '',
    check: (s) => {
      const m = {};
      s.forEach((x) => {
        const k = x.created_at.slice(0, 10);
        m[k] = (m[k] || 0) + 1;
      });
      return Object.values(m).some((v) => v >= 3);
    },
    progress: (s) => {
      const m = {};
      s.forEach((x) => {
        const k = x.created_at.slice(0, 10);
        m[k] = (m[k] || 0) + 1;
      });
      return Math.min(3, Math.max(0, ...Object.values(m)));
    },
    max: 3,
  },
  {
    id: 'con_5day',
    category: 'Consistency',
    rarity: RARITY.RARE,
    icon: '🔥',
    label: 'Five-a-Day',
    desc: 'Have 5 sessions in a single day',
    hint: '',
    check: (s) => {
      const m = {};
      s.forEach((x) => {
        const k = x.created_at.slice(0, 10);
        m[k] = (m[k] || 0) + 1;
      });
      return Object.values(m).some((v) => v >= 5);
    },
    progress: (s) => {
      const m = {};
      s.forEach((x) => {
        const k = x.created_at.slice(0, 10);
        m[k] = (m[k] || 0) + 1;
      });
      return Math.min(5, Math.max(0, ...Object.values(m)));
    },
    max: 5,
  },
  {
    id: 'con_weekend',
    category: 'Consistency',
    rarity: RARITY.RARE,
    icon: '🏖️',
    label: 'Weekend Scholar',
    desc: 'Study on both Saturday and Sunday',
    hint: '',
    check: (s) =>
      s.some((x) => new Date(x.created_at).getDay() === 6) &&
      s.some((x) => new Date(x.created_at).getDay() === 0),
    progress: (s) =>
      [6, 0].filter((d) => s.some((x) => new Date(x.created_at).getDay() === d))
        .length,
    max: 2,
  },
  {
    id: 'mast_eff80',
    category: 'Mastery',
    rarity: RARITY.RARE,
    icon: '🎯',
    label: 'Sharp',
    desc: 'Achieve 80% completion rate (min 10 sessions)',
    hint: "Complete sessions, don't just create them.",
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
    hint: '100% completion rate on 20+ sessions.',
    check: (s) => s.length >= 20 && ah_countDone(s) === s.length,
    progress: (s) =>
      s.length < 1 ? 0 : Math.round((ah_countDone(s) / s.length) * 100),
    max: 100,
  },
  {
    id: 'mast_plan5',
    category: 'Mastery',
    rarity: RARITY.COMMON,
    icon: '📐',
    label: 'Structured',
    desc: 'Complete AI-planned sessions 5 times',
    hint: '',
    check: (s) =>
      s.filter(
        (x) => x.ai_plan?.steps?.length > 0 && (x.completed || x.is_completed),
      ).length >= 5,
    progress: (s) =>
      Math.min(
        5,
        s.filter(
          (x) =>
            x.ai_plan?.steps?.length > 0 && (x.completed || x.is_completed),
        ).length,
      ),
    max: 5,
  },
  {
    id: 'mast_plan25',
    category: 'Mastery',
    rarity: RARITY.EPIC,
    icon: '🏛️',
    label: 'The Architect',
    desc: 'Complete AI-planned sessions 25 times',
    hint: '',
    check: (s) =>
      s.filter(
        (x) => x.ai_plan?.steps?.length > 0 && (x.completed || x.is_completed),
      ).length >= 25,
    progress: (s) =>
      Math.min(
        25,
        s.filter(
          (x) =>
            x.ai_plan?.steps?.length > 0 && (x.completed || x.is_completed),
        ).length,
      ),
    max: 25,
  },
  {
    id: 'mast_100h',
    category: 'Mastery',
    rarity: RARITY.EPIC,
    icon: '🧲',
    label: 'Centurion Hours',
    desc: '100 hours of completed sessions',
    hint: 'Only counts completed sessions.',
    check: (s) =>
      s
        .filter((x) => x.completed || x.is_completed)
        .reduce((a, x) => a + (x.duration || 0), 0) >= 6000,
    progress: (s) =>
      Math.min(
        6000,
        s
          .filter((x) => x.completed || x.is_completed)
          .reduce((a, x) => a + (x.duration || 0), 0),
      ),
    max: 6000,
  },
  {
    id: 'mast_10steps',
    category: 'Mastery',
    rarity: RARITY.EPIC,
    icon: '🪜',
    label: 'Step Master',
    desc: 'Use an AI plan with 10+ steps',
    hint: 'Generate a detailed plan in AI mode.',
    check: (s) => s.some((x) => (x.ai_plan?.steps?.length || 0) >= 10),
    progress: (s) =>
      Math.min(10, Math.max(0, ...s.map((x) => x.ai_plan?.steps?.length || 0))),
    max: 10,
  },
  {
    id: 'sp_comeback',
    category: 'Special',
    rarity: RARITY.RARE,
    icon: '🦅',
    label: 'The Comeback',
    desc: 'Return after 7+ days of inactivity',
    hint: 'Sometimes life happens. Come back.',
    check: (s) => {
      if (s.length < 2) return false;
      const sorted = [...s].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      );
      for (let i = 1; i < sorted.length; i++) {
        const gap =
          (new Date(sorted[i].created_at) -
            new Date(sorted[i - 1].created_at)) /
          86400000;
        if (gap >= 7) return true;
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
        const gap =
          (new Date(sorted[i].created_at) -
            new Date(sorted[i - 1].created_at)) /
          86400000;
        if (gap > max) max = gap;
      }
      return Math.min(7, Math.round(max));
    },
    max: 7,
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
    id: 'sp_noted',
    category: 'Special',
    rarity: RARITY.COMMON,
    icon: '📝',
    label: 'Note Taker',
    desc: 'Add notes to 5 sessions',
    hint: 'Use the Notes field.',
    check: (s) =>
      s.filter((x) => x.notes && x.notes.trim().length > 0).length >= 5,
    progress: (s) =>
      Math.min(5, s.filter((x) => x.notes && x.notes.trim().length > 0).length),
    max: 5,
  },
  {
    id: 'sp_noted20',
    category: 'Special',
    rarity: RARITY.RARE,
    icon: '📓',
    label: 'The Journalist',
    desc: 'Add notes to 20 sessions',
    hint: '',
    check: (s) =>
      s.filter((x) => x.notes && x.notes.trim().length > 0).length >= 20,
    progress: (s) =>
      Math.min(
        20,
        s.filter((x) => x.notes && x.notes.trim().length > 0).length,
      ),
    max: 20,
  },
  {
    id: 'sp_goals',
    category: 'Special',
    rarity: RARITY.COMMON,
    icon: '🎯',
    label: 'Goal Setter',
    desc: 'Add a goal to 5 sessions',
    hint: 'Fill the Goal field when creating.',
    check: (s) =>
      s.filter((x) => x.goal && x.goal.trim().length > 0).length >= 5,
    progress: (s) =>
      Math.min(5, s.filter((x) => x.goal && x.goal.trim().length > 0).length),
    max: 5,
  },
  {
    id: 'sp_long_note',
    category: 'Special',
    rarity: RARITY.EPIC,
    icon: '✍️',
    label: 'Deep Reflection',
    desc: 'Write a note longer than 200 characters',
    hint: 'Thorough notes show deeper engagement.',
    check: (s) => s.some((x) => x.notes && x.notes.length >= 200),
    progress: (s) =>
      Math.min(200, Math.max(0, ...s.map((x) => x.notes?.length || 0))),
    max: 200,
  },
  {
    id: 'sp_weekday',
    category: 'Special',
    rarity: RARITY.RARE,
    icon: '📅',
    label: 'Weekday Warrior',
    desc: 'Study on all 5 weekdays in one week',
    hint: 'Mon–Fri in the same week.',
    check: (s) => {
      const now = new Date(),
        wk = now.getDay(),
        mon = new Date(now);
      mon.setDate(now.getDate() - ((wk + 6) % 7));
      const days = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        days.push(d.toISOString().slice(0, 10));
      }
      return days.every((d) => s.some((x) => x.created_at.slice(0, 10) === d));
    },
    progress: (s) => {
      const now = new Date(),
        wk = now.getDay(),
        mon = new Date(now);
      mon.setDate(now.getDate() - ((wk + 6) % 7));
      let c = 0;
      for (let i = 0; i < 5; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        if (
          s.some(
            (x) => x.created_at.slice(0, 10) === d.toISOString().slice(0, 10),
          )
        )
          c++;
      }
      return c;
    },
    max: 5,
  },
  {
    id: 'sp_ft_all',
    category: 'Special',
    rarity: RARITY.LEGENDARY,
    icon: '🌈',
    label: 'Renaissance Soul',
    desc: 'Study in every focus type category',
    hint: 'Try every focus mode available.',
    check: (s) => ah_focusSet(s).size >= 8,
    progress: (s) => Math.min(8, ah_focusSet(s).size),
    max: 8,
  },
  {
    id: 'sp_hard_all',
    category: 'Special',
    rarity: RARITY.LEGENDARY,
    icon: '😈',
    label: 'Masochist',
    desc: 'Have 80%+ of sessions on Hard difficulty (min 10)',
    hint: 'The rarest grind.',
    check: (s) => s.length >= 10 && ah_hardCount(s) / s.length >= 0.8,
    progress: (s) =>
      s.length < 10 ? 0 : Math.round((ah_hardCount(s) / s.length) * 100),
    max: 80,
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
   SCORE / LEVEL / TITLE HELPERS  (unchanged)
═══════════════════════════════════════════════════════════════ */
const FOCUS_COLORS_MAP = {
  'Deep Work': '#c9a84c',
  Revision: '#6b9e6b',
  Reading: '#5b8fa8',
  Writing: '#b87a5a',
  Practice: '#9b6bae',
  Research: '#5a8a9b',
  Creative: '#c06b8a',
  'Problem Solving': '#6b8aca',
  'Free Focus': '#a0906c',
};
const focusColor = (ft) => FOCUS_COLORS_MAP[ft] || '#c9a84c';
const DIFF_COLOR = { easy: '#6b9e6b', medium: '#c9a84c', hard: '#c0544a' };
function scoreColor(n) {
  if (n >= 85) return '#6b9e6b';
  if (n >= 65) return '#c9a84c';
  return '#c0544a';
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

/* ═══════════════════════════════════════════════════════════════
   CSS
   — All original classes kept intact
   — New classes prefixed with fi-nb- (navbar) and fi-hero- (hero band)
═══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

:root {
  color-scheme:light;
  --bg:#f5f0e8;--surface:#faf7f2;--surface2:#f0ebe0;--surface3:#e8e0d0;
  --border:#ddd5c4;--border2:#ccc0a8;
  --ink:#1e1a14;--ink2:#5c5445;--ink3:#9c9283;
  --gold:#c4913a;--gold2:#e8b96a;--gold3:rgba(196,145,58,.1);--gold-glow:rgba(196,145,58,.2);
  --red:#b85c4a;--red2:rgba(184,92,74,.1);
  --green:#6b8c6b;--green2:rgba(107,140,107,.1);--green3:rgba(107,140,107,.22);
  --blue:#5b8fa8;--blue2:rgba(91,143,168,.1);
  --purple:#9b6bae;--purple2:rgba(155,107,174,.1);
  --shadow:0 2px 16px rgba(30,26,20,.08);--shadow-md:0 6px 28px rgba(30,26,20,.12);--shadow-lg:0 16px 56px rgba(30,26,20,.16);
  --f-display:'Cormorant Garamond',Georgia,serif;
  --f-ui:'Cabinet Grotesk',sans-serif;
  --f-mono:'JetBrains Mono',monospace;
  --ease:cubic-bezier(.16,1,.3,1);--spring:cubic-bezier(.34,1.56,.64,1);--r:10px;
}
.dark {
  color-scheme:dark;
  --bg:#0c0b09;--surface:#131210;--surface2:#1a1815;--surface3:#222019;
  --border:#2a2722;--border2:#35312b;
  --ink:#f0ead8;--ink2:#a89880;--ink3:#6b5f4e;
  --shadow:0 2px 16px rgba(0,0,0,.35);--shadow-md:0 6px 28px rgba(0,0,0,.45);--shadow-lg:0 16px 56px rgba(0,0,0,.6);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── PAGE ── */
.fi{min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--f-ui);position:relative;overflow-x:hidden;transition:background .35s,color .35s}
.fi-orbs{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.fi-orb{position:absolute;border-radius:50%;filter:blur(180px)}
.fi-orb1{width:700px;height:700px;background:var(--gold);top:-280px;right:-200px;opacity:.05}
.fi-orb2{width:500px;height:500px;background:#4a5a9a;bottom:-200px;left:-160px;opacity:.04}
.fi-orb3{width:400px;height:400px;background:var(--green);top:40%;right:10%;opacity:.03}
.dark .fi-orb1{opacity:.055} .dark .fi-orb2{opacity:.045}
.fi-grain{pointer-events:none;position:fixed;inset:0;z-index:1;opacity:.02;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode:multiply}
.dark .fi-grain{mix-blend-mode:screen;opacity:.03}

/* ══════════════════════════════════════════════
   UPGRADED TOPBAR (replaces old fi-topbar)
══════════════════════════════════════════════ */
.fi-topbar {
  position:sticky;top:0;z-index:200;
  background:color-mix(in srgb,var(--bg) 82%,transparent);
  backdrop-filter:blur(22px) saturate(1.5);
  -webkit-backdrop-filter:blur(22px) saturate(1.5);
  border-bottom:1px solid var(--border);
  transition:background .35s;
}
.fi-topbar::before {
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--gold),var(--gold2),transparent);
  opacity:.5;
}
.fi-nb-inner {
  max-width:1200px;margin:0 auto;padding:0 28px;
  height:66px;display:flex;align-items:center;gap:16px;
}
@media(max-width:768px){.fi-nb-inner{padding:0 14px;height:58px}}

/* Back button */
.fi-nb-back {
  display:inline-flex;align-items:center;gap:7px;
  font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink3);background:transparent;border:1px solid var(--border);
  padding:7px 13px;border-radius:7px;cursor:pointer;text-decoration:none;
  transition:all .22s var(--spring);flex-shrink:0;white-space:nowrap;
}
.fi-nb-back:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3);transform:translateX(-2px)}

/* Page identity */
.fi-nb-identity{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.fi-nb-title{font-family:var(--f-display);font-size:1.35rem;font-weight:600;letter-spacing:-.02em;color:var(--ink);line-height:1;white-space:nowrap}
.fi-nb-title em{font-style:italic;color:var(--gold)}
.fi-nb-subtitle{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
@media(max-width:500px){.fi-nb-subtitle{display:none}}

/* Right cluster */
.fi-nb-right{display:flex;align-items:center;gap:10px;flex-shrink:0}

/* Level pill — bigger than before */
.fi-nb-level{
  display:inline-flex;align-items:center;gap:8px;
  padding:6px 14px;border-radius:30px;
  background:linear-gradient(135deg,rgba(196,145,58,.14),rgba(196,145,58,.06));
  border:1px solid rgba(196,145,58,.35);
  cursor:default;
}
.fi-nb-level-orb{
  width:28px;height:28px;border-radius:50%;
  background:linear-gradient(135deg,var(--gold),var(--gold2));
  display:grid;place-items:center;
  font-family:var(--f-display);font-size:.9rem;font-weight:700;color:#fff;
  flex-shrink:0;
  box-shadow:0 0 10px rgba(196,145,58,.35);
}
.fi-nb-level-text{display:flex;flex-direction:column;gap:0}
.fi-nb-level-title{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:500}
.fi-nb-level-xp{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.05em;color:var(--ink3)}
@media(max-width:640px){.fi-nb-level-text{display:none}}

/* XP bar in topbar */
.fi-nb-xpbar-wrap{display:flex;flex-direction:column;gap:4px;min-width:90px}
@media(max-width:768px){.fi-nb-xpbar-wrap{display:none}}
.fi-nb-xpbar-label{font-family:var(--f-mono);font-size:.48rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);display:flex;justify-content:space-between}
.fi-nb-xpbar-track{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.fi-nb-xpbar-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:3px;transition:width 1.2s var(--ease)}

/* Theme btn (unchanged class, kept for compatibility) */
.fi-theme-btn{width:32px;height:32px;border-radius:6px;display:grid;place-items:center;background:transparent;border:1px solid var(--border2);color:var(--ink3);cursor:pointer;transition:all .2s}
.fi-theme-btn:hover{border-color:var(--gold);color:var(--gold);transform:rotate(12deg)}

/* ── NEW HERO STATS BAND ── */
.fi-hero-band{
  display:grid;grid-template-columns:repeat(4,1fr);gap:0;
  border-bottom:1px solid var(--border);
  position:relative;z-index:2;
  background:linear-gradient(135deg,color-mix(in srgb,var(--gold) 5%,var(--bg)),var(--bg));
}
@media(max-width:900px){.fi-hero-band{grid-template-columns:repeat(2,1fr)}}
@media(max-width:480px){.fi-hero-band{grid-template-columns:1fr 1fr}}
.fi-hero-stat{
  padding:22px 24px;display:flex;flex-direction:column;gap:5px;
  border-right:1px solid var(--border);position:relative;overflow:hidden;
  transition:background .2s;
}
.fi-hero-stat:last-child{border-right:none}
@media(max-width:900px){.fi-hero-stat:nth-child(2){border-right:none}.fi-hero-stat:nth-child(3){border-top:1px solid var(--border)}}
.fi-hero-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--hs-accent,var(--gold));opacity:0;transition:opacity .2s}
.fi-hero-stat:hover::before{opacity:.8}
.fi-hero-stat:hover{background:color-mix(in srgb,var(--hs-accent,var(--gold)) 4%,var(--bg))}
.fi-hs-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,var(--hs-accent,var(--gold)) 13%,transparent);color:var(--hs-accent,var(--gold));margin-bottom:6px;flex-shrink:0}
.fi-hs-val{font-family:var(--f-display);font-size:2.2rem;font-weight:300;letter-spacing:-.04em;color:var(--ink);line-height:1}
.fi-hs-label{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
.fi-hs-sub{font-family:var(--f-mono);font-size:.5rem;color:var(--green);letter-spacing:.05em;display:flex;align-items:center;gap:4px;margin-top:2px}

/* ── XP / LEVEL HERO CARD (replaces original fi-level-card, class kept for compat) ── */
.fi-level-card{
  background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--gold) 8%,var(--surface)));
  border:1px solid rgba(196,145,58,.28);border-radius:var(--r);
  padding:28px 28px 22px;margin-bottom:32px;
  display:grid;grid-template-columns:auto 1fr auto auto auto;
  align-items:center;gap:28px;flex-wrap:wrap;
  position:relative;overflow:hidden;
}
.fi-level-card::after{content:'◈';position:absolute;right:20px;bottom:-20px;font-size:9rem;color:var(--gold);opacity:.04;font-family:var(--f-display);line-height:1;pointer-events:none}
.dark .fi-level-card{background:linear-gradient(135deg,#131210,#1a1508)}
@media(max-width:900px){.fi-level-card{grid-template-columns:auto 1fr;row-gap:16px}}
@media(max-width:480px){.fi-level-card{grid-template-columns:1fr}}

/* Level orb — larger */
.fi-level-orb{
  width:72px;height:72px;border-radius:50%;
  border:2px solid var(--gold);background:var(--gold3);
  display:grid;place-items:center;flex-shrink:0;position:relative;
  box-shadow:0 0 28px rgba(196,145,58,.2);
}
.fi-level-orb::after{content:'';position:absolute;inset:-7px;border-radius:50%;border:1px dashed rgba(196,145,58,.3);animation:slow-spin 12s linear infinite}
@keyframes slow-spin{to{transform:rotate(360deg)}}
.fi-level-num{font-family:var(--f-display);font-size:2rem;font-weight:600;color:var(--gold);line-height:1}

/* Level info (wider XP bar) */
.fi-level-info{flex:1;min-width:200px}
.fi-level-title{font-family:var(--f-display);font-size:1.35rem;font-weight:300;color:var(--ink);margin-bottom:3px}
.fi-level-title em{font-style:italic;color:var(--gold)}
.fi-level-sub{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:10px}
.fi-xp-bar-track{height:8px;background:var(--border);border-radius:4px;overflow:hidden}
.fi-xp-bar-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:4px;transition:width 1.4s var(--ease);position:relative}
.fi-xp-bar-fill::after{content:'';position:absolute;top:0;right:0;bottom:0;width:8px;background:rgba(255,255,255,.35);border-radius:4px;filter:blur(1px)}
.fi-xp-bar-label{font-family:var(--f-mono);font-size:.54rem;color:var(--ink3);margin-top:7px;letter-spacing:.06em;display:flex;justify-content:space-between}

/* Stat chips — bigger */
.fi-streak-chip{display:flex;flex-direction:column;align-items:center;gap:5px;padding:14px 22px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;min-width:90px;text-align:center}
.fi-streak-num{font-family:var(--f-display);font-size:2rem;font-weight:300;color:var(--gold);line-height:1}
.fi-streak-label{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}

/* ══ All original fi-* classes below — UNCHANGED ══ */
.fi-wrap{max-width:1200px;margin:0 auto;padding:40px 28px 100px;position:relative;z-index:2}
@media(max-width:768px){.fi-wrap{padding:24px 14px 80px}}
.fi-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px}
.fi-section-eyebrow{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:7px}
.fi-section-eyebrow::before{content:'';display:block;width:18px;height:1px;background:currentColor;opacity:.5}
.fi-section-title{font-family:var(--f-display);font-size:1.7rem;font-weight:300;letter-spacing:-.02em;color:var(--ink)}
.fi-section-title em{font-style:italic;color:var(--gold)}
.fi-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;transition:background .35s,border-color .35s,box-shadow .2s}
.fi-card:hover{box-shadow:var(--shadow-md)}
.fi-card-head{padding:14px 20px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px}
.fi-card-label{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:6px}
.fi-card-body{padding:20px}
.fi-stat-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:32px}
@media(max-width:1100px){.fi-stat-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:640px){.fi-stat-grid{grid-template-columns:repeat(2,1fr)}}
.fi-stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;position:relative;overflow:hidden;transition:all .25s var(--ease);cursor:default}
.fi-stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent,var(--gold));opacity:.7}
.fi-stat-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:var(--accent,var(--gold))}
.fi-stat-card-icon{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;margin-bottom:12px;background:color-mix(in srgb,var(--accent,var(--gold)) 12%,transparent);color:var(--accent,var(--gold))}
.fi-stat-label{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:5px}
.fi-stat-value{font-family:var(--f-display);font-size:1.9rem;font-weight:300;letter-spacing:-.03em;color:var(--ink);line-height:1}
.fi-stat-delta{font-family:var(--f-mono);font-size:.54rem;color:var(--ink3);margin-top:5px;display:flex;align-items:center;gap:3px}
.fi-stat-delta.up{color:var(--green)}
.fi-stat-bg-glyph{position:absolute;right:10px;bottom:-12px;font-size:5rem;opacity:.04;font-family:var(--f-display);pointer-events:none;line-height:1}
.fi-heatmap{display:flex;gap:3px;overflow-x:auto;padding-bottom:4px}
.fi-hm-week{display:flex;flex-direction:column;gap:3px}
.fi-hm-cell{width:12px;height:12px;border-radius:2px;cursor:default;transition:transform .15s;flex-shrink:0}
.fi-hm-cell:hover{transform:scale(1.4)}
.fi-hm-cell.l0{background:var(--border)}.fi-hm-cell.l1{background:color-mix(in srgb,var(--gold) 30%,var(--border))}.fi-hm-cell.l2{background:color-mix(in srgb,var(--gold) 55%,var(--border))}.fi-hm-cell.l3{background:color-mix(in srgb,var(--gold) 78%,var(--border))}.fi-hm-cell.l4{background:var(--gold);box-shadow:0 0 5px rgba(196,145,58,.4)}
.fi-hm-label{font-family:var(--f-mono);font-size:.5rem;color:var(--ink3);letter-spacing:.06em}
.fi-weekly-grid{display:flex;align-items:flex-end;gap:8px;height:100px}
.fi-weekly-col{display:flex;flex-direction:column;align-items:center;gap:5px;flex:1}
.fi-weekly-bar-wrap{flex:1;display:flex;align-items:flex-end;width:100%}
.fi-weekly-bar{width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,var(--gold),color-mix(in srgb,var(--gold) 60%,var(--border)));transition:height 1s var(--ease);min-height:2px}
.fi-weekly-bar:hover{background:var(--gold2)}
.fi-weekly-bar.today{background:linear-gradient(180deg,var(--green),color-mix(in srgb,var(--green) 60%,var(--border)))}
.fi-weekly-day{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
.fi-weekly-day.today{color:var(--green)}
.fi-weekly-mins{font-family:var(--f-mono);font-size:.48rem;color:var(--ink3);white-space:nowrap}
.fi-timeline-wrap{display:flex;flex-direction:column;gap:10px}
.fi-timeline-row{display:flex;align-items:center;gap:12px}
.fi-timeline-date{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.06em;color:var(--ink3);width:72px;flex-shrink:0}
.fi-timeline-bar{flex:1;height:10px;background:var(--border);border-radius:20px;overflow:hidden;display:flex;gap:1px}
.fi-timeline-seg{height:100%;border-radius:2px;transition:width 1s var(--ease)}
.fi-timeline-total{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);width:36px;text-align:right;flex-shrink:0}
.fi-donut-wrap{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.fi-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.fi-donut-pct{font-family:var(--f-display);font-size:1.5rem;font-weight:300;color:var(--gold)}
.fi-donut-sub{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);letter-spacing:.1em;text-transform:uppercase}
.fi-donut-legend{display:flex;flex-direction:column;gap:10px}
.fi-legend-row{display:flex;align-items:center;gap:8px;font-family:var(--f-mono);font-size:.58rem;color:var(--ink2)}
.fi-legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.fi-breakdown-list{display:flex;flex-direction:column;gap:14px}
.fi-breakdown-row{}
.fi-breakdown-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
.fi-breakdown-label{font-family:var(--f-ui);font-size:.8rem;font-weight:600;color:var(--ink)}
.fi-breakdown-val{font-family:var(--f-mono);font-size:.6rem;color:var(--ink3)}
.fi-breakdown-track{height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.fi-breakdown-fill{height:100%;border-radius:3px;transition:width 1.1s var(--ease)}
.fi-sessions-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
@media(max-width:640px){.fi-sessions-grid{grid-template-columns:1fr}}
.fi-session-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;transition:all .25s var(--ease);position:relative}
.fi-session-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:var(--border2)}
.fi-session-card-top{padding:16px 18px 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.fi-session-card-title{font-family:var(--f-ui);font-size:.88rem;font-weight:700;color:var(--ink);line-height:1.3}
.fi-session-card-subject{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.08em;color:var(--ink3);margin-top:3px}
.fi-score-badge{display:flex;flex-direction:column;align-items:center;gap:1px;flex-shrink:0;padding:6px 10px;border-radius:8px;background:var(--surface2);border:1px solid var(--border)}
.fi-score-num{font-family:var(--f-display);font-size:1.2rem;font-weight:300;line-height:1}
.fi-score-label{font-family:var(--f-mono);font-size:.44rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.fi-session-card-meta{padding:0 18px 14px;display:flex;gap:8px;flex-wrap:wrap}
.fi-meta-chip{display:inline-flex;align-items:center;gap:4px;font-family:var(--f-mono);font-size:.52rem;letter-spacing:.07em;padding:3px 8px;border-radius:20px;background:var(--surface2);border:1px solid var(--border);color:var(--ink3)}
.fi-session-card-bar{height:3px;background:var(--border);display:flex}
.fi-session-bar-fill{height:100%;transition:width .8s var(--ease)}
.fi-session-card-footer{padding:12px 18px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.fi-session-date{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);letter-spacing:.06em}
.fi-session-actions{display:flex;gap:6px}
.fi-session-action{width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s}
.fi-session-action:hover{border-color:var(--gold);color:var(--gold)}
.fi-edit-overlay{position:absolute;inset:0;background:var(--surface);border-radius:var(--r);padding:16px;display:flex;flex-direction:column;gap:10px;z-index:10;animation:fade-in .2s ease}
@keyframes fade-in{from{opacity:0}to{opacity:1}}
.fi-edit-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 12px;font-family:var(--f-ui);font-size:.85rem;color:var(--ink);outline:none;transition:border-color .2s}
.fi-edit-input:focus{border-color:var(--gold)}
.fi-edit-label{font-family:var(--f-mono);font-size:.53rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:3px}
.fi-edit-actions{display:flex;gap:7px;margin-top:4px}
.fi-filter-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.fi-filter-btn{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;padding:5px 13px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--ink3);cursor:pointer;transition:all .15s}
.fi-filter-btn:hover{border-color:var(--gold);color:var(--gold)}
.fi-filter-btn.active{background:var(--gold3);border-color:var(--gold);color:var(--gold)}
.fi-sort-select{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.08em;padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:var(--surface);color:var(--ink3);cursor:pointer;outline:none;appearance:none;padding-right:24px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239c9283' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.fi-today-panel{background:linear-gradient(135deg,color-mix(in srgb,var(--green) 8%,var(--surface)),var(--surface));border:1px solid rgba(107,140,107,.3);border-radius:var(--r);padding:20px 24px;margin-bottom:32px}
.dark .fi-today-panel{background:linear-gradient(135deg,rgba(107,140,107,.08),#131210)}
.fi-today-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap}
.fi-today-title{font-family:var(--f-display);font-size:1.2rem;font-weight:300;color:var(--ink)}
.fi-today-title em{font-style:italic;color:var(--green)}
.fi-today-sessions{display:flex;gap:10px;flex-wrap:wrap}
.fi-today-chip{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);font-family:var(--f-ui);font-size:.78rem;color:var(--ink);transition:all .18s;cursor:pointer}
.fi-today-chip:hover{border-color:var(--green)}
.fi-today-chip.active{border-color:var(--green);background:var(--green2)}
.fi-today-chip-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse-dot 2s ease-in-out infinite}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.fi-btn{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;padding:9px 16px;border-radius:7px;border:none;cursor:pointer;transition:all .22s var(--spring);white-space:nowrap}
.fi-btn:disabled{opacity:.4;cursor:not-allowed}
.fi-btn-gold{background:var(--gold);color:#fff}
.dark .fi-btn-gold{color:#0c0b09}
.fi-btn-gold:hover:not(:disabled){background:var(--gold2);transform:translateY(-1px);box-shadow:0 4px 14px rgba(196,145,58,.3)}
.fi-btn-outline{background:transparent;border:1px solid var(--border2);color:var(--ink2)}
.fi-btn-outline:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}
.fi-btn-ghost{background:transparent;border:none;color:var(--ink3);padding:7px 10px}
.fi-btn-ghost:hover{color:var(--ink)}
.fi-btn-sm{padding:5px 10px;font-size:.54rem}
.fi-loading{min-height:100vh;display:grid;place-items:center;background:var(--bg)}
.fi-loading-glyph{font-family:var(--f-display);font-size:3rem;color:var(--gold);animation:slow-spin 4s linear infinite;display:inline-block}
.fi-loading-text{font-family:var(--f-mono);font-size:.65rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-top:14px}
.fi-two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:28px}
@media(max-width:900px){.fi-two-col{grid-template-columns:1fr}}
.fi-empty{padding:48px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
.fi-empty-icon{width:56px;height:56px;border-radius:50%;background:var(--surface2);border:1.5px dashed var(--border);display:grid;place-items:center;color:var(--ink3)}
.fi-empty-title{font-family:var(--f-display);font-size:1.2rem;font-weight:300;color:var(--ink2)}
.fi-empty-sub{font-family:var(--f-mono);font-size:.58rem;color:var(--ink3);letter-spacing:.06em;max-width:260px;line-height:1.65}
@keyframes fi-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.fi-a1{animation:fi-up .55s .03s var(--ease) both}
.fi-a2{animation:fi-up .55s .09s var(--ease) both}
.fi-a3{animation:fi-up .55s .15s var(--ease) both}
.fi-a4{animation:fi-up .55s .21s var(--ease) both}
.fi-a5{animation:fi-up .55s .27s var(--ease) both}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}

/* ── ACHIEVEMENT CSS (unchanged) ── */
.rarity-common    {--rc:#9c9283;--rg:rgba(156,146,131,.22);--rr:#9c9283}
.rarity-rare      {--rc:#5b8fa8;--rg:rgba(91,143,168,.28);--rr:#5b8fa8}
.rarity-epic      {--rc:#9b6bae;--rg:rgba(155,107,174,.32);--rr:#9b6bae}
.rarity-legendary {--rc:#c9a84c;--rg:rgba(201,168,76,.38);--rr:#c9a84c}
.ach-mini{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 8px;border-radius:10px;border:1px solid var(--border);background:var(--surface);text-align:center;transition:all .22s var(--spring);position:relative;cursor:default}
.ach-mini.earned{border-color:var(--rr,var(--gold));background:color-mix(in srgb,var(--rc,var(--gold)) 7%,var(--surface));box-shadow:0 0 14px var(--rg,rgba(196,145,58,.15))}
.ach-mini.earned:hover{transform:translateY(-4px) scale(1.05);box-shadow:0 8px 24px var(--rg,rgba(196,145,58,.25))}
.ach-mini.locked{opacity:.42;filter:grayscale(.75)}
.ach-mini.locked:hover{opacity:.6}
.ach-mini-icon{font-size:1.7rem;line-height:1}
.ach-mini-label{font-family:var(--f-mono);font-size:.47rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3);line-height:1.4}
.ach-mini.earned .ach-mini-label{color:var(--rc,var(--gold))}
.ach-mini-rarity{font-size:.39rem;font-family:var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--rc,var(--ink3));opacity:.75}
.ach-view-all-btn{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;border-radius:7px;border:1px solid var(--border2);background:transparent;color:var(--ink2);cursor:pointer;transition:all .22s var(--spring)}
.ach-view-all-btn:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3);transform:translateY(-1px);box-shadow:0 4px 14px rgba(196,145,58,.15)}
.ach-backdrop{position:fixed;inset:0;z-index:9000;background:rgba(20,17,12,.72);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);display:flex;align-items:flex-start;justify-content:center;padding:32px 20px;animation:ach-bd-in .3s var(--ease) both;overflow-y:auto}
.dark .ach-backdrop{background:rgba(8,7,5,.85)}
@keyframes ach-bd-in{from{opacity:0}to{opacity:1}}
.ach-panel{width:100%;max-width:960px;background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.18);animation:ach-panel-in .4s var(--ease) both;position:relative;flex-shrink:0}
.dark .ach-panel{box-shadow:0 40px 120px rgba(0,0,0,.65)}
@keyframes ach-panel-in{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:none}}
.ach-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),var(--purple),transparent);opacity:.5;z-index:1}
.ach-panel-hd{padding:28px 32px 20px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--gold) 4%,var(--surface));position:relative;overflow:hidden}
.dark .ach-panel-hd{background:color-mix(in srgb,var(--gold) 3%,var(--surface))}
.ach-panel-hd::after{content:'✦';position:absolute;right:32px;top:50%;transform:translateY(-50%);font-size:8rem;color:var(--gold);opacity:.04;font-family:var(--f-display);line-height:1;pointer-events:none}
.ach-panel-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.ach-panel-title{font-family:var(--f-display);font-size:2.1rem;font-weight:300;letter-spacing:-.02em;color:var(--ink)}
.ach-panel-title em{font-style:italic;color:var(--gold)}
.ach-panel-sub{font-family:var(--f-mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-top:6px}
.ach-close-btn{width:36px;height:36px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .2s;flex-shrink:0;margin-top:2px}
.ach-close-btn:hover{border-color:var(--red);color:var(--red);transform:rotate(90deg)}
.ach-summary{display:flex;gap:20px;flex-wrap:wrap;padding:14px 32px;border-bottom:1px solid var(--border);background:var(--surface2)}
.ach-sum-item{display:flex;flex-direction:column;gap:2px}
.ach-sum-val{font-family:var(--f-display);font-size:1.4rem;font-weight:300;color:var(--ink);line-height:1}
.ach-sum-lbl{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.ach-overall-wrap{flex:1;min-width:160px;display:flex;flex-direction:column;justify-content:flex-end;gap:5px}
.ach-overall-track{height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.ach-overall-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:3px;transition:width 1s var(--ease)}
.ach-controls{display:flex;align-items:center;gap:10px;padding:12px 32px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.ach-tabs{display:flex;gap:4px}
.ach-tab{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.08em;text-transform:uppercase;padding:5px 13px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--ink3);cursor:pointer;transition:all .15s}
.ach-tab:hover{border-color:var(--gold);color:var(--gold)}
.ach-tab.on{background:var(--gold3);border-color:var(--gold);color:var(--gold)}
.ach-cat-pills{display:flex;gap:4px;flex-wrap:wrap;flex:1}
.ach-cat-pill{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.06em;padding:3px 9px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--ink3);cursor:pointer;transition:all .15s}
.ach-cat-pill:hover{background:var(--surface2);color:var(--ink);border-color:var(--border2)}
.ach-cat-pill.on{background:var(--surface3);color:var(--ink);border-color:var(--border2)}
.ach-sort-sel{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.06em;padding:5px 24px 5px 10px;border-radius:20px;border:1px solid var(--border2);background:var(--surface2);color:var(--ink3);cursor:pointer;outline:none;appearance:none;margin-left:auto;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239c9283' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.ach-panel-body{padding:24px 32px;max-height:58vh;overflow-y:auto}
.ach-cat-section{margin-bottom:28px}
.ach-cat-label{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.ach-cat-label::before{content:'';display:block;width:14px;height:1px;background:currentColor;opacity:.5}
.ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
@media(max-width:640px){.ach-grid{grid-template-columns:1fr}}
.ach-card{border-radius:12px;border:1px solid var(--border);background:var(--surface);overflow:visible;transition:all .25s var(--ease);position:relative}
.ach-card.earned{border-color:var(--rr,var(--gold));background:color-mix(in srgb,var(--rc,var(--gold)) 5%,var(--surface))}
.ach-card.earned:hover{transform:translateY(-4px) scale(1.015);box-shadow:0 12px 36px var(--rg,rgba(196,145,58,.28))}
.ach-card.locked{opacity:.52}
.ach-card.locked:hover{opacity:.72;transform:translateY(-2px)}
.ach-card.earned::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 50%);pointer-events:none;border-radius:12px}
.ach-card-inner{padding:14px 16px}
.ach-card-top{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
.ach-card-icon{width:42px;height:42px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);display:grid;place-items:center;flex-shrink:0;font-size:1.4rem;line-height:1;transition:transform .2s var(--spring)}
.ach-card.earned .ach-card-icon{background:color-mix(in srgb,var(--rc,var(--gold)) 15%,var(--surface2));border-color:var(--rr,var(--gold));box-shadow:0 0 12px var(--rg,rgba(196,145,58,.2))}
.ach-card.earned:hover .ach-card-icon{transform:scale(1.1) rotate(-4deg)}
.ach-card-meta{flex:1;min-width:0}
.ach-card-title{font-family:var(--f-ui);font-size:.86rem;font-weight:700;color:var(--ink);line-height:1.2}
.ach-card.locked .ach-card-title{color:var(--ink2)}
.ach-card-desc{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.03em;color:var(--ink3);margin-top:3px;line-height:1.5}
.ach-rarity-tag{font-family:var(--f-mono);font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:20px;border:1px solid var(--rr,var(--border));color:var(--rc,var(--ink3));background:color-mix(in srgb,var(--rc,var(--ink3)) 8%,transparent);align-self:flex-start;white-space:nowrap;flex-shrink:0}
.ach-prog-wrap{margin-top:10px}
.ach-prog-hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
.ach-prog-lbl{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.06em;color:var(--ink3)}
.ach-prog-nums{font-family:var(--f-mono);font-size:.52rem;font-weight:500;color:var(--rc,var(--gold))}
.ach-prog-track{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.ach-prog-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--rc,var(--gold)),color-mix(in srgb,var(--rc,var(--gold)) 70%,white));transition:width 1.1s var(--ease);position:relative}
.ach-prog-fill::after{content:'';position:absolute;top:0;right:0;bottom:0;width:5px;background:rgba(255,255,255,.35);border-radius:3px;filter:blur(1px)}
.ach-earned-stamp{display:flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.5rem;letter-spacing:.06em;text-transform:uppercase;color:var(--rc,var(--green));padding:4px 8px;border-radius:5px;background:color-mix(in srgb,var(--rc,var(--green)) 10%,transparent);border:1px solid color-mix(in srgb,var(--rc,var(--green)) 28%,transparent);margin-top:8px;width:fit-content}
.ach-lock{position:absolute;top:9px;right:9px;color:var(--ink3);opacity:.38}
.ach-info-btn{position:absolute;bottom:9px;right:9px;width:20px;height:20px;border-radius:50%;background:var(--surface3);border:1px solid var(--border);color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s;z-index:5}
.ach-info-btn:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3)}
.ach-popover{position:absolute;bottom:32px;right:6px;background:var(--ink);color:var(--surface);border-radius:9px;padding:10px 13px;font-family:var(--f-mono);font-size:.54rem;line-height:1.65;letter-spacing:.03em;max-width:200px;z-index:30;box-shadow:0 8px 28px rgba(0,0,0,.28);animation:ach-pop .15s var(--ease)}
.dark .ach-popover{background:var(--surface3);color:var(--ink);border:1px solid var(--border2)}
@keyframes ach-pop{from{opacity:0;transform:scale(.9) translateY(4px)}to{opacity:1;transform:none}}
.ach-popover::after{content:'';position:absolute;bottom:-6px;right:12px;width:12px;height:12px;background:var(--ink);clip-path:polygon(0 0,100% 0,50% 100%)}
.dark .ach-popover::after{background:var(--surface3)}
@keyframes ach-unlock{0%{transform:scale(1)}20%{transform:scale(1.2)}40%{transform:scale(.96)}60%{transform:scale(1.07)}80%{transform:scale(.99)}100%{transform:scale(1)}}
.ach-unlocking{animation:ach-unlock .6s var(--spring)}
`;

/* ═══════════════════════════════════════════════════════════════
   ACHIEVEMENT COMPONENTS  (unchanged)
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
          <div className="ach-card-meta">
            <div className="ach-card-title">{a.label}</div>
            <div className="ach-card-desc">{a.desc}</div>
          </div>
          <div className="ach-rarity-tag">{a.rarity.label}</div>
        </div>
        {a.earned ? (
          <div className="ach-earned-stamp">
            <CheckCircle2 size={10} /> Unlocked
          </div>
        ) : (
          <div className="ach-prog-wrap">
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
            onClick={(e) => {
              e.stopPropagation();
              setInfo((v) => !v);
            }}
          >
            <Info size={10} />
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

const OVERLAY_CATS = [
  'All',
  'First Steps',
  'Sessions',
  'Streaks',
  'Focus Time',
  'Difficulty',
  'AI Mastery',
  'Subjects',
  'XP & Levels',
  'Consistency',
  'Mastery',
  'Special',
];

function AchievementsOverlay({ achievements, onClose, isDark }) {
  const [tab, setTab] = useState('all');
  const [cat, setCat] = useState('All');
  const [sort, setSort] = useState('default');
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const earned = achievements.filter((a) => a.earned).length,
    total = achievements.length,
    pct = Math.round((earned / total) * 100);
  const filtered = useMemo(() => {
    let list = [...achievements];
    if (tab === 'earned') list = list.filter((a) => a.earned);
    if (tab === 'locked') list = list.filter((a) => !a.earned);
    if (cat !== 'All') list = list.filter((a) => a.category === cat);
    const ro = [RARITY.LEGENDARY, RARITY.EPIC, RARITY.RARE, RARITY.COMMON];
    if (sort === 'progress')
      list.sort(
        (a, b) =>
          (b.max > 0 ? b.progressVal / b.max : 0) -
          (a.max > 0 ? a.progressVal / a.max : 0),
      );
    if (sort === 'rarity')
      list.sort((a, b) => ro.indexOf(a.rarity) - ro.indexOf(b.rarity));
    if (sort === 'earned') list.sort((a, b) => b.earned - a.earned);
    return list;
  }, [achievements, tab, cat, sort]);
  const grouped = useMemo(() => {
    if (cat !== 'All') return { [cat]: filtered };
    const g = {};
    filtered.forEach((a) => {
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    });
    return g;
  }, [filtered, cat]);
  return (
    <div
      className={`ach-backdrop${isDark ? ' dark' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ach-panel">
        <div className="ach-panel-hd">
          <div className="ach-panel-title-row">
            <div>
              <div className="ach-panel-title">
                All <em>Achievements</em>
              </div>
              <div className="ach-panel-sub">
                {earned} unlocked · {total - earned} remaining · {total} total
              </div>
            </div>
            <button className="ach-close-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="ach-summary">
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
                fontSize: '.5rem',
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
          <div className="ach-cat-pills">
            {OVERLAY_CATS.map((c) => (
              <button
                key={c}
                className={`ach-cat-pill${cat === c ? ' on' : ''}`}
                onClick={() => setCat(c)}
              >
                {c}
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
              {cat === 'All' && <div className="ach-cat-label">{name}</div>}
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
                fontSize: '.62rem',
                color: 'var(--ink3)',
                letterSpacing: '.1em',
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

function MiniBadge({ a }) {
  const rc = rarityClass(a.rarity);
  return (
    <div
      className={`ach-mini ${a.earned ? 'earned' : 'locked'} ${rc}`}
      title={a.desc}
    >
      <div className="ach-mini-icon">{a.icon}</div>
      <div className="ach-mini-label">{a.label}</div>
      <div className="ach-mini-rarity">{a.rarity.label}</div>
    </div>
  );
}

function AchievementsCard({ achievements, isDark }) {
  const [open, setOpen] = useState(false);
  const earned = achievements.filter((a) => a.earned).length,
    total = achievements.length,
    pct = Math.round((earned / total) * 100);
  const preview = useMemo(() => {
    const ro = [RARITY.LEGENDARY, RARITY.EPIC, RARITY.RARE, RARITY.COMMON];
    return [...achievements]
      .sort((a, b) => {
        if (a.earned !== b.earned) return b.earned - a.earned;
        return ro.indexOf(a.rarity) - ro.indexOf(b.rarity);
      })
      .slice(0, 20);
  }, [achievements]);
  return (
    <>
      <div className="fi-card">
        <div className="fi-card-head">
          <span className="fi-card-label">
            <Award size={11} /> Achievements &amp; Badges
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--f-mono)',
                fontSize: '.52rem',
                color: 'var(--ink3)',
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 4,
                  background: 'var(--border)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background:
                      'linear-gradient(90deg,var(--gold),var(--gold2))',
                    borderRadius: 2,
                    transition: 'width 1s var(--ease)',
                  }}
                />
              </div>
              {earned}/{total}
            </div>
            <span
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: '.52rem',
                color: 'var(--ink3)',
              }}
            >
              {pct}% complete
            </span>
          </div>
        </div>
        <div className="fi-card-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(86px,1fr))',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {preview.map((a) => (
              <MiniBadge key={a.id} a={a} />
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
                fontSize: '.54rem',
                color: 'var(--ink3)',
                letterSpacing: '.05em',
              }}
            >
              Showing 20 of {total} · {total - earned} locked
            </span>
            <button className="ach-view-all-btn" onClick={() => setOpen(true)}>
              <Trophy size={12} /> View All Achievements{' '}
              <ArrowUpRight size={11} />
            </button>
          </div>
        </div>
      </div>
      {open &&
        createPortal(
          <AchievementsOverlay
            achievements={achievements}
            onClose={() => setOpen(false)}
            isDark={isDark}
          />,
          document.body,
        )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXISTING SUB-COMPONENTS  (100% unchanged)
═══════════════════════════════════════════════════════════════ */
function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  accent,
  glyph,
  delay = 0,
}) {
  return (
    <div
      className="fi-stat-card"
      style={{ '--accent': accent, animationDelay: `${delay}ms` }}
    >
      <div className="fi-stat-card-icon">
        <Icon size={16} strokeWidth={1.8} />
      </div>
      <div className="fi-stat-label">{label}</div>
      <div className="fi-stat-value">{value}</div>
      {delta && (
        <div className={`fi-stat-delta ${delta.up ? 'up' : ''}`}>
          {delta.up ? <ArrowUpRight size={10} /> : <Minus size={10} />}
          {delta.text}
        </div>
      )}
      {glyph && <div className="fi-stat-bg-glyph">{glyph}</div>}
    </div>
  );
}
function WeeklyChart({ data }) {
  const max = Math.max(...data.map((d) => d.mins), 1),
    todayK = todayISO();
  return (
    <div className="fi-weekly-grid">
      {data.map((d) => (
        <div key={d.date} className="fi-weekly-col">
          <div className="fi-weekly-bar-wrap">
            <div
              className={`fi-weekly-bar${d.date === todayK ? ' today' : ''}`}
              style={{ height: `${Math.max(2, (d.mins / max) * 80)}px` }}
              title={`${d.mins}m`}
            />
          </div>
          <div className={`fi-weekly-day${d.date === todayK ? ' today' : ''}`}>
            {d.day}
          </div>
          <div className="fi-weekly-mins">{d.mins > 0 ? `${d.mins}m` : ''}</div>
        </div>
      ))}
    </div>
  );
}
function Heatmap({ weeks }) {
  return (
    <div>
      <div className="fi-heatmap">
        {weeks.map((wk, wi) => (
          <div key={wi} className="fi-hm-week">
            {wk.map((c, di) => (
              <div
                key={di}
                className={`fi-hm-cell l${c.level}`}
                title={`${c.date}: ${c.mins}m`}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}
      >
        <span className="fi-hm-label">Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <div
            key={l}
            className={`fi-hm-cell l${l}`}
            style={{ flexShrink: 0 }}
          />
        ))}
        <span className="fi-hm-label">More</span>
      </div>
    </div>
  );
}
function Timeline({ sessions }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const byDay = {};
  sessions.forEach((s) => {
    const k = new Date(s.created_at).toISOString().slice(0, 10);
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(s);
  });
  const maxM = Math.max(
    ...days.map((d) =>
      (byDay[d] || []).reduce((a, s) => a + (s.duration || 0), 0),
    ),
    1,
  );
  return (
    <div className="fi-timeline-wrap">
      {days.map((day) => {
        const ds = byDay[day] || [],
          tm = ds.reduce((a, s) => a + (s.duration || 0), 0),
          pct = (tm / maxM) * 100;
        return (
          <div key={day} className="fi-timeline-row">
            <div className="fi-timeline-date">
              {new Date(day + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div className="fi-timeline-bar">
              {ds.map((s, i) => {
                const w = tm > 0 ? ((s.duration || 0) / tm) * pct : 0;
                return (
                  <div
                    key={s.id}
                    className="fi-timeline-seg"
                    style={{
                      width: `${w}%`,
                      background: focusColor(s.focus_type),
                      opacity: s.completed ? 1 : 0.6,
                    }}
                    title={`${s.title} — ${s.duration}m`}
                  />
                );
              })}
            </div>
            <div className="fi-timeline-total">{tm > 0 ? `${tm}m` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}
function Donut({ pct, size = 110, stroke = 12 }) {
  const r = (size - stroke) / 2,
    circ = 2 * Math.PI * r,
    offset = circ * (1 - pct / 100);
  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={
            pct >= 75
              ? 'var(--green)'
              : pct >= 50
                ? 'var(--gold)'
                : 'var(--red)'
          }
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s var(--ease)' }}
        />
      </svg>
      <div className="fi-donut-center">
        <div className="fi-donut-pct">{pct}%</div>
        <div className="fi-donut-sub">Score</div>
      </div>
    </div>
  );
}
function SessionCard({ session, onEdit, onNavigate }) {
  const score = calcFocusScore(session),
    sc = scoreColor(score),
    fc = focusColor(session.focus_type),
    dc = DIFF_COLOR[session.difficulty] || 'var(--ink3)';
  const [editing, setEditing] = useState(false),
    [editTitle, setEditTitle] = useState(session.title),
    [editType, setEditType] = useState(session.focus_type || '');
  const save = () => {
    onEdit(session.id, { title: editTitle, focus_type: editType });
    setEditing(false);
  };
  const cancel = () => {
    setEditTitle(session.title);
    setEditType(session.focus_type || '');
    setEditing(false);
  };
  return (
    <div className="fi-session-card">
      {editing && (
        <div className="fi-edit-overlay">
          <div>
            <div className="fi-edit-label">Title</div>
            <input
              className="fi-edit-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <div className="fi-edit-label">Focus Type</div>
            <input
              className="fi-edit-input"
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              placeholder="e.g. Deep Work"
            />
          </div>
          <div className="fi-edit-actions">
            <button className="fi-btn fi-btn-ghost fi-btn-sm" onClick={cancel}>
              <X size={11} /> Cancel
            </button>
            <button className="fi-btn fi-btn-gold fi-btn-sm" onClick={save}>
              <Check size={11} /> Save
            </button>
          </div>
        </div>
      )}
      <div className="fi-session-card-bar">
        <div
          className="fi-session-bar-fill"
          style={{ width: `${score}%`, background: sc }}
        />
      </div>
      <div className="fi-session-card-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fi-session-card-title">{session.title}</div>
          {session.subject && (
            <div className="fi-session-card-subject">{session.subject}</div>
          )}
        </div>
        <div className="fi-score-badge">
          <div className="fi-score-num" style={{ color: sc }}>
            {score}
          </div>
          <div className="fi-score-label">Score</div>
        </div>
      </div>
      <div className="fi-session-card-meta">
        <span className="fi-meta-chip">
          <Clock size={9} />
          {fmtMins(session.duration)}
        </span>
        {session.focus_type && (
          <span
            className="fi-meta-chip"
            style={{ borderColor: `${fc}40`, color: fc }}
          >
            {session.focus_type}
          </span>
        )}
        {session.difficulty && (
          <span className="fi-meta-chip" style={{ color: dc }}>
            {capFirst(session.difficulty)}
          </span>
        )}
        {(session.completed || session.is_completed) && (
          <span
            className="fi-meta-chip"
            style={{
              color: 'var(--green)',
              borderColor: 'rgba(107,140,107,.3)',
            }}
          >
            <CheckCircle2 size={9} /> Done
          </span>
        )}
        {session.ai_plan?.steps?.length > 0 && (
          <span className="fi-meta-chip">
            <Brain size={9} />
            {session.ai_plan.steps.length} steps
          </span>
        )}
      </div>
      <div className="fi-session-card-footer">
        <div className="fi-session-date">{dateStr(session.created_at)}</div>
        <div className="fi-session-actions">
          <button
            className="fi-session-action"
            onClick={() => setEditing(true)}
            title="Edit"
          >
            <Edit2 size={11} />
          </button>
          <button
            className="fi-session-action"
            onClick={() => onNavigate(session.id)}
            title="Open"
          >
            <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function FocusInsights() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { supabase, loading: sbLoading } = useSupabase();
  const { theme, toggleTheme } = useTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const isDark = theme === 'dark';
  const [gems, setGems] = useState(0);

  const [equippedBadge, setEquippedBadge] = useState(null);

  // Load equipped badge
  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from('user_badges')
      .select('badge_id, is_equipped')
      .eq('user_id', user.id)
      .eq('is_equipped', true)
      .single()
      .then(({ data }) => {
        if (data) setEquippedBadge(data.badge_id);
      });
  }, [supabase, user]);

  // Resolve badge icon from catalogue
  const equippedBadgeIcon = useMemo(
    () => BADGE_CATALOGUE.find((b) => b.id === equippedBadge)?.icon ?? null,
    [equippedBadge],
  );

  // // Level-up gem rewards
  // const { pendingLevelUp, clearLevelUp } = useLevelUp({
  //   currentLevel: lvl,
  //   supabase,
  //   userId: user?.id,
  //   onGemsChange: setGems,
  // });

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });
      setSessions(s || []);
      setLoading(false);
    })();
  }, [supabase]);

  const handleEdit = useCallback(
    async (id, updates) => {
      if (!supabase) return;
      await supabase
        .from('sessions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      );
    },
    [supabase],
  );

  const stats = useMemo(() => {
    if (!sessions.length)
      return {
        total: 0,
        totalMins: 0,
        avgMins: 0,
        completed: 0,
        efficiency: 0,
        streak: 0,
        totalXP: 0,
        level: 1,
        weeklyData: buildWeekly([]),
        heatmapWeeks: buildHeatmap([]),
        focusTypeBreakdown: [],
        subjectBreakdown: [],
        achievements: [],
        todaySessions: [],
        weekMins: 0,
      };
    const total = sessions.length;
    const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);
    const avgMins = Math.round(totalMins / total);
    const completed = sessions.filter(
      (s) => s.completed || s.is_completed,
    ).length;
    const efficiency = Math.round((completed / total) * 100);
    const streak = calcStreakFromSessions(sessions);
    const { totalXP, weeklyXP } = computeXPFromSessions(sessions);
    const level = sharedXpToLevel(totalXP);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekMins = sessions
      .filter((s) => new Date(s.created_at) >= weekStart)
      .reduce((a, s) => a + (s.duration || 0), 0);
    const todayK = todayISO();
    const todaySessions = sessions.filter(
      (s) => new Date(s.created_at).toISOString().slice(0, 10) === todayK,
    );
    const ftMap = {};
    sessions.forEach((s) => {
      const k = s.focus_type || 'General';
      ftMap[k] = (ftMap[k] || 0) + (s.duration || 0);
    });
    const focusTypeBreakdown = Object.entries(ftMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, mins]) => ({
        name,
        mins,
        pct: Math.round((mins / totalMins) * 100),
      }));
    const subMap = {};
    sessions.forEach((s) => {
      if (s.subject)
        subMap[s.subject] = (subMap[s.subject] || 0) + (s.duration || 0);
    });
    const subjectBreakdown = Object.entries(subMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, mins]) => ({
        name,
        mins,
        pct: Math.round((mins / totalMins) * 100),
      }));
    const achievements = computeAchievements(sessions, streak);
    return {
      total,
      totalMins,
      avgMins,
      completed,
      efficiency,
      streak,
      totalXP,
      level,
      weekMins,
      todaySessions,
      weeklyData: buildWeekly(sessions),
      heatmapWeeks: buildHeatmap(sessions),
      focusTypeBreakdown,
      subjectBreakdown,
      achievements,
    };
  }, [sessions]);

  const displaySessions = useMemo(() => {
    let list = [...sessions];
    const ws = new Date();
    ws.setDate(ws.getDate() - 6);
    if (filter === 'completed')
      list = list.filter((s) => s.completed || s.is_completed);
    else if (filter === 'incomplete')
      list = list.filter((s) => !(s.completed || s.is_completed));
    else if (filter === 'this-week')
      list = list.filter((s) => new Date(s.created_at) >= ws);
    else if (filter === 'ai-plan')
      list = list.filter((s) => s.ai_plan?.steps?.length > 0);
    if (sort === 'newest')
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === 'oldest')
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sort === 'score')
      list.sort((a, b) => calcFocusScore(b) - calcFocusScore(a));
    else if (sort === 'duration')
      list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    return list;
  }, [sessions, filter, sort]);

  const lvl = stats.level;

  // Level-up gem rewards
  const { pendingLevelUp, clearLevelUp } = useLevelUp({
    currentLevel: lvl,
    supabase,
    userId: user?.id,
    onGemsChange: setGems,
  });

  const sharedLI = getSharedLevelInfo(stats.totalXP);
  const xpCur = sharedLI.xpCurrent;
  const xpNeeded = sharedLI.xpNeeded;
  const xpPct = sharedLI.pct;
  const avgScore = sessions.length
    ? Math.round(
        sessions.reduce((a, s) => a + calcFocusScore(s), 0) / sessions.length,
      )
    : 0;

  if (sbLoading || loading)
    return (
      <div className={`fi-loading${isDark ? ' dark' : ''}`}>
        <style>{CSS}</style>
        <div style={{ textAlign: 'center' }}>
          <div className="fi-loading-glyph">◈</div>
          <div className="fi-loading-text">Loading insights…</div>
        </div>
      </div>
    );

  return (
    <div className={`fi${isDark ? ' dark' : ''}`}>
      <style>{CSS}</style>
      <div className="fi-orbs" aria-hidden>
        <div className="fi-orb fi-orb1" />
        <div className="fi-orb fi-orb2" />
        <div className="fi-orb fi-orb3" />
      </div>
      <div className="fi-grain" aria-hidden />

      {/* ══════════════════════════════════════
          UPGRADED TOPBAR
      ══════════════════════════════════════ */}
      <div className="fi-topbar">
        <div className="fi-nb-inner">
          {/* ← Back to Dashboard */}
          <button className="fi-nb-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={13} strokeWidth={2} /> Dashboard
          </button>

          {/* Page identity */}
          <div className="fi-nb-identity">
            <div className="fi-nb-title">
              Focus <em>Insights</em>
            </div>
            <div className="fi-nb-subtitle">Your progress, visualised</div>
          </div>

          {/* Right cluster */}
          <div className="fi-nb-right">
            {/* XP mini-bar (hidden on small screens) */}
            <div className="fi-nb-xpbar-wrap">
              <div className="fi-nb-xpbar-label">
                <span>XP</span>
                <span>{xpPct}%</span>
              </div>
              <div className="fi-nb-xpbar-track">
                <div
                  className="fi-nb-xpbar-fill"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
              <div className="fi-nb-xpbar-label" style={{ marginTop: 2 }}>
                <span>{xpCur.toLocaleString()}</span>
                <span style={{ color: 'var(--gold)' }}>
                  {xpNeeded.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Level pill */}
            <div className="fi-nb-level">
              <div className="fi-nb-level-orb">{lvl}</div>
              <div className="fi-nb-level-text">
                <div className="fi-nb-level-title">{levelTitle(lvl)}</div>
                <div className="fi-nb-level-xp">
                  {stats.totalXP.toLocaleString()} XP
                </div>
              </div>
            </div>

            {/* New session */}
            <button
              className="fi-btn fi-btn-outline fi-btn-sm"
              onClick={() => navigate('/create-session')}
            >
              <Play size={11} /> New
            </button>

            {/* Theme toggle */}
            <button
              className="fi-theme-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun size={14} strokeWidth={1.8} />
              ) : (
                <Moon size={14} strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          HERO STATS BAND — 4 large glanceable numbers
      ══════════════════════════════════════ */}
      {/* <div className="fi-hero-band">
        {[
          {
            Icon: Clock,
            val: fmtMins(stats.totalMins),
            label: 'Total Focus',
            accent: 'var(--green)',
            sub: `${fmtMins(stats.weekMins)} this week`,
          },
          {
            Icon: Layers,
            val: stats.total,
            label: 'Sessions',
            accent: 'var(--gold)',
          },
          {
            Icon: Flame,
            val: `${stats.streak}d`,
            label: 'Current Streak',
            accent: '#c4913a',
          },
          {
            Icon: Zap,
            val: `${avgScore}`,
            label: 'Avg Score',
            accent: 'var(--purple)',
          },
        ].map(({ Icon, val, label, accent, sub }) => (
          <div
            key={label}
            className="fi-hero-stat"
            style={{ '--hs-accent': accent }}
          >
            <div className="fi-hs-icon">
              <Icon size={17} strokeWidth={1.7} />
            </div>
            <div className="fi-hs-val">{val}</div>
            <div className="fi-hs-label">{label}</div>
            {sub && (
              <div className="fi-hs-sub">
                <TrendingUp size={9} />
                {sub}
              </div>
            )}
          </div>
        ))}
      </div> */}

      <div className="fi-wrap">
        {/* §1 OVERVIEW STAT CARDS (retained for deeper detail)
        <div className="fi-a1" style={{ marginBottom: 28 }}>
          <div className="fi-section-head">
            <div>
              <div className="fi-section-eyebrow">
                <BarChart2 size={10} /> Intelligence Overview
              </div>
              <div className="fi-section-title">
                Your <em>Focus</em> at a Glance
              </div>
            </div>
          </div>
          <div className="fi-stat-grid">
            <StatCard
              icon={Layers}
              label="Total Sessions"
              value={stats.total}
              accent="var(--gold)"
              glyph="◈"
              delay={0}
            />
            <StatCard
              icon={Clock}
              label="Focus Time"
              value={fmtMins(stats.totalMins)}
              accent="var(--green)"
              glyph="⏱"
              delay={40}
              delta={{ text: `${fmtMins(stats.weekMins)} this week`, up: true }}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Session"
              value={fmtMins(stats.avgMins)}
              accent="var(--blue)"
              glyph="↗"
              delay={80}
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={`${stats.completed}/${stats.total}`}
              accent="var(--green)"
              glyph="✓"
              delay={120}
            />
            <StatCard
              icon={Zap}
              label="Avg Focus Score"
              value={`${avgScore}`}
              accent="var(--purple)"
              glyph="⚡"
              delay={160}
            />
          </div>
        </div> */}

        {/* §2 LEVEL + XP HERO CARD + ACHIEVEMENTS */}
        <div className="fi-a2" style={{ marginBottom: 28 }}>
          <div className="fi-section-head">
            <div>
              <div className="fi-section-eyebrow">
                <Trophy size={10} /> Gamification
              </div>
              <div className="fi-section-title">
                <em>Progress</em> &amp; Achievements
              </div>
            </div>
          </div>

          {/* Upgraded level card */}
          <div className="fi-level-card">
            <div
              className="fi-level-orb"
              title={
                equippedBadgeIcon
                  ? `Equipped: ${equippedBadge}`
                  : `Level ${lvl}`
              }
            >
              {equippedBadgeIcon ? (
                <span style={{ fontSize: '2rem', lineHeight: 1 }}>
                  {equippedBadgeIcon}
                </span>
              ) : (
                <div className="fi-level-num">{lvl}</div>
              )}
            </div>
            <div className="fi-level-info">
              <div className="fi-level-title">
                Level {lvl} — <em>{levelTitle(lvl)}</em>
              </div>
              <div className="fi-level-sub">
                {xpCur.toLocaleString()} / {xpNeeded.toLocaleString()} XP to
                Level {lvl + 1}
              </div>
              <div className="fi-xp-bar-track">
                <div
                  className="fi-xp-bar-fill"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
              <div className="fi-xp-bar-label">
                <span>{xpPct}% complete</span>
                <span style={{ color: 'var(--gold)' }}>
                  {(xpNeeded - xpCur).toLocaleString()} XP remaining
                </span>
              </div>
            </div>
            <div className="fi-streak-chip">
              <div className="fi-streak-num">🔥 {stats.streak}</div>
              <div className="fi-streak-label">Day Streak</div>
            </div>
            <div className="fi-streak-chip">
              <div className="fi-streak-num" style={{ color: 'var(--purple)' }}>
                ⚡ {stats.totalXP.toLocaleString()}
              </div>
              <div className="fi-streak-label">Total XP</div>
            </div>
            <div className="fi-streak-chip">
              <div className="fi-streak-num" style={{ color: 'var(--green)' }}>
                {stats.achievements.filter((a) => a.earned).length}/
                {stats.achievements.length}
              </div>
              <div className="fi-streak-label">Badges</div>
            </div>
          </div>

          <AchievementsCard achievements={stats.achievements} isDark={isDark} />
        </div>

        {/* §3 TODAY */}
        {stats.todaySessions.length > 0 && (
          <div className="fi-a3" style={{ marginBottom: 28 }}>
            <div className="fi-today-panel">
              <div className="fi-today-head">
                <div>
                  <div className="fi-section-eyebrow">
                    <Calendar size={10} /> Today
                  </div>
                  <div className="fi-today-title">
                    Today's <em>Sessions</em>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: '.6rem',
                    color: 'var(--green)',
                  }}
                >
                  {stats.todaySessions.reduce(
                    (a, s) => a + (s.duration || 0),
                    0,
                  )}
                  m focused today
                </div>
              </div>
              <div className="fi-today-sessions">
                {stats.todaySessions.map((s) => (
                  <div
                    key={s.id}
                    className={`fi-today-chip${s.completed || s.is_completed ? ' active' : ''}`}
                    onClick={() => navigate(`/session/${s.id}`)}
                  >
                    {(s.completed || s.is_completed) && (
                      <div className="fi-today-chip-dot" />
                    )}
                    <span style={{ fontWeight: 600 }}>{s.title}</span>
                    <span
                      style={{
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.54rem',
                        color: 'var(--ink3)',
                      }}
                    >
                      {fmtMins(s.duration)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.52rem',
                        color: 'var(--gold)',
                      }}
                    >
                      +{sessionXP(s)} XP
                    </span>
                  </div>
                ))}
                <button
                  className="fi-btn fi-btn-outline fi-btn-sm"
                  onClick={() => navigate('/create-session')}
                >
                  <Play size={11} /> New Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* §3b DAILY COMMISSIONS */}
        <div className="fi-a3" style={{ marginBottom: 28 }}>
          <DailyCommissions
            supabase={supabase}
            userId={user?.id}
            sessions={sessions}
            gems={gems}
            onGemsChange={setGems}
            isDark={isDark}
          />
        </div>

        {/* §4 CHARTS
        <div className="fi-a3" style={{ marginBottom: 28 }}>
          <div className="fi-section-head">
            <div>
              <div className="fi-section-eyebrow">
                <TrendingUp size={10} /> Trends
              </div>
              <div className="fi-section-title">
                Activity <em>Patterns</em>
              </div>
            </div>
          </div>
          <div className="fi-two-col">
            <div className="fi-card">
              <div className="fi-card-head">
                <span className="fi-card-label">
                  <BarChart2 size={11} /> This Week
                </span>
              </div>
              <div className="fi-card-body">
                <WeeklyChart data={stats.weeklyData} />
              </div>
            </div>
            <div className="fi-card">
              <div className="fi-card-head">
                <span className="fi-card-label">
                  <Calendar size={11} /> 16-Week Activity
                </span>
              </div>
              <div className="fi-card-body">
                <Heatmap weeks={stats.heatmapWeeks} />
              </div>
            </div>
          </div>
        </div> */}

        {/* §5 TIMELINE
        <div className="fi-a4" style={{ marginBottom: 28 }}>
          <div className="fi-section-head">
            <div>
              <div className="fi-section-eyebrow">
                <Zap size={10} /> Focus Flow
              </div>
              <div className="fi-section-title">
                Daily <em>Timeline</em>
              </div>
            </div>
          </div>
          <div className="fi-card">
            <div className="fi-card-body">
              {sessions.length > 0 ? (
                <Timeline sessions={sessions} />
              ) : (
                <div className="fi-empty">
                  <div className="fi-empty-icon">
                    <Clock size={22} />
                  </div>
                  <div className="fi-empty-title">No sessions yet</div>
                </div>
              )}
            </div>
          </div>
        </div> */}

        {/* §6 PRODUCTIVITY */}
        <div className="fi-a4" style={{ marginBottom: 28 }}>
          <div className="fi-section-head">
            <div>
              <div className="fi-section-eyebrow">
                <Brain size={10} /> Productivity
              </div>
              <div className="fi-section-title">
                Focus <em>Breakdown</em>
              </div>
            </div>
          </div>
          <div className="fi-two-col">
            <div className="fi-card">
              <div className="fi-card-head">
                <span className="fi-card-label">
                  <Target size={11} /> Efficiency
                </span>
              </div>
              <div className="fi-card-body">
                <div className="fi-donut-wrap">
                  <Donut pct={stats.efficiency} />
                  <div className="fi-donut-legend">
                    {[
                      {
                        dot: 'var(--green)',
                        label: 'Completed',
                        val: `${stats.completed} sessions`,
                      },
                      {
                        dot: 'var(--border)',
                        label: 'Incomplete',
                        val: `${stats.total - stats.completed} sessions`,
                      },
                      {
                        dot: 'var(--gold)',
                        label: 'Avg Score',
                        val: `${avgScore} / 100`,
                      },
                      {
                        dot: 'var(--blue)',
                        label: 'Total Focus',
                        val: fmtMins(stats.totalMins),
                      },
                    ].map(({ dot, label, val }) => (
                      <div key={label} className="fi-legend-row">
                        <span
                          className="fi-legend-dot"
                          style={{ background: dot }}
                        />
                        <span style={{ color: 'var(--ink3)' }}>{label}:</span>
                        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="fi-card">
              <div className="fi-card-head">
                <span className="fi-card-label">
                  <Layers size={11} /> Focus Types
                </span>
              </div>
              <div className="fi-card-body">
                {stats.focusTypeBreakdown.length > 0 ? (
                  <div className="fi-breakdown-list">
                    {stats.focusTypeBreakdown.map(({ name, mins, pct }) => (
                      <div key={name} className="fi-breakdown-row">
                        <div className="fi-breakdown-top">
                          <div
                            className="fi-breakdown-label"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 7,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: focusColor(name),
                                flexShrink: 0,
                                display: 'inline-block',
                              }}
                            />
                            {name}
                          </div>
                          <div className="fi-breakdown-val">
                            {fmtMins(mins)} · {pct}%
                          </div>
                        </div>
                        <div className="fi-breakdown-track">
                          <div
                            className="fi-breakdown-fill"
                            style={{
                              width: `${pct}%`,
                              background: focusColor(name),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="fi-empty">
                    <div className="fi-empty-sub">No focus type data yet</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {stats.subjectBreakdown.length > 0 && (
            <SubjectBreakdown
              subjectBreakdown={stats.subjectBreakdown}
              sessions={sessions}
              isDark={isDark}
            />
          )}
        </div>

        {/* §8 BADGE STORE */}
        <div className="fi-a5">
          <BadgeStore
            supabase={supabase}
            userId={user?.id}
            isDark={isDark}
            gems={gems}
            onGemsChange={setGems}
            onEquip={(badgeId) => setEquippedBadge(badgeId)} // ← add this
          />
        </div>

        {/* §7 ALL SESSIONS
        <div className="fi-a5">
          <div className="fi-section-head">
            <div>
              <div className="fi-section-eyebrow">
                <Sparkles size={10} /> All Sessions
              </div>
              <div className="fi-section-title">
                Session <em>Library</em>
              </div>
            </div>
            <div
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: '.58rem',
                color: 'var(--ink3)',
              }}
            >
              {displaySessions.length} shown
            </div>
          </div>
          <div className="fi-filter-row">
            {[
              { k: 'all', l: 'All' },
              { k: 'completed', l: 'Completed' },
              { k: 'incomplete', l: 'Incomplete' },
              { k: 'this-week', l: 'This Week' },
              { k: 'ai-plan', l: 'With AI Plan' },
            ].map(({ k, l }) => (
              <button
                key={k}
                className={`fi-filter-btn${filter === k ? ' active' : ''}`}
                onClick={() => setFilter(k)}
              >
                {l}
              </button>
            ))}
            <select
              className="fi-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="score">Highest Score</option>
              <option value="duration">Longest First</option>
            </select>
          </div>
          {displaySessions.length === 0 ? (
            <div className="fi-empty">
              <div className="fi-empty-icon">
                <BookOpen size={22} />
              </div>
              <div className="fi-empty-title">No sessions found</div>
              <div className="fi-empty-sub">
                Start a focus session to see your data here.
              </div>
              <button
                className="fi-btn fi-btn-gold"
                onClick={() => navigate('/create-session')}
              >
                <Play size={13} /> Start Focusing
              </button>
            </div>
          ) : (
            <div className="fi-sessions-grid">
              {displaySessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onEdit={handleEdit}
                  onNavigate={(id) => navigate(`/session/${id}`)}
                />
              ))}
            </div>
          )}
        </div> */}

        {pendingLevelUp && (
          <LevelUpModal
            newLevel={pendingLevelUp.newLevel}
            gemsAwarded={pendingLevelUp.gemsAwarded}
            onClose={clearLevelUp}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
}
