/**
 * DailyCommissions.jsx
 *
 * Genshin-inspired daily quest system with XP + FocusGem rewards.
 * Commissions rotate on a 7-day cycle (day-of-week keyed).
 * State persists to Supabase: commission_completions + user_gems.
 *
 * Props:
 *   supabase      – Supabase client from useSupabase()
 *   userId        – Clerk user.id string
 *   sessions      – sessions array (used to auto-detect commission progress)
 *   onGemsChange  – optional callback(newTotal) when gems update
 *   isDark        – boolean for theme
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Gem,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Flame,
  Brain,
  Target,
  Star,
  BookOpen,
  Layers,
  Award,
  Sparkles,
  Lock,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   COMMISSION DATA CONFIG
   7 days × 4 commissions each. Rotate weekly by day index (0=Sun).
   To add commissions: push to any day's array.
   To change rotation: modify getDayCommissions().
═══════════════════════════════════════════════════════════════ */
const COMMISSIONS_BY_DAY = {
  0: [
    // Sunday
    {
      id: 'sun_1',
      title: 'Rest & Reflect',
      description: 'Complete any 1 session today',
      icon: Star,
      rewardXP: 80,
      rewardGems: 12,
      type: 'sessions',
      target: 1,
    },
    {
      id: 'sun_2',
      title: 'The Deep Dive',
      description: 'Log a session of 45 minutes or more',
      icon: Brain,
      rewardXP: 120,
      rewardGems: 18,
      type: 'duration_single',
      target: 45,
    },
    {
      id: 'sun_3',
      title: 'Sunday Scholar',
      description: 'Accumulate 60 total minutes today',
      icon: BookOpen,
      rewardXP: 100,
      rewardGems: 15,
      type: 'duration_today',
      target: 60,
    },
    {
      id: 'sun_4',
      title: 'Goal Setter',
      description: 'Create a session with a goal defined',
      icon: Target,
      rewardXP: 60,
      rewardGems: 10,
      type: 'has_goal',
      target: 1,
    },
  ],
  1: [
    // Monday
    {
      id: 'mon_1',
      title: 'Monday Momentum',
      description: 'Complete 2 sessions to start the week',
      icon: Flame,
      rewardXP: 100,
      rewardGems: 15,
      type: 'sessions',
      target: 2,
    },
    {
      id: 'mon_2',
      title: 'Deep Work Initiate',
      description: 'Log 90 total minutes of focus today',
      icon: Brain,
      rewardXP: 150,
      rewardGems: 22,
      type: 'duration_today',
      target: 90,
    },
    {
      id: 'mon_3',
      title: 'Hard Mode',
      description: 'Complete a session on Hard difficulty',
      icon: Zap,
      rewardXP: 130,
      rewardGems: 20,
      type: 'difficulty',
      target: 'hard',
    },
    {
      id: 'mon_4',
      title: 'The Planner',
      description: 'Create an AI-assisted study plan session',
      icon: Layers,
      rewardXP: 90,
      rewardGems: 14,
      type: 'ai_plan',
      target: 1,
    },
  ],
  2: [
    // Tuesday
    {
      id: 'tue_1',
      title: 'Consistency Check',
      description: 'Complete any session today',
      icon: CheckCircle2,
      rewardXP: 70,
      rewardGems: 10,
      type: 'sessions',
      target: 1,
    },
    {
      id: 'tue_2',
      title: 'Hour of Power',
      description: 'Complete a single session of 60 minutes',
      icon: Clock,
      rewardXP: 160,
      rewardGems: 24,
      type: 'duration_single',
      target: 60,
    },
    {
      id: 'tue_3',
      title: 'Note Taker',
      description: 'Complete a session with notes written',
      icon: BookOpen,
      rewardXP: 80,
      rewardGems: 12,
      type: 'has_notes',
      target: 1,
    },
    {
      id: 'tue_4',
      title: 'Trio Tuesday',
      description: 'Complete 3 sessions today',
      icon: Layers,
      rewardXP: 200,
      rewardGems: 30,
      type: 'sessions',
      target: 3,
    },
  ],
  3: [
    // Wednesday
    {
      id: 'wed_1',
      title: 'Midweek Grind',
      description: 'Log 2 sessions to keep the streak alive',
      icon: Flame,
      rewardXP: 110,
      rewardGems: 16,
      type: 'sessions',
      target: 2,
    },
    {
      id: 'wed_2',
      title: 'Gladiator',
      description: 'Complete 2 Hard difficulty sessions',
      icon: Zap,
      rewardXP: 200,
      rewardGems: 30,
      type: 'difficulty_count',
      target: 2,
      difficulty: 'hard',
    },
    {
      id: 'wed_3',
      title: 'Time Lord',
      description: 'Accumulate 120 total minutes today',
      icon: Clock,
      rewardXP: 180,
      rewardGems: 27,
      type: 'duration_today',
      target: 120,
    },
    {
      id: 'wed_4',
      title: 'AI Collaborator',
      description: 'Use an AI plan in your session',
      icon: Brain,
      rewardXP: 90,
      rewardGems: 14,
      type: 'ai_plan',
      target: 1,
    },
  ],
  4: [
    // Thursday
    {
      id: 'thu_1',
      title: 'Almost There',
      description: 'Complete 1 session — just show up',
      icon: Star,
      rewardXP: 70,
      rewardGems: 10,
      type: 'sessions',
      target: 1,
    },
    {
      id: 'thu_2',
      title: 'The Marathon',
      description: 'Complete a single session of 90 minutes',
      icon: Clock,
      rewardXP: 220,
      rewardGems: 33,
      type: 'duration_single',
      target: 90,
    },
    {
      id: 'thu_3',
      title: 'Focus Burst',
      description: 'Complete 3 sessions totalling 60+ minutes',
      icon: Flame,
      rewardXP: 170,
      rewardGems: 25,
      type: 'sessions_with_duration',
      target: 3,
      minDuration: 60,
    },
    {
      id: 'thu_4',
      title: 'Reflective Mind',
      description: 'Write detailed notes (200+ characters)',
      icon: BookOpen,
      rewardXP: 100,
      rewardGems: 15,
      type: 'long_notes',
      target: 200,
    },
  ],
  5: [
    // Friday
    {
      id: 'fri_1',
      title: 'Friday Fire',
      description: 'Complete 2 sessions to close the week strong',
      icon: Flame,
      rewardXP: 120,
      rewardGems: 18,
      type: 'sessions',
      target: 2,
    },
    {
      id: 'fri_2',
      title: 'Weekend Prep',
      description: 'Set goals on all your sessions today',
      icon: Target,
      rewardXP: 90,
      rewardGems: 14,
      type: 'all_have_goals',
      target: 1,
    },
    {
      id: 'fri_3',
      title: 'End of Week Warrior',
      description: 'Log 100 total minutes today',
      icon: Zap,
      rewardXP: 160,
      rewardGems: 24,
      type: 'duration_today',
      target: 100,
    },
    {
      id: 'fri_4',
      title: 'Subject Hopper',
      description: 'Study 2 different subjects today',
      icon: Layers,
      rewardXP: 140,
      rewardGems: 21,
      type: 'unique_subjects',
      target: 2,
    },
  ],
  6: [
    // Saturday
    {
      id: 'sat_1',
      title: 'Weekend Warrior',
      description: 'Complete any 1 session on a Saturday',
      icon: Star,
      rewardXP: 90,
      rewardGems: 14,
      type: 'sessions',
      target: 1,
    },
    {
      id: 'sat_2',
      title: 'Saturday Deep Work',
      description: 'Log a 75-minute unbroken session',
      icon: Brain,
      rewardXP: 190,
      rewardGems: 28,
      type: 'duration_single',
      target: 75,
    },
    {
      id: 'sat_3',
      title: 'The Completionist',
      description: "Mark all today's sessions as complete",
      icon: CheckCircle2,
      rewardXP: 110,
      rewardGems: 17,
      type: 'all_completed',
      target: 1,
    },
    {
      id: 'sat_4',
      title: 'Weekend Sprint',
      description: 'Complete 3 sessions — show no days off',
      icon: Flame,
      rewardXP: 220,
      rewardGems: 33,
      type: 'sessions',
      target: 3,
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   PROGRESS COMPUTATION ENGINE
   Each commission type has a progress resolver.
   Returns { progress: 0–100, current: number, target: number }
═══════════════════════════════════════════════════════════════ */
function computeProgress(commission, todaySessions) {
  const { type, target, difficulty, minDuration } = commission;
  const completedSessions = todaySessions.filter(
    (s) => s.completed || s.is_completed,
  );
  const totalMins = todaySessions.reduce((a, s) => a + (s.duration || 0), 0);

  switch (type) {
    case 'sessions': {
      const c = Math.min(completedSessions.length, target);
      return { current: c, target, progress: Math.round((c / target) * 100) };
    }
    case 'duration_today': {
      const c = Math.min(totalMins, target);
      return { current: c, target, progress: Math.round((c / target) * 100) };
    }
    case 'duration_single': {
      const max = Math.max(0, ...todaySessions.map((s) => s.duration || 0));
      const c = Math.min(max, target);
      return { current: c, target, progress: Math.round((c / target) * 100) };
    }
    case 'difficulty': {
      const has = completedSessions.some(
        (s) => (s.difficulty || '').toLowerCase() === target,
      );
      return { current: has ? 1 : 0, target: 1, progress: has ? 100 : 0 };
    }

    case 'difficulty_count': {
      const count = todaySessions.filter(
        (s) => (s.difficulty || '').toLowerCase() === (difficulty || target),
      ).length;
      const c = Math.min(count, target);
      return { current: c, target, progress: Math.round((c / target) * 100) };
    }
    case 'ai_plan': {
      const has = todaySessions.some((s) => s.ai_plan?.steps?.length > 0);
      return { current: has ? 1 : 0, target: 1, progress: has ? 100 : 0 };
    }
    case 'has_notes': {
      const has = completedSessions.some((s) => s.notes?.trim().length > 0);
      return { current: has ? 1 : 0, target: 1, progress: has ? 100 : 0 };
    }
    case 'has_goal': {
      const has = completedSessions.some((s) => s.goal?.trim().length > 0);
      return { current: has ? 1 : 0, target: 1, progress: has ? 100 : 0 };
    }
    case 'long_notes': {
      const maxLen = Math.max(
        0,
        ...todaySessions.map((s) => s.notes?.length || 0),
      );
      const c = Math.min(maxLen, target);
      return { current: c, target, progress: Math.round((c / target) * 100) };
    }
    case 'sessions_with_duration': {
      const completedToday = todaySessions.filter(
        (s) => s.completed || s.is_completed,
      );
      const totalMinsCompleted = completedToday.reduce(
        (a, s) => a + (s.duration || 0),
        0,
      );
      // Progress is gated on both: enough sessions AND enough total minutes
      const sessionsMet = Math.min(completedToday.length, target);
      const durationMet = totalMinsCompleted >= minDuration;
      // Only show full session progress if duration threshold is also met
      const c = durationMet
        ? sessionsMet
        : Math.min(completedToday.length, target - 1);
      return {
        current: completedToday.length,
        target,
        progress: durationMet
          ? Math.round((sessionsMet / target) * 100)
          : Math.min(99, Math.round((completedToday.length / target) * 100)),
      };
    }
    case 'all_completed': {
      if (todaySessions.length === 0)
        return { current: 0, target: 1, progress: 0 };
      const allDone = todaySessions.every((s) => s.completed || s.is_completed);
      return {
        current: allDone ? 1 : 0,
        target: 1,
        progress: allDone ? 100 : 0,
      };
    }
    case 'all_have_goals': {
      if (todaySessions.length === 0)
        return { current: 0, target: 1, progress: 0 };
      const allHave = todaySessions.every((s) => s.goal?.trim().length > 0);
      return {
        current: allHave ? 1 : 0,
        target: 1,
        progress: allHave ? 100 : 0,
      };
    }
    case 'unique_subjects': {
      const subjects = new Set(
        todaySessions.map((s) => s.subject).filter(Boolean),
      );
      const c = Math.min(subjects.size, target);
      return { current: c, target, progress: Math.round((c / target) * 100) };
    }
    default:
      return { current: 0, target: 1, progress: 0 };
  }
}

function getDayCommissions(dateISO) {
  // Use the date string to pick the day-of-week bucket deterministically.
  // new Date(dateISO + 'T12:00:00') avoids timezone-midnight edge cases.
  const dow = new Date(dateISO + 'T12:00:00').getDay();
  return COMMISSIONS_BY_DAY[dow] || COMMISSIONS_BY_DAY[0];
}

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* ═══════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,600&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

.dc-wrap { font-family: 'Cabinet Grotesk', sans-serif; margin-bottom: 32px; }

/* ── Section header ── */
.dc-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; gap:12px; flex-wrap:wrap; }
.dc-eyebrow { font-family:'JetBrains Mono',monospace; font-size:.56rem; letter-spacing:.18em; text-transform:uppercase; color:var(--gold); display:flex; align-items:center; gap:7px; }
.dc-eyebrow::before { content:''; display:block; width:18px; height:1px; background:currentColor; opacity:.5; }
.dc-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:1.7rem; font-weight:300; letter-spacing:-.02em; color:var(--ink); }
.dc-title em { font-style:italic; color:var(--gold); }

/* ── Gem counter ── */
.dc-gems-badge {
  display:inline-flex; align-items:center; gap:8px;
  padding:7px 16px; border-radius:30px;
  background:linear-gradient(135deg,rgba(155,107,174,.15),rgba(201,168,76,.1));
  border:1px solid rgba(155,107,174,.35);
  font-family:'JetBrains Mono',monospace; font-size:.62rem; letter-spacing:.06em;
  cursor:default; transition:all .2s;
}
.dc-gems-badge:hover { border-color:rgba(155,107,174,.6); background:linear-gradient(135deg,rgba(155,107,174,.22),rgba(201,168,76,.14)); }
.dc-gem-icon { width:16px; height:16px; color:#9b6bae; flex-shrink:0; }
.dc-gem-count { color:var(--ink); font-weight:500; }
.dc-gem-label { color:var(--ink3); }

/* ── Commission cards ── */
.dc-list { display:flex; flex-direction:column; gap:10px; }

.dc-card {
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:14px;
  overflow:hidden;
  transition:all .28s cubic-bezier(.16,1,.3,1);
  position:relative;
  cursor:default;
}
.dc-card::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,var(--dc-accent,var(--gold)),transparent);
  opacity:0; transition:opacity .25s;
}
.dc-card:hover { transform:translateY(-3px); box-shadow:0 12px 36px rgba(30,26,20,.1); border-color:var(--border2); }
.dc-card:hover::before { opacity:.8; }
.dc-card.dc-completed {
  background:linear-gradient(135deg,color-mix(in srgb,var(--dc-accent,var(--gold)) 7%,var(--surface)),var(--surface));
  border-color:color-mix(in srgb,var(--dc-accent,var(--gold)) 40%,var(--border));
}
.dc-card.dc-completed::before { opacity:1; }
.dark .dc-card { background:var(--surface); }
.dark .dc-card.dc-completed { background:linear-gradient(135deg,rgba(155,107,174,.08),#131210); }

.dc-card-inner { padding:18px 20px 16px; display:flex; align-items:center; gap:16px; }

/* Icon orb */
.dc-icon-orb {
  width:46px; height:46px; border-radius:12px; flex-shrink:0;
  display:grid; place-items:center;
  background:color-mix(in srgb,var(--dc-accent,var(--gold)) 14%,transparent);
  border:1px solid color-mix(in srgb,var(--dc-accent,var(--gold)) 30%,transparent);
  color:var(--dc-accent,var(--gold));
  transition:all .2s;
}
.dc-card:hover .dc-icon-orb { transform:scale(1.08) rotate(-4deg); }
.dc-card.dc-completed .dc-icon-orb {
  background:color-mix(in srgb,var(--dc-accent,var(--gold)) 20%,transparent);
  box-shadow:0 0 18px color-mix(in srgb,var(--dc-accent,var(--gold)) 30%,transparent);
}

/* Content */
.dc-content { flex:1; min-width:0; }
.dc-card-title { font-size:.92rem; font-weight:700; color:var(--ink); line-height:1.25; margin-bottom:3px; display:flex; align-items:center; gap:8px; }
.dc-card-desc { font-family:'JetBrains Mono',monospace; font-size:.52rem; letter-spacing:.04em; color:var(--ink3); margin-bottom:11px; line-height:1.6; }

/* Progress bar */
.dc-prog-wrap { margin-bottom:10px; }
.dc-prog-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; }
.dc-prog-pct { font-family:'JetBrains Mono',monospace; font-size:.5rem; letter-spacing:.08em; color:var(--dc-accent,var(--gold)); }
.dc-prog-track { height:6px; background:var(--border); border-radius:3px; overflow:hidden; }
.dc-prog-fill {
  height:100%; border-radius:3px;
  background:linear-gradient(90deg,var(--dc-accent,var(--gold)),color-mix(in srgb,var(--dc-accent,var(--gold)) 70%,white));
  transition:width 1.2s cubic-bezier(.16,1,.3,1);
  position:relative;
}
.dc-prog-fill::after {
  content:''; position:absolute; top:0; right:0; bottom:0; width:6px;
  background:rgba(255,255,255,.35); border-radius:3px; filter:blur(1px);
}

/* Rewards row */
.dc-rewards { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dc-reward-chip {
  display:inline-flex; align-items:center; gap:5px;
  font-family:'JetBrains Mono',monospace; font-size:.52rem; letter-spacing:.06em;
  padding:3px 10px; border-radius:20px;
  transition:all .2s;
}
.dc-chip-xp {
  background:rgba(196,145,58,.1); border:1px solid rgba(196,145,58,.3);
  color:var(--gold);
}
.dc-chip-gem {
  background:rgba(155,107,174,.12); border:1px solid rgba(155,107,174,.35);
  color:#9b6bae;
}
.dark .dc-chip-gem { color:#c090d8; background:rgba(155,107,174,.18); }
.dc-chip-icon { width:11px; height:11px; }

/* Completed stamp */
.dc-claimed {
  display:inline-flex; align-items:center; gap:5px;
  font-family:'JetBrains Mono',monospace; font-size:.5rem; letter-spacing:.08em; text-transform:uppercase;
  padding:3px 10px; border-radius:20px;
  background:color-mix(in srgb,var(--dc-accent,var(--gold)) 12%,transparent);
  border:1px solid color-mix(in srgb,var(--dc-accent,var(--gold)) 30%,transparent);
  color:var(--dc-accent,var(--gold));
}

/* Claim button */
.dc-claim-btn {
  display:inline-flex; align-items:center; gap:6px;
  font-family:'JetBrains Mono',monospace; font-size:.54rem; letter-spacing:.08em; text-transform:uppercase;
  padding:6px 14px; border-radius:8px; border:none; cursor:pointer;
  background:var(--dc-accent,var(--gold)); color:#fff;
  transition:all .22s cubic-bezier(.34,1.56,.64,1);
  flex-shrink:0; white-space:nowrap;
}
.dark .dc-claim-btn { color:#0c0b09; }
.dc-claim-btn:hover { filter:brightness(1.12); transform:scale(1.04); box-shadow:0 4px 16px color-mix(in srgb,var(--dc-accent,var(--gold)) 35%,transparent); }
.dc-claim-btn:active { transform:scale(.97); }
.dc-claim-btn:disabled { opacity:.4; cursor:not-allowed; transform:none; }

/* View all toggle */
.dc-toggle {
  display:flex; align-items:center; justify-content:center; gap:7px; width:100%;
  font-family:'JetBrains Mono',monospace; font-size:.56rem; letter-spacing:.1em; text-transform:uppercase;
  padding:10px; border-radius:10px; border:1px dashed var(--border2);
  background:transparent; color:var(--ink3); cursor:pointer;
  transition:all .22s; margin-top:4px;
}
.dc-toggle:hover { border-color:var(--gold); color:var(--gold); background:var(--gold3); }

/* Claim flash animation */
@keyframes dc-claim-flash {
  0% { transform:scale(1); }
  25% { transform:scale(1.03); }
  50% { transform:scale(.99); }
  75% { transform:scale(1.015); }
  100% { transform:scale(1); }
}
.dc-claim-anim { animation:dc-claim-flash .5s cubic-bezier(.34,1.56,.64,1); }

/* Completion shimmer */
@keyframes dc-shimmer {
  0% { background-position:-200% center; }
  100% { background-position:200% center; }
}
.dc-shimmer-text {
  background:linear-gradient(90deg,var(--gold),#e8c06a,var(--gold));
  background-size:200% auto;
  -webkit-background-clip:text; background-clip:text;
  -webkit-text-fill-color:transparent;
  animation:dc-shimmer 2.5s linear infinite;
}

/* Today progress header */
.dc-progress-summary {
  display:flex; align-items:center; gap:16px; padding:14px 18px;
  background:var(--surface2); border-radius:10px; margin-bottom:14px;
  border:1px solid var(--border);
}
.dc-ps-val { font-family:'Cormorant Garamond',serif; font-size:1.6rem; font-weight:300; color:var(--gold); line-height:1; }
.dc-ps-label { font-family:'JetBrains Mono',monospace; font-size:.5rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink3); }
.dc-ps-divider { width:1px; height:32px; background:var(--border); flex-shrink:0; }
.dc-ps-track-wrap { flex:1; }
.dc-ps-track { height:5px; background:var(--border); border-radius:3px; overflow:hidden; margin-top:6px; }
.dc-ps-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,var(--gold),#9b6bae); transition:width 1s ease; }
`;

/* ═══════════════════════════════════════════════════════════════
   ACCENT COLORS per commission slot
═══════════════════════════════════════════════════════════════ */
const ACCENT_COLORS = [
  '#c4913a', // gold
  '#9b6bae', // purple/gem
  '#5b8fa8', // blue
  '#6b8c6b', // green
];

/* ═══════════════════════════════════════════════════════════════
   SINGLE COMMISSION CARD
═══════════════════════════════════════════════════════════════ */
function CommissionCard({
  commission,
  progressData,
  isCompleted,
  onClaim,
  claiming,
  accentColor,
}) {
  const Icon = commission.icon;
  const { progress, current, target } = progressData;
  const canClaim = progress >= 100 && !isCompleted;

  return (
    <div
      className={`dc-card${isCompleted ? ' dc-completed' : ''} ${claiming ? 'dc-claim-anim' : ''}`}
      style={{ '--dc-accent': accentColor }}
    >
      <div className="dc-card-inner">
        <div className="dc-icon-orb">
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <div className="dc-content">
          <div className="dc-card-title">
            {commission.title}
            {isCompleted && (
              <span
                className="dc-shimmer-text"
                style={{
                  fontSize: '.65rem',
                  fontFamily: 'JetBrains Mono,monospace',
                  fontWeight: 400,
                }}
              >
                ✦ Claimed
              </span>
            )}
          </div>
          <div className="dc-card-desc">{commission.description}</div>
          <div className="dc-prog-wrap">
            <div className="dc-prog-header">
              <span
                style={{
                  fontFamily: 'JetBrains Mono,monospace',
                  fontSize: '.5rem',
                  letterSpacing: '.06em',
                  color: 'var(--ink3)',
                }}
              >
                {current} / {target}
              </span>
              <span className="dc-prog-pct">{progress}%</span>
            </div>
            <div className="dc-prog-track">
              <div className="dc-prog-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="dc-rewards">
            <span className="dc-reward-chip dc-chip-xp">
              <Zap size={11} className="dc-chip-icon" />+{commission.rewardXP}{' '}
              XP
            </span>
            <span className="dc-reward-chip dc-chip-gem">
              <Gem size={11} className="dc-chip-icon" />+{commission.rewardGems}{' '}
              Gems
            </span>
            {isCompleted && (
              <span className="dc-claimed">
                <CheckCircle2 size={10} />
                Reward Claimed
              </span>
            )}
          </div>
        </div>
        {canClaim && !isCompleted && (
          <button
            className="dc-claim-btn"
            onClick={() => onClaim(commission)}
            disabled={claiming}
          >
            <Sparkles size={12} />
            Claim
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function DailyCommissions({
  supabase,
  userId,
  sessions = [],
  onGemsChange,
  isDark = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [gems, setGems] = useState(0);
  const [claiming, setClaiming] = useState(null); // commission id being claimed
  const [loading, setLoading] = useState(true);

  // REPLACE with this:
  const [todayDate, setTodayDate] = useState(todayISO);

  useEffect(() => {
    const interval = setInterval(() => {
      const newDate = todayISO();
      setTodayDate((prev) => {
        if (prev !== newDate) {
          setCompletedIds(new Set());
          setLoading(true);
          return newDate;
        }
        return prev;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const commissions = useMemo(() => getDayCommissions(todayDate), [todayDate]);

  // Filter sessions to today only
  const todaySessions = useMemo(() => {
    const today = todayDate; // ← consume state so memo reacts to date rollover
    return sessions.filter((s) => {
      const d = new Date(s.created_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}` === today;
    });
  }, [sessions, todayDate]); // ← add todayDate to deps

  // Compute live progress for each commission
  const progressMap = useMemo(() => {
    const map = {};
    commissions.forEach((c) => {
      map[c.id] = computeProgress(c, todaySessions);
    });
    return map;
  }, [commissions, todaySessions]);

  // Load completed commissions + gem balance from Supabase
  // REPLACE with this:
  useEffect(() => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const [{ data: completions }, { data: gemsRow }] = await Promise.all([
          supabase
            .from('commission_completions')
            .select('commission_id')
            .eq('user_id', userId)
            .eq('completed_date', todayDate),
          supabase
            .from('user_gems')
            .select('gems')
            .eq('user_id', userId)
            .maybeSingle(), // maybeSingle() returns null instead of throwing when no row exists
        ]);
        if (completions) {
          setCompletedIds(new Set(completions.map((r) => r.commission_id)));
        }
        if (gemsRow) setGems(gemsRow.gems);
      } catch (err) {
        console.error('DailyCommissions: load failed', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, userId, todayDate]);

  // REPLACE with this:
  const handleClaim = useCallback(
    async (commission) => {
      if (!supabase || !userId || claiming) return;
      if (!commissions.find((c) => c.id === commission.id)) return;
      setClaiming(commission.id);

      // Add this block immediately before the insert:
      const { data: existing } = await supabase
        .from('commission_completions')
        .select('id')
        .eq('user_id', userId)
        .eq('commission_id', commission.id)
        .eq('completed_date', todayDate)
        .maybeSingle();

      if (existing) {
        // Already claimed (duplicate tab or retry) — sync local state and bail
        setCompletedIds((prev) => new Set([...prev, commission.id]));
        setClaiming(null);
        return;
      }

      const { error: err1 } = await supabase
        .from('commission_completions')
        .insert({
          user_id: userId,
          commission_id: commission.id,
          completed_date: todayDate,
          xp_awarded: commission.rewardXP,
          gems_awarded: commission.rewardGems,
        });

      if (err1) {
        setClaiming(null);
        return;
      }

      // const newGems = gems + commission.rewardGems;
      // await supabase.from('user_gems').upsert(
      //   {
      //     user_id: userId,
      //     gems: newGems,
      //     updated_at: new Date().toISOString(),
      //   },
      //   { onConflict: 'user_id' },
      // );

      // setCompletedIds((prev) => new Set([...prev, commission.id]));
      // setGems(newGems);
      // onGemsChange?.(newGems);

      const { data: newTotal, error: gemErr } = await supabase.rpc(
        'increment_gems',
        {
          p_user_id: userId,
          p_amount: commission.rewardGems,
        },
      );

      setCompletedIds((prev) => new Set([...prev, commission.id]));
      const updatedGems = gemErr ? gems + commission.rewardGems : newTotal;
      setGems(updatedGems);
      onGemsChange?.(updatedGems);

      setTimeout(() => setClaiming(null), 600);
    },
    [supabase, userId, claiming, gems, onGemsChange, commissions, todayDate],
  );

  const completedCount = completedIds.size;
  const totalCount = commissions.length;
  const overallPct = Math.round((completedCount / totalCount) * 100);

  const visibleCommissions = expanded ? commissions : commissions.slice(0, 1);

  if (loading) return null;

  return (
    <div className={`dc-wrap${isDark ? ' dark' : ''}`}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="dc-head">
        <div>
          <div className="dc-eyebrow">
            <Star size={10} /> Daily Commissions
          </div>
          <div className="dc-title">
            Today's <em>Quests</em>
          </div>
        </div>
        <div className="dc-gems-badge">
          <Gem className="dc-gem-icon" size={16} strokeWidth={1.8} />
          <span className="dc-gem-count">{gems.toLocaleString()}</span>
          <span className="dc-gem-label">FocusGems</span>
        </div>
      </div>

      {/* Overall progress summary */}
      <div className="dc-progress-summary">
        <div style={{ textAlign: 'center' }}>
          <div className="dc-ps-val">
            {completedCount}/{totalCount}
          </div>
          <div className="dc-ps-label">Completed</div>
        </div>
        <div className="dc-ps-divider" />
        <div className="dc-ps-track-wrap">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: 'JetBrains Mono,monospace',
                fontSize: '.5rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'var(--ink3)',
              }}
            >
              Daily Progress
            </span>
            <span
              style={{
                fontFamily: 'JetBrains Mono,monospace',
                fontSize: '.5rem',
                color: 'var(--gold)',
              }}
            >
              {overallPct}%
            </span>
          </div>
          <div className="dc-ps-track">
            <div className="dc-ps-fill" style={{ width: `${overallPct}%` }} />
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            className="dc-ps-val"
            style={{ color: '#9b6bae', fontSize: '1.3rem' }}
          >
            <Gem
              size={18}
              style={{ display: 'inline', verticalAlign: 'middle' }}
            />{' '}
            {commissions.reduce(
              (a, c) => (completedIds.has(c.id) ? a + c.rewardGems : a),
              0,
            )}
          </div>
          <div className="dc-ps-label">Gems Earned</div>
        </div>
      </div>

      {/* Commission cards */}
      <div className="dc-list">
        {visibleCommissions.map((commission, i) => (
          <CommissionCard
            key={commission.id}
            commission={commission}
            progressData={progressMap[commission.id]}
            isCompleted={completedIds.has(commission.id)}
            onClaim={handleClaim}
            claiming={claiming === commission.id}
            accentColor={ACCENT_COLORS[i % ACCENT_COLORS.length]}
          />
        ))}
      </div>

      {/* View all toggle */}
      <button className="dc-toggle" onClick={() => setExpanded((v) => !v)}>
        {expanded ? (
          <>
            <ChevronUp size={13} /> Show Less
          </>
        ) : (
          <>
            <ChevronDown size={13} />
            View All Commissions
            <span
              style={{
                background: 'var(--gold3)',
                border: '1px solid rgba(196,145,58,.3)',
                color: 'var(--gold)',
                padding: '1px 8px',
                borderRadius: '20px',
                fontFamily: 'JetBrains Mono,monospace',
                fontSize: '.48rem',
              }}
            >
              {totalCount - 1} more
            </span>
          </>
        )}
      </button>
    </div>
  );
}
