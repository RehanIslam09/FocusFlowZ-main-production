/**
 * Dashboard.jsx — Intelligent Decision System v2
 *
 * UPGRADES FROM v1:
 *  ✅ PART 1  — Next Action Intelligence Engine (resume > planned > create)
 *  ✅ PART 2  — Insight Rotation (5–8s), prioritization, memoization
 *  ✅ PART 3  — Session Feedback Loop (post-completion banner, auto-dismiss)
 *  ✅ PART 4  — Today Progress Narrative ("2 of 4 sessions · 65% of goal")
 *  ✅ PART 5  — Weekly Calendar Intelligence (streak highlight, best day insight)
 *  ✅ PART 6  — Focus Distribution Insight (dominant type callout on donut)
 *  ✅ PART 7  — Session Recommendation Engine (duration, difficulty, focus type)
 *  ✅ PART 8  — Fatigue Detection (incomplete rate, drop in duration)
 *  ✅ PART 9  — UX Polish (Next Action dominant, micro-interactions, hierarchy)
 *  ✅ PART 10 — Performance (all analytics useMemo, O(n) algorithms)
 *
 *  All existing features preserved. Zero AI APIs. Pure algorithmic intelligence.
 */

import { useUser } from '@clerk/clerk-react';
import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useSupabase from '../hooks/useSupabase';
import AppNavbar from '../components/app/AppNavbar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BookOpen,
  Clock,
  Flame,
  Plus,
  ArrowRight,
  Brain,
  Target,
  TrendingUp,
  Zap,
  ChevronRight,
  Calendar,
  BarChart2,
  Sparkles,
  Check,
  Play,
  Star,
  Activity,
  Edit2,
  X,
  RotateCcw,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Award,
  ChevronLeft,
  AlertTriangle,
  Coffee,
  Lightbulb,
  ListChecks,
} from 'lucide-react';

// ── Shared progress system ──
import {
  useUserProgress,
  calcSessionXP,
  calcStreakFromSessions,
  computeXPFromSessions,
  getLevelInfo,
} from '../hooks/useUserProgress';
import SessionRewardCard from '../components/SessionRewardCard';
import { DailyProgressStrip } from '../components/app/DailyProgressStrip';

/* ═══════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════ */

function fmtMins(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function useGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
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

function buildWeeklyData(sessions) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const map = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map[key] = { day: labels[d.getDay()], mins: 0, sessions: 0, date: key };
  }
  sessions.forEach((s) => {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    if (map[key]) {
      map[key].mins += s.duration || 0;
      map[key].sessions += 1;
    }
  });
  return Object.values(map);
}

function buildFocusTypeData(sessions) {
  const map = {};
  sessions.forEach((s) => {
    const ft = s.focus_type || 'General';
    map[ft] = (map[ft] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function buildHeatmap(sessions) {
  const dayMap = {};
  sessions.forEach((s) => {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    dayMap[key] = (dayMap[key] || 0) + (s.duration || 0);
  });
  const weeks = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 83);
  for (let w = 0; w < 12; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      const mins = dayMap[key] || 0;
      week.push({
        date: key,
        mins,
        level:
          mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 90 ? 3 : 4,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

function bestDayOfWeek(sessions) {
  const map = {};
  const labels = [
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

/* ═══════════════════════════════════════════════════════════
   ⚙️ SMART INSIGHT ENGINE (O(n) algorithms)
═══════════════════════════════════════════════════════════ */

function analyzeTimeOfDay(sessions) {
  if (!sessions.length) return null;
  const buckets = {
    Morning: {
      label: 'morning',
      range: '5–11am',
      totalMins: 0,
      completed: 0,
      count: 0,
    },
    Afternoon: {
      label: 'afternoon',
      range: '12–4pm',
      totalMins: 0,
      completed: 0,
      count: 0,
    },
    Evening: {
      label: 'evening',
      range: '5–9pm',
      totalMins: 0,
      completed: 0,
      count: 0,
    },
    Night: {
      label: 'night',
      range: '10pm–4am',
      totalMins: 0,
      completed: 0,
      count: 0,
    },
  };
  sessions.forEach((s) => {
    const h = new Date(s.created_at).getHours();
    const bucket =
      h >= 5 && h < 12
        ? 'Morning'
        : h >= 12 && h < 17
          ? 'Afternoon'
          : h >= 17 && h < 22
            ? 'Evening'
            : 'Night';
    buckets[bucket].count++;
    buckets[bucket].totalMins += s.duration || 0;
    if (s.completed || s.is_completed) buckets[bucket].completed++;
  });
  let best = null,
    bestScore = -1;
  for (const [name, b] of Object.entries(buckets)) {
    if (b.count < 2) continue;
    const rate = b.completed / b.count;
    const avgMins = b.totalMins / b.count;
    const score = rate * 0.6 + Math.min(avgMins / 120, 1) * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = {
        name,
        ...b,
        rate: Math.round(rate * 100),
        avgMins: Math.round(avgMins),
      };
    }
  }
  return best;
}

function analyzeCompletionRates(sessions) {
  if (!sessions.length) return null;
  const overall = { total: sessions.length, completed: 0 };
  const byDiff = {};
  sessions.forEach((s) => {
    const done = s.completed || s.is_completed;
    if (done) overall.completed++;
    const diff = s.difficulty || 'unset';
    if (!byDiff[diff]) byDiff[diff] = { total: 0, completed: 0 };
    byDiff[diff].total++;
    if (done) byDiff[diff].completed++;
  });
  overall.rate = Math.round((overall.completed / overall.total) * 100);
  let bestDiff = null,
    bestDiffRate = -1;
  for (const [diff, d] of Object.entries(byDiff)) {
    if (d.total < 2 || diff === 'unset') continue;
    const rate = Math.round((d.completed / d.total) * 100);
    if (rate > bestDiffRate) {
      bestDiffRate = rate;
      bestDiff = { name: diff, rate, total: d.total };
    }
  }
  return { overall, bestDiff };
}

function analyzeWeeklyComparison(sessions) {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
  let thisWeek = 0,
    lastWeek = 0;
  sessions.forEach((s) => {
    const d = new Date(s.created_at);
    if (d >= startOfThisWeek) thisWeek += s.duration || 0;
    else if (d >= startOfLastWeek && d < startOfThisWeek)
      lastWeek += s.duration || 0;
  });
  if (!lastWeek && !thisWeek) return null;
  if (!lastWeek) return { thisWeek, lastWeek: 0, pct: null, isNew: true };
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  return { thisWeek, lastWeek, pct, isNew: false };
}

function analyzeBestCategory(sessions) {
  if (!sessions.length) return null;
  const map = {};
  sessions.forEach((s) => {
    const ft = s.focus_type || 'General';
    if (!map[ft]) map[ft] = { totalMins: 0, count: 0, completed: 0 };
    map[ft].totalMins += s.duration || 0;
    map[ft].count++;
    if (s.completed || s.is_completed) map[ft].completed++;
  });
  let best = null,
    bestAvg = -1;
  for (const [name, d] of Object.entries(map)) {
    if (d.count < 2) continue;
    const avg = d.totalMins / d.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = { name, avg: Math.round(avg), count: d.count };
    }
  }
  return best;
}

/* ── PART 8: FATIGUE DETECTION (O(n)) ──
 * Detects:
 *  1. High incomplete rate in recent sessions (last 5)
 *  2. Drop in average session duration (recent vs overall)
 * Returns { detected, message, suggestion } or null
 */
function analyzeFatigue(sessions) {
  if (sessions.length < 4) return null;
  const recent = sessions.slice(0, 5); // most recent first
  const recentIncomplete = recent.filter(
    (s) => !(s.completed || s.is_completed),
  ).length;
  const incompleteRate = recentIncomplete / recent.length;

  const recentAvg =
    recent.reduce((a, s) => a + (s.duration || 0), 0) / recent.length;
  const overallAvg =
    sessions.reduce((a, s) => a + (s.duration || 0), 0) / sessions.length;
  const durationDrop =
    overallAvg > 0 ? (overallAvg - recentAvg) / overallAvg : 0;

  if (incompleteRate >= 0.6 || durationDrop >= 0.35) {
    return {
      detected: true,
      incompleteRate: Math.round(incompleteRate * 100),
      durationDrop: Math.round(durationDrop * 100),
      suggestion:
        durationDrop >= 0.35
          ? 'Your recent sessions are shorter than usual. Consider a light 20-min session today.'
          : 'Several recent sessions went incomplete. Try an easier, shorter session to rebuild momentum.',
    };
  }
  return null;
}

/* ══════════════════════════════════════════════════════
   XP / POINTS ENGINE
   Pure client-side. Points = focus minutes.
   Weekly XP = sum of durations this week.
   No backend required.
══════════════════════════════════════════════════════ */

function computeXP(sessions) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  let weeklyXP = 0;
  let totalXP = 0;

  sessions.forEach((s) => {
    const mins = s.duration || 0;
    // Multipliers: completed sessions earn full XP; incomplete earn 50%
    const done = s.completed || s.is_completed;
    const earned = done ? mins : Math.floor(mins * 0.5);
    totalXP += earned;
    if (new Date(s.created_at) >= startOfWeek) {
      weeklyXP += earned;
    }
  });

  return { weeklyXP, totalXP };
}

// function getLevelInfo(totalXP) {
//   // Each level requires 20% more XP than previous
//   const LEVELS = [
//     { label: 'Novice', threshold: 0 },
//     { label: 'Apprentice', threshold: 60 },
//     { label: 'Scholar', threshold: 180 },
//     { label: 'Focused', threshold: 400 },
//     { label: 'Deep Thinker', threshold: 800 },
//     { label: 'Flow State', threshold: 1500 },
//     { label: 'Sage', threshold: 3000 },
//   ];
//   let level = LEVELS[0];
//   let next = LEVELS[1];
//   for (let i = 0; i < LEVELS.length; i++) {
//     if (totalXP >= LEVELS[i].threshold) {
//       level = LEVELS[i];
//       next = LEVELS[i + 1] || null;
//     }
//   }
//   const pct = next
//     ? Math.round(
//         ((totalXP - level.threshold) / (next.threshold - level.threshold)) *
//           100,
//       )
//     : 100;
//   return {
//     label: level.label,
//     pct,
//     nextLabel: next?.label || null,
//     nextAt: next?.threshold || null,
//   };
// }

/**
 * detectMissedYesterday
 * Checks if user had zero sessions yesterday.
 * Uses sessionStorage to avoid re-showing after dismiss.
 * Returns { missed: bool, message: string } | null
 */
function detectMissedYesterday(sessions) {
  // Check if already dismissed today
  const dismissedKey = `missedDayDismissed_${todayDateKey()}`;
  if (sessionStorage.getItem(dismissedKey)) return null;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const hadYesterdaySession = sessions.some(
    (s) => new Date(s.created_at).toISOString().slice(0, 10) === yesterdayKey,
  );

  if (hadYesterdaySession) return null;

  // Only show if user has history (isn't brand new)
  if (sessions.length < 3) return null;

  // Check if they've studied before yesterday (so it's a real miss, not a gap)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const hasRecentHistory = sessions.some(
    (s) => new Date(s.created_at) >= twoDaysAgo,
  );
  if (!hasRecentHistory) return null;

  return {
    missed: true,
    message: 'You missed yesterday — start small today.',
    sub: 'A 20-minute session is enough to rebuild momentum.',
  };
}

/* ── PART 7: SESSION RECOMMENDATION ENGINE (O(n)) ──
 * Analyzes avg duration, best time of day, completion rates
 * Returns { duration, difficulty, focusType, reason }
 */
function generateRecommendation(sessions) {
  if (sessions.length < 3) return null;

  // Average duration (completed sessions only, more reliable)
  const completed = sessions.filter((s) => s.completed || s.is_completed);
  const avgDuration = completed.length
    ? Math.round(
        completed.reduce((a, s) => a + (s.duration || 0), 0) / completed.length,
      )
    : Math.round(
        sessions.reduce((a, s) => a + (s.duration || 0), 0) / sessions.length,
      );

  // Best time of day
  const tod = analyzeTimeOfDay(sessions);

  // Best difficulty
  const cr = analyzeCompletionRates(sessions);
  const suggestedDifficulty = cr?.bestDiff?.name || 'Medium';

  // Best focus type (most sessions)
  const focusMap = {};
  sessions.forEach((s) => {
    const ft = s.focus_type || 'General';
    focusMap[ft] = (focusMap[ft] || 0) + 1;
  });
  const topFocus =
    Object.entries(focusMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';

  // Round duration to nearest 5
  const roundedDuration = Math.round(avgDuration / 5) * 5;

  // Build reason string
  const h = new Date().getHours();
  const currentPeriod =
    h >= 5 && h < 12
      ? 'Morning'
      : h >= 12 && h < 17
        ? 'Afternoon'
        : h >= 17 && h < 22
          ? 'Evening'
          : 'Night';

  let reason = `You usually complete ${fmtMins(roundedDuration)} sessions`;
  if (tod && tod.name === currentPeriod && tod.rate >= 50) {
    reason += ` — and ${tod.label} is your highest success window (${tod.rate}% completion).`;
  } else if (tod && tod.rate >= 50) {
    reason += `. Your best time is ${tod.label} (${tod.rate}% completion rate).`;
  } else {
    reason += '. Start one now?';
  }

  return {
    duration: roundedDuration || 45,
    difficulty: suggestedDifficulty,
    focusType: topFocus,
    reason,
    bestTime: tod?.label || null,
    bestTimeRate: tod?.rate || null,
  };
}

/* ── INSIGHT PRIORITY SCORES ──
 * completion insights > weekly trends > generic stats
 * Higher score = shown first
 */
const INSIGHT_PRIORITY = { completion: 3, weekly: 2, category: 1, generic: 0 };

/**
 * buildRecencyWeightedSessions
 * Returns a session array where the last N sessions appear twice.
 * This gives recent behavior 2× influence on O(n) analyses
 * without changing any analysis function signatures.
 *
 * @param {Array} sessions - full sessions array (newest first)
 * @param {number} recentCount - how many recent sessions to upweight
 * @returns {Array} augmented session array
 */
function buildRecencyWeightedSessions(sessions, recentCount = 5) {
  if (sessions.length <= recentCount) return sessions;
  // Duplicate the most recent sessions to double their statistical weight
  const recent = sessions.slice(0, recentCount);
  return [...recent, ...sessions]; // recent appear twice, O(n)
}

/**
 * getRecencyBoostInsight
 * Checks if recent sessions (last 3) show a strong pattern
 * that differs from the all-time average — surfaces it as a
 * high-priority "trend" insight.
 *
 * @param {Array} sessions - full sessions array (newest first)
 * @returns {{ icon, text, color, priority } | null}
 */
function getRecencyBoostInsight(sessions) {
  if (sessions.length < 5) return null;

  const recent = sessions.slice(0, 3);
  const older = sessions.slice(3);

  // Recent avg duration vs historical avg
  const recentAvg =
    recent.reduce((a, s) => a + (s.duration || 0), 0) / recent.length;
  const olderAvg =
    older.reduce((a, s) => a + (s.duration || 0), 0) / older.length;

  if (!olderAvg) return null;

  const delta = ((recentAvg - olderAvg) / olderAvg) * 100;

  // Recent completion rate
  const recentCompletedCount = recent.filter(
    (s) => s.completed || s.is_completed,
  ).length;
  const recentCompRate = Math.round(
    (recentCompletedCount / recent.length) * 100,
  );

  // Only surface an insight if there's a meaningful shift (±20%)
  if (delta >= 20) {
    return {
      icon: 'trending',
      priority: 4, // Higher than INSIGHT_PRIORITY.completion (3) — recency wins
      text: `Your last 3 sessions averaged ${fmtMins(Math.round(recentAvg))} — ${Math.round(delta)}% above your usual. You're in a strong run.`,
      color: 'var(--color-success)',
    };
  }

  if (delta <= -25 && recentCompRate < 60) {
    return {
      icon: 'trending',
      priority: 4,
      text: `Recent sessions are shorter and ${100 - recentCompRate}% incomplete. A focused 25-min session today can reset the pattern.`,
      color: 'var(--color-danger)',
    };
  }

  return null;
}

function generateSmartInsights(sessions) {
  if (!sessions.length)
    return [
      {
        icon: 'spark',
        priority: 0,
        text: 'Create your first session to start tracking your focus patterns.',
        color: 'var(--accent)',
      },
    ];

  const insights = [];

  // ── RECENCY BOOST ──
  const recencyInsight = getRecencyBoostInsight(sessions);

  // ── ADD recency insight first ──
  if (recencyInsight) insights.push(recencyInsight);

  // ── RECENCY WEIGHTING ──
  const weightedSessions = buildRecencyWeightedSessions(sessions, 5);
  // 1. Completion rate insight (priority: completion = 3)
  const cr = analyzeCompletionRates(weightedSessions);
  if (cr?.bestDiff) {
    insights.push({
      icon: 'target',
      priority: INSIGHT_PRIORITY.completion,
      text: `You complete ${cr.bestDiff.rate}% of ${cr.bestDiff.name} difficulty sessions — your strongest zone.`,
      color: '#7a8cb8',
    });
  } else if (cr?.overall.rate >= 60) {
    insights.push({
      icon: 'target',
      priority: INSIGHT_PRIORITY.completion,
      text: `You complete ${cr.overall.rate}% of all sessions. Solid consistency.`,
      color: '#7a8cb8',
    });
  }

  // 2. Weekly comparison (priority: weekly = 2)
  const wc = analyzeWeeklyComparison(sessions);
  if (wc && !wc.isNew && wc.pct !== null) {
    if (wc.pct > 0) {
      insights.push({
        icon: 'trending',
        priority: INSIGHT_PRIORITY.weekly,
        text: `Study time up ${wc.pct}% this week — ${fmtMins(wc.thisWeek)} vs ${fmtMins(wc.lastWeek)} last week.`,
        color: 'var(--color-success)',
      });
    } else if (wc.pct < -10) {
      insights.push({
        icon: 'trending',
        priority: INSIGHT_PRIORITY.weekly,
        text: `Focus time dropped ${Math.abs(wc.pct)}% vs last week. One good session today can reverse it.`,
        color: 'var(--color-danger)',
      });
    }
  } else if (wc?.isNew && wc.thisWeek > 0) {
    insights.push({
      icon: 'trending',
      priority: INSIGHT_PRIORITY.weekly,
      text: `You've logged ${fmtMins(wc.thisWeek)} of focus this week. Keep the momentum going.`,
      color: 'var(--color-success)',
    });
  }

  // 3. Time-of-day insight (priority: category = 1)
  const tod = analyzeTimeOfDay(weightedSessions);
  if (tod && tod.rate >= 50) {
    insights.push({
      icon: 'clock',
      priority: INSIGHT_PRIORITY.category,
      text: `You focus best in the ${tod.label} — ${tod.rate}% completion rate, averaging ${fmtMins(tod.avgMins)} per session.`,
      color: 'var(--accent)',
    });
  }

  // 4. Best focus category (priority: category = 1)
  if (insights.length < 3) {
    const bc = analyzeBestCategory(weightedSessions);
    if (bc) {
      insights.push({
        icon: 'award',
        priority: INSIGHT_PRIORITY.category,
        text: `Your strongest focus type is "${bc.name}" — averaging ${fmtMins(bc.avg)} per session.`,
        color: 'var(--accent)',
      });
    }
  }

  // 5. Fallback (priority: generic = 0)
  if (!insights.length) {
    const streak = calcStreak(sessions);
    if (streak > 1) {
      insights.push({
        icon: 'flame',
        priority: INSIGHT_PRIORITY.generic,
        text: `${streak}-day focus streak — you're building a real habit.`,
        color: 'var(--color-success)',
      });
    } else {
      const total = sessions.reduce((a, s) => a + (s.duration || 0), 0);
      insights.push({
        icon: 'spark',
        priority: INSIGHT_PRIORITY.generic,
        text: `You've logged ${fmtMins(total)} of total focus time. Keep going.`,
        color: 'var(--accent)',
      });
    }
  }

  // Sort by priority descending, return top 3
  return insights.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

/* ── PART 6: DOMINANT FOCUS TYPE INSIGHT ── */
function getDominantFocusInsight(focusData) {
  if (!focusData.length) return null;
  const total = focusData.reduce((a, d) => a + d.value, 0);
  if (!total) return null;
  const top = [...focusData].sort((a, b) => b.value - a.value)[0];
  const pct = Math.round((top.value / total) * 100);
  if (pct < 30) return null; // not dominant enough
  return { name: top.name, pct };
}

/* ─────────────────────────────────────────────
   PART 1: NEXT ACTION DECISION ENGINE
   Priority: active/incomplete > today planned > create new
───────────────────────────────────────────── */

/**
 * Determines the highest-priority next action.
 * Returns: { type, title, subtitle, sessionId, btnLabel }
 * type: 'resume' | 'start_planned' | 'create'
 */
function computeNextAction(sessions, todaySessions) {
  const todayKey = todayDateKey();

  // Priority 1: Active incomplete session (most recent)
  const activeSession = sessions.find((s) => !(s.completed || s.is_completed));
  if (activeSession) {
    return {
      type: 'resume',
      title: activeSession.title,
      subtitle: `${fmtMins(activeSession.duration)} · ${activeSession.focus_type || 'General'} · not yet completed`,
      sessionId: activeSession.id,
      btnLabel: 'Resume',
      session: activeSession,
    };
  }

  // Priority 2: Today's planned sessions (if any incomplete)
  const pendingToday = todaySessions.filter(
    (s) => !(s.completed || s.is_completed),
  );
  if (pendingToday.length > 0) {
    const next = pendingToday[0];
    return {
      type: 'start_planned',
      title: next.title,
      subtitle: `Planned for today · ${fmtMins(next.duration)} · ${next.focus_type || 'General'}`,
      sessionId: next.id,
      btnLabel: 'Start Now',
      session: next,
    };
  }

  // Priority 3: Create new session
  return {
    type: 'create',
    title: 'Start a new focus session',
    subtitle: 'Plan your goals and begin a focused block',
    sessionId: null,
    btnLabel: 'Create Session',
    session: null,
  };
}

const FOCUS_COLORS = [
  '#c4913a',
  '#b85c4a',
  '#6b8c6b',
  '#7a8cb8',
  '#9c8266',
  '#5c9aaa',
];

/* ─────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────── */
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (!target) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

/* ─────────────────────────────────────────────
   DESIGN TOKEN CSS
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=IBM+Plex+Mono:wght@300;400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');

:root {
  --_cream-50:  #fdfaf4;
  --_cream-100: #f5f0e8;
  --_cream-200: #ede7d9;
  --_cream-300: #e4dccb;
  --_cream-400: #d8ceb8;
  --_ink-900:   #1e1a14;
  --_ink-700:   #3d3628;
  --_ink-500:   #5c5445;
  --_ink-300:   #9c9283;
  --_ink-200:   #bdb3a3;
  --_amber:     #c4913a;
  --_amber-l:   #e8b96a;
  --_amber-d:   #a8782a;
  --_terra:     #b85c4a;
  --_sage:      #6b8c6b;
  --_sepia:     #7a6a54;
}

:root {
  --bg-page:       var(--_cream-100);
  --bg-secondary:  var(--_cream-200);
  --surface-1:     var(--_cream-50);
  --surface-2:     var(--_cream-200);
  --surface-3:     var(--_cream-300);
  --surface-invert:var(--_ink-900);
  --text-primary:  var(--_ink-900);
  --text-secondary:var(--_ink-500);
  --text-muted:    var(--_ink-300);
  --text-invert:   #f0ead8;
  --text-invert-dim: rgba(240,234,216,.45);
  --border-subtle: #ddd5c4;
  --border-mid:    #c8bc9e;
  --border-strong: #b0a48c;
  --accent:        var(--_amber);
  --accent-light:  var(--_amber-l);
  --accent-dark:   var(--_amber-d);
  --accent-glow:   rgba(196,145,58,.22);
  --accent-dim:    rgba(196,145,58,.12);
  --accent-dim2:   rgba(196,145,58,.06);
  --color-success: var(--_sage);
  --color-danger:  var(--_terra);
  --shadow-xs: 0 1px 4px rgba(30,26,20,.05);
  --shadow-sm: 0 2px 10px rgba(30,26,20,.07);
  --shadow-md: 0 8px 32px rgba(30,26,20,.10);
  --shadow-lg: 0 20px 60px rgba(30,26,20,.14);
  --f-serif: 'Playfair Display', Georgia, serif;
  --f-mono:  'IBM Plex Mono', monospace;
  --f-body:  'Lora', Georgia, serif;
  --ease:   cubic-bezier(.16,1,.3,1);
  --spring: cubic-bezier(.34,1.56,.64,1);
  --dur:    .55s;
}

.dark {
  --bg-page:        #141210;
  --bg-secondary:   #1c1a14;
  --surface-1:      #1e1b14;
  --surface-2:      #252218;
  --surface-3:      #2c2820;
  --surface-invert: #0e0d09;
  --text-primary:   #f0ead8;
  --text-secondary: #b8aa94;
  --text-muted:     #7a6e5e;
  --text-invert:    #f0ead8;
  --text-invert-dim: rgba(240,234,216,.35);
  --border-subtle:  #2a261e;
  --border-mid:     #3a3528;
  --border-strong:  #4a4436;
  --accent:         #d4a24a;
  --accent-light:   #e8c070;
  --accent-dark:    #b88030;
  --accent-glow:    rgba(212,162,74,.20);
  --accent-dim:     rgba(212,162,74,.14);
  --accent-dim2:    rgba(212,162,74,.07);
  --shadow-xs: 0 1px 4px rgba(0,0,0,.25);
  --shadow-sm: 0 2px 10px rgba(0,0,0,.35);
  --shadow-md: 0 8px 32px rgba(0,0,0,.50);
  --shadow-lg: 0 20px 60px rgba(0,0,0,.65);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.grain-svg {
  pointer-events: none; position: fixed; inset: 0; width: 100%; height: 100%;
  opacity: .032; z-index: 0; mix-blend-mode: multiply;
}
.dark .grain-svg { opacity: .055; mix-blend-mode: screen; }

.dash-page {
  min-height: 100vh; background: var(--bg-page);
  color: var(--text-primary); font-family: var(--f-body);
  position: relative; transition: background .3s, color .3s;
}
.dash-inner {
  max-width: 1220px; margin: 0 auto;
  padding: 0 40px 120px; position: relative; z-index: 1;
}
@media (max-width: 900px) { .dash-inner { padding: 0 20px 80px; } }

/* HERO */
.hero {
  position: relative; padding: 56px 0 48px; margin-bottom: 4px;
  overflow: hidden; animation: fadeUp var(--dur) var(--ease) both;
}
.hero-bg-orb {
  position: absolute; width: 560px; height: 380px; border-radius: 50%;
  background: radial-gradient(ellipse at center, var(--accent-dim2) 0%, transparent 70%);
  top: -60px; right: -100px; pointer-events: none; z-index: 0;
}
.hero-bg-orb-2 {
  position: absolute; width: 280px; height: 280px; border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(107,140,107,.06) 0%, transparent 70%);
  bottom: -40px; left: 30%; pointer-events: none; z-index: 0;
}
.hero-inner {
  position: relative; z-index: 1; display: flex;
  align-items: flex-end; justify-content: space-between; gap: 32px; flex-wrap: wrap;
}
.hero-left { flex: 1; min-width: 260px; }
.hero-eyebrow {
  display: flex; align-items: center; gap: 10px; font-family: var(--f-mono);
  font-size: .62rem; letter-spacing: .16em; text-transform: uppercase;
  color: var(--text-muted); margin-bottom: 18px;
}
.hero-eyebrow-pulse {
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
  animation: pulse 2.4s ease-in-out infinite; flex-shrink: 0;
}
.hero-eyebrow-sep { opacity: .35; }
.hero-title {
  font-family: var(--f-serif); font-size: clamp(2.1rem, 4.5vw, 3.4rem);
  font-weight: 700; line-height: 1.08; letter-spacing: -.04em;
  color: var(--text-primary); margin-bottom: 20px;
}
.hero-title em { font-style: italic; color: var(--accent); font-weight: 400; }
.hero-metrics { display: flex; align-items: center; gap: 28px; flex-wrap: wrap; }
.hero-metric { display: flex; flex-direction: column; gap: 2px; }
.hero-metric-val {
  font-family: var(--f-serif); font-size: 1.8rem; font-weight: 700;
  color: var(--text-primary); letter-spacing: -.04em; line-height: 1;
}
.hero-metric-label {
  font-family: var(--f-mono); font-size: .57rem; letter-spacing: .12em;
  text-transform: uppercase; color: var(--text-muted);
}
.hero-metric-sep { width: 1px; height: 34px; background: var(--border-subtle); flex-shrink: 0; }
.hero-badge {
  display: inline-flex; align-items: center; gap: 6px; background: var(--accent-dim);
  border: 1px solid rgba(196,145,58,.22); color: var(--accent); font-family: var(--f-mono);
  font-size: .59rem; letter-spacing: .1em; text-transform: uppercase;
  padding: 5px 12px; border-radius: 100px; margin-top: 18px;
}
.hero-right {
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px; padding-bottom: 4px;
}
.hero-cta {
  display: inline-flex; align-items: center; gap: 10px;
  background: var(--text-primary); color: var(--bg-page);
  font-family: var(--f-mono); font-size: .73rem; letter-spacing: .08em;
  text-transform: uppercase; padding: 14px 28px; border-radius: 6px; border: none;
  cursor: pointer; transition: background .2s, transform .28s var(--spring), box-shadow .28s, color .2s;
  white-space: nowrap; position: relative; overflow: hidden;
}
.hero-cta::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  opacity: 0; transition: opacity .25s;
}
.hero-cta:hover::before { opacity: 1; }
.hero-cta:hover { color: #fff; transform: translateY(-3px); box-shadow: 0 10px 32px var(--accent-glow); }
.hero-cta span, .hero-cta svg { position: relative; z-index: 1; }
.hero-cta-sub {
  display: inline-flex; align-items: center; gap: 7px; background: transparent;
  border: 1px solid var(--border-subtle); color: var(--text-secondary);
  font-family: var(--f-mono); font-size: .67rem; letter-spacing: .06em;
  text-transform: uppercase; padding: 11px 20px; border-radius: 6px; cursor: pointer;
  transition: border-color .2s, color .2s, transform .2s;
}
.hero-cta-sub:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }

/* ══ PART 3: SESSION FEEDBACK BANNER ══ */
.feedback-banner {
  background: var(--surface-invert);
  border: 1px solid rgba(196,145,58,.22);
  border-left: 3px solid var(--accent);
  border-radius: 10px; padding: 14px 18px;
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  margin-bottom: 20px; position: relative; overflow: hidden;
  animation: bannerIn .45s var(--spring) both;
}
.feedback-banner.dismissing { animation: bannerOut .3s var(--ease) both; }
.feedback-banner-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at left, var(--accent-glow) 0%, transparent 60%);
}
.feedback-banner-left { display: flex; align-items: center; gap: 12px; z-index: 1; }
.feedback-banner-icon {
  width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
  background: var(--accent-dim); border: 1px solid var(--accent-glow);
  display: grid; place-items: center; color: var(--accent);
}
.feedback-banner-tag {
  font-family: var(--f-mono); font-size: .54rem; letter-spacing: .14em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 2px;
}
.feedback-banner-text {
  font-family: var(--f-body); font-size: .78rem; color: var(--text-invert); font-style: italic;
}
.feedback-banner-close {
  background: none; border: none; cursor: pointer;
  color: rgba(240,234,216,.3); padding: 4px; z-index: 1;
  transition: color .2s; display: flex; align-items: center;
}
.feedback-banner-close:hover { color: var(--accent); }

/* ══ SMART INSIGHTS RIBBON ══ */
.insight-ribbon {
    background: linear-gradient(
    135deg,
    var(--surface-2),
    var(--surface-1)
  );
  border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 20px 28px;
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  margin-bottom: 28px; position: relative; overflow: hidden;
  box-shadow: 0 0 0 1px rgba(196,145,58,.1), var(--shadow-md);
}

.dark .insight-ribbon {
  background: linear-gradient(
    135deg,
    rgba(36, 32, 24, 0.9),
    rgba(28, 25, 18, 0.9)
  );
  border: 1px solid var(--border-mid);
}

.insight-ribbon-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at 10% 50%, var(--accent-glow) 0%, transparent 55%);
  animation: insightGlow 4s ease-in-out infinite;
}
.insight-ribbon-glyph {
  position: absolute; right: 22px; top: 50%; transform: translateY(-50%);
  font-family: var(--f-serif); font-size: 5rem; line-height: 1;
  color: rgba(255,255,255,.02); pointer-events: none;
}

.insight-ribbon-glyph {
  color: rgba(0, 0, 0, 0.06);
}

.dark .insight-ribbon-glyph {
  color: rgba(255, 255, 255, 0.05);
}

.insight-left {
  display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; position: relative; z-index: 1;
}
.insight-icon-wrap {
  width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
  background: var(--accent-dim); border: 1px solid var(--accent-glow);
  display: grid; place-items: center; color: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}
.insight-tag {
  font-family: var(--f-mono); font-size: .56rem; letter-spacing: .16em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 4px;
}
.insight-body {
  font-family: var(--f-body); font-size: .82rem; color: var(--text-invert);
  line-height: 1.5; font-style: italic;
  animation: insightFadeIn .4s var(--ease) both;
}
.insight-nav {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0; position: relative; z-index: 1;
}
.insight-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: rgba(240,234,216,.2); transition: background .25s, transform .25s;
  cursor: pointer; border: none; padding: 0;
}
.insight-dot.active { background: var(--accent); transform: scale(1.3); }
.insight-action {
  display: flex; align-items: center; gap: 6px; background: transparent;
  border: 1px solid rgba(196,145,58,.3); color: var(--accent-light);
  font-family: var(--f-mono); font-size: .62rem; letter-spacing: .06em;
  text-transform: uppercase; padding: 8px 14px; border-radius: 6px; cursor: pointer;
  transition: border-color .2s, background .2s;
  white-space: nowrap; flex-shrink: 0; position: relative; z-index: 1;
}
.insight-action:hover { background: var(--accent-dim); border-color: var(--accent); }

/* ══ PART 1: NEXT ACTION BLOCK — visually dominant ══ */
.next-action-block {
  background: linear-gradient(
    135deg,
    var(--surface-2),
    var(--surface-1)
  );
  border: 1px solid var(--border-subtle);
  border-radius: 14px; padding: 22px 24px;
  margin-bottom: 28px; position: relative; overflow: hidden;
  animation: fadeUp var(--dur) var(--ease) 60ms both;
  box-shadow: var(--shadow-md), 0 0 0 1px rgba(196,145,58,.08);
  transition: box-shadow .3s, transform .3s var(--spring);
}

.dark .next-action-block {
  background: linear-gradient(
    135deg,
    rgba(40, 36, 26, 0.95),
    rgba(28, 25, 18, 0.95)
  );
}

.next-action-block:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg), 0 0 0 1px rgba(196,145,58,.14); }
.next-action-bg-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at 5% 50%, rgba(196,145,58,.08) 0%, transparent 60%);
}
.next-action-inner {
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  position: relative; z-index: 1;
}
.next-action-left { display: flex; align-items: center; gap: 16px; min-width: 0; }
.next-action-icon-wrap {
  width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
  background: var(--accent-dim); border: 1px solid var(--accent-glow);
  display: grid; place-items: center; color: var(--accent);
  box-shadow: 0 0 16px var(--accent-glow);
}
.next-action-tag {
  font-family: var(--f-mono); font-size: .55rem; letter-spacing: .16em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 4px;
}
.next-action-title {
  font-family: var(--f-serif); font-size: 1.05rem; font-weight: 600;
  color: var(--text-invert); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.next-action-sub {
  font-family: var(--f-mono); font-size: .57rem; color: var(--text-invert-dim); margin-top: 3px;
}
.next-action-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.next-action-btn {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  background: var(--accent); color: #fff;
  font-family: var(--f-mono); font-size: .68rem; font-weight: 500; letter-spacing: .07em;
  text-transform: uppercase; padding: 12px 22px; border-radius: 7px; border: none;
  cursor: pointer; white-space: nowrap;
  transition: transform .22s var(--spring), box-shadow .22s, background .2s;
  box-shadow: 0 4px 16px rgba(196,145,58,.3);
}
.next-action-btn:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 8px 24px rgba(196,145,58,.4); background: var(--accent-dark); }

/* Next action session highlight card */
.next-action-session-preview {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
  border-radius: 7px; padding: 7px 12px; flex-shrink: 0;
}
.next-action-session-type {
  font-family: var(--f-mono); font-size: .54rem; color: var(--accent-light);
  text-transform: uppercase; letter-spacing: .1em;
}
.next-action-session-dur {
  font-family: var(--f-mono); font-size: .57rem; color: var(--text-invert-dim);
}

/* ══ PART 4: TODAY PROGRESS NARRATIVE ══ */
.today-progress-narrative {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 10px; padding: 14px 18px; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  animation: fadeUp var(--dur) var(--ease) 90ms both;
}
.today-progress-text {
  font-family: var(--f-serif); font-size: .88rem; color: var(--text-primary); font-style: italic;
}
.today-progress-pct {
  font-family: var(--f-mono); font-size: .62rem; color: var(--accent);
  background: var(--accent-dim); border: 1px solid var(--accent-dim);
  padding: 4px 10px; border-radius: 6px; white-space: nowrap;
}

/* ══ PART 7: RECOMMENDATION CARD ══ */
.recommendation-card {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--color-success);
  border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
  display: flex; align-items: flex-start; gap: 12px;
  animation: fadeUp var(--dur) var(--ease) 110ms both;
}
.recommendation-icon {
  width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
  background: rgba(107,140,107,.1); border: 1px solid rgba(107,140,107,.2);
  display: grid; place-items: center; color: var(--color-success);
}
.recommendation-tag {
  font-family: var(--f-mono); font-size: .54rem; letter-spacing: .14em;
  text-transform: uppercase; color: var(--color-success); margin-bottom: 3px;
}
.recommendation-text {
  font-family: var(--f-body); font-size: .78rem; color: var(--text-secondary);
  line-height: 1.55; font-style: italic;
}
.recommendation-chips {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
}
.recommendation-chip {
  font-family: var(--f-mono); font-size: .56rem; letter-spacing: .08em;
  background: var(--surface-2); border: 1px solid var(--border-subtle);
  color: var(--text-muted); padding: 3px 8px; border-radius: 4px;
}

.recommendation-action-btn {
  display: inline-flex; align-items: center; gap: 7px;
  margin-top: 12px;
  background: var(--color-success); color: #fff;
  font-family: var(--f-mono); font-size: .62rem; font-weight: 500;
  letter-spacing: .07em; text-transform: uppercase;
  padding: 9px 16px; border-radius: 6px; border: none; cursor: pointer;
  transition: transform .2s var(--spring), box-shadow .2s, opacity .2s;
  box-shadow: 0 3px 12px rgba(107,140,107,.3);
}
.recommendation-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(107,140,107,.4);
}


/* ══ PART 8: FATIGUE ALERT ══ */
.fatigue-alert {
  background: rgba(184,92,74,.06); border: 1px solid rgba(184,92,74,.2);
  border-left: 3px solid var(--color-danger);
  border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
  display: flex; align-items: flex-start; gap: 12px;
  animation: fadeUp var(--dur) var(--ease) 100ms both;
}
.fatigue-icon {
  width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
  background: rgba(184,92,74,.1); border: 1px solid rgba(184,92,74,.2);
  display: grid; place-items: center; color: var(--color-danger);
}
.fatigue-tag {
  font-family: var(--f-mono); font-size: .54rem; letter-spacing: .14em;
  text-transform: uppercase; color: var(--color-danger); margin-bottom: 3px;
}
.fatigue-text {
  font-family: var(--f-body); font-size: .78rem; color: var(--text-secondary);
  line-height: 1.55; font-style: italic;
}

/* TODAY SESSIONS SECTION */
.today-sessions-section { margin-bottom: 28px; }
.today-session-card {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 10px; padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  transition: transform .22s var(--spring), box-shadow .22s, border-color .2s;
  margin-bottom: 8px;
}
.today-session-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); border-color: var(--border-mid); }
.today-session-card.highlighted { border-color: var(--accent); background: var(--accent-dim2); }
.today-session-card.highlighted .today-session-card-stripe { opacity: 1; }
.today-session-card-stripe {
  width: 3px; height: 40px; border-radius: 2px;
  background: var(--accent); opacity: .4; flex-shrink: 0;
}
.today-session-info { flex: 1; min-width: 0; }
.today-session-title {
  font-family: var(--f-serif); font-size: .88rem; font-weight: 600;
  color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.today-session-meta {
  display: flex; align-items: center; gap: 10px; margin-top: 3px;
  font-family: var(--f-mono); font-size: .57rem; color: var(--text-muted);
}
.today-session-tag {
  background: var(--surface-2); border: 1px solid var(--border-subtle);
  padding: 2px 7px; border-radius: 4px;
}
.today-session-status {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--f-mono); font-size: .55rem; padding: 3px 8px; border-radius: 4px;
}
.today-session-status.done { background: rgba(107,140,107,.12); color: var(--color-success); border: 1px solid rgba(107,140,107,.25); }
.today-session-status.pending { background: var(--accent-dim2); color: var(--accent); border: 1px solid var(--accent-dim); }
.today-session-btn {
  display: flex; align-items: center; gap: 5px; background: transparent;
  border: 1px solid var(--border-subtle); color: var(--text-secondary);
  font-family: var(--f-mono); font-size: .59rem; letter-spacing: .05em;
  text-transform: uppercase; padding: 6px 12px; border-radius: 5px; cursor: pointer;
  transition: background .18s, color .18s, border-color .18s; flex-shrink: 0; white-space: nowrap;
}
.today-session-btn:hover { background: var(--text-primary); color: var(--bg-page); border-color: var(--text-primary); }

/* WEEKLY CALENDAR WIDGET */
.week-calendar {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 18px 16px;
  animation: fadeUp var(--dur) var(--ease) 120ms both;
}
.week-cal-title {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--f-serif); font-size: .88rem; font-weight: 600;
  color: var(--text-primary); margin-bottom: 14px;
}
.week-cal-title svg { color: var(--accent); opacity: .7; }
.week-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.week-cal-day { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.week-cal-label {
  font-family: var(--f-mono); font-size: .52rem; letter-spacing: .1em;
  text-transform: uppercase; color: var(--text-muted);
}
.week-cal-cell {
  width: 100%; aspect-ratio: 1; border-radius: 6px;
  border: 1px solid var(--border-subtle); background: var(--surface-2);
  position: relative; display: flex; align-items: center; justify-content: center;
  cursor: default; transition: transform .15s var(--spring); min-width: 28px; max-width: 44px;
}
.week-cal-cell:hover { transform: scale(1.1); }
.week-cal-cell.today { border-color: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
.week-cal-cell.streak-day { box-shadow: 0 0 6px var(--accent-glow); }
.week-cal-cell[data-l="0"] { background: var(--surface-2); }
.week-cal-cell[data-l="1"] { background: color-mix(in srgb, var(--accent) 22%, var(--surface-2)); border-color: transparent; }
.week-cal-cell[data-l="2"] { background: color-mix(in srgb, var(--accent) 48%, var(--surface-2)); border-color: transparent; }
.week-cal-cell[data-l="3"] { background: color-mix(in srgb, var(--accent) 74%, var(--surface-2)); border-color: transparent; }
.week-cal-cell[data-l="4"] { background: var(--accent); border-color: transparent; }
@supports not (color: color-mix(in srgb, red, blue)) {
  .week-cal-cell[data-l="1"] { background: rgba(196,145,58,.22); }
  .week-cal-cell[data-l="2"] { background: rgba(196,145,58,.48); }
  .week-cal-cell[data-l="3"] { background: rgba(196,145,58,.74); }
}
.week-cal-mins {
  font-family: var(--f-mono); font-size: .5rem; color: rgba(240,234,216,.6);
  position: absolute; bottom: 3px;
}
.week-cal-cell[data-l="0"] .week-cal-mins { display: none; }
.week-cal-streak {
  display: flex; align-items: center; gap: 6px; margin-top: 10px;
  font-family: var(--f-mono); font-size: .58rem; color: var(--text-muted);
}
.week-cal-streak-val { color: var(--accent); font-weight: 500; }

/* PART 5: BEST DAY INSIGHT */
.week-cal-best-day {
  display: flex; align-items: center; gap: 6px; margin-top: 8px;
  font-family: var(--f-mono); font-size: .56rem; color: var(--text-muted);
  padding-top: 8px; border-top: 1px solid var(--border-subtle);
}
.week-cal-best-day span { color: var(--accent); }

/* STAT BAND */
.stat-band {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14px; margin-bottom: 36px;
  animation: fadeUp var(--dur) var(--ease) 120ms both;
}
@media (max-width: 800px) { .stat-band { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 460px) { .stat-band { grid-template-columns: 1fr; } }

.stat-card {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 22px 20px 18px;
  position: relative; overflow: hidden; cursor: default;
  transition: transform .28s var(--spring), box-shadow .28s, border-color .2s;
}
.stat-card::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--sc-accent, var(--accent)); transform: scaleX(0);
  transform-origin: left; transition: transform .45s var(--ease);
}
.stat-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--border-mid); }
.stat-card:hover::after { transform: scaleX(1); }
.stat-card-glow {
  position: absolute; width: 110px; height: 110px; border-radius: 50%;
  background: radial-gradient(circle, var(--sc-glow, var(--accent-dim2)) 0%, transparent 70%);
  top: -24px; right: -16px; pointer-events: none;
}
.stat-card-icon { color: var(--sc-accent, var(--accent)); margin-bottom: 12px; opacity: .8; }
.stat-card-label {
  font-family: var(--f-mono); font-size: .59rem; text-transform: uppercase; letter-spacing: .14em;
  color: var(--text-muted); margin-bottom: 8px;
}
.stat-card-value {
  font-family: var(--f-serif); font-size: 2rem; font-weight: 700;
  color: var(--text-primary); letter-spacing: -.04em; line-height: 1; margin-bottom: 8px;
}
.stat-card-delta {
  display: flex; align-items: center; gap: 5px; font-family: var(--f-mono); font-size: .57rem;
  color: var(--text-muted); /* was --color-success */ letter-spacing: .05em;
}

/* MAIN GRID */
.main-grid {
  display: grid; grid-template-columns: 1fr 296px;
  gap: 28px; align-items: start;
}
@media (max-width: 960px) { .main-grid { grid-template-columns: 1fr; } }

/* SECTION RULE */
.sec-rule { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.sec-rule-line { flex: 1; height: 1px; background: var(--border-subtle); }
.sec-rule-label {
  font-family: var(--f-mono); font-size: .59rem; letter-spacing: .18em;
  text-transform: uppercase; color: var(--text-muted); white-space: nowrap;
}
.sec-rule-gem { font-family: var(--f-serif); font-size: .68rem; color: var(--accent); opacity: .5; }
.sec-rule-action {
  font-family: var(--f-mono); font-size: .61rem; color: var(--accent);
  text-transform: uppercase; letter-spacing: .08em; background: none; border: none;
  cursor: pointer; display: flex; align-items: center; gap: 4px; transition: opacity .2s; padding: 0;
}
.sec-rule-action:hover { opacity: .65; }

/* CHART CARD */
.chart-card {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 24px 22px 20px; margin-bottom: 28px;
  animation: fadeUp var(--dur) var(--ease) 160ms both; transition: box-shadow .28s;
}
.chart-card:hover { box-shadow: var(--shadow-md); }
.chart-header {
  display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px;
}
.chart-title { font-family: var(--f-serif); font-size: 1.02rem; font-weight: 600; color: var(--text-primary); }
.chart-subtitle {
  font-family: var(--f-mono); font-size: .57rem; text-transform: uppercase;
  letter-spacing: .12em; color: var(--text-muted); margin-top: 4px;
}
.chart-num { font-family: var(--f-serif); font-size: 1.6rem; font-weight: 700; color: var(--text-primary); letter-spacing: -.04em; text-align: right; }
.chart-num-label { font-family: var(--f-mono); font-size: .56rem; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); text-align: right; margin-top: 2px; }
.chart-insight {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 14px;
  font-family: var(--f-mono); font-size: .59rem; color: var(--color-success); letter-spacing: .06em;
}
.ct {
  background: var(--surface-invert); border-radius: 8px; padding: 9px 14px;
  font-family: var(--f-mono); font-size: .61rem; color: var(--text-invert-dim); line-height: 1.7;
  box-shadow: var(--shadow-md); border: 1px solid rgba(255,255,255,.06);
}
.ct-val { color: var(--accent-light); font-weight: 500; }

/* SESSION CARDS */
.sessions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.session-card {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 18px 16px; display: flex; flex-direction: column;
  gap: 10px; position: relative; overflow: hidden;
  animation: fadeUp .5s var(--ease) both;
  transition: transform .28s var(--spring), box-shadow .28s, border-color .2s;
}
.session-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--border-mid); }
.session-card-stripe {
  position: absolute; top: 0; left: 0; width: 3px; height: 100%;
  background: var(--accent); opacity: .45; border-radius: 12px 0 0 12px;
}
.session-top { display: flex; align-items: center; justify-content: space-between; }
.session-type {
  font-family: var(--f-mono); font-size: .56rem; text-transform: uppercase;
  letter-spacing: .1em; color: var(--text-muted); background: var(--surface-2);
  border: 1px solid var(--border-subtle); padding: 3px 8px; border-radius: 4px;
}
.session-dur {
  display: flex; align-items: center; gap: 4px; font-family: var(--f-mono);
  font-size: .57rem; color: var(--accent); letter-spacing: .04em;
}
.session-title {
  font-family: var(--f-serif); font-size: .94rem; font-weight: 600;
  color: var(--text-primary); line-height: 1.35;
}
.session-footer {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-subtle);
}
.session-date {
  display: flex; align-items: center; gap: 4px; font-family: var(--f-mono);
  font-size: .59rem; color: var(--text-muted);
}
.session-btn {
  display: flex; align-items: center; gap: 5px; background: transparent;
  border: 1px solid var(--border-subtle); color: var(--text-secondary);
  font-family: var(--f-mono); font-size: .59rem; letter-spacing: .06em;
  text-transform: uppercase; padding: 6px 12px; border-radius: 5px; cursor: pointer;
  transition: background .18s, color .18s, border-color .18s;
}
.session-btn:hover { background: var(--text-primary); color: var(--bg-page); border-color: var(--text-primary); }

/* HEATMAP */
.heatmap-card {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 22px 20px; margin-top: 28px;
  animation: fadeUp var(--dur) var(--ease) 240ms both;
}
.heatmap-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; margin-top: 16px; }
.heatmap-week { display: flex; flex-direction: column; gap: 3px; }
.hm-cell { width: 100%; aspect-ratio: 1; border-radius: 2px; cursor: pointer; transition: transform .15s var(--spring), opacity .15s; }
.hm-cell:hover { transform: scale(1.55); z-index: 10; position: relative; }
.hm-cell[data-l="0"] { background: var(--surface-2); border: 1px solid var(--border-subtle); }
.hm-cell[data-l="1"] { background: color-mix(in srgb, var(--accent) 20%, var(--surface-2)); }
.hm-cell[data-l="2"] { background: color-mix(in srgb, var(--accent) 45%, var(--surface-2)); }
.hm-cell[data-l="3"] { background: color-mix(in srgb, var(--accent) 72%, var(--surface-2)); }
.hm-cell[data-l="4"] { background: var(--accent); }
@supports not (color: color-mix(in srgb, red, blue)) {
  .hm-cell[data-l="1"] { background: rgba(196,145,58,.2); }
  .hm-cell[data-l="2"] { background: rgba(196,145,58,.45); }
  .hm-cell[data-l="3"] { background: rgba(196,145,58,.72); }
}
.heatmap-legend { display: flex; align-items: center; gap: 4px; margin-top: 12px; justify-content: flex-end; }
.hm-legend-label { font-family: var(--f-mono); font-size: .56rem; color: var(--text-muted); }

/* SIDEBAR */
.sidebar { display: flex; flex-direction: column; gap: 18px; }

/* TODAY CARD */
.today-card {
    background: linear-gradient(
    180deg,
    var(--surface-2),
    var(--surface-1)
  );
  border: 1px solid var(--border-subtle); border-radius: 12px; padding: 22px 20px;
  position: relative; overflow: hidden; animation: fadeUp var(--dur) var(--ease) 100ms both;
  box-shadow: var(--shadow-md);
}

.dark .today-card {
  background: linear-gradient(
    180deg,
    rgba(30, 27, 20, 0.95),
    rgba(20, 18, 14, 0.95)
  );
  border: 1px solid var(--border-mid);
}

.today-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(196,145,58,.5), transparent);
}
.today-card::after {
  content: '◈'; position: absolute; bottom: -18px; right: 14px;
  font-size: 6.5rem; line-height: 1; color: rgba(255,255,255,.022);
  pointer-events: none; font-family: var(--f-serif);
}
.today-card-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at top right, rgba(196,145,58,.07) 0%, transparent 60%);
}
.today-tag {
  font-family: var(--f-mono); font-size: .56rem; text-transform: uppercase;
  letter-spacing: .16em; color: var(--text-invert-dim); margin-bottom: 10px; position: relative; z-index: 1;
}
.today-date {
  font-family: var(--f-serif); font-size: 1.75rem; font-weight: 700;
  color: var(--text-invert); line-height: 1; letter-spacing: -.03em; position: relative; z-index: 1;
}
.today-weekday {
  font-family: var(--f-mono); font-size: .6rem; color: var(--accent-light);
  letter-spacing: .1em; margin-top: 5px; position: relative; z-index: 1;
}
.today-divider { height: 1px; background: rgba(255,255,255,.07); margin: 18px 0; position: relative; z-index: 1; }
.today-focus-label {
  font-family: var(--f-mono); font-size: .56rem; text-transform: uppercase;
  letter-spacing: .12em; color: var(--text-invert-dim); margin-bottom: 6px; position: relative; z-index: 1;
}
.today-focus-val {
  font-family: var(--f-serif); font-size: 1.45rem; font-weight: 600;
  color: var(--text-invert); position: relative; z-index: 1;
}
.today-track {
  height: 3px; background: rgba(255,255,255,.07); border-radius: 2px;
  margin-top: 12px; overflow: hidden; position: relative; z-index: 1;
}
.today-fill {
  height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-light));
  border-radius: 2px; transition: width 1.4s var(--ease);
}
.today-goal-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 7px; position: relative; z-index: 1;
}
.today-goal { font-family: var(--f-mono); font-size: .55rem; color: rgba(240,234,216,.22); }
.today-goal-edit-btn {
  background: none; border: none; cursor: pointer; color: rgba(240,234,216,.25);
  display: flex; align-items: center; padding: 2px; transition: color .2s;
}
.today-goal-edit-btn:hover { color: var(--accent); }
.today-goal-input-row {
  display: flex; align-items: center; gap: 6px; margin-top: 10px; position: relative; z-index: 1;
}
.today-goal-input {
  background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
  color: var(--text-invert); font-family: var(--f-mono); font-size: .65rem;
  padding: 5px 9px; border-radius: 5px; width: 72px; outline: none; transition: border-color .2s;
}
.today-goal-input:focus { border-color: var(--accent); }
.today-goal-save-btn {
  background: var(--accent); color: #fff; border: none; padding: 5px 10px;
  border-radius: 5px; cursor: pointer; font-family: var(--f-mono); font-size: .62rem;
  transition: background .2s;
}
.today-goal-save-btn:hover { background: var(--accent-dark); }
.today-goal-cancel-btn {
  background: none; border: none; cursor: pointer; color: rgba(240,234,216,.3);
  padding: 5px; display: flex; align-items: center; transition: color .2s;
}
.today-goal-cancel-btn:hover { color: var(--color-danger); }

/* SIDEBAR CARD */
.sb-card {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 18px 16px;
  animation: fadeUp var(--dur) var(--ease) 140ms both; transition: box-shadow .22s;
}
.sb-card:hover { box-shadow: var(--shadow-sm); }
.sb-card-title {
  display: flex; align-items: center; gap: 8px; font-family: var(--f-serif);
  font-size: .88rem; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;
}
.sb-card-title svg { color: var(--accent); opacity: .7; }

/* DONUT */
.donut-row { display: flex; align-items: center; gap: 14px; }
.donut-legend { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.donut-legend-item { display: flex; align-items: center; gap: 8px; font-family: var(--f-body); font-size: .72rem; color: var(--text-secondary); }
.donut-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.donut-pct { font-family: var(--f-mono); font-size: .59rem; color: var(--text-muted); margin-left: auto; }
/* PART 6: Dominant focus insight */
.donut-dominant {
  margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-subtle);
  font-family: var(--f-mono); font-size: .57rem; color: var(--text-muted);
  display: flex; align-items: center; gap: 6px;
}
.donut-dominant span { color: var(--accent); }

/* QUICK ACTIONS */
.qa-item {
  width: 100%; display: flex; align-items: center; gap: 12px;
  background: transparent; border: none; cursor: pointer; padding: 10px 0;
  text-align: left; border-bottom: 1px solid var(--border-subtle); transition: opacity .18s;
}
.qa-item:last-child { border-bottom: none; padding-bottom: 0; }
.qa-item:hover { opacity: .72; }
.qa-item:hover .qa-arr { transform: translateX(3px); }
.qa-icon {
  width: 32px; height: 32px; border-radius: 7px; background: var(--surface-2);
  border: 1px solid var(--border-subtle); display: grid; place-items: center;
  color: var(--text-secondary); flex-shrink: 0; transition: background .18s;
}
.qa-item.hi .qa-icon { background: var(--accent); color: #fff; border-color: transparent; }
.qa-text { flex: 1; }
.qa-title { font-family: var(--f-body); font-size: .76rem; font-weight: 500; color: var(--text-primary); }
.qa-desc { font-family: var(--f-mono); font-size: .56rem; color: var(--text-muted); letter-spacing: .04em; margin-top: 2px; }
.qa-arr { color: var(--text-muted); transition: transform .2s; }

/* TIP CARD */
.tip-card {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--accent); border-radius: 12px; padding: 16px 14px;
  animation: fadeUp var(--dur) var(--ease) 200ms both;
}
.tip-tag { font-family: var(--f-mono); font-size: .57rem; text-transform: uppercase; letter-spacing: .14em; color: var(--accent); margin-bottom: 9px; }
.tip-body { font-family: var(--f-body); font-size: .76rem; color: var(--text-secondary); line-height: 1.72; font-style: italic; }

/* EMPTY STATE */
.empty-state {
  border: 1px dashed var(--border-mid); border-radius: 12px; padding: 56px 28px;
  text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px;
  animation: fadeUp .5s var(--ease) both;
}
.empty-icon {
  width: 64px; height: 64px; border-radius: 50%; background: var(--surface-2);
  border: 1px solid var(--border-subtle); display: grid; place-items: center;
  color: var(--text-secondary); margin-bottom: 4px;
}
.empty-title { font-family: var(--f-serif); font-size: 1.12rem; font-weight: 600; color: var(--text-primary); }
.empty-sub { font-size: .77rem; color: var(--text-muted); max-width: 255px; line-height: 1.7; }
.empty-feat { display: flex; align-items: center; gap: 8px; font-family: var(--f-body); font-size: .72rem; color: var(--text-secondary); }
.empty-check {
  width: 16px; height: 16px; border-radius: 50%; background: var(--accent-dim);
  border: 1px solid var(--accent); display: grid; place-items: center; color: var(--accent); flex-shrink: 0;
}

/* SKELETON */
.skeleton {
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border-subtle) 50%, var(--surface-2) 75%);
  background-size: 200% 100%; animation: shimmer 1.6s ease-in-out infinite; border-radius: 12px;
}
.err-msg { font-family: var(--f-mono); font-size: .67rem; color: var(--color-danger); padding: 12px 0; }

/* KEYFRAMES */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .4; transform: scale(.75); }
}
@keyframes insightFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes insightGlow {
  0%, 100% { opacity: .6; }
  50%       { opacity: 1; }
}
@keyframes bannerIn {
  from { opacity: 0; transform: translateY(-12px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0); max-height: 100px; }
}
@keyframes bannerOut {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-8px); }
}

/* ══ REWARD BANNER ══ */
.reward-banner {
  background: linear-gradient(135deg, var(--surface-invert) 0%, rgba(196,145,58,.08) 100%);
  border: 1px solid rgba(196,145,58,.35);
  border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
  display: flex; align-items: center; gap: 14px; position: relative; overflow: hidden;
  animation: rewardIn .5s var(--spring) both;
  box-shadow: 0 0 0 1px rgba(196,145,58,.1), 0 8px 32px rgba(196,145,58,.12);
}
.reward-banner.dismissing { animation: bannerOut .3s var(--ease) both; }
.reward-banner-shimmer {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 40%, rgba(196,145,58,.07) 50%, transparent 60%);
  animation: rewardShimmer 2.2s ease-in-out infinite;
}
.reward-banner-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  display: grid; place-items: center; color: #fff;
  box-shadow: 0 4px 12px rgba(196,145,58,.4);
}
.reward-banner-tag {
  font-family: var(--f-mono); font-size: .54rem; letter-spacing: .16em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 3px;
}
.reward-banner-text {
  font-family: var(--f-serif); font-size: .9rem; font-weight: 600;
  color: var(--text-invert); line-height: 1.3;
}
.reward-banner-sub {
  font-family: var(--f-mono); font-size: .56rem; color: var(--text-invert-dim);
  margin-top: 2px;
}
.reward-banner-close {
  margin-left: auto; background: none; border: none; cursor: pointer;
  color: rgba(240,234,216,.3); padding: 4px; transition: color .2s; flex-shrink: 0;
}
.reward-banner-close:hover { color: var(--accent); }

@keyframes rewardIn {
  from { opacity: 0; transform: translateY(-16px) scale(.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes rewardShimmer {
  0%   { transform: translateX(-100%); }
  60%, 100% { transform: translateX(200%); }
}

/* ══ MISSED DAY RECOVERY ══ */
.missed-day-card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--accent);
  border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
  display: flex; align-items: flex-start; gap: 12px;
  animation: fadeUp var(--dur) var(--ease) both;
}
.missed-day-icon {
  width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
  background: var(--accent-dim); border: 1px solid var(--accent-glow);
  display: grid; place-items: center; color: var(--accent);
}
.missed-day-tag {
  font-family: var(--f-mono); font-size: .54rem; letter-spacing: .14em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 3px;
}
.missed-day-text {
  font-family: var(--f-body); font-size: .78rem;
  color: var(--text-secondary); line-height: 1.55; font-style: italic;
}
.missed-day-sub {
  font-family: var(--f-mono); font-size: .56rem;
  color: var(--text-muted); margin-top: 4px;
}
.missed-day-actions {
  display: flex; align-items: center; gap: 8px; margin-top: 10px;
}
.missed-day-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--accent); color: #fff;
  font-family: var(--f-mono); font-size: .6rem; font-weight: 500;
  letter-spacing: .07em; text-transform: uppercase;
  padding: 7px 13px; border-radius: 5px; border: none; cursor: pointer;
  transition: transform .18s var(--spring), box-shadow .18s;
  box-shadow: 0 3px 10px rgba(196,145,58,.25);
}
.missed-day-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(196,145,58,.35); }
.missed-day-dismiss {
  background: none; border: none; cursor: pointer;
  font-family: var(--f-mono); font-size: .58rem;
  color: var(--text-muted); padding: 4px 6px; transition: color .2s;
}
.missed-day-dismiss:hover { color: var(--text-secondary); }

/* ══ TODAY PLAN SECTION ══ */
.today-plan-wrap {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 20px 20px 16px;
  margin-bottom: 24px;
  animation: fadeUp var(--dur) var(--ease) 80ms both;
  transition: box-shadow .28s, transform .28s var(--spring);
}
.today-plan-wrap:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.today-plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.today-plan-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.today-plan-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--f-serif);
  font-size: .95rem;
  font-weight: 600;
  color: var(--text-primary);
}
.today-plan-count {
  font-family: var(--f-mono);
  font-size: .56rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  padding: 3px 8px;
  border-radius: 20px;
}
.today-plan-add-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-family: var(--f-mono);
  font-size: .59rem;
  letter-spacing: .07em;
  text-transform: uppercase;
  padding: 6px 11px;
  border-radius: 5px;
  cursor: pointer;
  transition: border-color .2s, color .2s, transform .2s var(--spring);
}
.today-plan-add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: translateY(-1px);
}

/* Rail */
.today-plan-rail {
  height: 2px;
  background: var(--surface-3);
  border-radius: 2px;
  margin-bottom: 16px;
  overflow: hidden;
}
.today-plan-rail-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-light));
  border-radius: 2px;
  transition: width 1.2s var(--ease);
}

/* List */
.today-plan-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.today-plan-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 13px;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-2);
  transition: transform .22s var(--spring), box-shadow .22s, border-color .2s, background .2s;
  animation: fadeUp .38s var(--ease) both;
  position: relative;
  overflow: hidden;
}
.today-plan-item:hover {
  transform: translateX(3px);
  box-shadow: var(--shadow-xs);
  border-color: var(--border-mid);
}
.today-plan-item.highlight {
  border-color: rgba(196,145,58,.4);
  background: var(--accent-dim2);
  box-shadow: 0 0 0 1px rgba(196,145,58,.1), var(--shadow-xs);
}
.today-plan-item.highlight::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--accent);
  border-radius: 9px 0 0 9px;
}
.today-plan-item.done {
  opacity: .55;
}
.today-plan-item.done:hover {
  opacity: .75;
}

/* Check marker */
.today-plan-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--border-mid);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-family: var(--f-mono);
  font-size: .56rem;
  color: var(--text-muted);
  background: var(--surface-1);
  transition: border-color .2s, background .2s, color .2s;
}
.today-plan-check.checked {
  background: var(--color-success);
  border-color: var(--color-success);
  color: #fff;
}
.today-plan-item.highlight .today-plan-check {
  border-color: var(--accent);
  color: var(--accent);
}

/* Item info */
.today-plan-item-info {
  flex: 1;
  min-width: 0;
}
.today-plan-item-title {
  font-family: var(--f-serif);
  font-size: .84rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.today-plan-item.done .today-plan-item-title {
  text-decoration: line-through;
  color: var(--text-muted);
}
.today-plan-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}
.today-plan-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: var(--f-mono);
  font-size: .53rem;
  letter-spacing: .07em;
  color: var(--text-muted);
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  padding: 2px 6px;
  border-radius: 3px;
}

/* Priority badge */
.today-plan-priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--f-mono);
  font-size: .52rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--accent);
  background: var(--accent-dim);
  border: 1px solid rgba(196,145,58,.2);
  padding: 3px 7px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Item CTA button */
.today-plan-item-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-family: var(--f-mono);
  font-size: .57rem;
  letter-spacing: .05em;
  text-transform: uppercase;
  padding: 6px 11px;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .18s, color .18s, border-color .18s, transform .2s var(--spring);
}
.today-plan-item-btn:hover {
  background: var(--text-primary);
  color: var(--bg-page);
  border-color: var(--text-primary);
  transform: translateY(-1px);
}
.today-plan-item-btn.primary {
  background: var(--accent);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 3px 12px rgba(196,145,58,.3);
}
.today-plan-item-btn.primary:hover {
  background: var(--accent-dark);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(196,145,58,.4);
}
.today-plan-item-btn.review {
  opacity: .6;
}
.today-plan-item-btn.review:hover {
  opacity: 1;
}

/* Empty state */
.today-plan-empty {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface-1);
  border: 1px dashed var(--border-mid);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 24px;
  animation: fadeUp var(--dur) var(--ease) 80ms both;
}
.today-plan-empty-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  display: grid;
  place-items: center;
  color: var(--text-muted);
  flex-shrink: 0;
}
.today-plan-empty-title {
  font-family: var(--f-serif);
  font-size: .88rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.today-plan-empty-sub {
  font-family: var(--f-mono);
  font-size: .57rem;
  color: var(--text-muted);
  letter-spacing: .04em;
}
.today-plan-empty-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
  background: var(--accent);
  color: #fff;
  border: none;
  font-family: var(--f-mono);
  font-size: .6rem;
  font-weight: 500;
  letter-spacing: .07em;
  text-transform: uppercase;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: transform .2s var(--spring), box-shadow .2s;
  box-shadow: 0 3px 10px rgba(196,145,58,.25);
}
.today-plan-empty-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(196,145,58,.35);
}

@keyframes cardHoverGlow {
  from { box-shadow: var(--shadow-sm), 0 0 0 1px transparent; }
  to   { box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent-dim); }
}

@keyframes statCountIn {
  from { opacity: 0; transform: translateY(12px) scale(.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes ribbonGlowPulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(196,145,58,.1), var(--shadow-md); }
  50%       { box-shadow: 0 0 0 1px rgba(196,145,58,.22), 0 8px 40px rgba(196,145,58,.15); }
}

@keyframes iconGlowPulse {
  0%, 100% { box-shadow: 0 0 12px var(--accent-glow); }
  50%       { box-shadow: 0 0 22px var(--accent-glow), 0 0 6px var(--accent-glow); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes borderTrace {
  from { background-position: 0% 50%; }
  to   { background-position: 200% 50%; }
}

@keyframes nextActionPulse {
  0%, 100% { box-shadow: var(--shadow-md), 0 0 0 1px rgba(196,145,58,.08); }
  50%       { box-shadow: var(--shadow-md), 0 0 0 1px rgba(196,145,58,.2), 0 0 28px rgba(196,145,58,.08); }
}

@keyframes heatmapFadeIn {
  from { opacity: 0; transform: scaleY(.92); transform-origin: top; }
  to   { opacity: 1; transform: scaleY(1); }
}

@keyframes buttonRipple {
  from { transform: scale(0); opacity: .4; }
  to   { transform: scale(2.5); opacity: 0; }
}

.insight-ribbon {
  animation: ribbonGlowPulse 4s ease-in-out infinite,
             fadeUp var(--dur) var(--ease) both;
  transition: transform .3s var(--spring), box-shadow .3s;
}
.insight-ribbon:hover {
  transform: translateY(-2px);
}

.insight-icon-wrap {
  animation: iconGlowPulse 2.8s ease-in-out infinite;
  transition: transform .25s var(--spring);
}
.insight-ribbon:hover .insight-icon-wrap {
  transform: scale(1.12) rotate(-4deg);
}

/* Insight text fade+slide on change */
.insight-body {
  animation: slideUp .38s var(--ease) both;
}

/* Dot hover feedback */
.insight-dot {
  transition: background .25s, transform .3s var(--spring), opacity .2s;
}
.insight-dot:hover:not(.active) {
  background: rgba(240,234,216,.45);
  transform: scale(1.5);
}

.insight-action {
  transition: border-color .22s, background .22s, transform .25s var(--spring), box-shadow .22s;
}
.insight-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(196,145,58,.15);
}
.insight-action:active {
  transform: translateY(0) scale(.97);
}

.next-action-block {
  animation: nextActionPulse 5s ease-in-out infinite,
             fadeUp var(--dur) var(--ease) 60ms both;
  transition: box-shadow .35s, transform .35s var(--spring), border-color .25s;
}
.next-action-block:hover {
  transform: translateY(-3px);
  border-color: rgba(196,145,58,.28);
}

.next-action-icon-wrap {
  transition: transform .3s var(--spring), box-shadow .3s;
}
.next-action-block:hover .next-action-icon-wrap {
  transform: scale(1.08) rotate(-5deg);
  box-shadow: 0 0 24px var(--accent-glow);
}

.next-action-btn {
  position: relative;
  overflow: hidden;
  transition: transform .25s var(--spring), box-shadow .25s, background .2s;
}
.next-action-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,.15);
  border-radius: inherit;
  transform: scale(0);
  opacity: 0;
  transition: transform .4s var(--ease), opacity .4s;
}
.next-action-btn:active::after {
  animation: buttonRipple .38s var(--ease) forwards;
}
.next-action-btn:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 10px 28px rgba(196,145,58,.45);
}
.next-action-btn:active {
  transform: translateY(0) scale(.98);
  box-shadow: 0 4px 12px rgba(196,145,58,.25);
}


.stat-card {
  transition: transform .3s var(--spring), box-shadow .3s, border-color .22s;
  animation: statCountIn var(--dur) var(--ease) both;
}
.stat-card:hover {
  transform: translateY(-5px) scale(1.015);
  box-shadow: var(--shadow-md);
  border-color: var(--border-mid);
}
.stat-card:hover .stat-card-icon {
  transform: scale(1.12) rotate(-4deg);
}
.stat-card-icon {
  transition: transform .3s var(--spring);
}
.stat-card-value {
  transition: color .3s;
}
.stat-card:hover .stat-card-value {
  color: var(--accent);
}


.session-card {
  transition: transform .3s var(--spring), box-shadow .3s, border-color .22s;
  will-change: transform;
}
.session-card:hover {
  transform: translateY(-5px) scale(1.012);
  box-shadow: var(--shadow-md);
  border-color: var(--border-mid);
}
.session-card:hover .session-card-stripe {
  opacity: .75;
  box-shadow: 2px 0 12px var(--accent-glow);
}
.session-card-stripe {
  transition: opacity .3s, box-shadow .3s;
}

.session-btn {
  transition: background .2s, color .2s, border-color .2s,
              transform .22s var(--spring), box-shadow .2s;
}
.session-btn:hover {
  transform: translateX(2px);
}
.session-btn:active {
  transform: scale(.97);
}

.today-session-card {
  transition: transform .28s var(--spring), box-shadow .28s, border-color .22s, background .22s;
  border-radius: 10px;
}
.today-session-card:hover {
  transform: translateY(-2px) translateX(2px);
  box-shadow: var(--shadow-sm);
  border-color: var(--border-mid);
}
.today-session-card.highlighted {
  box-shadow: 0 0 0 1px rgba(196,145,58,.2), var(--shadow-sm);
}

.today-session-btn {
  transition: background .2s, color .2s, border-color .2s, transform .22s var(--spring);
}
.today-session-btn:active {
  transform: scale(.96);
}

.chart-card {
  transition: box-shadow .32s, transform .32s var(--spring), border-color .22s;
}
.chart-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-mid);
}


.heatmap-card {
  animation: heatmapFadeIn .6s var(--ease) 240ms both;
}
.hm-cell {
  transition: transform .18s var(--spring), opacity .18s;
}
.hm-cell:hover {
  transform: scale(1.6);
  z-index: 10;
  position: relative;
  opacity: 1;
}


.sb-card {
  transition: box-shadow .28s, transform .28s var(--spring), border-color .22s;
}
.sb-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
  border-color: var(--border-mid);
}

.today-card {
  transition: box-shadow .3s, transform .3s var(--spring);
}
.today-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}


.qa-item {
  transition: opacity .2s, transform .22s var(--spring);
  border-radius: 8px;
}
.qa-item:hover {
  opacity: 1;
  transform: translateX(3px);
}
.qa-item:hover .qa-icon {
  transform: scale(1.08) rotate(-4deg);
}
.qa-item:active {
  transform: translateX(1px) scale(.99);
}
.qa-icon {
  transition: transform .28s var(--spring), background .2s, color .2s;
}


.week-cal-cell {
  transition: transform .2s var(--spring), box-shadow .2s;
}
.week-cal-cell:hover {
  transform: scale(1.18) translateY(-1px);
  z-index: 2;
  position: relative;
  box-shadow: 0 4px 10px var(--accent-glow);
}

.recommendation-card {
  transition: box-shadow .28s, transform .28s var(--spring), border-color .22s;
}
.recommendation-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
  border-color: rgba(107,140,107,.35);
}

.recommendation-action-btn {
  transition: transform .25s var(--spring), box-shadow .25s, opacity .2s;
}
.recommendation-action-btn:active {
  transform: scale(.97);
  box-shadow: 0 2px 6px rgba(107,140,107,.2);
}

.fatigue-alert {
  transition: box-shadow .28s, transform .28s var(--spring);
}
.fatigue-alert:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

/* ── Dark mode: surface legibility patches ── */
.dark .stat-card {
  background: var(--surface-1);
  border-color: var(--border-subtle);
}
.dark .stat-card:hover {
  background: var(--surface-2);
  border-color: var(--border-mid);
}

/* Fix: dark chart card background */
.dark .chart-card {
  background: var(--surface-1);
}

/* Fix: dark sidebar cards */
.dark .sb-card {
  background: var(--surface-1);
  border-color: var(--border-subtle);
}

/* Fix: dark today sessions section */
.dark .today-session-card {
  background: var(--surface-1);
  border-color: var(--border-subtle);
}
.dark .today-session-card:hover {
  background: var(--surface-2);
}

/* Fix: dark today-session-tag contrast */
.dark .today-session-tag {
  background: var(--surface-3);
  border-color: var(--border-mid);
  color: var(--text-secondary);
}

/* Fix: session type chip in dark */
.dark .session-type {
  background: var(--surface-3);
  border-color: var(--border-mid);
  color: var(--text-secondary);
}

/* Fix: session-footer border too faint in dark */
.dark .session-footer {
  border-top-color: var(--border-mid);
}

/* Fix: heatmap cells too invisible in dark */
.dark .hm-cell[data-l="0"] {
  background: var(--surface-3);
  border-color: var(--border-mid);
}
.dark .week-cal-cell[data-l="0"] {
  background: var(--surface-3);
  border-color: var(--border-mid);
}

/* Fix: tip card in dark — border left too faint */
.dark .tip-card {
  background: var(--surface-2);
  border-color: var(--border-mid);
}

/* Fix: recommendation chip in dark */
.dark .recommendation-chip {
  background: var(--surface-3);
  border-color: var(--border-mid);
  color: var(--text-secondary);
}

/* Fix: empty state border in dark */
.dark .empty-state {
  border-color: var(--border-mid);
}
.dark .empty-icon {
  background: var(--surface-3);
  border-color: var(--border-mid);
}

/* Fix: hero badge in dark — too faint */
.dark .hero-badge {
  background: var(--accent-dim);
  border-color: rgba(212,162,74,.3);
}

/* Fix: next-action-session-preview in dark */
.dark .next-action-session-preview {
  background: rgba(255,255,255,.04);
  border-color: rgba(255,255,255,.07);
}

/* Fix: today-goal text visibility in dark */
.dark .today-goal {
  color: rgba(240,234,216,.32);
}

/* Fix: insight-ribbon glow in dark mode */
.dark .insight-ribbon {
  box-shadow: 0 0 0 1px rgba(212,162,74,.12), var(--shadow-md);
}

/* Fix: missed day card in dark */
.dark .missed-day-card {
  background: var(--surface-2);
  border-color: var(--border-mid);
  border-left-color: var(--accent);
}

/* Light mode: soften harsh borders */
:root .stat-card,
:root .chart-card,
:root .sb-card,
:root .session-card,
:root .today-session-card {
  border-color: var(--border-subtle);
}

/* Light mode: keep surfaces warm, not clinical white */
:root .insight-ribbon {
  box-shadow: 0 0 0 1px rgba(196,145,58,.09), var(--shadow-md);
}

/* Guarantee consistent easing across all interactive elements */
.hero-cta,
.hero-cta-sub,
.next-action-btn,
.session-btn,
.today-session-btn,
.insight-action,
.insight-dot,
.qa-item,
.qa-icon,
.recommendation-action-btn,
.missed-day-btn,
.today-goal-save-btn,
.sec-rule-action,
.stat-card,
.session-card,
.today-session-card,
.chart-card,
.sb-card,
.today-card,
.week-cal-cell,
.hm-cell,
.next-action-block,
.insight-ribbon {
  will-change: transform;
}

/* Universal: no transition on reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}


/* Subtle glass for feedback/reward banners */
.feedback-banner,
.reward-banner {
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
}

/* Stronger glass on today sidebar card in light mode */
:root .today-card {
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
}

/* Insight ribbon glass */
.insight-ribbon {
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* Next action block glass layer */
.next-action-block {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* Consistent border-radius across card family */
.today-session-card,
.recommendation-card,
.fatigue-alert,
.missed-day-card {
  border-radius: 10px;
}

.session-card,
.stat-card,
.chart-card,
.sb-card,
.week-calendar,
.heatmap-card {
  border-radius: 12px;
}

.next-action-block,
.today-card,
.insight-ribbon {
  border-radius: 14px;
}

/* Fix: hero metrics gap on small screens */
@media (max-width: 480px) {
  .hero-metrics {
    gap: 16px;
  }
  .hero-metric-val {
    font-size: 1.5rem;
  }
  .hero-title {
    font-size: clamp(1.7rem, 7vw, 2.8rem);
  }
}

/* Fix: recommendation chips wrap cleanly */
.recommendation-chips {
  gap: 5px;
  align-items: center;
}

/* Fix: donut legend items line-height */
.donut-legend-item {
  line-height: 1.4;
}

/* Fix: section rule gem spacing */
.sec-rule-gem {
  flex-shrink: 0;
}

/* Fix: today-progress-narrative responsive */
@media (max-width: 560px) {
  .today-progress-narrative {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

/* ============================= */
/* 🔥 DASHBOARD THEME FIX (FINAL OVERRIDE) */
/* ============================= */

/* -------- Shared Fix (All 3 Components) -------- */
.insight-ribbon,
.next-action-block,
.today-card {
  color: var(--text-main) !important;
}

/* Fix all nested text */
.insight-ribbon > *:not(button):not(.next-action-btn),
.next-action-block > *:not(button):not(.next-action-btn),
.today-card > *:not(button) {
  color: inherit;
}

/* Labels / secondary text */
.insight-ribbon .label,
.next-action-block .meta,
.today-card .sub {
  color: var(--text-muted) !important;
}

/* -------- Background Fix -------- */
.insight-ribbon,
.next-action-block,
.today-card {
  background: linear-gradient(
    135deg,
    var(--surface-2),
    var(--surface-1)
  ) !important;

  border: 1px solid var(--border-subtle) !important;
}

/* -------- DARK MODE OVERRIDES -------- */
.dark .insight-ribbon,
.dark .next-action-block,
.dark .today-card {
  background: linear-gradient(
    135deg,
    rgba(36, 32, 24, 0.95),
    rgba(22, 20, 16, 0.95)
  ) !important;

  border: 1px solid var(--border-mid) !important;
  color: var(--text-main) !important;
}

/* -------- Remove Bad Hardcoded Whites -------- */
.insight-ribbon,
.next-action-block,
.today-card {
  --force-text-fix: var(--text-main);
}

.insight-ribbon *[style*="color: #fff"],
.next-action-block *[style*="color: #fff"],
.today-card *[style*="color: #fff"] {
  color: var(--text-main) !important;
}

/* -------- Smooth Transitions (Premium Feel) -------- */
.insight-ribbon,
.next-action-block,
.today-card {
  transition: 
    background 0.3s cubic-bezier(.16,1,.3,1),
    color 0.3s cubic-bezier(.16,1,.3,1),
    border 0.3s cubic-bezier(.16,1,.3,1),
    box-shadow 0.3s cubic-bezier(.16,1,.3,1);
}

/* -------- Optional Glow Polish -------- */
.dark .insight-ribbon {
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
}

.insight-ribbon {
  box-shadow: 0 8px 30px rgba(0,0,0,0.06);
}

/* FORCE FIX: Smart Insight glyph (star) */
.insight-ribbon .insight-ribbon-glyph {
  color: rgba(0, 0, 0, 0.06) !important;
}

.dark .insight-ribbon .insight-ribbon-glyph {
  color: rgba(255, 255, 255, 0.05) !important;
}


/* ============================= */
/* 🔥 TODAY GOAL UPGRADE */
/* ============================= */

.today-goal-row.upgraded {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 10px;
  background: linear-gradient(
    135deg,
    var(--surface-2),
    var(--surface-1)
  );
  border: 1px solid var(--border-subtle);

  display: flex;
  align-items: center;
  justify-content: space-between;

  position: relative;
  overflow: hidden;

  transition: transform .25s var(--spring), box-shadow .25s;
}

.today-goal-row.upgraded:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

/* subtle premium glow */
.today-goal-row.upgraded::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 80% 20%, var(--accent-dim), transparent 60%);
  pointer-events: none;
}

/* LEFT SIDE */
.today-goal-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.today-goal-label {
  font-family: var(--f-mono);
  font-size: .55rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* MAIN VALUE */
.today-goal-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.today-goal-time {
  font-family: var(--f-serif);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.03em;
}

.today-goal-sub {
  font-family: var(--f-mono);
  font-size: .55rem;
  color: var(--text-muted);
}

/* EDIT BUTTON */
.today-goal-edit-btn.upgraded {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-1);

  display: flex;
  align-items: center;
  justify-content: center;

  color: var(--text-muted);
  cursor: pointer;

  transition: all .2s;
}

.today-goal-edit-btn.upgraded:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.08);
  box-shadow: 0 0 12px var(--accent-dim);
}

/* DARK MODE POLISH */
.dark .today-goal-row.upgraded {
  border: 1px solid var(--border-mid);
}

/* === TODAY CARD SPACING FIX (DROP-IN OVERRIDE) === */

.today-card {
  padding: 22px 20px 18px;
}

/* Header tightening */
.today-tag {
  margin-bottom: 8px;
}

.today-date {
  margin-bottom: 2px;
}

.today-weekday {
  margin-top: 2px;
}

/* Divider rhythm */
.today-divider {
  margin: 16px 0 14px;
}

/* Focus section */
.today-focus-label {
  margin-bottom: 8px;
}

.today-track {
  margin-top: 10px;
}

/* Goal section spacing (MAIN FIX) */
.today-goal-row {
  margin-top: 18px;
  align-items: center;
}

/* Goal text alignment */
.today-goal-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

/* Goal typography balance */
.today-goal-time {
  font-size: 1.5rem;
  line-height: 1;
}

.today-goal-sub {
  font-size: 0.6rem;
  margin-top: 2px;
}

/* Edit button alignment */
.today-goal-edit-btn.upgraded {
  margin-left: 10px;
}

/* === FIX EDIT MODE LAYOUT === */

.today-goal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Hide normal text when editing */
.today-goal-row.editing .today-goal-text {
  display: none;
}

/* Make input row inline instead of stacked */
.today-goal-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Prevent it from dropping full width */
.today-goal-input-row {
  flex: 1;
}

/* Input styling cleanup */
.today-goal-input {
  width: 60px;
  height: 32px;
  padding: 4px 8px;
  font-size: 0.7rem;
  border-radius: 6px;
}

/* Save button */
.today-goal-save-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 0.7rem;
}

/* Cancel button (X) */
.today-goal-cancel-btn {
  height: 32px;
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Keep everything aligned vertically */
.today-goal-row.editing {
  align-items: center;
}

/* ══ SESSION REWARD TOAST ══ */
.reward-toast {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 9999;
  min-width: 280px;
  max-width: 360px;
  background: var(--surface-invert);
  border: 1px solid rgba(196,145,58,.35);
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 13px;
  box-shadow: 0 20px 60px rgba(0,0,0,.3), 0 0 0 1px rgba(196,145,58,.1);
  transform: translateY(20px) scale(.96);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity .38s var(--ease),
    transform .42s var(--spring);
  overflow: hidden;
}
.reward-toast.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}
.reward-toast.exiting {
  opacity: 0;
  transform: translateY(10px) scale(.97);
}
.reward-toast-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at left, rgba(196,145,58,.12) 0%, transparent 60%);
  pointer-events: none;
}
.reward-toast-xp {
  display: flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  color: #fff;
  font-family: var(--f-mono);
  font-size: .66rem;
  font-weight: 600;
  letter-spacing: .07em;
  padding: 8px 12px;
  border-radius: 8px;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(196,145,58,.4);
  animation: xpPop .4s var(--spring) .1s both;
}
.reward-toast-body {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.reward-toast-headline {
  font-family: var(--f-serif);
  font-size: .86rem;
  font-weight: 600;
  color: var(--text-invert);
  line-height: 1.3;
}
.reward-toast-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}
.reward-toast-tag {
  font-family: var(--f-mono);
  font-size: .54rem;
  letter-spacing: .08em;
  color: var(--text-invert-dim);
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
  padding: 2px 7px;
  border-radius: 4px;
}
.reward-toast-close {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(240,234,216,.3);
  padding: 4px;
  transition: color .2s;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.reward-toast-close:hover { color: var(--accent); }

@keyframes xpPop {
  from { transform: scale(.7); opacity: 0; }
  to   { transform: scale(1);  opacity: 1; }
}

/* ══ XP STREAK BAR (inline in hero area) ══ */
.xp-streak-bar {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: 100px;
  padding: 7px 16px 7px 10px;
  margin-bottom: 10px;
  animation: fadeUp var(--dur) var(--ease) both;
}
.xp-streak-bar-flame {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--f-mono);
  font-size: .62rem;
  color: var(--accent);
  font-weight: 500;
}
.xp-streak-bar-sep {
  width: 1px;
  height: 14px;
  background: var(--border-subtle);
}
.xp-streak-bar-pts {
  font-family: var(--f-mono);
  font-size: .62rem;
  color: var(--text-muted);
}
.xp-streak-bar-pts strong {
  color: var(--text-primary);
  font-weight: 600;
}
.xp-streak-bar-level {
  display: flex;
  align-items: center;
  gap: 6px;
}
.xp-streak-bar-level-label {
  font-family: var(--f-mono);
  font-size: .58rem;
  color: var(--text-muted);
}
.xp-streak-bar-level-pill {
  font-family: var(--f-mono);
  font-size: .56rem;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--accent);
  background: var(--accent-dim);
  border: 1px solid rgba(196,145,58,.2);
  padding: 2px 7px;
  border-radius: 20px;
}
.xp-streak-bar-track {
  width: 48px;
  height: 3px;
  background: var(--surface-3);
  border-radius: 2px;
  overflow: hidden;
}
.xp-streak-bar-track-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-light));
  border-radius: 2px;
  transition: width 1s var(--ease);
}

/* ══ HABIT LOOP UPGRADES ══ */

/* Mission block — upgraded Next Action messaging */
.next-action-mission-context {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.next-action-mission-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--f-mono);
  font-size: .53rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 20px;
  white-space: nowrap;
}
.next-action-mission-pill.streak {
  background: rgba(255,107,53,.12);
  border: 1px solid rgba(255,107,53,.25);
  color: #ff9a5c;
}
.next-action-mission-pill.goal {
  background: var(--accent-dim);
  border: 1px solid var(--accent-dim);
  color: var(--accent-light);
}
.next-action-mission-pill.complete {
  background: rgba(107,140,107,.12);
  border: 1px solid rgba(107,140,107,.25);
  color: var(--color-success);
}

/* Streak risk warning banner */
.streak-risk-bar {
  background: rgba(255,107,53,.08);
  border: 1px solid rgba(255,107,53,.2);
  border-left: 3px solid #ff6b35;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: fadeUp var(--dur) var(--ease) both;
}
.streak-risk-icon {
  width: 28px; height: 28px;
  border-radius: 7px;
  background: rgba(255,107,53,.12);
  border: 1px solid rgba(255,107,53,.2);
  display: grid; place-items: center;
  color: #ff9a5c;
  flex-shrink: 0;
}
.streak-risk-tag {
  font-family: var(--f-mono);
  font-size: .54rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #ff9a5c;
  margin-bottom: 3px;
}
.streak-risk-text {
  font-family: var(--f-body);
  font-size: .78rem;
  color: var(--text-secondary);
  line-height: 1.5;
  font-style: italic;
  flex: 1;
}
.streak-risk-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ff6b35;
  color: #fff;
  font-family: var(--f-mono);
  font-size: .6rem;
  font-weight: 500;
  letter-spacing: .07em;
  text-transform: uppercase;
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform .2s var(--spring), box-shadow .2s;
  box-shadow: 0 3px 12px rgba(255,107,53,.3);
}
.streak-risk-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(255,107,53,.4);
}

/* XP Pop animation — for stat card XP */
@keyframes xpScalePop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.22); }
  70%  { transform: scale(.96); }
  100% { transform: scale(1); }
}
.xp-pop {
  animation: xpScalePop .45s var(--spring);
}

/* Progress bar glow pulse on completion */
@keyframes barGlowComplete {
  0%   { box-shadow: 0 0 0 rgba(196,145,58,0); }
  50%  { box-shadow: 0 0 16px rgba(196,145,58,.5); }
  100% { box-shadow: 0 0 0 rgba(196,145,58,0); }
}
.today-fill.complete {
  animation: barGlowComplete 1.2s ease-in-out;
}

/* Insight action inline CTA */
.insight-inline-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--f-mono);
  font-size: .6rem;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--accent);
  background: var(--accent-dim);
  border: 1px solid rgba(196,145,58,.2);
  padding: 3px 9px;
  border-radius: 20px;
  cursor: pointer;
  margin-left: 6px;
  white-space: nowrap;
  transition: background .18s, border-color .18s;
  vertical-align: middle;
}
.insight-inline-action:hover {
  background: rgba(196,145,58,.2);
  border-color: var(--accent);
}

/* Session reward card — always-visible upgrade */
.src-persistent {
  position: relative;
  overflow: hidden;
}
.src-persistent::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(196,145,58,.04) 50%, transparent 60%);
  animation: srcShimmer 4s ease-in-out infinite;
  pointer-events: none;
}
@keyframes srcShimmer {
  0%   { transform: translateX(-100%); }
  60%, 100% { transform: translateX(200%); }
}

`;

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════ */

const GrainOverlay = memo(() => (
  <svg className="grain-svg" xmlns="http://www.w3.org/2000/svg">
    <filter id="dg">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.65"
        numOctaves="3"
        stitchTiles="stitch"
      />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#dg)" />
  </svg>
));

const SectionRule = memo(({ label, action, onAction }) => (
  <div className="sec-rule">
    <div className="sec-rule-line" />
    <span className="sec-rule-gem">✦</span>
    <span className="sec-rule-label">{label}</span>
    <span className="sec-rule-gem">✦</span>
    <div className="sec-rule-line" />
    {action && (
      <button className="sec-rule-action" onClick={onAction}>
        {action} <ArrowRight size={10} />
      </button>
    )}
  </div>
));

const StreakRiskBar = memo(({ streak, navigate }) => {
  if (!streak || streak < 2) return null;
  const h = new Date().getHours();
  // Show after 4pm if no session today
  if (h < 16) return null;
  return (
    <div className="streak-risk-bar">
      <div className="streak-risk-icon">
        <Flame size={13} />
      </div>
      <div>
        <div className="streak-risk-tag">Streak at Risk</div>
        <div className="streak-risk-text">
          {`You're ${streak === 1 ? '1 day' : `${streak} days`} in — don't break it now. One session is all it takes.`}
        </div>
      </div>
      <button
        className="streak-risk-btn"
        onClick={() => navigate('/create-session')}
      >
        <Flame size={10} /> Save Streak
      </button>
    </div>
  );
});

const ChartTooltip = memo(({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ct">
      <div style={{ marginBottom: 2 }}>{label}</div>
      <span className="ct-val">{fmtMins(payload[0]?.value)}</span>
      {payload[0]?.payload?.sessions > 0 && (
        <span style={{ color: 'rgba(240,234,216,.35)', marginLeft: 6 }}>
          · {payload[0].payload.sessions} session
          {payload[0].payload.sessions > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
});

const WeeklyChart = memo(({ data, totalMins, topDay }) => (
  <div className="chart-card">
    <div className="chart-header">
      <div>
        <div className="chart-title">Weekly Focus</div>
        <div className="chart-subtitle">Minutes · last 7 days</div>
      </div>
      <div>
        <div className="chart-num">{fmtMins(totalMins)}</div>
        <div className="chart-num-label">This week</div>
      </div>
    </div>
    <ResponsiveContainer width="100%" height={140}>
      <BarChart
        data={data}
        barSize={24}
        margin={{ top: 4, right: 0, left: -26, bottom: 0 }}
      >
        <XAxis
          dataKey="day"
          tick={{
            fontFamily: "'IBM Plex Mono'",
            fontSize: 10,
            fill: 'var(--text-muted)',
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{
            fontFamily: "'IBM Plex Mono'",
            fontSize: 10,
            fill: 'var(--text-muted)',
          }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v === 0 ? '' : `${v}m`)}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: 'var(--surface-2)', radius: 4 }}
        />
        <Bar
          dataKey="mins"
          radius={[4, 4, 0, 0]}
          fill="var(--accent)"
          opacity={0.8}
        />
      </BarChart>
    </ResponsiveContainer>
    {topDay && (
      <div className="chart-insight">
        <Star size={10} style={{ color: 'var(--accent)' }} />
        Your best day is {topDay}
      </div>
    )}
  </div>
));

/* PART 6: Enhanced donut with dominant type insight */
const FocusDonut = memo(({ data, dominantInsight }) => {
  const [active, setActive] = useState(null);
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  if (!data.length)
    return (
      <div
        style={{
          fontFamily: 'var(--f-mono)',
          fontSize: '.62rem',
          color: 'var(--text-muted)',
          padding: '18px 0',
          textAlign: 'center',
        }}
      >
        No sessions yet
      </div>
    );
  return (
    <>
      <div className="donut-row">
        <ResponsiveContainer width={90} height={90}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={26}
              outerRadius={42}
              dataKey="value"
              strokeWidth={0}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={FOCUS_COLORS[i % FOCUS_COLORS.length]}
                  opacity={active === null || active === i ? 1 : 0.35}
                  style={{ transition: 'opacity .2s', cursor: 'pointer' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-legend">
          {data.slice(0, 4).map((d, i) => (
            <div key={d.name} className="donut-legend-item">
              <div
                className="donut-dot"
                style={{ background: FOCUS_COLORS[i % FOCUS_COLORS.length] }}
              />
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.name}
              </span>
              <span className="donut-pct">
                {Math.round((d.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* Part 6: Dominant focus type insight */}
      {dominantInsight && (
        <div className="donut-dominant">
          <Activity size={10} />
          Most time:{' '}
          <span>
            {dominantInsight.name} ({dominantInsight.pct}%)
          </span>
        </div>
      )}
    </>
  );
});

const StreakHeatmap = memo(({ weeks }) => (
  <div className="heatmap-card">
    <SectionRule label="Activity · 12 Weeks" />
    <div className="heatmap-grid">
      {weeks.map((week, wi) => (
        <div key={wi} className="heatmap-week">
          {week.map((cell) => (
            <div
              key={cell.date}
              className="hm-cell"
              data-l={cell.level}
              title={`${cell.date}: ${fmtMins(cell.mins)}`}
            />
          ))}
        </div>
      ))}
    </div>
    <div className="heatmap-legend">
      <span className="hm-legend-label">Less</span>
      {[0, 1, 2, 3, 4].map((l) => (
        <div
          key={l}
          className="hm-cell"
          data-l={l}
          style={{ width: 10, height: 10, flexShrink: 0 }}
        />
      ))}
      <span className="hm-legend-label">More</span>
    </div>
  </div>
));

const SessionCard = memo(({ session, index, onStart }) => (
  <div
    className="session-card"
    style={{ animationDelay: `${200 + index * 70}ms` }}
  >
    <div className="session-card-stripe" />
    <div className="session-top">
      <span className="session-type">{session.focus_type || 'General'}</span>
      <span className="session-dur">
        <Clock size={10} />
        {fmtMins(session.duration)}
      </span>
    </div>
    <h3 className="session-title">{session.title}</h3>
    <div className="session-footer">
      <span className="session-date">
        <Calendar size={10} />
        {new Date(session.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </span>
      <button className="session-btn" onClick={() => onStart(session)}>
        Open <ArrowRight size={11} />
      </button>
    </div>
  </div>
));

const EmptyState = memo(({ onNew }) => (
  <div className="empty-state">
    <div className="empty-icon">
      <BookOpen size={26} strokeWidth={1.2} />
    </div>
    <h3 className="empty-title">Your study slate is blank</h3>
    <p className="empty-sub">
      Create your first session and start building your focus habit.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {[
        'Plan your sessions ahead of time',
        'Track focus time & streaks',
        'Get insights on your progress',
      ].map((f) => (
        <div key={f} className="empty-feat">
          <div className="empty-check">
            <Check size={9} strokeWidth={2.5} />
          </div>
          {f}
        </div>
      ))}
    </div>
    <button
      className="hero-cta"
      onClick={onNew}
      style={{ marginTop: 10, fontSize: '.71rem', padding: '12px 24px' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Plus size={13} /> New Session
      </span>
    </button>
  </div>
));

/* ── PART 2: SMART INSIGHTS RIBBON (rotating, prioritized, memoized) ── */
const InsightRibbon = memo(({ insights, onAction, hasData }) => {
  const [idx, setIdx] = useState(0);

  // ✅ NEW rotation system
  // REPLACE the existing useEffect in InsightRibbon with this:

  const ROTATION_MIN_MS = 5000;
  const ROTATION_MAX_MS = 8000;

  useEffect(() => {
    if (insights.length <= 1) return;

    let timer;

    const scheduleNext = () => {
      // Random interval between 5s and 8s — feels alive, not robotic
      const delay =
        ROTATION_MIN_MS + Math.random() * (ROTATION_MAX_MS - ROTATION_MIN_MS);
      timer = setTimeout(() => {
        setIdx((i) => (i + 1) % insights.length);
        scheduleNext(); // re-schedule after each rotation
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timer); // cleanup
  }, [insights.length]);

  const current = insights[idx] || insights[0];

  const InsightIcon = () => {
    const ic = current.icon;
    if (ic === 'trending') return <TrendingUp size={15} />;
    if (ic === 'target') return <Target size={15} />;
    if (ic === 'award') return <Award size={15} />;
    if (ic === 'flame') return <Flame size={15} />;
    if (ic === 'clock') return <Clock size={15} />;
    return <Sparkles size={15} />;
  };

  return (
    <div className="insight-ribbon">
      <div className="insight-ribbon-glow" />
      <span className="insight-ribbon-glyph">✦</span>
      <div className="insight-left">
        <div className="insight-icon-wrap">
          <InsightIcon />
        </div>
        <div>
          <div className="insight-tag">Smart Insights</div>
          {/* key forces re-animation on change */}
          <div className="insight-body" key={idx}>
            {current.text}
            {current.actionLabel && (
              <button className="insight-inline-action" onClick={onAction}>
                {current.actionLabel} →
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="insight-nav">
        {insights.length > 1 &&
          insights.map((_, i) => (
            <button
              key={i}
              className={`insight-dot${i === idx ? ' active' : ''}`}
              onClick={() => setIdx(i)}
              aria-label={`Insight ${i + 1}`}
            />
          ))}
      </div>
      <button className="insight-action" onClick={onAction}>
        {hasData ? 'Plan next session' : 'Get started'}
        <ArrowRight size={12} />
      </button>
    </div>
  );
});

/* ── PART 1: NEXT ACTION DECISION BLOCK ── */
const NextActionBlock = memo(({ nextAction, navigate, missionContext }) => {
  const { type, title, subtitle, sessionId, btnLabel, session } = nextAction;

  const Icon =
    type === 'resume' ? RotateCcw : type === 'start_planned' ? Play : Plus;
  const tag =
    type === 'resume'
      ? 'Resume Session'
      : type === 'start_planned'
        ? 'Start Planned'
        : 'Next Action';

  const handleClick = () => {
    if (type === 'create') navigate('/create-session');
    else navigate(`/session/${sessionId}`);
  };

  return (
    <div className="next-action-block">
      <div className="next-action-bg-glow" />
      <div className="next-action-inner">
        <div className="next-action-left">
          <div className="next-action-icon-wrap">
            <Icon size={18} strokeWidth={1.6} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="next-action-tag">{tag}</div>
            <div className="next-action-title">{title}</div>
            <div className="next-action-sub">{subtitle}</div>
            {/* Mission context pill */}
            {missionContext && (
              <div className="next-action-mission-context">
                <span
                  className={`next-action-mission-pill ${missionContext.type}`}
                >
                  {missionContext.type === 'streak' && <Flame size={8} />}
                  {missionContext.type === 'goal' && <Target size={8} />}
                  {missionContext.type === 'complete' && <Check size={8} />}
                  {missionContext.message}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="next-action-right">
          {session && (
            <div className="next-action-session-preview">
              <span className="next-action-session-type">
                {session.focus_type || 'General'}
              </span>
              <span style={{ color: 'rgba(240,234,216,.2)' }}>·</span>
              <span className="next-action-session-dur">
                {fmtMins(session.duration)}
              </span>
            </div>
          )}
          <button className="next-action-btn" onClick={handleClick}>
            <Icon size={12} /> {btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

// {
//   /* ── DAILY PROGRESS STRIP ── */
// }
// {
//   sessions.length > 0 && (
//     <DailyProgressStrip
//       xpToday={dailyStripData.xpToday}
//       sessionsToday={dailyStripData.sessionsToday}
//       sessionsTotal={dailyStripData.sessionsTotal}
//       goalPct={dailyStripData.goalPct}
//       streak={dailyStripData.streak}
//       atStreakRisk={dailyStripData.atStreakRisk}
//       onAction={() => {
//         if (nextAction.sessionId) navigate(`/session/${nextAction.sessionId}`);
//         else navigate('/create-session');
//       }}
//     />
//   );
// }

/* ── PART 3: SESSION FEEDBACK BANNER ── */
const FeedbackBanner = memo(({ message, onDismiss, dismissing }) => {
  if (!message) return null;
  return (
    <div className={`feedback-banner${dismissing ? ' dismissing' : ''}`}>
      <div className="feedback-banner-glow" />
      <div className="feedback-banner-left">
        <div className="feedback-banner-icon">
          <Check size={14} />
        </div>
        <div>
          <div className="feedback-banner-tag">Session Complete</div>
          <div className="feedback-banner-text">{message}</div>
        </div>
      </div>
      <button className="feedback-banner-close" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
});

const RewardBanner = memo(({ reward, onDismiss, dismissing }) => {
  if (!reward) return null;
  return (
    <div className={`reward-banner${dismissing ? ' dismissing' : ''}`}>
      <div className="reward-banner-shimmer" />
      <div className="reward-banner-icon">
        {reward.type === 'streak' ? <Flame size={16} /> : <Award size={16} />}
      </div>
      <div style={{ flex: 1, zIndex: 1 }}>
        <div className="reward-banner-tag">
          {reward.type === 'streak' ? 'Streak milestone' : 'Deep Work'}
        </div>
        <div className="reward-banner-text">{reward.headline}</div>
        {reward.sub && <div className="reward-banner-sub">{reward.sub}</div>}
      </div>
      <button className="reward-banner-close" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
});

/* ── PART 4: TODAY PROGRESS NARRATIVE ── */
const TodayProgressNarrative = memo(({ completed, total, pct }) => {
  if (!total) return null;
  const narrativeText =
    completed === total && total > 0
      ? `All ${total} session${total > 1 ? 's' : ''} done today — great work!`
      : `${completed} of ${total} session${total > 1 ? 's' : ''} completed today`;

  return (
    <div className="today-progress-narrative">
      <span className="today-progress-text">{narrativeText}</span>
      <span className="today-progress-pct">{pct}% of daily goal</span>
    </div>
  );
});

/* ── PART 7: SESSION RECOMMENDATION CARD ── */
// MODIFY RecommendationCard — add navigate prop and button

// 1. Update the function signature:
const RecommendationCard = memo(({ rec, navigate }) => {
  if (!rec) return null;

  const handleStart = () => {
    navigate('/create-session', {
      state: {
        prefill: {
          duration: rec.duration,
          difficulty: rec.difficulty,
          focus_type: rec.focusType,
        },
      },
    });
  };

  return (
    <div className="recommendation-card">
      <div className="recommendation-icon">
        <Lightbulb size={13} />
      </div>
      <div>
        <div className="recommendation-tag">Recommended</div>
        <div className="recommendation-text">{rec.reason}</div>
        <div className="recommendation-chips">
          <span className="recommendation-chip">⏱ {fmtMins(rec.duration)}</span>
          {rec.difficulty && (
            <span className="recommendation-chip">⚡ {rec.difficulty}</span>
          )}
          <span className="recommendation-chip">🎯 {rec.focusType}</span>
        </div>
        {/* ── ACTION BUTTON ── */}
        <button className="recommendation-action-btn" onClick={handleStart}>
          <Play size={11} /> Start Recommended Session
        </button>
      </div>
    </div>
  );
});

/* ── PART 8: FATIGUE ALERT ── */
const FatigueAlert = memo(({ fatigue }) => {
  if (!fatigue?.detected) return null;
  return (
    <div className="fatigue-alert">
      <div className="fatigue-icon">
        <Coffee size={13} />
      </div>
      <div>
        <div className="fatigue-tag">Fatigue Detected</div>
        <div className="fatigue-text">{fatigue.suggestion}</div>
      </div>
    </div>
  );
});

const MissedDayRecovery = memo(({ data, onDismiss, navigate }) => {
  if (!data?.missed) return null;
  return (
    <div className="missed-day-card">
      <div className="missed-day-icon">
        <Sunrise size={13} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="missed-day-tag">Pick Up Where You Left Off</div>
        <div className="missed-day-text">{data.message}</div>
        <div className="missed-day-sub">{data.sub}</div>
        <div className="missed-day-actions">
          <button
            className="missed-day-btn"
            onClick={() =>
              navigate('/create-session', {
                state: { prefill: { duration: 20, difficulty: 'Easy' } },
              })
            }
          >
            <Play size={10} /> Start 20 min session
          </button>
          <button className="missed-day-dismiss" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════
   TODAY PLAN SECTION
   Shows today's sessions as an ordered plan with
   priority highlight, status chips, and smart CTAs.
══════════════════════════════════════════════════════ */

const TodayPlan = memo(({ sessions, navigate, highlightId }) => {
  if (!sessions.length) {
    return (
      <div className="today-plan-empty">
        <div className="today-plan-empty-icon">
          <ListChecks size={18} strokeWidth={1.4} />
        </div>
        <div>
          <div className="today-plan-empty-title">
            No sessions planned today
          </div>
          <div className="today-plan-empty-sub">
            Add a session to build your daily plan.
          </div>
        </div>
        <button
          className="today-plan-empty-btn"
          onClick={() => navigate('/create-session')}
        >
          <Plus size={11} /> Plan Session
        </button>
      </div>
    );
  }

  // Sort: incomplete first, then completed
  const sorted = [...sessions].sort((a, b) => {
    const aDone = a.completed || a.is_completed;
    const bDone = b.completed || b.is_completed;
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;
    return 0;
  });

  const firstPending = sorted.find((s) => !(s.completed || s.is_completed));

  return (
    <div className="today-plan-wrap">
      <div className="today-plan-header">
        <div className="today-plan-header-left">
          <div className="today-plan-title">
            <ListChecks
              size={14}
              style={{ color: 'var(--accent)', opacity: 0.8 }}
            />
            Today's Plan
          </div>
          <div className="today-plan-count">
            {sorted.filter((s) => s.completed || s.is_completed).length}/
            {sorted.length} done
          </div>
        </div>
        <button
          className="today-plan-add-btn"
          onClick={() => navigate('/create-session')}
        >
          <Plus size={11} /> Add
        </button>
      </div>

      {/* Progress rail */}
      <div className="today-plan-rail">
        <div
          className="today-plan-rail-fill"
          style={{
            width: `${Math.round(
              (sorted.filter((s) => s.completed || s.is_completed).length /
                sorted.length) *
                100,
            )}%`,
          }}
        />
      </div>

      <div className="today-plan-list">
        {sorted.map((s, i) => {
          const done = s.completed || s.is_completed;
          const isHighlight = s.id === firstPending?.id;
          const isActive = s.id === highlightId && !done;

          const btnLabel = isActive ? 'Resume' : done ? 'Review' : 'Start';
          const BtnIcon = isActive ? RotateCcw : done ? ArrowRight : Play;

          return (
            <div
              key={s.id}
              className={`today-plan-item${isHighlight ? ' highlight' : ''}${done ? ' done' : ''}`}
              style={{ animationDelay: `${i * 55}ms` }}
            >
              {/* Completion marker */}
              <div className={`today-plan-check${done ? ' checked' : ''}`}>
                {done ? (
                  <Check size={9} strokeWidth={3} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>

              {/* Info */}
              <div className="today-plan-item-info">
                <div className="today-plan-item-title">{s.title}</div>
                <div className="today-plan-item-meta">
                  <span className="today-plan-meta-chip">
                    <Clock size={8} /> {fmtMins(s.duration)}
                  </span>
                  {s.focus_type && (
                    <span className="today-plan-meta-chip">{s.focus_type}</span>
                  )}
                  {s.difficulty && (
                    <span className="today-plan-meta-chip">{s.difficulty}</span>
                  )}
                </div>
              </div>

              {/* Priority badge for highlight */}
              {isHighlight && (
                <span className="today-plan-priority-badge">
                  <Zap size={8} /> Next
                </span>
              )}

              {/* CTA */}
              <button
                className={`today-plan-item-btn${done ? ' review' : isHighlight ? ' primary' : ''}`}
                onClick={() => navigate(`/session/${s.id}`)}
              >
                <BtnIcon size={10} /> {btnLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════
   SESSION REWARD TOAST
   Triggered on session completion.
   Shows XP earned, streak, difficulty bonus.
   Auto-dismisses after 3.5s.
══════════════════════════════════════════════════════ */

const SessionRewardToast = memo(({ reward, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!reward) return;
    // Slight delay so it feels like a response, not instant
    const enterTimer = setTimeout(() => setVisible(true), 80);
    const exitTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 380);
    }, 3500);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [reward, onDismiss]);

  if (!reward) return null;

  return (
    <div
      className={`reward-toast${visible ? ' visible' : ''}${exiting ? ' exiting' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="reward-toast-glow" />

      {/* XP pill */}
      <div className="reward-toast-xp">
        <Zap size={11} />+{reward.xp} pts
      </div>

      <div className="reward-toast-body">
        <div className="reward-toast-headline">{reward.headline}</div>
        {reward.tags && (
          <div className="reward-toast-tags">
            {reward.tags.map((tag) => (
              <span key={tag} className="reward-toast-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        className="reward-toast-close"
        onClick={() => {
          setExiting(true);
          setTimeout(onDismiss, 380);
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
});

/* ══════════════════════════════════════════════════════
   XP STREAK BAR
   Compact pill shown below hero eyebrow.
   Shows streak + weekly XP + current level.
══════════════════════════════════════════════════════ */

const XPStreakBar = memo(({ streak, weeklyXP, totalXP }) => {
  const level = getLevelInfo(totalXP);
  if (!weeklyXP && !streak) return null;
  return (
    <div className="xp-streak-bar">
      {streak > 0 && (
        <>
          <div className="xp-streak-bar-flame">
            <Flame size={12} />
            {streak}d streak
          </div>
          <div className="xp-streak-bar-sep" />
        </>
      )}
      <div className="xp-streak-bar-pts">
        <strong>{weeklyXP}</strong> pts this week
      </div>
      <div className="xp-streak-bar-sep" />
      <div className="xp-streak-bar-level">
        <span className="xp-streak-bar-level-label">Lvl</span>
        <span className="xp-streak-bar-level-pill">{level.label}</span>
        <div className="xp-streak-bar-track">
          <div
            className="xp-streak-bar-track-fill"
            style={{ width: `${level.pct}%` }}
          />
        </div>
      </div>
    </div>
  );
});

/* ── TODAY SESSIONS SECTION ── */
const TodaySessions = memo(({ sessions, navigate, highlightId }) => {
  if (!sessions.length) return null;
  return (
    <div className="today-sessions-section">
      <SectionRule
        label={`Today · ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
      />
      {sessions.map((s) => {
        const done = s.completed || s.is_completed;
        const isHL = s.id === highlightId;
        return (
          <div
            key={s.id}
            className={`today-session-card${isHL ? ' highlighted' : ''}`}
          >
            <div className="today-session-card-stripe" />
            <div className="today-session-info">
              <div className="today-session-title">{s.title}</div>
              <div className="today-session-meta">
                <span className="today-session-tag">
                  {s.focus_type || 'General'}
                </span>
                <span>
                  <Clock
                    size={9}
                    style={{
                      display: 'inline',
                      verticalAlign: 'middle',
                      marginRight: 3,
                    }}
                  />
                  {fmtMins(s.duration)}
                </span>
                {s.difficulty && <span>{s.difficulty}</span>}
              </div>
            </div>
            <span
              className={`today-session-status ${done ? 'done' : 'pending'}`}
            >
              {done ? (
                <>
                  <Check size={9} /> Done
                </>
              ) : (
                <>
                  <Play size={9} /> Active
                </>
              )}
            </span>
            <button
              className="today-session-btn"
              onClick={() => navigate(`/session/${s.id}`)}
            >
              Open <ArrowRight size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
});

/* ── PART 5: ENHANCED WEEKLY CALENDAR WITH BEST DAY INSIGHT ── */
const WeekCalendar = memo(({ weeklyData, streak, bestDay }) => {
  const todayKey = todayDateKey();
  const streakDays = useMemo(() => {
    // Mark which days in the current week are part of the streak
    const set = new Set();
    const today = new Date();
    for (let i = 0; i < streak; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      set.add(d.toISOString().slice(0, 10));
    }
    return set;
  }, [streak]);

  return (
    <div className="week-calendar">
      <div className="week-cal-title">
        <Calendar size={13} />
        This Week
      </div>
      <div className="week-cal-grid">
        {weeklyData.map((day) => {
          const level =
            day.mins === 0
              ? 0
              : day.mins < 30
                ? 1
                : day.mins < 60
                  ? 2
                  : day.mins < 90
                    ? 3
                    : 4;
          const isToday = day.date === todayKey;
          const inStreak = streakDays.has(day.date) && day.mins > 0;
          return (
            <div key={day.date} className="week-cal-day">
              <span className="week-cal-label">{day.day}</span>
              <div
                className={`week-cal-cell${isToday ? ' today' : ''}${inStreak && !isToday ? ' streak-day' : ''}`}
                data-l={level}
                title={`${day.date}: ${fmtMins(day.mins)}${day.sessions ? ` · ${day.sessions} session${day.sessions > 1 ? 's' : ''}` : ''}`}
              >
                {day.mins > 0 && (
                  <span className="week-cal-mins">{day.mins}m</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {streak > 0 && (
        <div className="week-cal-streak">
          <Flame size={11} />
          <span>
            <span className="week-cal-streak-val">{streak}-day</span> streak
          </span>
        </div>
      )}
      {/* Part 5: Best day insight */}
      {bestDay && (
        <div className="week-cal-best-day">
          <Star size={9} />
          Most consistent on <span>{bestDay}s</span>
        </div>
      )}
    </div>
  );
});

/* ── TODAY CARD WITH CONFIGURABLE GOAL ── */
const TodayCard = memo(
  ({ todayMins, todayProgress, dailyGoal, onGoalChange }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    const startEdit = () => {
      setDraft(String(Math.round(dailyGoal / 60)));
      setEditing(true);
    };
    const save = () => {
      const parsed = parseInt(draft, 10);
      if (!isNaN(parsed) && parsed > 0) onGoalChange(parsed * 60);
      setEditing(false);
    };
    const cancel = () => setEditing(false);

    return (
      <div className="today-card">
        <div className="today-card-glow" />
        <div className="today-tag">Today</div>
        <div className="today-date">
          {new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
          })}
        </div>
        <div className="today-weekday">
          {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
        <div className="today-divider" />
        <div className="today-focus-label">Focus Today</div>
        <div className="today-focus-val">
          {todayMins > 0 ? fmtMins(todayMins) : '—'}
        </div>
        <div className="today-track">
          <div className="today-fill" style={{ width: `${todayProgress}%` }} />
        </div>
        {editing ? (
          <div className="today-goal-input-row">
            <input
              className="today-goal-input"
              type="number"
              min="1"
              max="24"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') cancel();
              }}
              autoFocus
              placeholder="hrs"
            />
            <button className="today-goal-save-btn" onClick={save}>
              Save
            </button>
            <button className="today-goal-cancel-btn" onClick={cancel}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="today-goal-row upgraded">
            <div className="today-goal-left">
              <div className="today-goal-label">Daily Goal</div>

              <div className="today-goal-main">
                <span className="today-goal-time">{fmtMins(dailyGoal)}</span>
                <span className="today-goal-sub">target</span>
              </div>
            </div>

            <button
              className="today-goal-edit-btn upgraded"
              onClick={startEdit}
              title="Edit goal"
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  },
);

/* ── STAT CARD (animated counter) ── */
const StatCard = memo(
  ({
    icon: Icon,
    label,
    rawValue,
    displayValue,
    accent,
    glow,
    delta,
    delay,
  }) => {
    const isNumeric = typeof rawValue === 'number';
    const counted = useCountUp(isNumeric ? rawValue : 0);
    const shown = isNumeric ? counted : displayValue;

    return (
      <div
        className="stat-card"
        style={{
          '--sc-accent': accent,
          '--sc-glow': glow,
          animationDelay: `${delay}ms`,
        }}
      >
        <div className="stat-card-glow" />
        <div className="stat-card-icon">
          <Icon size={16} strokeWidth={1.6} />
        </div>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">
          {shown}
          {isNumeric && rawValue > 0 && label === 'Day Streak' ? 'd' : ''}
        </div>
        {delta && (
          <div className="stat-card-delta">
            <TrendingUp size={9} />
            {delta}
          </div>
        )}
      </div>
    );
  },
);

/* ═══════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════ */

const DEFAULT_DAILY_GOAL_MINS = 120; // 2 hours
const FEEDBACK_DISMISS_DELAY_MS = 6000;

export default function Dashboard() {
  const { user } = useUser();
  const { supabase, loading: dbLoading } = useSupabase();
  const navigate = useNavigate();
  const greeting = useGreeting();

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState(null);

  // Configurable daily goal — persisted to localStorage
  const [dailyGoalMins, setDailyGoalMins] = useState(() => {
    const stored = localStorage.getItem('dailyGoalMins');
    return stored ? parseInt(stored, 10) : DEFAULT_DAILY_GOAL_MINS;
  });

  // PART 3: Feedback banner state
  const [feedbackBanner, setFeedbackBanner] = useState(null); // { message }
  const [feedbackDismissing, setFeedbackDismissing] = useState(false);
  const feedbackTimerRef = useRef(null);
  const prevSessionsRef = useRef(null); // track previous sessions for delta detection

  const handleGoalChange = useCallback((mins) => {
    setDailyGoalMins(mins);
    localStorage.setItem('dailyGoalMins', String(mins));
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!supabase) return;
    setLoadingSessions(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('sessions')
      .select(
        'id, title, duration, focus_type, created_at, subject, goal, difficulty, is_completed, completed',
      )
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) {
      console.error('Dashboard fetch error:', err.message);
      setError('Could not load sessions. Check your Supabase RLS policy.');
    } else {
      setSessions(data || []);
    }
    setLoadingSessions(false);
  }, [supabase]);

  useEffect(() => {
    if (!dbLoading) fetchSessions();
  }, [dbLoading, fetchSessions]);

  useEffect(() => {
    const handler = () => fetchSessions();
    window.addEventListener('session:created', handler);
    return () => window.removeEventListener('session:created', handler);
  }, [fetchSessions]);

  /* ── PART 3: Detect recently completed session and show feedback ── */
  useEffect(() => {
    if (prevSessionsRef.current === null) {
      prevSessionsRef.current = sessions;
      return;
    }
    const prev = prevSessionsRef.current;
    // Find a session that just became completed
    const newlyCompleted = sessions.find((s) => {
      const done = s.completed || s.is_completed;
      if (!done) return false;
      const prevSession = prev.find((p) => p.id === s.id);
      return (
        prevSession && !(prevSession.completed || prevSession.is_completed)
      );
    });

    if (newlyCompleted) {
      const streak = calcStreak(sessions);
      const msgs = [
        `+${fmtMins(newlyCompleted.duration)} logged`,
        streak > 1 ? `Streak increased to ${streak} days` : null,
        newlyCompleted.difficulty === 'Hard'
          ? 'You completed a hard session'
          : null,
      ].filter(Boolean);

      setFeedbackBanner({ message: msgs.join(' · ') });
      setFeedbackDismissing(false);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackDismissing(true);
        setTimeout(() => setFeedbackBanner(null), 320);
      }, FEEDBACK_DISMISS_DELAY_MS);
    }
    prevSessionsRef.current = sessions;
  }, [sessions]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  const dismissFeedback = useCallback(() => {
    setFeedbackDismissing(true);
    setTimeout(() => setFeedbackBanner(null), 320);
  }, []);

  // ── REWARD AMPLIFICATION STATE ──
  const [rewardBanner, setRewardBanner] = useState(null);
  const [rewardDismissing, setRewardDismissing] = useState(false);
  const rewardTimerRef = useRef(null);
  const prevStreakRef = useRef(null);

  const dismissReward = useCallback(() => {
    setRewardDismissing(true);
    setTimeout(() => setRewardBanner(null), 320);
  }, []);

  // Detect streak milestones and long sessions
  useEffect(() => {
    if (!sessions.length) return;

    const currentStreak = calcStreak(sessions);
    const prevStreak = prevStreakRef.current;

    // Guard: skip on first render
    if (prevStreak === null) {
      prevStreakRef.current = currentStreak;
      return;
    }

    let reward = null;

    // 1. Streak milestone (increased AND hit a round number worth celebrating)
    const STREAK_MILESTONES = new Set([3, 5, 7, 10, 14, 21, 30]);
    if (currentStreak > prevStreak && STREAK_MILESTONES.has(currentStreak)) {
      reward = {
        type: 'streak',
        headline: `${currentStreak}-day streak — you're on fire.`,
        sub: 'Consistency is compounding. Keep it going.',
      };
    }

    // 2. Long session completed (>60 min, check most recent)
    const latest = sessions[0];
    if (
      !reward &&
      latest &&
      (latest.completed || latest.is_completed) &&
      (latest.duration || 0) > 60
    ) {
      // Only trigger if this is a fresh completion (not already seen)
      const lastSeenId = sessionStorage.getItem('lastRewardedSessionId');
      if (lastSeenId !== String(latest.id)) {
        sessionStorage.setItem('lastRewardedSessionId', String(latest.id));
        reward = {
          type: 'deep_work',
          headline: `${fmtMins(latest.duration)} deep work session complete.`,
          sub: "That's serious focus. Your best self showed up.",
        };
      }
    }

    if (reward) {
      setRewardBanner(reward);
      setRewardDismissing(false);
      if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
      rewardTimerRef.current = setTimeout(() => {
        setRewardDismissing(true);
        setTimeout(() => setRewardBanner(null), 320);
      }, 5000);
    }

    prevStreakRef.current = currentStreak;
  }, [sessions]);

  useEffect(
    () => () => {
      if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
    },
    [],
  );

  /* ── Memoized stats (PART 10: all O(n), no recalculation on unrelated state) ── */
  const stats = useMemo(() => {
    const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);
    const streak = calcStreak(sessions);
    const weeklyData = buildWeeklyData(sessions);
    const weekMins = weeklyData.reduce((a, d) => a + d.mins, 0);
    const focusData = buildFocusTypeData(sessions);
    const heatmapWeeks = buildHeatmap(sessions);
    const topDay = bestDayOfWeek(sessions);
    const avgMins = sessions.length
      ? Math.round(totalMins / sessions.length)
      : 0;
    const completedCount = sessions.filter(
      (s) => s.completed || s.is_completed,
    ).length;
    const wc = analyzeWeeklyComparison(sessions);
    const weekDelta =
      wc && !wc.isNew && wc.pct !== null
        ? wc.pct >= 0
          ? `+${wc.pct}% vs last week`
          : `${wc.pct}% vs last week`
        : null;
    return {
      totalMins,
      streak,
      weeklyData,
      weekMins,
      focusData,
      heatmapWeeks,
      topDay,
      avgMins,
      completedCount,
      weekDelta,
    };
  }, [sessions]);

  /* ── Smart insights (memoized — PART 2 + PART 10) ── */
  const smartInsights = useMemo(
    () => generateSmartInsights(sessions),
    [sessions],
  );

  /* ── Today sessions ── */
  const todayKey = useMemo(() => todayDateKey(), []);
  const todaySessions = useMemo(
    () =>
      sessions.filter(
        (s) => new Date(s.created_at).toISOString().slice(0, 10) === todayKey,
      ),
    [sessions, todayKey],
  );

  const todayMins = useMemo(
    () => stats.weeklyData.find((d) => d.date === todayKey)?.mins || 0,
    [stats.weeklyData, todayKey],
  );
  const todayProgress = useMemo(
    () => Math.min(100, Math.round((todayMins / dailyGoalMins) * 100)),
    [todayMins, dailyGoalMins],
  );

  /* ── PART 4: Today narrative counts ── */
  const todayCompleted = useMemo(
    () => todaySessions.filter((s) => s.completed || s.is_completed).length,
    [todaySessions],
  );

  /* ── PART 1: Compute next action ── */
  const nextAction = useMemo(
    () => computeNextAction(sessions, todaySessions),
    [sessions, todaySessions],
  );

  /* ── PART 7: Recommendation engine (memoized) ── */
  const recommendation = useMemo(
    () => generateRecommendation(sessions),
    [sessions],
  );

  /* ── PART 8: Fatigue detection (memoized) ── */
  const fatigue = useMemo(() => analyzeFatigue(sessions), [sessions]);

  /* ── PART 6: Dominant focus insight (memoized) ── */
  const dominantFocusInsight = useMemo(
    () => getDominantFocusInsight(stats.focusData),
    [stats.focusData],
  );

  // ── MISSED DAY RECOVERY ──
  const [missedDayDismissed, setMissedDayDismissed] = useState(false);

  // ── XP SYSTEM (unified — from useUserProgress) ──
  const {
    totalXP,
    weeklyXP,
    streak: progressStreak,
    levelInfo,
  } = useUserProgress(
    sessions,
    supabase,
    { persist: true }, // writes to user_progress table if it exists
  );
  // Note: use stats.streak for display (already computed from sessions above)
  // progressStreak is the same value, kept for hook completeness

  // ── SESSION REWARD MODAL (unified — uses shared XP formula) ──
  const [sessionReward, setSessionReward] = useState(null);
  const prevSessionIdsRef = useRef(new Set());
  const hasSeededRef = useRef(false);

  const seededRef = useRef(false);
  const prevCompletedIdsRef = useRef(new Set());

  useEffect(() => {
    if (!sessions.length) return;

    if (!seededRef.current) {
      seededRef.current = true;
      sessions.forEach((s) => {
        if (s.completed || s.is_completed) {
          prevCompletedIdsRef.current.add(s.id);
        }
      });
      return;
    }

    const currentStreak = calcStreakFromSessions(sessions);

    sessions.forEach((s) => {
      const done = s.completed || s.is_completed;
      if (!done) return;
      if (prevCompletedIdsRef.current.has(s.id)) return; // already seen

      // New completion detected
      prevCompletedIdsRef.current.add(s.id);

      console.log('🔥 NEW COMPLETION DETECTED:', s.title);

      const xp = calcSessionXP(s);
      const { totalXP } = computeXPFromSessions(sessions);
      const levelInfo = getLevelInfo(totalXP);

      setSessionReward({
        xp,
        sessionTitle: s.title,
        streak: currentStreak,
        difficulty: s.difficulty,
        achievement: null,
        levelInfo,
      });
    });
  }, [sessions]);

  // Add after: const [sessionReward, setSessionReward] = useState(null);

  const latestCompletedSession = useMemo(() => {
    return [...sessions]
      .filter((s) => s.completed || s.is_completed)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }, [sessions]);

  const latestReward = useMemo(() => {
    if (!latestCompletedSession) return null;
    const xp = calcSessionXP(latestCompletedSession);
    const streak = calcStreakFromSessions(sessions);
    const { totalXP } = computeXPFromSessions(sessions);
    const levelInfo = getLevelInfo(totalXP);
    return {
      xp,
      sessionTitle: latestCompletedSession.title,
      streak,
      difficulty: latestCompletedSession.difficulty,
      levelInfo,
    };
  }, [sessions, latestCompletedSession]);

  const dismissSessionReward = useCallback(() => setSessionReward(null), []);

  const missedDayData = useMemo(
    () => (missedDayDismissed ? null : detectMissedYesterday(sessions)),
    [sessions, missedDayDismissed],
  );

  /* ── DAILY PROGRESS STRIP DATA ── */
  const dailyStripData = useMemo(() => {
    const todayKey2 = todayDateKey();

    // XP earned today from completed sessions
    const xpToday = sessions
      .filter(
        (s) => new Date(s.created_at).toISOString().slice(0, 10) === todayKey2,
      )
      .reduce((acc, s) => {
        const done = s.completed || s.is_completed;
        const mins = s.duration || 0;
        return acc + (done ? mins : Math.floor(mins * 0.5));
      }, 0);

    // Sessions completed today vs total today
    const sessionsCompletedToday = todaySessions.filter(
      (s) => s.completed || s.is_completed,
    ).length;
    const sessionsTotalToday = Math.max(todaySessions.length, 3); // min 3 for goal sense

    // Goal % based on daily goal mins
    const goalPct = Math.min(
      100,
      Math.round((todayMins / dailyGoalMins) * 100),
    );

    // Streak at risk: user had a streak yesterday but hasn't done anything today
    const atStreakRisk =
      stats.streak > 0 && todayMins === 0 && new Date().getHours() >= 16;

    return {
      xpToday,
      sessionsToday: sessionsCompletedToday,
      sessionsTotal: sessionsTotalToday,
      goalPct,
      streak: stats.streak,
      atStreakRisk,
    };
  }, [sessions, todaySessions, todayMins, dailyGoalMins, stats.streak]);

  /* ── MISSION CONTEXT for Next Action ── */
  const missionContext = useMemo(() => {
    const { streak, atStreakRisk, goalPct, sessionsToday, sessionsTotal } =
      dailyStripData;

    if (atStreakRisk && streak > 1) {
      return {
        type: 'streak',
        message: `Don't lose your ${streak}-day streak — 1 session saves it`,
      };
    }
    if (goalPct >= 100) {
      return {
        type: 'complete',
        message: 'Daily goal complete — keep the momentum',
      };
    }
    const remaining = sessionsTotal - sessionsToday;
    if (remaining === 1) {
      return {
        type: 'goal',
        message: "You're 1 session away from today's goal",
      };
    }
    if (sessionsToday === 0) {
      return {
        type: 'goal',
        message: 'Start strong — complete your first session today',
      };
    }
    return {
      type: 'goal',
      message: `${remaining} sessions left to hit your daily goal`,
    };
  }, [dailyStripData]);

  /* ── ENHANCED INSIGHTS with action prompts ── */
  const actionableInsights = useMemo(() => {
    return smartInsights.map((insight) => {
      // Inject action suggestion into text
      const h = new Date().getHours();
      const isMorning = h >= 5 && h < 12;
      const isAfternoon = h >= 12 && h < 17;

      let enhanced = insight.text;
      let actionLabel = null;

      if (insight.icon === 'clock') {
        if (
          (isMorning && insight.text.includes('morning')) ||
          (isAfternoon && insight.text.includes('afternoon'))
        ) {
          actionLabel = 'Start now';
          enhanced = insight.text.replace(
            /\. Your best time.*$|— .*$/,
            ' — now is your window.',
          );
        }
      } else if (
        insight.icon === 'trending' &&
        insight.color === 'var(--color-success)'
      ) {
        actionLabel = 'Keep going';
      } else if (insight.icon === 'target') {
        actionLabel = 'Plan next';
      }

      return { ...insight, text: enhanced, actionLabel };
    });
  }, [smartInsights]);

  const handleMissedDayDismiss = useCallback(() => {
    // Persist dismiss for today's session
    sessionStorage.setItem(`missedDayDismissed_${todayDateKey()}`, '1');
    setMissedDayDismissed(true);
  }, []);

  const recentSessions = useMemo(() => sessions.slice(0, 3), [sessions]);

  const statItems = useMemo(
    () => [
      {
        icon: BookOpen,
        label: 'Sessions',
        rawValue: sessions.length,
        displayValue: String(sessions.length),
        accent: 'var(--accent)',
        glow: 'var(--accent-dim2)',
        delta: sessions.length > 0 ? `${stats.completedCount} completed` : null,
        delay: 0,
      },
      {
        icon: Clock,
        label: 'Focus Time',
        rawValue: null,
        displayValue: fmtMins(stats.totalMins),
        accent: 'var(--color-danger)',
        glow: 'rgba(184,92,74,.07)',
        delta: `${fmtMins(stats.weekMins)} this week`,
        delay: 60,
      },
      {
        icon: Flame,
        label: 'Day Streak',
        rawValue: stats.streak,
        displayValue: `${stats.streak}d`,
        accent: 'var(--color-success)',
        glow: 'rgba(107,140,107,.07)',
        delta: stats.streak > 0 ? 'Keep it going' : 'Start today',
        delay: 120,
      },
      {
        icon: TrendingUp,
        label: 'Avg Session',
        rawValue: null,
        displayValue: fmtMins(stats.avgMins),
        accent: '#7a6a54',
        glow: 'rgba(122,106,84,.07)',
        delta: stats.avgMins > 0 ? `across ${sessions.length} sessions` : null,
        delay: 180,
      },
    ],
    [sessions.length, stats],
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="dash-page">
        <GrainOverlay />
        <AppNavbar />

        <div className="dash-inner">
          {/* ── HERO ── */}
          <div className="hero">
            <div className="hero-bg-orb" />
            <div className="hero-bg-orb-2" />
            <div className="hero-inner">
              <div className="hero-left">
                <div className="hero-eyebrow">
                  <div className="hero-eyebrow-pulse" />
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {sessions.length > 0 && (
                    <>
                      <span className="hero-eyebrow-sep">·</span>
                      {sessions.length} session
                      {sessions.length !== 1 ? 's' : ''}
                    </>
                  )}
                </div>
                <h1 className="hero-title">
                  {greeting},<br />
                  <em>{user?.firstName || 'Scholar'}</em>
                </h1>
                <div className="hero-metrics">
                  {stats.totalMins > 0 && (
                    <>
                      <div className="hero-metric">
                        <div className="hero-metric-val">
                          {fmtMins(stats.totalMins)}
                        </div>
                        <div className="hero-metric-label">Total Focus</div>
                      </div>
                      <div className="hero-metric-sep" />
                    </>
                  )}
                  {stats.streak > 0 && (
                    <>
                      <div className="hero-metric">
                        <div className="hero-metric-val">{stats.streak}d</div>
                        <div className="hero-metric-label">Streak</div>
                      </div>
                      <div className="hero-metric-sep" />
                    </>
                  )}
                  {stats.weekMins > 0 && (
                    <div className="hero-metric">
                      <div className="hero-metric-val">
                        {fmtMins(stats.weekMins)}
                      </div>
                      <div className="hero-metric-label">This Week</div>
                    </div>
                  )}
                </div>
                {sessions.length > 0 && stats.topDay && (
                  <div className="hero-badge">
                    <Star size={10} /> Best on {stats.topDay}s · avg{' '}
                    {fmtMins(stats.avgMins)}
                  </div>
                )}
              </div>
              <div className="hero-right">
                <button
                  className="hero-cta"
                  onClick={() => navigate('/create-session')}
                >
                  <Play size={13} />
                  <span>Start Session</span>
                </button>
                <button
                  className="hero-cta-sub"
                  onClick={() => navigate('/create-session?plan=1')}
                >
                  <Brain size={12} /> Session Plan
                </button>
              </div>
            </div>
          </div>
          {/* ── XP STREAK BAR ── */}
          {sessions.length > 0 && (
            <XPStreakBar
              streak={stats.streak}
              weeklyXP={weeklyXP}
              totalXP={totalXP}
            />
          )}
          {/* ── DAILY PROGRESS STRIP ── */} {/* ← ADD IT HERE */}
          {sessions.length > 0 && (
            <DailyProgressStrip
              xpToday={dailyStripData.xpToday}
              sessionsToday={dailyStripData.sessionsToday}
              sessionsTotal={dailyStripData.sessionsTotal}
              goalPct={dailyStripData.goalPct}
              streak={dailyStripData.streak}
              atStreakRisk={dailyStripData.atStreakRisk}
              onAction={() => {
                if (nextAction.sessionId)
                  navigate(`/session/${nextAction.sessionId}`);
                else navigate('/create-session');
              }}
            />
          )}
          {/* ── PART 3: SESSION FEEDBACK BANNER ── */}
          {feedbackBanner && (
            <FeedbackBanner
              message={feedbackBanner.message}
              onDismiss={dismissFeedback}
              dismissing={feedbackDismissing}
            />
          )}
          {/* ── REWARD AMPLIFICATION ── */}
          <RewardBanner
            reward={rewardBanner}
            onDismiss={dismissReward}
            dismissing={rewardDismissing}
          />
          {/* ── SMART INSIGHTS RIBBON ── */}
          <InsightRibbon
            insights={actionableInsights}
            onAction={() => navigate('/create-session')}
            hasData={sessions.length > 0}
          />
          {/* ── SESSION REWARD CARD (persistent) ── */}
          {/* {latestReward && (
            <div className="src-persistent">
              <SessionRewardCard reward={latestReward} />
            </div>
          )} */}
          {/* ── STAT BAND ── */}
          <div className="stat-band">
            {statItems.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
          {/* ── MAIN 2-COL ── */}
          <div className="main-grid">
            {/* LEFT COLUMN */}
            <div>
              {/* PART 1: NEXT ACTION (always show — dominant CTA) */}
              {sessions.length > 0 && (
                <NextActionBlock
                  nextAction={nextAction}
                  navigate={navigate}
                  missionContext={missionContext}
                />
              )}

              {/* PART 4: TODAY PROGRESS NARRATIVE */}
              {todaySessions.length > 0 && (
                <TodayProgressNarrative
                  completed={todayCompleted}
                  total={todaySessions.length}
                  pct={todayProgress}
                />
              )}

              {/* PART 8: FATIGUE ALERT — before recommendation */}
              {!loadingSessions && <FatigueAlert fatigue={fatigue} />}

              {/* ── MISSED DAY RECOVERY ── */}
              {!loadingSessions && (
                <MissedDayRecovery
                  data={missedDayData}
                  onDismiss={handleMissedDayDismiss}
                  navigate={navigate}
                />
              )}

              {/* ── STREAK RISK BAR ── */}
              {!loadingSessions && dailyStripData.atStreakRisk && (
                <StreakRiskBar streak={stats.streak} navigate={navigate} />
              )}

              {/* PART 7: SESSION RECOMMENDATION */}
              {!loadingSessions && !fatigue?.detected && (
                <RecommendationCard rec={recommendation} navigate={navigate} />
              )}
              {/* TODAY PLAN — replaces old TodaySessions */}
              {!loadingSessions && (
                <TodayPlan
                  sessions={todaySessions}
                  navigate={navigate}
                  highlightId={nextAction.session?.id}
                />
              )}

              {loadingSessions ? (
                <div
                  className="skeleton"
                  style={{ height: 230, marginBottom: 28 }}
                />
              ) : (
                <WeeklyChart
                  data={stats.weeklyData}
                  totalMins={stats.weekMins}
                  topDay={stats.topDay}
                />
              )}

              {error && <div className="err-msg">{error}</div>}

              <SectionRule
                label="Recent Sessions"
                action="View all"
                onAction={() => navigate('/sessions')}
              />

              {loadingSessions ? (
                <div className="sessions-grid">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton" style={{ height: 160 }} />
                  ))}
                </div>
              ) : recentSessions.length === 0 ? (
                <EmptyState onNew={() => navigate('/create-session')} />
              ) : (
                <div className="sessions-grid">
                  {recentSessions.map((s, i) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      index={i}
                      onStart={(sess) => navigate(`/session/${sess.id}`)}
                    />
                  ))}
                </div>
              )}

              {!loadingSessions && sessions.length > 0 && (
                <StreakHeatmap weeks={stats.heatmapWeeks} />
              )}
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="sidebar">
              {/* TODAY CARD */}
              <TodayCard
                todayMins={todayMins}
                todayProgress={todayProgress}
                dailyGoal={dailyGoalMins}
                onGoalChange={handleGoalChange}
              />

              {/* PART 5: WEEKLY CALENDAR with best day insight */}
              <WeekCalendar
                weeklyData={stats.weeklyData}
                streak={stats.streak}
                bestDay={stats.topDay}
              />

              {/* PART 6: FOCUS TYPES with dominant insight */}
              {sessions.length > 0 && (
                <div className="sb-card" style={{ animationDelay: '160ms' }}>
                  <div className="sb-card-title">
                    <BarChart2 size={13} /> Focus Types
                  </div>
                  <FocusDonut
                    data={stats.focusData}
                    dominantInsight={dominantFocusInsight}
                  />
                </div>
              )}

              {/* QUICK ACTIONS */}
              <div className="sb-card" style={{ animationDelay: '200ms' }}>
                <div className="sb-card-title">
                  <Zap size={13} /> Quick Actions
                </div>
                {[
                  {
                    icon: Plus,
                    title: 'New Session',
                    desc: 'Plan your next focus block',
                    path: '/create-session',
                    hi: true,
                  },
                  {
                    icon: Brain,
                    title: 'Session Plan',
                    desc: 'Structure your study goals',
                    path: '/create-session?plan=1',
                  },
                  {
                    icon: BarChart2,
                    title: 'All Sessions',
                    desc: 'Browse and manage',
                    path: '/sessions',
                  },
                ].map(({ icon: Icon, title, desc, path, hi }) => (
                  <button
                    key={title}
                    className={`qa-item${hi ? ' hi' : ''}`}
                    onClick={() => navigate(path)}
                  >
                    <div className="qa-icon">
                      <Icon size={14} strokeWidth={1.7} />
                    </div>
                    <div className="qa-text">
                      <div className="qa-title">{title}</div>
                      <div className="qa-desc">{desc}</div>
                    </div>
                    <ChevronRight size={12} className="qa-arr" />
                  </button>
                ))}
              </div>

              {/* TIP */}
              <div className="tip-card">
                <div className="tip-tag">Study Tip</div>
                <p className="tip-body">
                  "Break your session into 25-minute focused sprints with
                  5-minute breaks. Consistency beats marathon cramming — every
                  time."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
