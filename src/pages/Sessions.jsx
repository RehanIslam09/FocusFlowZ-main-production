/**
 * Sessions.jsx — Focus Command Center
 * A complete redesign: state-driven, cinematic, premium.
 *
 * ✅ All original functionality preserved:
 *    - Supabase fetch + toggle (focus_logs + sessions)
 *    - Search, filter (status + type), sort
 *    - Grid / List view
 *    - session:created event listener
 *    - useTheme / useSupabase / useUser
 *
 * ✅ New features:
 *    - Grouped sections (Active → Today → This Week → Older)
 *    - "Continue where you left off" featured card
 *    - Smart insights ribbon
 *    - Hover quick-actions (Resume · Edit · Duplicate)
 *    - Staggered entrance animations
 *    - Full two-layer semantic token system (bulletproof dark mode)
 */

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import AppNavbar from '../components/app/AppNavbar';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import {
  Plus,
  Clock,
  Calendar,
  ArrowRight,
  BookOpen,
  Brain,
  Search,
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  Circle,
  X,
  LayoutGrid,
  AlignLeft,
  Flame,
  Play,
  RotateCcw,
  Copy,
  Zap,
  Target,
  TrendingUp,
  Activity,
  Star,
  ChevronRight,
  PenLine,
} from 'lucide-react';
import SessionNotesEditor, {
  htmlToMarkdown,
} from '../components/SessionNotesEditor';

/* ─────────────────────────────────────────────
   UTILS
───────────────────────────────────────────── */
const fmtMins = (m) => {
  if (!m) return '0m';
  const h = Math.floor(m / 60),
    r = m % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
};

const timeAgo = (d) => {
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const isToday = (d) => {
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

const isThisWeek = (d) => {
  const date = new Date(d);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  return date >= weekAgo && date <= now;
};

/* ─────────────────────────────────────────────
   CSS — Strict semantic token system
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=IBM+Plex+Mono:wght@300;400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');

/* ══ PRIMITIVE PALETTE ══ */
:root {
  --_p-cream-50:  #fdfaf4;
  --_p-cream-100: #f5f0e8;
  --_p-cream-200: #ede7d9;
  --_p-cream-300: #e2d9c8;
  --_p-ink-900:   #1e1a14;
  --_p-ink-600:   #3d3628;
  --_p-ink-400:   #5c5445;
  --_p-ink-200:   #9c9283;
  --_p-amber:     #c4913a;
  --_p-amber-l:   #e8b96a;
  --_p-amber-d:   #a8782a;
  --_p-terra:     #b85c4a;
  --_p-sage:      #6b8c6b;
  --_p-sepia:     #7a6a54;
}

/* ══ SEMANTIC TOKENS — LIGHT ══ */
:root {
  --bg-page:       var(--_p-cream-100);
  --bg-alt:        var(--_p-cream-200);
  --surface-1:     var(--_p-cream-50);
  --surface-2:     var(--_p-cream-200);
  --surface-3:     var(--_p-cream-300);
  --surface-invert:#1e1a14;
  --surface-active:rgba(196,145,58,.07);
  --text-primary:  var(--_p-ink-900);
  --text-secondary:var(--_p-ink-400);
  --text-muted:    var(--_p-ink-200);
  --text-invert:   #f0ead8;
  --text-invert-dim:rgba(240,234,216,.42);
  --border-subtle: #ddd5c4;
  --border-mid:    #c8bc9e;
  --border-strong: #b0a48c;
  --accent:        var(--_p-amber);
  --accent-light:  var(--_p-amber-l);
  --accent-dim:    rgba(196,145,58,.12);
  --accent-dim2:   rgba(196,145,58,.06);
  --accent-glow:   rgba(196,145,58,.20);
  --success:       var(--_p-sage);
  --success-dim:   rgba(107,140,107,.10);
  --success-border:rgba(107,140,107,.28);
  --danger:        var(--_p-terra);
  --danger-dim:    rgba(184,92,74,.08);
  --shadow-xs: 0 1px 4px rgba(30,26,20,.05);
  --shadow-sm: 0 2px 12px rgba(30,26,20,.07);
  --shadow-md: 0 8px 32px rgba(30,26,20,.10);
  --shadow-lg: 0 20px 56px rgba(30,26,20,.14);
  --shadow-glow: 0 0 0 3px var(--accent-dim), 0 8px 32px var(--accent-glow);
  --f-serif: 'Playfair Display', Georgia, serif;
  --f-mono:  'IBM Plex Mono', monospace;
  --f-body:  'Lora', Georgia, serif;
  --ease:   cubic-bezier(.16,1,.3,1);
  --spring: cubic-bezier(.34,1.56,.64,1);
  --dur: .5s;
}

/* ══ SEMANTIC TOKENS — DARK ══ */
.dark {
  --bg-page:        #111009;
  --bg-alt:         #181610;
  --surface-1:      #1a1812;
  --surface-2:      #222018;
  --surface-3:      #2a271e;
  --surface-invert: #0a0906;
  --surface-active: rgba(212,162,74,.08);
  --text-primary:   #f0ead8;
  --text-secondary: #b8aa94;
  --text-muted:     #7a6e5e;
  --text-invert:    #f0ead8;
  --text-invert-dim:rgba(240,234,216,.32);
  --border-subtle:  #272420;
  --border-mid:     #36312a;
  --border-strong:  #46403a;
  --accent:         #d4a24a;
  --accent-light:   #e8c070;
  --accent-dim:     rgba(212,162,74,.14);
  --accent-dim2:    rgba(212,162,74,.07);
  --accent-glow:    rgba(212,162,74,.18);
  --success:        #7aa87a;
  --success-dim:    rgba(122,168,122,.10);
  --success-border: rgba(122,168,122,.25);
  --danger:         #c06858;
  --danger-dim:     rgba(192,104,88,.08);
  --shadow-xs: 0 1px 4px rgba(0,0,0,.28);
  --shadow-sm: 0 2px 12px rgba(0,0,0,.38);
  --shadow-md: 0 8px 32px rgba(0,0,0,.52);
  --shadow-lg: 0 20px 56px rgba(0,0,0,.68);
  --shadow-glow: 0 0 0 3px var(--accent-dim), 0 8px 32px var(--accent-glow);
}

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── GRAIN ── */
.sp-grain {
  pointer-events: none; position: fixed; inset: 0; z-index: 998;
  opacity: .028; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.dark .sp-grain { opacity: .048; mix-blend-mode: screen; }

/* ── PAGE ── */
.sp { min-height: 100vh; background: var(--bg-page); color: var(--text-primary); font-family: var(--f-body); position: relative; transition: background .35s, color .3s; }
.sp-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.sp-orb { position: absolute; border-radius: 50%; filter: blur(180px); }
.sp-orb1 { width: 600px; height: 600px; background: rgba(196,145,58,.06); top: -200px; right: -100px; }
.sp-orb2 { width: 400px; height: 400px; background: rgba(107,140,107,.04); bottom: -150px; left: -80px; }
.dark .sp-orb1 { background: rgba(212,162,74,.04); }
.dark .sp-orb2 { background: rgba(107,140,107,.03); }
.sp-inner { max-width: 1260px; margin: 0 auto; padding: 44px 36px 110px; position: relative; z-index: 1; }
@media (max-width: 768px) { .sp-inner { padding: 22px 18px 80px; } }

/* ══════════════════════════════
   CONTROL BAR
══════════════════════════════ */
.ctrl-bar {
  display: flex; align-items: flex-end;
  justify-content: space-between; gap: 24px;
  margin-bottom: 36px; flex-wrap: wrap;
  animation: fadeUp var(--dur) var(--ease) both;
}
.ctrl-left {}
.ctrl-eyebrow {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--f-mono); font-size: .59rem;
  letter-spacing: .18em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 10px;
}
.ctrl-eyebrow-line { width: 22px; height: 1px; background: var(--accent); opacity: .6; }
.ctrl-title {
  font-family: var(--f-serif);
  font-size: clamp(2rem, 4.5vw, 3.2rem);
  font-weight: 700; letter-spacing: -.04em; line-height: 1.06;
  color: var(--text-primary);
}
.ctrl-title em { font-style: italic; color: var(--accent); font-weight: 400; }
.ctrl-sub {
  font-family: var(--f-mono); font-size: .59rem;
  color: var(--text-muted); letter-spacing: .08em; margin-top: 8px;
}
.ctrl-right { display: flex; align-items: center; gap: 9px; flex-shrink: 0; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--f-mono); font-size: .65rem;
  letter-spacing: .08em; text-transform: uppercase;
  padding: 11px 22px; border-radius: 7px; border: none;
  cursor: pointer; transition: all .22s var(--ease); white-space: nowrap;
}
.btn-primary {
  background: var(--text-primary); color: var(--bg-page);
  position: relative; overflow: hidden;
}
.btn-primary::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  opacity: 0; transition: opacity .25s;
}
.btn-primary:hover::before { opacity: 1; }
.btn-primary:hover { color: #fff; transform: translateY(-2px); box-shadow: 0 8px 28px var(--accent-glow); }
.btn-primary span, .btn-primary svg { position: relative; z-index: 1; }
.btn-ghost {
  background: transparent; border: 1px solid var(--border-mid);
  color: var(--text-secondary);
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }

/* ══════════════════════════════
   STAT STRIP
══════════════════════════════ */
.stat-strip {
  display: grid; grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--border-subtle); border-radius: 14px;
  overflow: hidden; background: var(--surface-1);
  box-shadow: var(--shadow-sm); margin-bottom: 32px;
  animation: fadeUp var(--dur) var(--ease) 60ms both;
  transition: background .35s, border-color .35s;
}
@media (max-width: 640px) { .stat-strip { grid-template-columns: repeat(2, 1fr); } }
.stat-item {
  padding: 22px 20px; border-right: 1px solid var(--border-subtle);
  position: relative; overflow: hidden; transition: background .2s;
}
.stat-item:last-child { border-right: none; }
.stat-item:hover { background: var(--surface-2); }
.stat-accent-line {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--si-color, var(--accent));
  transform: scaleX(0); transform-origin: left;
  transition: transform .4s var(--ease);
}
.stat-item:hover .stat-accent-line { transform: scaleX(1); }
.stat-icon { color: var(--si-color, var(--accent)); opacity: .85; margin-bottom: 11px; }
.stat-label {
  font-family: var(--f-mono); font-size: .56rem;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--text-muted); margin-bottom: 5px;
}
.stat-value {
  font-family: var(--f-serif); font-size: 1.85rem;
  font-weight: 700; letter-spacing: -.04em; line-height: 1;
  color: var(--text-primary);
}
.stat-sub {
  font-family: var(--f-mono); font-size: .55rem;
  color: var(--text-muted); margin-top: 5px;
}

/* Progress bar */
.prog-bar-wrap {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 10px; padding: 14px 22px;
  display: flex; align-items: center; gap: 18px;
  margin-bottom: 32px; box-shadow: var(--shadow-xs);
  animation: fadeUp var(--dur) var(--ease) 80ms both;
  transition: background .35s;
}
.pbw-label {
  font-family: var(--f-mono); font-size: .58rem;
  letter-spacing: .12em; text-transform: uppercase;
  color: var(--text-muted); white-space: nowrap;
}
.pbw-track { flex: 1; height: 4px; background: var(--surface-3); border-radius: 2px; overflow: hidden; }
.pbw-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--success));
  border-radius: 2px; transition: width 1.4s cubic-bezier(.22,1,.36,1);
}
.pbw-num {
  font-family: var(--f-mono); font-size: .7rem; font-weight: 500;
  color: var(--text-primary); white-space: nowrap;
}
.pbw-sub { font-family: var(--f-mono); font-size: .54rem; color: var(--text-muted); }

/* ══════════════════════════════
   INSIGHTS RIBBON
══════════════════════════════ */
.insights-ribbon {
  display: flex; gap: 14px; margin-bottom: 32px;
  overflow-x: auto; padding-bottom: 4px;
  animation: fadeUp var(--dur) var(--ease) 90ms both;
  scrollbar-width: none;
}
.insights-ribbon::-webkit-scrollbar { display: none; }
.insight-chip {
  flex-shrink: 0; display: flex; align-items: center; gap: 10px;
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 10px; padding: 12px 16px;
  box-shadow: var(--shadow-xs);
  transition: background .2s, border-color .2s, box-shadow .2s;
  min-width: 200px;
}
.insight-chip:hover { border-color: var(--border-mid); box-shadow: var(--shadow-sm); }
.ic-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--accent-dim); display: grid; place-items: center;
  color: var(--accent); flex-shrink: 0;
}
.ic-label {
  font-family: var(--f-mono); font-size: .56rem;
  text-transform: uppercase; letter-spacing: .12em;
  color: var(--text-muted);
}
.ic-value {
  font-family: var(--f-serif); font-size: .95rem; font-weight: 600;
  color: var(--text-primary); margin-top: 2px;
}

/* ══════════════════════════════
   FEATURED CARD ("Continue")
══════════════════════════════ */
.featured-card {
  position: relative; overflow: hidden;
  background: var(--surface-invert);
  border-radius: 16px; padding: 32px 36px;
  margin-bottom: 36px;
  box-shadow: var(--shadow-lg);
  animation: fadeUp var(--dur) var(--ease) 100ms both;
  display: flex; align-items: center; justify-content: space-between; gap: 28px;
  flex-wrap: wrap;
}
.featured-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(196,145,58,.6), transparent);
}
.featured-card::after {
  content: '◈'; position: absolute;
  right: 200px; top: 50%; transform: translateY(-50%);
  font-family: var(--f-serif); font-size: 9rem; line-height: 1;
  color: rgba(255,255,255,.018); pointer-events: none; user-select: none;
}
.fc-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at top left, rgba(196,145,58,.06) 0%, transparent 60%);
}
.fc-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(196,145,58,.15); border: 1px solid rgba(196,145,58,.3);
  color: var(--accent-light); font-family: var(--f-mono);
  font-size: .57rem; letter-spacing: .12em; text-transform: uppercase;
  padding: 4px 10px; border-radius: 100px; margin-bottom: 14px;
}
.fc-badge-pulse {
  width: 5px; height: 5px; border-radius: 50%; background: var(--accent-light);
  animation: pulse 2.2s ease-in-out infinite;
}
.fc-title {
  font-family: var(--f-serif); font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 600; color: var(--text-invert); line-height: 1.2;
  margin-bottom: 12px; max-width: 480px;
}
.fc-meta {
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
}
.fc-meta-item {
  display: flex; align-items: center; gap: 7px;
  font-family: var(--f-mono); font-size: .62rem;
  color: var(--text-invert-dim); letter-spacing: .06em;
}
.fc-meta-item strong { color: var(--text-invert); font-weight: 500; }
.fc-actions { display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; position: relative; z-index: 1; }
.fc-cta {
  display: inline-flex; align-items: center; gap: 10px;
  background: var(--accent); color: #fff;
  font-family: var(--f-mono); font-size: .72rem;
  letter-spacing: .08em; text-transform: uppercase;
  padding: 13px 26px; border-radius: 8px; border: none;
  cursor: pointer; white-space: nowrap;
  transition: background .2s, transform .25s var(--spring), box-shadow .25s;
}
.fc-cta:hover { background: var(--accent-light); transform: translateY(-2px); box-shadow: 0 10px 32px var(--accent-glow); }
.fc-cta-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  color: rgba(240,234,216,.6); font-family: var(--f-mono);
  font-size: .65rem; letter-spacing: .08em; text-transform: uppercase;
  padding: 10px 20px; border-radius: 7px; cursor: pointer;
  transition: all .2s;
}
.fc-cta-ghost:hover { background: rgba(255,255,255,.1); color: var(--text-invert); }
.fc-type-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--f-mono); font-size: .58rem;
  letter-spacing: .1em; text-transform: uppercase;
  color: var(--accent-light); background: rgba(196,145,58,.1);
  border: 1px solid rgba(196,145,58,.2);
  padding: 4px 10px; border-radius: 4px; margin-bottom: 8px;
}

/* ══════════════════════════════
   TOOLBAR
══════════════════════════════ */
.toolbar {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 16px; flex-wrap: wrap;
  animation: fadeUp var(--dur) var(--ease) 110ms both;
}
.search-wrap { position: relative; flex: 1; min-width: 200px; }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.search-input {
  width: 100%; background: var(--surface-1);
  border: 1px solid var(--border-subtle); border-radius: 8px;
  padding: 10px 12px 10px 36px;
  font-family: var(--f-mono); font-size: .68rem;
  color: var(--text-primary); outline: none;
  transition: border-color .2s, box-shadow .2s, background .35s;
}
.search-input::placeholder { color: var(--text-muted); }
.search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
.sort-wrap { position: relative; flex-shrink: 0; }
.sort-btn {
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 8px; padding: 10px 15px;
  font-family: var(--f-mono); font-size: .63rem;
  color: var(--text-secondary); cursor: pointer; transition: all .2s;
}
.sort-btn:hover { border-color: var(--accent); color: var(--accent); }
.sort-dropdown {
  position: absolute; top: calc(100% + 6px); right: 0;
  background: var(--surface-1); border: 1px solid var(--border-mid);
  border-radius: 11px; padding: 6px; min-width: 180px;
  z-index: 50; box-shadow: var(--shadow-md);
  animation: dropIn .15s var(--ease);
}
.sort-option {
  display: block; width: 100%; background: transparent; border: none;
  padding: 9px 13px; font-family: var(--f-mono); font-size: .63rem;
  color: var(--text-muted); text-align: left; cursor: pointer;
  border-radius: 7px; transition: all .12s;
}
.sort-option:hover { background: var(--surface-2); color: var(--text-primary); }
.sort-option.active { color: var(--accent); }
.view-toggle {
  display: flex; border: 1px solid var(--border-subtle);
  border-radius: 8px; overflow: hidden; flex-shrink: 0;
}
.view-btn {
  background: transparent; border: none; padding: 9px 13px;
  cursor: pointer; color: var(--text-muted);
  transition: all .15s; display: grid; place-items: center;
}
.view-btn:hover { color: var(--text-primary); background: var(--surface-2); }
.view-btn.active { background: var(--accent); color: #fff; }

/* ══════════════════════════════
   CHIPS
══════════════════════════════ */
.chips-row {
  display: flex; align-items: center; gap: 7px;
  flex-wrap: wrap; margin-bottom: 24px;
  animation: fadeUp var(--dur) var(--ease) 120ms both;
}
.chips-label {
  font-family: var(--f-mono); font-size: .55rem;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--text-muted); margin-right: 2px;
}
.chip {
  font-family: var(--f-mono); font-size: .6rem;
  letter-spacing: .06em; padding: 5px 13px; border-radius: 20px;
  border: 1px solid var(--border-subtle); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.chip:hover { border-color: var(--accent); color: var(--accent); }
.chip.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
.chips-sep { width: 1px; height: 14px; background: var(--border-subtle); margin: 0 4px; }
.results-label {
  font-family: var(--f-mono); font-size: .59rem;
  color: var(--text-muted); letter-spacing: .08em;
  text-transform: uppercase; margin-bottom: 16px;
}

/* ══════════════════════════════
   SECTION GROUPS
══════════════════════════════ */
.section-group { margin-bottom: 36px; }
.section-header {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 16px;
}
.section-header-line { flex: 1; height: 1px; background: var(--border-subtle); }
.section-header-label {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--f-mono); font-size: .59rem;
  letter-spacing: .16em; text-transform: uppercase;
  color: var(--text-muted); white-space: nowrap;
}
.section-header-gem { font-family: var(--f-serif); font-size: .65rem; color: var(--accent); opacity: .5; }
.section-count {
  font-family: var(--f-mono); font-size: .56rem;
  background: var(--surface-2); border: 1px solid var(--border-subtle);
  color: var(--text-muted); padding: 2px 7px; border-radius: 10px;
}

/* ══════════════════════════════
   SESSION CARDS (GRID)
══════════════════════════════ */
.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 14px;
}
.sc {
  background: var(--surface-1); border: 1px solid var(--border-subtle);
  border-radius: 13px; padding: 20px 18px 16px;
  display: flex; flex-direction: column; gap: 11px;
  position: relative; overflow: hidden;
  animation: fadeUp .5s var(--ease) both;
  transition: transform .28s var(--spring), box-shadow .28s, border-color .22s, background .35s;
  cursor: default;
}
.sc:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md); border-color: var(--border-mid);
}
.sc:hover .sc-actions { opacity: 1; transform: translateY(0); }
.sc:hover .sc-begin { opacity: 1; }
.sc.done {
  opacity: .78;
  border-color: var(--success-border);
}
.sc.done:hover { opacity: 1; }
.sc-stripe {
  position: absolute; top: 0; left: 0;
  width: 3px; height: 100%; background: var(--accent); opacity: .4;
  border-radius: 13px 0 0 13px;
}
.sc.done .sc-stripe { background: var(--success); opacity: .5; }
.sc-done-ribbon {
  position: absolute; top: 0; right: 0; width: 0; height: 0;
  border-style: solid; border-width: 0 28px 28px 0;
  border-color: transparent var(--success) transparent transparent;
}
.sc-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sc-type {
  font-family: var(--f-mono); font-size: .55rem;
  letter-spacing: .1em; text-transform: uppercase;
  color: var(--text-muted); background: var(--surface-2);
  border: 1px solid var(--border-subtle); padding: 3px 8px; border-radius: 4px;
}
.sc-dur {
  display: flex; align-items: center; gap: 4px;
  font-family: var(--f-mono); font-size: .59rem; color: var(--accent);
}
.sc-title {
  font-family: var(--f-serif); font-size: 1.05rem; font-weight: 600;
  color: var(--text-primary); line-height: 1.35;
}
.sc.done .sc-title { color: var(--text-secondary); }
.sc-goal {
  font-family: var(--f-body); font-size: .73rem; font-style: italic;
  color: var(--text-muted); line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.sc-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.sc-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--f-mono); font-size: .57rem;
  color: var(--text-muted); background: var(--surface-2);
  padding: 3px 8px; border-radius: 20px; border: 1px solid var(--border-subtle);
}
.sc-pill.done-pill { color: var(--success); border-color: var(--success-border); background: var(--success-dim); }
.sc-foot {
  display: flex; align-items: center;
  justify-content: space-between; gap: 8px;
  margin-top: auto; padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
}
.sc-check {
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); display: grid; place-items: center;
  padding: 4px; border-radius: 6px;
  transition: color .2s, transform .18s, background .18s; flex-shrink: 0;
}
.sc-check:hover { transform: scale(1.18); background: var(--surface-2); }
.sc-check:disabled { opacity: .45; cursor: default; }
.sc-begin {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-family: var(--f-mono); font-size: .59rem;
  letter-spacing: .07em; text-transform: uppercase;
  padding: 7px 14px; border-radius: 6px; cursor: pointer;
  flex: 1; justify-content: center;
  transition: all .2s; opacity: .7;
}
.sc-begin:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.sc-actions {
  display: flex; align-items: center; gap: 5px;
  opacity: 0; transform: translateY(4px);
  transition: opacity .22s var(--ease), transform .22s var(--ease);
}
.sc-action-btn {
  display: grid; place-items: center; width: 30px; height: 30px;
  background: var(--surface-2); border: 1px solid var(--border-subtle);
  border-radius: 6px; cursor: pointer; color: var(--text-muted);
  transition: all .18s;
}
.sc-action-btn:hover { background: var(--surface-3); color: var(--text-primary); border-color: var(--border-mid); }

/* ══════════════════════════════
   LIST VIEW
══════════════════════════════ */
.sl {
  display: flex; flex-direction: column;
  border: 1px solid var(--border-subtle); border-radius: 13px;
  overflow: hidden; background: var(--surface-1);
  box-shadow: var(--shadow-sm);
  transition: background .35s;
}
.sl-header {
  display: grid;
  grid-template-columns: 38px 120px 1fr 90px 90px 130px;
  align-items: center; gap: 12px; padding: 11px 18px;
  background: var(--surface-2); border-bottom: 1px solid var(--border-subtle);
  font-family: var(--f-mono); font-size: .55rem;
  letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted);
}
.sl-row {
  display: grid;
  grid-template-columns: 38px 120px 1fr 90px 90px 130px;
  align-items: center; gap: 12px; padding: 13px 18px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-1);
  animation: fadeUp .3s var(--ease) both;
  transition: background .15s;
  position: relative;
}
.sl-row:last-child { border-bottom: none; }
.sl-row:hover { background: var(--surface-2); }
.sl-row:hover .sl-actions { opacity: 1; }
.sl-row.done { opacity: .75; }
.sl-row.done:hover { opacity: 1; }
.sl-check {
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); display: grid; place-items: center;
  padding: 3px; border-radius: 5px; transition: color .2s, transform .15s;
}
.sl-check:hover { transform: scale(1.2); }
.sl-check:disabled { opacity: .45; cursor: default; }
.sl-type {
  font-family: var(--f-mono); font-size: .57rem;
  letter-spacing: .08em; text-transform: uppercase;
  color: var(--text-muted); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.sl-title {
  font-family: var(--f-body); font-size: .84rem; font-weight: 500;
  color: var(--text-primary); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.sl-row.done .sl-title { color: var(--text-secondary); text-decoration: line-through; text-decoration-color: var(--border-mid); }
.sl-meta {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--f-mono); font-size: .57rem; color: var(--text-muted);
}
.sl-begin {
  display: inline-flex; align-items: center; gap: 5px;
  background: transparent; border: 1px solid var(--border-subtle);
  border-radius: 6px; padding: 6px 14px;
  font-family: var(--f-mono); font-size: .58rem;
  letter-spacing: .07em; text-transform: uppercase;
  color: var(--text-secondary); cursor: pointer; transition: all .18s;
}
.sl-begin:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.sl-actions {
  position: absolute; right: 180px; top: 50%; transform: translateY(-50%);
  display: flex; gap: 4px; opacity: 0;
  transition: opacity .2s var(--ease);
}
.sl-act {
  display: grid; place-items: center; width: 28px; height: 28px;
  background: var(--surface-3); border: 1px solid var(--border-subtle);
  border-radius: 5px; cursor: pointer; color: var(--text-muted);
  transition: all .15s;
}
.sl-act:hover { background: var(--surface-2); color: var(--text-primary); }
@media (max-width: 768px) {
  .sl-header, .sl-row { grid-template-columns: 38px 1fr 80px 80px; }
}

/* ══════════════════════════════
   EMPTY STATE
══════════════════════════════ */
.empty {
  background: var(--surface-1); border: 1px dashed var(--border-mid);
  border-radius: 16px; padding: 90px 32px;
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 16px; animation: fadeUp .5s var(--ease) both;
}
.empty-icon-wrap {
  position: relative; width: 80px; height: 80px;
  display: grid; place-items: center;
}
.empty-icon-ring {
  position: absolute; inset: 0; border-radius: 50%;
  border: 1px dashed var(--border-mid);
}
.empty-icon-ring2 {
  position: absolute; inset: -10px; border-radius: 50%;
  border: 1px dashed var(--border-subtle); opacity: .5;
}
.empty-icon-inner {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--surface-2); border: 1px solid var(--border-subtle);
  display: grid; place-items: center; color: var(--text-muted);
}
.empty-title {
  font-family: var(--f-serif); font-size: 1.4rem; font-weight: 600;
  color: var(--text-primary);
}
.empty-sub {
  font-family: var(--f-body); font-size: .8rem;
  color: var(--text-muted); max-width: 320px; line-height: 1.75;
}
.empty-features { display: flex; flex-direction: column; gap: 8px; text-align: left; }
.empty-feat {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--f-body); font-size: .75rem; color: var(--text-secondary);
}
.empty-feat-check {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--accent-dim); border: 1px solid var(--accent);
  display: grid; place-items: center; color: var(--accent); flex-shrink: 0;
}

/* ══════════════════════════════
   AI BANNER (empty state)
══════════════════════════════ */
.ai-banner {
  background: var(--surface-invert); border-radius: 14px;
  padding: 22px 28px; display: flex; align-items: center;
  justify-content: space-between; gap: 20px;
  margin-bottom: 32px; position: relative; overflow: hidden;
  box-shadow: var(--shadow-md);
  animation: fadeUp var(--dur) var(--ease) both;
}
.ai-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(196,145,58,.55), transparent);
}
.ai-banner::after {
  content: '✦'; position: absolute; right: 200px; top: 50%;
  transform: translateY(-50%); font-size: 6rem; line-height: 1;
  color: rgba(255,255,255,.022); font-family: var(--f-serif);
  pointer-events: none; user-select: none;
}
.ai-banner-left { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
.ai-banner-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  display: grid; place-items: center; color: #fff; flex-shrink: 0;
  box-shadow: 0 4px 16px var(--accent-glow);
}
.ai-banner-title {
  font-family: var(--f-serif); font-size: 1.05rem; font-weight: 600;
  color: var(--text-invert);
}
.ai-banner-sub {
  font-family: var(--f-mono); font-size: .57rem;
  color: var(--text-invert-dim); letter-spacing: .04em; margin-top: 3px;
}
.ai-banner-cta {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(196,145,58,.18); border: 1px solid rgba(196,145,58,.32);
  color: var(--accent-light); font-family: var(--f-mono);
  font-size: .65rem; letter-spacing: .08em; text-transform: uppercase;
  padding: 10px 20px; border-radius: 7px; cursor: pointer;
  transition: all .2s; flex-shrink: 0; position: relative; z-index: 1;
}
.ai-banner-cta:hover { background: rgba(196,145,58,.28); transform: translateY(-1px); }

/* ══════════════════════════════
   SKELETONS
══════════════════════════════ */
.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
.skeleton {
  border-radius: 13px; border: 1px solid var(--border-subtle);
  background: linear-gradient(90deg, var(--surface-1) 25%, var(--surface-2) 50%, var(--surface-1) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* ══════════════════════════════
   ERROR
══════════════════════════════ */
.error-bar {
  background: var(--danger-dim); border: 1px solid rgba(184,92,74,.22);
  border-radius: 9px; padding: 12px 16px; margin-bottom: 22px;
  font-family: var(--f-mono); font-size: .65rem;
  color: var(--danger); display: flex; align-items: center; gap: 8px;
}

/* ══════════════════════════════
   KEYFRAMES
══════════════════════════════ */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes dropIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .4; transform: scale(.75); }
}

/* ── Inline notes panel on session cards ── */
.sc-notes-toggle{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.54rem;letter-spacing:.07em;padding:4px 9px;border-radius:6px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-muted);cursor:pointer;transition:all .18s;white-space:nowrap}
.sc-notes-toggle:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-dim2)}
.sc-notes-toggle.open{border-color:var(--accent);color:var(--accent);background:var(--accent-dim)}
.sc-notes-panel{border-top:1px solid var(--border-subtle);padding:14px 16px 16px;animation:sne-in .18s ease both}
@keyframes sne-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.sl-notes-toggle{display:inline-flex;align-items:center;gap:4px;font-family:var(--f-mono);font-size:.52rem;letter-spacing:.07em;padding:4px 8px;border-radius:6px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-muted);cursor:pointer;transition:all .18s;white-space:nowrap;flex-shrink:0}
.sl-notes-toggle:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-dim2)}
.sl-notes-toggle.open{border-color:var(--accent);color:var(--accent);background:var(--accent-dim)}
.sl-notes-panel{padding:12px 16px 14px;border-top:1px solid var(--border-subtle);animation:sne-in .18s ease both}
`;

/* ─────────────────────────────────────────────
   SECTION RULE COMPONENT
───────────────────────────────────────────── */
const SectionHeader = memo(({ icon: Icon, label, count, color }) => (
  <div className="section-header">
    <div className="section-header-line" />
    <div
      className="section-header-label"
      style={{ color: color || 'var(--text-muted)' }}
    >
      <span className="section-header-gem">✦</span>
      {Icon && <Icon size={11} strokeWidth={1.8} />}
      {label}
      {count !== undefined && <span className="section-count">{count}</span>}
    </div>
    <div className="section-header-line" />
  </div>
));

/* ─────────────────────────────────────────────
   GRID CARD
───────────────────────────────────────────── */
function GridCard({
  session: s,
  index: i,
  toggling,
  onToggle,
  onNavigate,
  onDuplicate,
  supabase,
  user,
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesHtml, setNotesHtml] = useState(s.notes_html || s.notes || '');
  const [saveState, setSaveState] = useState('idle');
  const notesTimer = useRef(null);

  const handleNotesChange = useCallback(
    (html) => {
      setNotesHtml(html);
      setSaveState('saving');
      clearTimeout(notesTimer.current);
      notesTimer.current = setTimeout(async () => {
        if (!supabase) return;
        const markdown = htmlToMarkdown(html);
        await supabase
          .from('sessions')
          .update({ notes: markdown, notes_html: html })
          .eq('id', s.id);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
        if (markdown && user?.id) {
          const noteTitle = `${s.title} — Notes`;
          const noteContent = {
            type: 'doc',
            content: markdown
              .split('\n')
              .filter(Boolean)
              .map((line) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
              })),
          };
          const { data: existing } = await supabase
            .from('user_notes')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', noteTitle)
            .maybeSingle();
          if (existing?.id) {
            await supabase
              .from('user_notes')
              .update({
                content: noteContent,
                word_count: markdown.split(/\s+/).filter(Boolean).length,
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('user_notes').insert({
              user_id: user.id,
              title: noteTitle,
              subject: s.subject || 'Study Session',
              tags: ['session-note'],
              content: noteContent,
              word_count: markdown.split(/\s+/).filter(Boolean).length,
            });
          }
          window.dispatchEvent(new CustomEvent('notes:updated'));
        }
      }, 900);
    },
    [supabase, user, s.id, s.title, s.subject],
  );

  return (
    <div
      className={`sc${s.completed ? ' done' : ''}`}
      style={{ animationDelay: `${i * 55}ms` }}
    >
      <div className="sc-stripe" />
      {s.completed && <div className="sc-done-ribbon" />}
      <div className="sc-top">
        <span className="sc-type">{s.focus_type || 'General'}</span>
        <span className="sc-dur">
          <Clock size={10} />
          {fmtMins(s.duration)}
        </span>
      </div>
      <div className="sc-title">{s.title}</div>
      {s.goal && <div className="sc-goal">{s.goal}</div>}
      <div className="sc-meta">
        <span className="sc-pill">
          <Calendar size={9} />
          {timeAgo(s.created_at)}
        </span>
        {s.difficulty && <span className="sc-pill">{s.difficulty}</span>}
        {s.completed && (
          <span className="sc-pill done-pill">
            <CheckCircle2 size={9} />
            Done
          </span>
        )}
      </div>
      <div className="sc-foot">
        <button
          className="sc-check"
          disabled={toggling.has(s.id)}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(s);
          }}
          title={s.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {s.completed ? (
            <CheckCircle2 size={16} color="var(--success)" />
          ) : (
            <Circle size={16} />
          )}
        </button>
        <div className="sc-actions">
          <button
            className="sc-action-btn"
            title="Notes"
            onClick={() => setNotesOpen((o) => !o)}
          >
            <PenLine size={11} />
          </button>
          <button
            className="sc-action-btn"
            title="Duplicate"
            onClick={() => onDuplicate(s)}
          >
            <Copy size={11} />
          </button>
          <button
            className="sc-action-btn"
            title="Open session"
            onClick={() => onNavigate(`/session/${s.id}`)}
          >
            <Zap size={11} />
          </button>
        </div>
        <button
          className="sc-begin"
          onClick={() => onNavigate(`/session/${s.id}`)}
        >
          {s.completed ? (
            <>
              <RotateCcw size={11} />
              Review
            </>
          ) : (
            <>
              <Play size={11} />
              Begin
            </>
          )}
          <ArrowRight size={11} />
        </button>
      </div>
      {notesOpen && (
        <div className="sc-notes-panel">
          <SessionNotesEditor
            value={notesHtml}
            onChange={handleNotesChange}
            saveState={saveState}
            placeholder="Add notes for this session… (type / for commands)"
            minHeight={150}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   LIST ROW
───────────────────────────────────────────── */
function ListRow({
  session: s,
  index: i,
  toggling,
  onToggle,
  onNavigate,
  onDuplicate,
  supabase,
  user,
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesHtml, setNotesHtml] = useState(s.notes_html || s.notes || '');
  const [saveState, setSaveState] = useState('idle');
  const notesTimer = useRef(null);

  const handleNotesChange = useCallback(
    (html) => {
      setNotesHtml(html);
      setSaveState('saving');
      clearTimeout(notesTimer.current);
      notesTimer.current = setTimeout(async () => {
        if (!supabase) return;
        const markdown = htmlToMarkdown(html);
        await supabase
          .from('sessions')
          .update({ notes: markdown, notes_html: html })
          .eq('id', s.id);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
        if (markdown && user?.id) {
          const noteTitle = `${s.title} — Notes`;
          const noteContent = {
            type: 'doc',
            content: markdown
              .split('\n')
              .filter(Boolean)
              .map((line) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
              })),
          };
          const { data: existing } = await supabase
            .from('user_notes')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', noteTitle)
            .maybeSingle();
          if (existing?.id) {
            await supabase
              .from('user_notes')
              .update({
                content: noteContent,
                word_count: markdown.split(/\s+/).filter(Boolean).length,
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('user_notes').insert({
              user_id: user.id,
              title: noteTitle,
              subject: s.subject || 'Study Session',
              tags: ['session-note'],
              content: noteContent,
              word_count: markdown.split(/\s+/).filter(Boolean).length,
            });
          }
          window.dispatchEvent(new CustomEvent('notes:updated'));
        }
      }, 900);
    },
    [supabase, user, s.id, s.title, s.subject],
  );

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        className={`sl-row${s.completed ? ' done' : ''}`}
        style={{ animationDelay: `${i * 40}ms` }}
      >
        <button
          className="sl-check"
          disabled={toggling.has(s.id)}
          onClick={() => onToggle(s)}
        >
          {s.completed ? (
            <CheckCircle2 size={16} color="var(--success)" />
          ) : (
            <Circle size={16} />
          )}
        </button>
        <div className="sl-type">{s.focus_type || '—'}</div>
        <div className="sl-title">{s.title}</div>
        <span className="sl-meta">
          <Clock size={9} />
          {fmtMins(s.duration)}
        </span>
        <span className="sl-meta">
          <Calendar size={9} />
          {timeAgo(s.created_at)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="sl-actions">
            <button
              className="sl-act"
              title="Notes"
              onClick={() => setNotesOpen((o) => !o)}
            >
              <PenLine size={11} />
            </button>
            <button
              className="sl-act"
              title="Duplicate"
              onClick={() => onDuplicate(s)}
            >
              <Copy size={11} />
            </button>
            <button
              className="sl-act"
              title="Open"
              onClick={() => onNavigate(`/session/${s.id}`)}
            >
              <Zap size={11} />
            </button>
          </div>
          <button
            className="sl-begin"
            onClick={() => onNavigate(`/session/${s.id}`)}
          >
            {s.completed ? 'Review' : 'Begin'}
            <ArrowRight size={11} />
          </button>
        </div>
      </div>
      {notesOpen && (
        <div className="sl-notes-panel">
          <SessionNotesEditor
            value={notesHtml}
            onChange={handleNotesChange}
            saveState={saveState}
            placeholder="Add notes for this session… (type / for commands)"
            minHeight={140}
          />
        </div>
      )}
    </div>
  );
}
/* ─────────────────────────────────────────────
   FEATURED CARD — "Continue where you left off"
───────────────────────────────────────────── */
const FeaturedCard = memo(({ session: s, onNavigate }) => {
  if (!s) return null;
  return (
    <div className="featured-card">
      <div className="fc-glow" />
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 240 }}>
        <div className="fc-badge">
          <div className="fc-badge-pulse" />
          Continue where you left off
        </div>
        {s.focus_type && (
          <div className="fc-type-badge">
            <Zap size={9} />
            {s.focus_type}
          </div>
        )}
        <div className="fc-title">{s.title}</div>
        <div className="fc-meta">
          <div className="fc-meta-item">
            <Clock size={12} />
            <strong>{fmtMins(s.duration)}</strong> planned
          </div>
          <div className="fc-meta-item">
            <Calendar size={12} />
            {timeAgo(s.created_at)}
          </div>
          {s.subject && (
            <div className="fc-meta-item">
              <BookOpen size={12} />
              <strong>{s.subject}</strong>
            </div>
          )}
        </div>
      </div>
      <div className="fc-actions">
        <button
          className="fc-cta"
          onClick={() => onNavigate(`/session/${s.id}`)}
        >
          <Play size={14} /> Resume Session
        </button>
        <button
          className="fc-cta-ghost"
          onClick={() => onNavigate('/create-session')}
        >
          <Sparkles size={12} /> New AI Plan
        </button>
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function Sessions() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { supabase, loading: dbLoading } = useSupabase();
  useTheme(); // ensures dark class is applied

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showSort, setShowSort] = useState(false);
  const [toggling, setToggling] = useState(new Set());
  const sortRef = useRef(null);

  /* click-outside for sort dropdown */
  useEffect(() => {
    const h = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target))
        setShowSort(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── FETCH ── */
  const fetchSessions = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('sessions')
      .select(
        'id,title,duration,focus_type,subject,goal,difficulty,completed,created_at,started_at,completed_at,focus_logs(completed)',
      )
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setSessions(
      (data || []).map((s) => ({
        ...s,
        completed:
          (Array.isArray(s.focus_logs) &&
            s.focus_logs.some((l) => l.completed)) ||
          s.completed === true,
      })),
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!dbLoading) fetchSessions();
  }, [dbLoading, fetchSessions]);

  useEffect(() => {
    const handler = () => fetchSessions();
    window.addEventListener('session:created', handler);
    return () => window.removeEventListener('session:created', handler);
  }, [fetchSessions]);

  /* ── TOGGLE COMPLETE ── */
  const handleToggle = useCallback(
    async (session) => {
      if (toggling.has(session.id)) return;
      setToggling((p) => new Set([...p, session.id]));
      const nv = !session.completed;
      setSessions((p) =>
        p.map((s) => (s.id === session.id ? { ...s, completed: nv } : s)),
      );
      try {
        if (nv) {
          const { error: e1 } = await supabase.from('focus_logs').insert({
            session_id: session.id,
            user_id: user?.id,
            completed: true,
            duration: session.duration || 0,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
          });
          if (e1) throw e1;
          const { error: e2 } = await supabase
            .from('sessions')
            .update({ completed: true })
            .eq('id', session.id);
          if (e2) throw e2;
        } else {
          const { error: e1 } = await supabase
            .from('focus_logs')
            .delete()
            .eq('session_id', session.id)
            .eq('completed', true);
          if (e1) throw e1;
          const { error: e2 } = await supabase
            .from('sessions')
            .update({ completed: false })
            .eq('id', session.id);
          if (e2) throw e2;
        }
      } catch (e) {
        console.error(e.message);
        setSessions((p) =>
          p.map((s) => (s.id === session.id ? { ...s, completed: !nv } : s)),
        );
      } finally {
        setToggling((p) => {
          const n = new Set(p);
          n.delete(session.id);
          return n;
        });
      }
    },
    [supabase, user, toggling],
  );

  /* ── DUPLICATE (navigate to create with pre-filled data) ── */
  const handleDuplicate = useCallback(
    (session) => {
      navigate('/create-session', {
        state: {
          prefill: {
            title: `${session.title} (copy)`,
            focus_type: session.focus_type,
            duration: session.duration,
            subject: session.subject,
            goal: session.goal,
            difficulty: session.difficulty,
          },
        },
      });
    },
    [navigate],
  );

  /* ── DERIVED DATA ── */
  const focusTypes = useMemo(
    () =>
      [...new Set(sessions.map((s) => s.focus_type).filter(Boolean))].slice(
        0,
        6,
      ),
    [sessions],
  );

  const filtered = useMemo(() => {
    return sessions
      .filter((s) => {
        const q = search.toLowerCase();
        if (
          q &&
          !s.title?.toLowerCase().includes(q) &&
          !s.focus_type?.toLowerCase().includes(q) &&
          !s.subject?.toLowerCase().includes(q)
        )
          return false;
        if (filterType !== 'all' && s.focus_type !== filterType) return false;
        if (filterStatus === 'done' && !s.completed) return false;
        if (filterStatus === 'active' && s.completed) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest')
          return new Date(b.created_at) - new Date(a.created_at);
        if (sortBy === 'oldest')
          return new Date(a.created_at) - new Date(b.created_at);
        if (sortBy === 'duration') return (b.duration || 0) - (a.duration || 0);
        if (sortBy === 'alpha')
          return (a.title || '').localeCompare(b.title || '');
        return 0;
      });
  }, [sessions, search, filterType, filterStatus, sortBy]);

  /* ── GROUPED SECTIONS ── */
  const grouped = useMemo(() => {
    const active = filtered.filter((s) => !s.completed);
    const done = filtered.filter((s) => s.completed);
    const todayActive = active.filter((s) => isToday(s.created_at));
    const weekActive = active.filter(
      (s) => !isToday(s.created_at) && isThisWeek(s.created_at),
    );
    const olderActive = active.filter((s) => !isThisWeek(s.created_at));
    return { todayActive, weekActive, olderActive, done };
  }, [filtered]);

  /* ── STATS ── */
  const stats = useMemo(() => {
    const done = sessions.filter((s) => s.completed).length;
    const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);
    const avgMins = sessions.length
      ? Math.round(totalMins / sessions.length)
      : 0;
    const weekMins = sessions
      .filter((s) => isThisWeek(s.created_at))
      .reduce((a, s) => a + (s.duration || 0), 0);
    const completionRate = sessions.length
      ? Math.round((done / sessions.length) * 100)
      : 0;
    return { done, totalMins, avgMins, weekMins, completionRate };
  }, [sessions]);

  /* ── featured session = most recent incomplete ── */
  const featuredSession = useMemo(
    () => sessions.find((s) => !s.completed) || null,
    [sessions],
  );

  const isFiltered = search || filterType !== 'all' || filterStatus !== 'all';
  const goCreate = () => navigate('/create-session');

  const SORTS = [
    { v: 'newest', l: 'Newest first' },
    { v: 'oldest', l: 'Oldest first' },
    { v: 'duration', l: 'Longest first' },
    { v: 'alpha', l: 'A → Z' },
  ];

  /* ── CARD RENDERERS ── */
  const renderGrid = (arr, startIndex = 0) => (
    <div className="sessions-grid">
      {arr.map((s, i) => (
        <GridCard
          key={s.id}
          session={s}
          index={startIndex + i}
          toggling={toggling}
          onToggle={handleToggle}
          onNavigate={navigate}
          onDuplicate={handleDuplicate}
          supabase={supabase}
          user={user}
        />
      ))}
    </div>
  );

  const renderList = (arr, startIndex = 0) => (
    <div className="sl">
      {arr.map((s, i) => (
        <ListRow
          key={s.id}
          session={s}
          index={startIndex + i}
          toggling={toggling}
          onToggle={handleToggle}
          onNavigate={navigate}
          onDuplicate={handleDuplicate}
          supabase={supabase}
          user={user}
        />
      ))}
    </div>
  );

  const renderGroup = (arr, label, icon, color, startOffset = 0) => {
    if (!arr.length) return null;
    return (
      <div className="section-group">
        <SectionHeader
          icon={icon}
          label={label}
          count={arr.length}
          color={color}
        />
        {view === 'grid'
          ? renderGrid(arr, startOffset)
          : renderList(arr, startOffset)}
      </div>
    );
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="sp">
        <div className="sp-grain" />
        <div className="sp-bg">
          <div className="sp-orb sp-orb1" />
          <div className="sp-orb sp-orb2" />
        </div>

        <AppNavbar />

        <div className="sp-inner">
          {/* ── CONTROL BAR ── */}
          <div className="ctrl-bar">
            <div className="ctrl-left">
              <div className="ctrl-eyebrow">
                <div className="ctrl-eyebrow-line" />
                <BookOpen size={11} /> Focus Sessions
              </div>
              <h1 className="ctrl-title">
                Your Study <em>Sessions</em>
              </h1>
              <p className="ctrl-sub">
                Plan · Focus · Master — every session brings you closer.
              </p>
            </div>
            <div className="ctrl-right">
              <button className="btn btn-ghost" onClick={goCreate}>
                <Brain size={13} />
                <span>AI Plan</span>
              </button>
              <button className="btn btn-primary" onClick={goCreate}>
                <Plus size={13} />
                <span>New Session</span>
              </button>
            </div>
          </div>

          {/* ── ERROR ── */}
          {error && (
            <div className="error-bar">
              <X size={13} />
              {error}
            </div>
          )}

          {/* ── STAT STRIP ── */}
          {sessions.length > 0 && (
            <div className="stat-strip">
              {[
                {
                  icon: BookOpen,
                  label: 'Total Sessions',
                  value: sessions.length,
                  sub: null,
                  color: 'var(--accent)',
                },
                {
                  icon: Clock,
                  label: 'Focus Time',
                  value: fmtMins(stats.totalMins),
                  sub: `${fmtMins(stats.weekMins)} this week`,
                  color: '#5a7caa',
                },
                {
                  icon: CheckCircle2,
                  label: 'Completed',
                  value: stats.done,
                  sub: `${sessions.length - stats.done} remaining`,
                  color: 'var(--success)',
                },
                {
                  icon: TrendingUp,
                  label: 'Completion',
                  value: `${stats.completionRate}%`,
                  sub: `avg ${fmtMins(stats.avgMins)}`,
                  color: '#9a6a9a',
                },
              ].map(({ icon: Icon, label, value, sub, color }) => (
                <div
                  key={label}
                  className="stat-item"
                  style={{ '--si-color': color }}
                >
                  <div className="stat-accent-line" />
                  <div className="stat-icon">
                    <Icon size={15} strokeWidth={1.6} />
                  </div>
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">{value}</div>
                  {sub && <div className="stat-sub">{sub}</div>}
                </div>
              ))}
            </div>
          )}

          {/* ── PROGRESS BAR ── */}
          {sessions.length > 0 && (
            <div className="prog-bar-wrap">
              <span className="pbw-label">Progress</span>
              <div className="pbw-track">
                <div
                  className="pbw-fill"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
              <div>
                <div className="pbw-num">
                  {stats.done}/{sessions.length}
                </div>
                <div className="pbw-sub">sessions done</div>
              </div>
            </div>
          )}

          {/* ── INSIGHTS RIBBON ── */}
          {sessions.length >= 3 && (
            <div className="insights-ribbon">
              {[
                {
                  icon: Activity,
                  label: 'Avg Session',
                  value: fmtMins(stats.avgMins),
                },
                {
                  icon: Flame,
                  label: 'This Week',
                  value: fmtMins(stats.weekMins),
                },
                {
                  icon: Star,
                  label: 'Completion Rate',
                  value: `${stats.completionRate}%`,
                },
                {
                  icon: Target,
                  label: 'Remaining',
                  value: `${sessions.length - stats.done} sessions`,
                },
                {
                  icon: TrendingUp,
                  label: 'Total Focus',
                  value: fmtMins(stats.totalMins),
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="insight-chip">
                  <div className="ic-icon">
                    <Icon size={14} />
                  </div>
                  <div>
                    <div className="ic-label">{label}</div>
                    <div className="ic-value">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── AI BANNER (no sessions) ── */}
          {!loading && sessions.length === 0 && (
            <div className="ai-banner">
              <div className="ai-banner-left">
                <div className="ai-banner-icon">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="ai-banner-title">AI Session Planner</div>
                  <div className="ai-banner-sub">
                    Let Claude build a personalised study plan for your next
                    goal.
                  </div>
                </div>
              </div>
              <button className="ai-banner-cta" onClick={goCreate}>
                Generate plan <ArrowRight size={12} />
              </button>
            </div>
          )}

          {/* ── FEATURED CARD ── */}
          {!loading &&
            !isFiltered &&
            featuredSession &&
            sessions.length > 0 && (
              <FeaturedCard session={featuredSession} onNavigate={navigate} />
            )}

          {/* ── TOOLBAR ── */}
          <div className="toolbar">
            <div className="search-wrap">
              <Search size={13} className="search-icon" />
              <input
                className="search-input"
                placeholder="Search by title, type, subject…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="sort-wrap" ref={sortRef}>
              <button
                className="sort-btn"
                onClick={() => setShowSort((v) => !v)}
              >
                <SlidersHorizontal size={12} />
                {SORTS.find((o) => o.v === sortBy)?.l}
                <ChevronDown
                  size={11}
                  style={{
                    transition: 'transform .2s',
                    transform: showSort ? 'rotate(180deg)' : 'none',
                  }}
                />
              </button>
              {showSort && (
                <div className="sort-dropdown">
                  {SORTS.map((o) => (
                    <button
                      key={o.v}
                      className={`sort-option${sortBy === o.v ? ' active' : ''}`}
                      onClick={() => {
                        setSortBy(o.v);
                        setShowSort(false);
                      }}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="view-toggle">
              <button
                className={`view-btn${view === 'grid' ? ' active' : ''}`}
                onClick={() => setView('grid')}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                className={`view-btn${view === 'list' ? ' active' : ''}`}
                onClick={() => setView('list')}
                title="List view"
              >
                <AlignLeft size={14} />
              </button>
            </div>
          </div>

          {/* ── FILTER CHIPS ── */}
          <div className="chips-row">
            <span className="chips-label">Status</span>
            {[
              ['all', 'All'],
              ['active', 'Active'],
              ['done', 'Completed'],
            ].map(([v, l]) => (
              <button
                key={v}
                className={`chip${filterStatus === v ? ' active' : ''}`}
                onClick={() => setFilterStatus(v)}
              >
                {l}
              </button>
            ))}
            {focusTypes.length > 1 && (
              <>
                <div className="chips-sep" />
                <span className="chips-label">Type</span>
                <button
                  className={`chip${filterType === 'all' ? ' active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  All
                </button>
                {focusTypes.map((t) => (
                  <button
                    key={t}
                    className={`chip${filterType === t ? ' active' : ''}`}
                    onClick={() => setFilterType(t)}
                  >
                    {t}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* ── RESULTS COUNT ── */}
          {!loading && sessions.length > 0 && (
            <div className="results-label">
              {filtered.length} {filtered.length === 1 ? 'session' : 'sessions'}
              {isFiltered && ' · filtered'}
            </div>
          )}

          {/* ── LOADING SKELETONS ── */}
          {loading && (
            <div className="skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 195, animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          )}

          {/* ── EMPTY STATES ── */}
          {!loading && filtered.length === 0 && (
            <div className="empty">
              <div className="empty-icon-wrap">
                <div className="empty-icon-ring" />
                <div className="empty-icon-ring2" />
                <div className="empty-icon-inner">
                  {isFiltered ? (
                    <Search size={26} strokeWidth={1.2} />
                  ) : (
                    <BookOpen size={26} strokeWidth={1.2} />
                  )}
                </div>
              </div>
              <div className="empty-title">
                {isFiltered ? 'No sessions found' : 'Your study slate is blank'}
              </div>
              <p className="empty-sub">
                {isFiltered
                  ? "Try adjusting your search or filters to find what you're looking for."
                  : 'Create your first session and let AI craft a structured, personalized study plan.'}
              </p>
              {!isFiltered && (
                <>
                  <div className="empty-features">
                    {[
                      'Personalised AI study plan',
                      'Track focus time & streaks',
                      'Mark sessions complete',
                    ].map((f) => (
                      <div key={f} className="empty-feat">
                        <div className="empty-feat-check">
                          <CheckCircle2 size={10} strokeWidth={2.5} />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={goCreate}
                    style={{ marginTop: 8 }}
                  >
                    <Plus size={13} />
                    <span>Create First Session</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── GROUPED SESSION SECTIONS ── */}
          {!loading && filtered.length > 0 && !isFiltered && (
            <>
              {renderGroup(
                grouped.todayActive,
                'Today',
                Flame,
                'var(--accent)',
                0,
              )}
              {renderGroup(
                grouped.weekActive,
                'This Week',
                Calendar,
                'var(--text-secondary)',
                grouped.todayActive.length,
              )}
              {renderGroup(
                grouped.olderActive,
                'Earlier',
                BookOpen,
                'var(--text-muted)',
                grouped.todayActive.length + grouped.weekActive.length,
              )}
              {grouped.done.length > 0 && (
                <div className="section-group">
                  <SectionHeader
                    icon={CheckCircle2}
                    label="Completed"
                    count={grouped.done.length}
                    color="var(--success)"
                  />
                  {view === 'grid'
                    ? renderGrid(
                        grouped.done,
                        grouped.todayActive.length +
                          grouped.weekActive.length +
                          grouped.olderActive.length,
                      )
                    : renderList(
                        grouped.done,
                        grouped.todayActive.length +
                          grouped.weekActive.length +
                          grouped.olderActive.length,
                      )}
                </div>
              )}
            </>
          )}

          {/* ── FLAT LIST (when filtered) ── */}
          {!loading &&
            filtered.length > 0 &&
            isFiltered &&
            (view === 'grid' ? (
              renderGrid(filtered)
            ) : (
              <div className="sl">
                <div className="sl-header">
                  <span />
                  <span>Type</span>
                  <span>Title</span>
                  <span>Duration</span>
                  <span>Date</span>
                  <span />
                </div>
                {filtered.map((s, i) => (
                  <ListRow
                    key={s.id}
                    session={s}
                    index={i}
                    toggling={toggling}
                    onToggle={handleToggle}
                    onNavigate={navigate}
                    onDuplicate={handleDuplicate}
                    supabase={supabase}
                    user={user}
                  />
                ))}
              </div>
            ))}

          {/* ── LIST HEADER for non-filtered list view ── */}
          {!loading &&
            filtered.length > 0 &&
            !isFiltered &&
            view === 'list' && (
              <div style={{ marginTop: -32 }}>
                {/* headers are embedded per group in renderList */}
              </div>
            )}
        </div>
      </div>
    </>
  );
}
