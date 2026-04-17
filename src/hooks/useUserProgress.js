/**
 * useUserProgress.js
 *
 * SINGLE SOURCE OF TRUTH for XP, streak, level, and achievements.
 *
 * Strategy:
 *  1. Always computes from sessions (client-side, instant, no flicker)
 *  2. Optionally persists to user_progress table (cross-device sync)
 *  3. Optionally persists newly-unlocked achievements to user_achievements
 *
 * The hook is designed to be called ONCE at a high level (e.g. a layout
 * component or each page that needs it) — it memoizes all derived values.
 *
 * XP Formula (canonical — matches FocusInsights):
 *   base  = duration_mins * 2
 *   bonus = +50 if completed
 *   mult  = 1.5× if hard, 1.2× if medium, 1× otherwise
 *   total = round(base * mult) + bonus
 *
 * Level Formula:
 *   level = min(floor(sqrt(totalXP / 100)) + 1, 50)
 *   XP for level L = (L-1)^2 * 100
 *   XP for level L+1 = L^2 * 100
 */

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';

/* ─────────────────────────────────────────────
   XP ENGINE  (canonical, shared formulas)
───────────────────────────────────────────── */

/** XP earned from a single session */
export function calcSessionXP(session) {
  const mins = session.duration || 0;
  const done = session.completed || session.is_completed;
  const diff = (session.difficulty || '').toLowerCase();

  let base = mins * 2;
  const mult = diff === 'hard' ? 1.5 : diff === 'medium' ? 1.2 : 1;
  const bonus = done ? 50 : 0;

  return Math.round(base * mult) + bonus;
}

/** Total and weekly XP from a sessions array */
export function computeXPFromSessions(sessions) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  let totalXP = 0;
  let weeklyXP = 0;

  sessions.forEach((s) => {
    const xp = calcSessionXP(s);
    totalXP += xp;
    if (new Date(s.created_at) >= startOfWeek) {
      weeklyXP += xp;
    }
  });

  return { totalXP, weeklyXP };
}

/** Level from total XP */
export function xpToLevel(totalXP) {
  return Math.min(Math.floor(Math.sqrt(totalXP / 100)) + 1, 50);
}

/** XP required to reach level L (floor) */
export function xpForLevel(l) {
  return (l - 1) ** 2 * 100;
}

/** XP required to reach level L+1 (ceiling) */
export function xpForNextLevel(l) {
  return l ** 2 * 100;
}

/** Full level info object */
export function getLevelInfo(totalXP) {
  const LEVEL_TITLES = [
    { min: 0, label: 'Novice' },
    { min: 3, label: 'Apprentice' },
    { min: 6, label: 'Scholar' },
    { min: 10, label: 'Focused' },
    { min: 15, label: 'Adept' },
    { min: 20, label: 'Deep Thinker' },
    { min: 30, label: 'Expert' },
    { min: 40, label: 'Flow State' },
    { min: 45, label: 'Master' },
    { min: 48, label: 'Sage' },
  ];

  const level = xpToLevel(totalXP);
  const xpCurrent = totalXP - xpForLevel(level);
  const xpNeeded = xpForNextLevel(level) - xpForLevel(level);
  const pct = Math.round((xpCurrent / xpNeeded) * 100);

  const title =
    [...LEVEL_TITLES].reverse().find((t) => level >= t.min)?.label || 'Novice';

  return {
    level,
    title,
    xpCurrent,
    xpNeeded,
    pct,
    // Legacy compat aliases used by Dashboard's XPStreakBar
    label: title,
    nextLabel: null,
    nextAt: xpForNextLevel(level),
  };
}

/* ─────────────────────────────────────────────
   STREAK ENGINE
───────────────────────────────────────────── */
export function calcStreakFromSessions(sessions) {
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

/* ─────────────────────────────────────────────
   THE HOOK
───────────────────────────────────────────── */

/**
 * useUserProgress
 *
 * @param {Array}  sessions  - Full sessions array (newest first), already loaded
 * @param {Object} supabase  - Supabase client (from useSupabase hook), can be null
 * @param {Object} [options]
 * @param {boolean} [options.persist=false] - Write computed progress to DB
 * @returns {{
 *   totalXP: number,
 *   weeklyXP: number,
 *   level: number,
 *   levelInfo: object,
 *   streak: number,
 *   xpBySession: Map<string, number>,
 *   isReady: boolean,
 * }}
 */
export function useUserProgress(sessions, supabase, options = {}) {
  const { persist = false } = options;
  const { user } = useUser();
  const persistedRef = useRef(false); // prevent double-write on re-renders

  // ── Core derivations (all memoized, O(n)) ──
  const { totalXP, weeklyXP } = useMemo(
    () => computeXPFromSessions(sessions),
    [sessions],
  );

  const streak = useMemo(() => calcStreakFromSessions(sessions), [sessions]);

  const levelInfo = useMemo(() => getLevelInfo(totalXP), [totalXP]);

  // Per-session XP map — useful for showing "+45 XP" on individual sessions
  const xpBySession = useMemo(() => {
    const map = new Map();
    sessions.forEach((s) => map.set(s.id, calcSessionXP(s)));
    return map;
  }, [sessions]);

  // ── Optional DB persistence ──
  const persistProgress = useCallback(async () => {
    if (!supabase || !user || !persist) return;
    if (persistedRef.current) return;
    persistedRef.current = true;

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase.from('user_progress').upsert(
      {
        user_id: user.id,
        total_xp: totalXP,
        weekly_xp: weeklyXP,
        current_streak: streak,
        last_activity_date: today,
        level: levelInfo.level,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('❌ SUPABASE ERROR:', error);
    } else {
      console.log('✅ UPSERT SUCCESS:', data);
    }

    // Reset so next session change triggers another write
    persistedRef.current = false;
  }, [supabase, user, persist, totalXP, weeklyXP, streak, levelInfo.level]);

  useEffect(() => {
    if (sessions.length > 0) {
      persistProgress();
    }
  }, [sessions.length, persistProgress]);

  return {
    totalXP,
    weeklyXP,
    streak,
    level: levelInfo.level,
    levelInfo,
    xpBySession,
    isReady: sessions.length >= 0, // always ready — computed from sessions
  };
}

export default useUserProgress;
