/**
 * Analytics.jsx — Awwwards-level cinematic intelligence dashboard
 * FocusFlow AI — upgraded with deep behavioral analytics
 *
 * Schema (public.sessions):
 *   id, user_id, title, subject, goal, notes, duration (int4),
 *   difficulty, date, is_completed, completed, focus_type,
 *   ai_plan (jsonb), created_at, updated_at
 *
 * All queries only reference real columns confirmed in schema.
 * RLS handles user scoping automatically.
 */

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import AppNavbar from '../components/app/AppNavbar';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  Flame,
  BookOpen,
  Brain,
  Target,
  Sparkles,
  Calendar,
  BarChart2,
  Zap,
  ArrowUp,
  Minus,
  ArrowDown,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Star,
  Trophy,
  Eye,
  TrendingDown,
  Repeat,
  Battery,
  Shield,
  Wind,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   CSS — FULL DUAL-THEME SYSTEM
══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=IBM+Plex+Mono:wght@300;400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');

/* ─── LIGHT TOKENS ─── */
:root {
  color-scheme: light;
  --cream:#f5f0e8; --parchment:#ede7d9; --parchment2:#e4dccb; --card:#faf7f2;
  --ink:#1e1a14; --ink-muted:#5c5445; --ink-faint:#9c9283; --sepia:#7a6a54;
  --amber:#c4913a; --amber-glow:rgba(196,145,58,.15); --amber-deep:#a87830;
  --amber-light:#e8b96a; --amber-pale:rgba(196,145,58,.07);
  --terra:#b85c4a; --terra-pale:rgba(184,92,74,.1);
  --sage:#6b8c6b; --sage-pale:rgba(107,140,107,.1);
  --slate:#4a6580; --slate-pale:rgba(74,101,128,.1);
  --violet:#7c5cbf; --violet-pale:rgba(124,92,191,.1);
  --border:#ddd5c4; --border-h:#c8bc9e;
  --shadow-sm:0 2px 12px rgba(30,26,20,.07);
  --shadow-md:0 8px 32px rgba(30,26,20,.1);
  --shadow-lg:0 20px 60px rgba(30,26,20,.14);
  --f-serif:'Playfair Display',Georgia,serif;
  --f-mono:'IBM Plex Mono',monospace;
  --f-body:'Lora',Georgia,serif;
  --ease:cubic-bezier(.16,1,.3,1);
  --spring:cubic-bezier(.34,1.56,.64,1);
}

/* ─── DARK TOKENS ─── */
.dark {
  color-scheme: dark;
  --cream:#12100a; --parchment:#18160f; --parchment2:#201e16; --card:#18160f;
  --ink:#f0ead8; --ink-muted:#b8aa94; --ink-faint:#7a6e5e; --sepia:#a0906c;
  --border:#2e2a20; --border-h:#3e3828;
  --shadow-sm:0 2px 12px rgba(0,0,0,.3);
  --shadow-md:0 8px 32px rgba(0,0,0,.4);
  --shadow-lg:0 20px 60px rgba(0,0,0,.55);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ─── GRAIN ─── */
.an-grain { pointer-events:none; position:fixed; inset:0; width:100%; height:100%;
  opacity:.03; z-index:0; mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); }
.dark .an-grain { opacity:.055; mix-blend-mode:screen; }

/* ─── PAGE ─── */
.an-page { min-height:100vh; background:var(--cream); color:var(--ink);
  font-family:var(--f-body); position:relative; overflow-x:hidden;
  transition: background .4s ease, color .3s ease; }

/* ─── HERO ─── */
.an-hero { position:relative; padding:80px 52px 72px; max-width:1320px; margin:0 auto; z-index:1; }
@media(max-width:768px) { .an-hero { padding:48px 22px 44px; } }
.an-hero-bg { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.an-hero-orb1 { position:absolute; top:-120px; right:-80px; width:600px; height:600px;
  border-radius:50%; background:radial-gradient(circle,var(--amber-pale) 0%,transparent 65%); }
.an-hero-orb2 { position:absolute; bottom:-40px; left:-60px; width:400px; height:400px;
  border-radius:50%; background:radial-gradient(circle,var(--slate-pale) 0%,transparent 65%); }
.an-overline { display:inline-flex; align-items:center; gap:10px; font-family:var(--f-mono);
  font-size:.62rem; letter-spacing:.2em; text-transform:uppercase; color:var(--amber);
  margin-bottom:22px; opacity:0; animation:an-fadeup .7s var(--ease) .1s forwards; }
.an-overline-dot { width:6px; height:6px; border-radius:50%; background:var(--amber);
  animation:an-pulse 2.5s ease-in-out infinite; }
.an-h1 { font-family:var(--f-serif); font-size:clamp(2.6rem,5.5vw,5rem); font-weight:900;
  line-height:.93; letter-spacing:-.04em; color:var(--ink);
  opacity:0; animation:an-fadeup .8s var(--ease) .2s forwards; }
.an-h1 em { font-style:italic; color:var(--amber); }
.an-hero-sub { font-family:var(--f-mono); font-size:.7rem; color:var(--ink-faint);
  letter-spacing:.06em; margin-top:20px; line-height:1.9; max-width:460px;
  opacity:0; animation:an-fadeup .7s var(--ease) .35s forwards; }
.an-hero-stats { display:flex; gap:44px; margin-top:44px; flex-wrap:wrap;
  opacity:0; animation:an-fadeup .7s var(--ease) .5s forwards; }
.an-hero-stat-val { font-family:var(--f-serif); font-size:2.6rem; font-weight:700;
  color:var(--ink); letter-spacing:-.04em; line-height:1; }
.an-hero-stat-label { font-family:var(--f-mono); font-size:.57rem; text-transform:uppercase;
  letter-spacing:.14em; color:var(--ink-faint); margin-top:5px; }
.an-hero-stat-delta { font-family:var(--f-mono); font-size:.58rem; margin-top:3px;
  display:flex; align-items:center; gap:3px; }
.delta-up{color:var(--sage)} .delta-down{color:var(--terra)} .delta-flat{color:var(--ink-faint)}
/* theme toggle in hero */
.an-theme-btn { position:absolute; top:28px; right:52px; width:34px; height:34px;
  border-radius:8px; background:var(--parchment); border:1px solid var(--border);
  color:var(--ink-faint); cursor:pointer; display:grid; place-items:center;
  transition:all .2s; z-index:10; }
.an-theme-btn:hover { border-color:var(--amber); color:var(--amber); transform:rotate(12deg); }
@media(max-width:768px) { .an-theme-btn { right:22px; top:20px; } }

/* ─── SECTION RULE ─── */
.an-section-rule { display:flex; align-items:center; gap:14px; padding:0 52px;
  max-width:1320px; margin:0 auto 32px; }
@media(max-width:768px) { .an-section-rule { padding:0 22px; } }
.an-section-rule-line { flex:1; height:1px; background:var(--border); }
.an-section-rule-glyph { font-family:var(--f-serif); font-size:.9rem; color:var(--amber); opacity:.55; }
.an-section-rule-label { font-family:var(--f-mono); font-size:.6rem; letter-spacing:.2em;
  text-transform:uppercase; color:var(--ink-faint); }

/* ─── BENTO ─── */
.an-bento { display:grid; grid-template-columns:repeat(12,1fr); gap:18px;
  padding:0 52px 48px; max-width:1320px; margin:0 auto; position:relative; z-index:1; }
@media(max-width:1100px) { .an-bento { grid-template-columns:repeat(6,1fr); padding:0 28px 40px; } }
@media(max-width:640px)  { .an-bento { grid-template-columns:1fr; padding:0 18px 36px; } }
.bn { background:var(--card); border:1px solid var(--border); border-radius:16px;
  overflow:hidden; transition:transform .3s var(--spring), box-shadow .3s, border-color .25s;
  will-change:transform; }
.bn:hover { border-color:var(--border-h); box-shadow:var(--shadow-md); transform:translateY(-4px) scale(1.004); }
.bn.no-hover:hover { transform:none; box-shadow:none; }
/* span classes */
.col-4{grid-column:span 4} .col-3{grid-column:span 3} .col-6{grid-column:span 6}
.col-8{grid-column:span 8} .col-5{grid-column:span 5} .col-7{grid-column:span 7}
.col-9{grid-column:span 9} .col-12{grid-column:span 12}
@media(max-width:1100px) {
  .col-4,.col-3,.col-5 { grid-column:span 3; }
  .col-6,.col-8,.col-7,.col-9 { grid-column:span 6; }
  .col-12 { grid-column:span 6; }
}
@media(max-width:640px) { .col-3,.col-4,.col-5,.col-6,.col-7,.col-8,.col-9,.col-12 { grid-column:span 1; } }
.bn-pad { padding:24px; } .bn-pad-lg { padding:30px 28px; }
.bn-dark { background:var(--ink)!important; border-color:var(--ink)!important; }
.bn-dark .bn-title{color:var(--cream)} .bn-dark .bn-num{color:var(--cream)}
.bn-dark .bn-sub{color:rgba(240,234,216,.38)} .bn-dark .bn-eyebrow{color:rgba(240,234,216,.38)}
.bn-dark:hover { border-color:var(--amber)!important; }
.bn-amber { background:var(--amber)!important; border-color:transparent!important; }
.bn-amber .bn-title{color:#fff} .bn-amber .bn-num{color:#fff}
.bn-amber .bn-sub{color:rgba(255,255,255,.58)} .bn-amber .bn-eyebrow{color:rgba(255,255,255,.58)}
.bn-eyebrow { font-family:var(--f-mono); font-size:.56rem; text-transform:uppercase;
  letter-spacing:.15em; color:var(--ink-faint); display:flex; align-items:center;
  gap:6px; margin-bottom:10px; }
.bn-eyebrow-dot { width:5px; height:5px; border-radius:50%; background:var(--accent-color,var(--amber)); flex-shrink:0; }
.bn-title { font-family:var(--f-serif); font-size:1.02rem; font-weight:600; color:var(--ink);
  line-height:1.25; margin-bottom:5px; }
.bn-num { font-family:var(--f-serif); font-size:2.8rem; font-weight:900;
  letter-spacing:-.045em; color:var(--ink); line-height:1; }
.bn-sub { font-family:var(--f-mono); font-size:.58rem; color:var(--ink-faint); letter-spacing:.06em; margin-top:6px; }
/* tooltip */
.an-tooltip { background:var(--ink); border:none; border-radius:8px; padding:10px 15px;
  font-family:var(--f-mono); font-size:.63rem; color:var(--cream);
  box-shadow:var(--shadow-md); line-height:1.75; }
.an-tooltip-val { color:var(--amber-light); font-weight:500; }
/* chart axis defaults */
.recharts-text { fill:var(--ink-faint); }

/* ─── HEATMAP ─── */
.hm-outer { overflow-x:auto; padding-bottom:6px; }
.hm-grid { display:flex; gap:4px; min-width:fit-content; margin-top:16px; }
.hm-week { display:flex; flex-direction:column; gap:4px; }
.hm-cell { width:14px; height:14px; border-radius:3px; cursor:pointer; transition:transform .15s var(--spring); }
.hm-cell:hover { transform:scale(1.55); z-index:5; position:relative; }
.hm-cell[data-l="0"] { background:var(--parchment); border:1px solid var(--border); }
.hm-cell[data-l="1"] { background:rgba(196,145,58,.22); }
.hm-cell[data-l="2"] { background:rgba(196,145,58,.48); }
.hm-cell[data-l="3"] { background:rgba(196,145,58,.75); }
.hm-cell[data-l="4"] { background:var(--amber); box-shadow:0 0 6px rgba(196,145,58,.45); }
.hm-legend { display:flex; align-items:center; gap:5px; margin-top:12px; justify-content:flex-end; }
.hm-legend-label { font-family:var(--f-mono); font-size:.55rem; color:var(--ink-faint); }

/* ─── RADIAL SCORE ─── */
.radial-center { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; pointer-events:none; }
.radial-score { font-family:var(--f-serif); font-size:2.2rem; font-weight:900; color:var(--ink); letter-spacing:-.04em; line-height:1; }
.radial-label { font-family:var(--f-mono); font-size:.52rem; text-transform:uppercase; letter-spacing:.14em; color:var(--ink-faint); margin-top:4px; }

/* ─── FOCUS TYPE BARS ─── */
.ft-row { display:flex; flex-direction:column; gap:13px; margin-top:16px; }
.ft-item { display:flex; flex-direction:column; gap:6px; }
.ft-item-top { display:flex; justify-content:space-between; align-items:center; }
.ft-name { font-family:var(--f-body); font-size:.8rem; color:var(--ink-muted); font-weight:500; }
.ft-pct { font-family:var(--f-mono); font-size:.62rem; color:var(--amber); letter-spacing:.04em; }
.ft-track { height:5px; background:var(--parchment); border-radius:3px; overflow:hidden; border:1px solid var(--border); }
.ft-fill { height:100%; border-radius:3px; transition:width 1.3s var(--ease); }

/* ─── INSIGHT CARDS ─── */
.insight-row { display:flex; flex-direction:column; gap:10px; margin-top:14px; }
.insight-item { display:flex; align-items:flex-start; gap:12px; padding:12px 14px;
  background:var(--parchment); border:1px solid var(--border); border-radius:9px;
  transition:border-color .2s, transform .2s var(--spring); cursor:default; }
.insight-item:hover { border-color:var(--amber); transform:translateX(4px); }
.insight-icon { width:32px; height:32px; border-radius:8px; display:grid; place-items:center;
  flex-shrink:0; color:var(--amber); background:var(--amber-glow); border:1px solid rgba(196,145,58,.2); }
.insight-text { flex:1; }
.insight-label { font-family:var(--f-mono); font-size:.55rem; text-transform:uppercase;
  letter-spacing:.13em; color:var(--ink-faint); margin-bottom:3px; }
.insight-body { font-family:var(--f-body); font-size:.78rem; color:var(--ink-muted); line-height:1.6; }
.insight-body strong { color:var(--ink); font-weight:500; }

/* ─── BEHAVIORAL INTELLIGENCE PANEL ─── */
.beh-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
@media(max-width:500px) { .beh-grid { grid-template-columns:1fr; } }
.beh-card { padding:14px 16px; background:var(--parchment); border:1px solid var(--border);
  border-radius:10px; transition:border-color .2s, transform .2s var(--spring); }
.beh-card:hover { border-color:var(--border-h); transform:translateY(-2px); box-shadow:var(--shadow-sm); }
.beh-card-label { font-family:var(--f-mono); font-size:.52rem; text-transform:uppercase;
  letter-spacing:.13em; color:var(--ink-faint); margin-bottom:6px; display:flex; align-items:center; gap:6px; }
.beh-card-val { font-family:var(--f-serif); font-size:1.5rem; font-weight:700;
  color:var(--ink); letter-spacing:-.03em; line-height:1.1; }
.beh-card-val.positive { color:var(--sage); }
.beh-card-val.warning { color:var(--amber); }
.beh-card-val.danger { color:var(--terra); }
.beh-card-sub { font-family:var(--f-mono); font-size:.55rem; color:var(--ink-faint); margin-top:4px; line-height:1.5; }

/* ─── METRIC SCORE BARS ─── */
.score-bar-list { display:flex; flex-direction:column; gap:14px; margin-top:16px; }
.score-bar-item { }
.score-bar-top { display:flex; justify-content:space-between; margin-bottom:6px; }
.score-bar-name { font-family:var(--f-mono); font-size:.6rem; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-muted); }
.score-bar-num { font-family:var(--f-serif); font-size:.9rem; font-weight:700; color:var(--ink); letter-spacing:-.02em; }
.score-bar-track { height:6px; background:var(--parchment); border-radius:3px; overflow:hidden; border:1px solid var(--border); }
.score-bar-fill { height:100%; border-radius:3px; transition:width 1.3s var(--ease); position:relative; }
.score-bar-fill::after { content:''; position:absolute; top:0; right:0; bottom:0; width:4px;
  background:rgba(255,255,255,.4); border-radius:3px; filter:blur(1px); }

/* ─── TIME-OF-DAY CHART ─── */
.tod-bars { display:flex; align-items:flex-end; gap:8px; height:80px; margin-top:16px; }
.tod-col { display:flex; flex-direction:column; align-items:center; gap:5px; flex:1; }
.tod-bar-wrap { flex:1; display:flex; align-items:flex-end; width:100%; }
.tod-bar { width:100%; border-radius:4px 4px 0 0; min-height:3px; transition:height .9s var(--ease); }
.tod-label { font-family:var(--f-mono); font-size:.48rem; letter-spacing:.07em;
  text-transform:uppercase; color:var(--ink-faint); white-space:nowrap; }
.tod-mins { font-family:var(--f-mono); font-size:.46rem; color:var(--ink-faint); }
.tod-peak { color:var(--amber); font-weight:500; }

/* ─── NARRATIVE / STORY SECTION ─── */
.narrative-section { padding:0 52px 48px; max-width:1320px; margin:0 auto; position:relative; z-index:1; }
@media(max-width:768px) { .narrative-section { padding:0 22px 40px; } }
.narrative-card { background:var(--ink); border-radius:18px; padding:40px 48px;
  position:relative; overflow:hidden; }
.dark .narrative-card { background:linear-gradient(135deg,#1c1912,#26221a); border:1px solid var(--border-h); }
.narrative-bg-glyph { position:absolute; right:32px; bottom:-20px; font-family:var(--f-serif);
  font-size:14rem; color:var(--amber); opacity:.04; line-height:1; pointer-events:none;
  letter-spacing:-.1em; }
.narrative-overline { font-family:var(--f-mono); font-size:.6rem; letter-spacing:.2em;
  text-transform:uppercase; color:var(--amber); margin-bottom:16px; display:flex; align-items:center; gap:8px; }
.narrative-overline::before { content:''; display:block; width:20px; height:1px; background:var(--amber); opacity:.6; }
.narrative-text { font-family:var(--f-serif); font-size:clamp(1.05rem,2vw,1.35rem); font-style:italic;
  color:var(--cream); line-height:1.75; max-width:780px; margin-bottom:28px; }
.dark .narrative-text { color:var(--ink); }
.narrative-text em { color:var(--amber); font-style:normal; }
.narrative-chips { display:flex; gap:10px; flex-wrap:wrap; }
.narrative-chip { display:inline-flex; align-items:center; gap:6px; padding:6px 14px;
  border-radius:20px; border:1px solid rgba(240,234,216,.15);
  font-family:var(--f-mono); font-size:.58rem; letter-spacing:.08em; text-transform:uppercase;
  color:rgba(240,234,216,.5); background:rgba(240,234,216,.05); }
.dark .narrative-chip { border-color:var(--border); color:var(--ink-faint); background:var(--parchment); }
.narrative-chip-dot { width:5px; height:5px; border-radius:50%; background:var(--amber); }

/* ─── PREDICTION SECTION ─── */
.pred-list { display:flex; flex-direction:column; gap:10px; margin-top:16px; }
.pred-item { display:flex; align-items:flex-start; gap:12px; padding:13px 15px;
  background:var(--parchment); border:1px solid var(--border); border-radius:9px;
  transition:border-color .2s, box-shadow .2s; }
.pred-item:hover { border-color:var(--amber); box-shadow:var(--shadow-sm); }
.pred-badge { width:28px; height:28px; border-radius:7px; display:grid; place-items:center;
  flex-shrink:0; font-size:.85rem; line-height:1; }
.pred-text { flex:1; font-family:var(--f-body); font-size:.78rem; color:var(--ink-muted); line-height:1.6; }
.pred-text strong { color:var(--ink); font-weight:500; }
.pred-confidence { font-family:var(--f-mono); font-size:.52rem; color:var(--ink-faint);
  letter-spacing:.06em; margin-top:3px; display:flex; align-items:center; gap:4px; }
.pred-conf-bar { flex:1; height:3px; background:var(--border); border-radius:2px; overflow:hidden; }
.pred-conf-fill { height:100%; background:var(--amber); border-radius:2px; transition:width 1s var(--ease); }

/* ─── OPTIMIZATION PANEL ─── */
.opt-list { display:flex; flex-direction:column; gap:8px; margin-top:16px; }
.opt-item { display:flex; align-items:center; gap:12px; padding:11px 14px;
  background:var(--parchment); border:1px solid var(--border); border-radius:8px;
  transition:all .2s var(--spring); cursor:default; }
.opt-item:hover { transform:translateX(5px); border-color:var(--sage); }
.opt-dot { width:8px; height:8px; border-radius:50%; background:var(--sage); flex-shrink:0; }
.opt-text { font-family:var(--f-body); font-size:.78rem; color:var(--ink-muted); line-height:1.5; }
.opt-text strong { color:var(--ink); font-weight:500; }

/* ─── FOCUS DROP ALERT ─── */
.drop-alert { display:flex; align-items:flex-start; gap:13px; padding:14px 16px;
  background:color-mix(in srgb, var(--terra) 8%, var(--parchment));
  border:1px solid rgba(184,92,74,.3); border-radius:10px; margin-top:14px; }
.drop-alert-icon { width:32px; height:32px; border-radius:8px; display:grid; place-items:center;
  flex-shrink:0; color:var(--terra); background:var(--terra-pale); border:1px solid rgba(184,92,74,.2); }
.drop-alert-text { font-family:var(--f-body); font-size:.8rem; color:var(--ink-muted); line-height:1.6; }
.drop-alert-text strong { color:var(--terra); font-weight:500; }

/* ─── SKELETON ─── */
.sk { background:linear-gradient(90deg,var(--parchment) 25%,var(--parchment2) 50%,var(--parchment) 75%);
  background-size:200% 100%; animation:an-shimmer 1.6s ease-in-out infinite; border-radius:5px; }

/* ─── EMPTY ─── */
.an-empty { display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:14px; padding:44px 24px; text-align:center; }
.an-empty-glyph { font-family:var(--f-serif); font-size:3rem; color:var(--amber); opacity:.22; line-height:1; }
.an-empty-title { font-family:var(--f-serif); font-size:.95rem; font-weight:600; color:var(--ink); }
.an-empty-sub { font-family:var(--f-mono); font-size:.6rem; color:var(--ink-faint); letter-spacing:.06em; max-width:200px; line-height:1.65; }

/* ─── QUOTE ─── */
.an-quote { padding:44px 52px; max-width:1320px; margin:0 auto 16px; opacity:0; animation:an-fadeup .8s var(--ease) .2s forwards; }
@media(max-width:768px) { .an-quote { padding:30px 22px; } }
.an-quote-inner { border-left:3px solid var(--amber); padding-left:26px; }
.an-quote-text { font-family:var(--f-serif); font-size:clamp(.95rem,2vw,1.3rem); font-style:italic; color:var(--ink-muted); line-height:1.65; }
.an-quote-attr { font-family:var(--f-mono); font-size:.57rem; text-transform:uppercase; letter-spacing:.15em; color:var(--ink-faint); margin-top:10px; }

/* ─── ANIMATIONS ─── */
@keyframes an-fadeup { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
@keyframes an-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes an-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(.8)} }

/* ─── SCROLLBAR ─── */
::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border-h);border-radius:3px}
`;

/* ══════════════════════════════════════════════════════════════
   PURE UTILS
══════════════════════════════════════════════════════════════ */
function fmtMins(m) {
  if (!m) return '0m';
  const h = Math.floor(m / 60),
      mm = m % 60;
  return h ? `${h}h ${mm > 0 ? mm + 'm' : ''}` : `${mm}m`;
}
function capFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function useInView(ref, threshold = 0.12) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        },
        { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return visible;
}

function useCountUp(target, duration = 1200, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    let raf;
    const timeout = setTimeout(() => {
      const step = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return val;
}

/* ══════════════════════════════════════════════════════════════
   DATA BUILDERS
══════════════════════════════════════════════════════════════ */
function buildWeeklyArea(sessions) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      map = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map[key] = { day: days[d.getDay()], mins: 0, sessions: 0, date: key };
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

function buildMonthlyTrend(sessions) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      mins: 0,
      sessions: 0,
      completed: 0,
    });
  }
  sessions.forEach((s) => {
    const k = new Date(s.created_at).toISOString().slice(0, 7);
    const m = months.find((m) => m.key === k);
    if (m) {
      m.mins += s.duration || 0;
      m.sessions += 1;
      if (s.completed || s.is_completed) m.completed += 1;
    }
  });
  return months;
}

function buildFocusTypeDist(sessions) {
  const map = {};
  sessions.forEach((s) => {
    const ft = s.focus_type || 'General';
    map[ft] = (map[ft] || 0) + (s.duration || 0);
  });
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(map)
      .map(([name, mins]) => ({
        name,
        mins,
        pct: Math.round((mins / total) * 100),
      }))
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 6);
}

function buildHeatmap(sessions) {
  const dayMap = {};
  sessions.forEach((s) => {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    dayMap[key] = (dayMap[key] || 0) + (s.duration || 0);
  });
  const weeks = [],
      today = new Date(),
      start = new Date(today);
  start.setDate(today.getDate() - 91);
  for (let w = 0; w < 14; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      const mins = dayMap[key] || 0;
      week.push({
        date: key,
        mins,
        l: mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 90 ? 3 : 4,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

function buildTimeOfDay(sessions) {
  // Bucket sessions into 6 time blocks
  const buckets = [
    { label: 'Dawn', range: '5–9', key: 'dawn', mins: 0, count: 0 },
    { label: 'Morn', range: '9–12', key: 'morn', mins: 0, count: 0 },
    { label: 'Noon', range: '12–15', key: 'noon', mins: 0, count: 0 },
    { label: 'Aft', range: '15–18', key: 'aft', mins: 0, count: 0 },
    { label: 'Eve', range: '18–21', key: 'eve', mins: 0, count: 0 },
    { label: 'Night', range: '21–2', key: 'night', mins: 0, count: 0 },
  ];
  sessions.forEach((s) => {
    const h = new Date(s.created_at).getHours();
    let i =
        h >= 5 && h < 9
            ? 0
            : h >= 9 && h < 12
                ? 1
                : h >= 12 && h < 15
                    ? 2
                    : h >= 15 && h < 18
                        ? 3
                        : h >= 18 && h < 21
                            ? 4
                            : 5;
    buckets[i].mins += s.duration || 0;
    buckets[i].count += 1;
  });
  return buckets;
}

function buildDayOfWeekData(sessions) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const map = {};
  labels.forEach((l) => {
    map[l] = { day: l, mins: 0, count: 0 };
  });
  sessions.forEach((s) => {
    const d = labels[new Date(s.created_at).getDay()];
    map[d].mins += s.duration || 0;
    map[d].count += 1;
  });
  return Object.values(map);
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

function bestDay(sessions) {
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

function calcPerformanceScore(sessions, completedCount) {
  if (!sessions.length) return 0;
  const rate = completedCount / sessions.length;
  const avgMins =
      sessions.reduce((a, s) => a + (s.duration || 0), 0) / sessions.length;
  const consistency = Math.min(1, sessions.length / 20);
  return Math.min(
      100,
      Math.round(
          rate * 38 + (Math.min(avgMins, 90) / 90) * 32 + consistency * 30,
      ),
  );
}

// ─── ADVANCED METRIC SCORES ───
function calcConsistencyScore(sessions) {
  if (sessions.length < 3) return 0;
  const days = new Set(
      sessions.map((s) => new Date(s.created_at).toISOString().slice(0, 10)),
  );
  // Count unique study days over last 30 days
  let count = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) count++;
  }
  return Math.min(100, Math.round((count / 30) * 100));
}

function calcDisciplineScore(sessions, completedCount) {
  if (!sessions.length) return 0;
  const compRate = completedCount / sessions.length;
  // Hard sessions bonus
  const hardRatio =
      sessions.filter((s) => s.difficulty === 'hard').length / sessions.length;
  // Long sessions bonus
  const longRatio =
      sessions.filter((s) => (s.duration || 0) >= 60).length / sessions.length;
  return Math.min(
      100,
      Math.round(compRate * 50 + hardRatio * 25 + longRatio * 25),
  );
}

function calcBurnoutRisk(sessions) {
  if (sessions.length < 7) return { score: 0, label: 'Low', color: 'positive' };
  const last7 = sessions.filter((s) => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return new Date(s.created_at) >= d;
  });
  const prev7 = sessions.filter((s) => {
    const d1 = new Date(),
        d2 = new Date();
    d1.setDate(d1.getDate() - 14);
    d2.setDate(d2.getDate() - 7);
    const t = new Date(s.created_at);
    return t >= d1 && t < d2;
  });
  const last7Mins = last7.reduce((a, s) => a + (s.duration || 0), 0);
  const prev7Mins = prev7.reduce((a, s) => a + (s.duration || 0), 0);
  // High volume last week vs low completion = burnout risk
  const ratio = prev7Mins > 0 ? last7Mins / prev7Mins : 1;
  if (ratio > 1.4 && last7.length > 5)
    return { score: 72, label: 'Moderate', color: 'warning' };
  if (ratio > 1.8 && last7.length > 7)
    return { score: 88, label: 'High', color: 'danger' };
  return { score: Math.round(ratio * 20), label: 'Low', color: 'positive' };
}

function calcDeepWorkRatio(sessions) {
  if (!sessions.length) return 0;
  const deep = sessions.filter((s) => {
    const ft = (s.focus_type || '').toLowerCase();
    return (
        ft.includes('deep') ||
        ft.includes('research') ||
        ft.includes('writing') ||
        (s.duration || 0) >= 60
    );
  });
  return Math.round((deep.length / sessions.length) * 100);
}

function detectFocusDrop(sessions) {
  if (sessions.length < 8) return null;
  const recent = sessions.slice(0, 4);
  const older = sessions.slice(4, 8);
  const recentAvg = recent.reduce((a, s) => a + (s.duration || 0), 0) / 4;
  const olderAvg = older.reduce((a, s) => a + (s.duration || 0), 0) / 4;
  if (olderAvg > 0 && recentAvg < olderAvg * 0.82) {
    return {
      pct: Math.round(((olderAvg - recentAvg) / olderAvg) * 100),
      recentAvg,
      olderAvg,
    };
  }
  return null;
}

function detectPatternType(sessions) {
  if (sessions.length < 5) return 'emerging';
  const days = sessions.map((s) =>
      new Date(s.created_at).toISOString().slice(0, 10),
  );
  const gaps = [];
  for (let i = 1; i < Math.min(days.length, 12); i++) {
    const diff = (new Date(days[i - 1]) - new Date(days[i])) / 86400000;
    gaps.push(diff);
  }
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance =
      gaps.reduce((a, b) => a + Math.pow(b - avgGap, 2), 0) / gaps.length;
  if (avgGap <= 1.5 && variance < 2) return 'consistent';
  if (avgGap >= 2 && avgGap <= 4 && variance < 4) return 'bursty';
  return 'irregular';
}

function buildHabitLoop(sessions) {
  if (sessions.length < 5) return null;
  const byHour = {};
  sessions.forEach((s) => {
    const h = new Date(s.created_at).getHours();
    const bucket =
        h < 6
            ? 'late night'
            : h < 12
                ? 'morning'
                : h < 17
                    ? 'afternoon'
                    : h < 21
                        ? 'evening'
                        : 'night';
    if (!byHour[bucket]) byHour[bucket] = { count: 0, totalMins: 0 };
    byHour[bucket].count += 1;
    byHour[bucket].totalMins += s.duration || 0;
  });
  const dominant = Object.entries(byHour).sort(
      (a, b) => b[1].count - a[1].count,
  )[0];
  if (!dominant) return null;
  const [time, data] = dominant;
  const avgMins = Math.round(data.totalMins / data.count);
  return {
    time,
    avgMins,
    pct: Math.round((data.count / sessions.length) * 100),
  };
}

// ─── NARRATIVE GENERATOR ───
function generateNarrative(sessions, stats) {
  if (!sessions.length) return null;
  const pattern = detectPatternType(sessions);
  const habitLoop = buildHabitLoop(sessions);
  const topDay = bestDay(sessions);
  const tod = stats.timeOfDay;
  const peakBlock = tod ? [...tod].sort((a, b) => b.mins - a.mins)[0] : null;

  let text = 'You are ';
  if (pattern === 'consistent') text += 'a <em>highly consistent</em> learner';
  else if (pattern === 'bursty') text += 'an <em>intense burst learner</em>';
  else text += 'an <em>adaptive</em> self-directed learner';

  if (habitLoop)
    text += ` who prefers to study in the <em>${habitLoop.time}</em>`;
  if (habitLoop && habitLoop.avgMins)
    text += ` for around <em>${habitLoop.avgMins}-minute</em> sessions`;
  text += '.';

  if (topDay) text += ` Your focus peaks on <em>${topDay}s</em>.`;
  if (peakBlock && peakBlock.mins > 0)
    text += ` Your most productive time window is <em>${peakBlock.range}h</em>.`;
  if (stats.deepWorkRatio > 50)
    text += ' You have a strong <em>deep work</em> tendency.';

  return text;
}

// ─── PREDICTIONS ───
function generatePredictions(sessions, stats) {
  const preds = [];
  if (!sessions.length) return preds;

  // XP / level prediction
  const xpPerSession = 50;
  const curXP = sessions.length * xpPerSession;
  const nextLevel = Math.floor(Math.sqrt(curXP / 100)) + 2;
  const xpNeeded = Math.pow(nextLevel - 1, 2) * 100 - curXP;
  const sessionsNeeded = Math.ceil(xpNeeded / xpPerSession);
  if (sessionsNeeded > 0 && sessionsNeeded <= 20) {
    preds.push({
      emoji: '⚡',
      text: `At your current pace, you'll reach <strong>Level ${nextLevel}</strong> in about <strong>${sessionsNeeded} more session${sessionsNeeded > 1 ? 's' : ''}</strong>.`,
      confidence: 82,
    });
  }

  // Streak risk
  if (stats.streak > 0) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const studiedToday = sessions.some(
        (s) => new Date(s.created_at).toISOString().slice(0, 10) === todayKey,
    );
    if (!studiedToday) {
      preds.push({
        emoji: '🔥',
        text: `You haven't studied today yet. Your <strong>${stats.streak}-day streak</strong> is at risk — one session will keep it alive.`,
        confidence: 94,
      });
    }
  }

  // Weekly momentum
  const last7 = sessions.filter((s) => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return new Date(s.created_at) >= d;
  });
  const prev7 = sessions.filter((s) => {
    const d1 = new Date(),
        d2 = new Date();
    d1.setDate(d1.getDate() - 14);
    d2.setDate(d2.getDate() - 7);
    const t = new Date(s.created_at);
    return t >= d1 && t < d2;
  });
  if (last7.length > prev7.length) {
    preds.push({
      emoji: '📈',
      text: `Your session frequency increased by <strong>${last7.length - prev7.length}</strong> this week. You're building positive momentum.`,
      confidence: 78,
    });
  } else if (last7.length < prev7.length && prev7.length > 0) {
    preds.push({
      emoji: '📉',
      text: `Session count dropped by <strong>${prev7.length - last7.length}</strong> compared to last week. A few short sessions this week can reverse the trend.`,
      confidence: 75,
    });
  }

  // Focus depth prediction
  if (stats.deepWorkRatio > 40) {
    preds.push({
      emoji: '🧠',
      text: `Your high <strong>deep work ratio (${stats.deepWorkRatio}%)</strong> suggests you're ready for longer, uninterrupted study blocks of 90+ minutes.`,
      confidence: 68,
    });
  }

  return preds.slice(0, 4);
}

// ─── OPTIMIZATION SUGGESTIONS ───
function generateOptimizations(sessions, stats) {
  const opts = [];
  if (!sessions.length) return opts;

  const focusDrop = detectFocusDrop(sessions);
  const habitLoop = buildHabitLoop(sessions);

  if (stats.avgMins < 25)
    opts.push({
      text: 'Try <strong>25-minute Pomodoro sprints</strong> — they match your natural attention span.',
    });
  else if (stats.avgMins > 90)
    opts.push({
      text: 'Your sessions run long. Consider <strong>splitting into 60-min blocks</strong> with a 10-min break in between.',
    });

  if (stats.completionPct < 60)
    opts.push({
      text: 'Set <strong>one concrete goal per session</strong> before starting — it doubles completion rates.',
    });

  if (habitLoop && habitLoop.time === 'night')
    opts.push({
      text: 'You study most often at night. Try moving <strong>one session to morning</strong> — cognitive freshness peaks within 2 hours of waking.',
    });

  if (stats.deepWorkRatio < 30)
    opts.push({
      text: 'Add a <strong>Deep Work</strong> session 3x/week — even 45 minutes of distraction-free focus drives outsized results.',
    });

  if (stats.consistencyScore < 40)
    opts.push({
      text: 'Aim for <strong>5 sessions per week</strong> rather than cramming — spaced repetition retains 80% more.',
    });

  const weekendSessions = sessions.filter((s) => {
    const d = new Date(s.created_at).getDay();
    return d === 0 || d === 6;
  });
  if (weekendSessions.length === 0 && sessions.length > 5)
    opts.push({
      text: "You don't study on weekends. Even a <strong>20-min review Saturday</strong> improves weekly retention significantly.",
    });

  if (focusDrop)
    opts.push({
      text: `Your sessions shortened by <strong>${focusDrop.pct}%</strong> recently. Try a fixed schedule — same time, same place — to rebuild momentum.`,
    });

  return opts.slice(0, 5);
}

const FT_COLORS = [
  '#c4913a',
  '#b85c4a',
  '#6b8c6b',
  '#7a6a54',
  '#4a6580',
  '#9b6bae',
];
const DONUT_COLORS = [
  '#c4913a',
  '#b85c4a',
  '#6b8c6b',
  '#7a6a54',
  '#9c9283',
  '#4a6580',
];
const TOD_COLORS = {
  dawn: '#e8b96a',
  morn: '#c4913a',
  noon: '#a87830',
  aft: '#6b8c6b',
  eve: '#5b7fa8',
  night: '#7c5cbf',
};

/* ══════════════════════════════════════════════════════════════
   BentoCell — intersection-observed
══════════════════════════════════════════════════════════════ */
const BentoCell = memo(
    ({ span, className = '', dark, amber, noHover, delay = 0, children }) => {
      const ref = useRef(null);
      const visible = useInView(ref);
      return (
          <div
              ref={ref}
              className={[
                'bn',
                `col-${span}`,
                dark ? 'bn-dark' : '',
                amber ? 'bn-amber' : '',
                noHover ? 'no-hover' : '',
                className,
              ]
                  .filter(Boolean)
                  .join(' ')}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(26px)',
                transition: `opacity .55s var(--ease) ${delay}ms, transform .55s var(--ease) ${delay}ms, box-shadow .3s, border-color .25s`,
              }}
          >
            {children}
          </div>
      );
    },
);

/* ══════════════════════════════════════════════════════════════
   CHART TOOLTIP
══════════════════════════════════════════════════════════════ */
const ChartTooltip = memo(({ active, payload, label, unit = 'm' }) => {
  if (!active || !payload?.length) return null;
  return (
      <div className="an-tooltip">
        <div
            style={{
              color: 'rgba(240,234,216,.45)',
              marginBottom: 3,
              fontSize: '.6rem',
            }}
        >
          {label}
        </div>
        <span className="an-tooltip-val">
        {payload[0]?.value}
          {unit}
      </span>
        {payload[1] && (
            <span style={{ color: 'rgba(240,234,216,.45)', marginLeft: 7 }}>
          · {payload[1]?.value} sessions
        </span>
        )}
      </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════════════════════════════ */
function EmptyChart({ small }) {
  return (
      <div className="an-empty" style={{ padding: small ? '18px 0' : '36px 0' }}>
        <div className="an-empty-glyph">◈</div>
        <div className="an-empty-title">No data yet</div>
        <div className="an-empty-sub">
          Log study sessions to see analytics here.
        </div>
      </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SECTION RULE
══════════════════════════════════════════════════════════════ */
function SectionRule({ label }) {
  return (
      <div className="an-section-rule">
        <div className="an-section-rule-line" />
        <span className="an-section-rule-glyph">✦</span>
        <span className="an-section-rule-label">{label}</span>
        <span className="an-section-rule-glyph">✦</span>
        <div className="an-section-rule-line" />
      </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HERO STAT
══════════════════════════════════════════════════════════════ */
function HeroStat({ val, label, delta, dir }) {
  return (
      <div>
        <div className="an-hero-stat-val">{val}</div>
        <div className="an-hero-stat-label">{label}</div>
        {delta && (
            <div
                className={`an-hero-stat-delta ${dir === 'up' ? 'delta-up' : dir === 'down' ? 'delta-down' : 'delta-flat'}`}
            >
              {dir === 'up' ? (
                  <ArrowUp size={9} />
              ) : dir === 'down' ? (
                  <ArrowDown size={9} />
              ) : (
                  <Minus size={9} />
              )}
              {delta}
            </div>
        )}
      </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TIME-OF-DAY BARS  (pure CSS, no recharts needed)
══════════════════════════════════════════════════════════════ */
function TimeOfDayChart({ data }) {
  const max = Math.max(...data.map((d) => d.mins), 1);
  const peakIdx = data.reduce(
      (best, d, i) => (d.mins > data[best].mins ? i : best),
      0,
  );
  return (
      <div className="tod-bars">
        {data.map((d, i) => (
            <div key={d.key} className="tod-col">
              <div className="tod-bar-wrap">
                <div
                    className="tod-bar"
                    style={{
                      height: `${Math.max(4, (d.mins / max) * 100)}%`,
                      background:
                          i === peakIdx
                              ? 'var(--amber)'
                              : 'color-mix(in srgb,var(--amber) 35%,var(--parchment2))',
                      opacity: d.mins === 0 ? 0.25 : 1,
                    }}
                    title={`${d.range}h — ${fmtMins(d.mins)}`}
                />
              </div>
              <div className={`tod-label${i === peakIdx ? ' tod-peak' : ''}`}>
                {d.label}
              </div>
              <div className="tod-mins">{d.mins > 0 ? `${d.mins}m` : ''}</div>
            </div>
        ))}
      </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN — Analytics
══════════════════════════════════════════════════════════════ */
export default function Analytics() {
  const { supabase, loading: dbLoading } = useSupabase();
  const { theme, toggleTheme } = useTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── Fetch — uses real confirmed schema columns ── */
  const fetchSessions = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
        .from('sessions')
        .select(
            'id, title, subject, duration, difficulty, focus_type, is_completed, completed, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(300);
    if (error) console.error('Analytics fetch:', error.message);
    else setSessions(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase || dbLoading) return;
    fetchSessions();
  }, [supabase, dbLoading, fetchSessions]);

  // 🌐 Global sync — refetch whenever FocusMode saves a new session
  useEffect(() => {
    const handler = () => fetchSessions();
    window.addEventListener('session:created', handler);
    return () => window.removeEventListener('session:created', handler);
  }, [fetchSessions]);

  /* ── All derived data — fully memoised ── */
  const stats = useMemo(() => {
    const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);
    const completedCount = sessions.filter(
        (s) => s.completed || s.is_completed,
    ).length;
    const streak = calcStreak(sessions);
    const score = calcPerformanceScore(sessions, completedCount);
    const avgMins = sessions.length
        ? Math.round(totalMins / sessions.length)
        : 0;
    const weeklyData = buildWeeklyArea(sessions);
    const weekMins = weeklyData.reduce((a, d) => a + d.mins, 0);
    const monthlyData = buildMonthlyTrend(sessions);
    const focusTypeDist = buildFocusTypeDist(sessions);
    const heatmapWeeks = buildHeatmap(sessions);
    const topDay = bestDay(sessions);
    const donutData = focusTypeDist.map((s, i) => ({
      name: s.name,
      value: s.pct,
      fill: DONUT_COLORS[i % DONUT_COLORS.length],
    }));
    const completionPct = sessions.length
        ? Math.round((completedCount / sessions.length) * 100)
        : 0;
    const timeOfDay = buildTimeOfDay(sessions);
    const dayOfWeekData = buildDayOfWeekData(sessions);
    const consistencyScore = calcConsistencyScore(sessions);
    const disciplineScore = calcDisciplineScore(sessions, completedCount);
    const burnoutRisk = calcBurnoutRisk(sessions);
    const deepWorkRatio = calcDeepWorkRatio(sessions);
    const focusDrop = detectFocusDrop(sessions);
    const patternType = detectPatternType(sessions);
    const habitLoop = buildHabitLoop(sessions);
    return {
      totalMins,
      completedCount,
      streak,
      score,
      avgMins,
      weeklyData,
      weekMins,
      monthlyData,
      focusTypeDist,
      heatmapWeeks,
      topDay,
      donutData,
      completionPct,
      totalSessions: sessions.length,
      timeOfDay,
      dayOfWeekData,
      consistencyScore,
      disciplineScore,
      burnoutRisk,
      deepWorkRatio,
      focusDrop,
      patternType,
      habitLoop,
    };
  }, [sessions]);

  const narrative = useMemo(
      () => generateNarrative(sessions, stats),
      [sessions, stats],
  );
  const predictions = useMemo(
      () => generatePredictions(sessions, stats),
      [sessions, stats],
  );
  const optimizations = useMemo(
      () => generateOptimizations(sessions, stats),
      [sessions, stats],
  );

  const insights = useMemo(() => {
    const tips = [];
    if (stats.topDay)
      tips.push({
        icon: Calendar,
        label: 'Peak Day',
        text: `You consistently perform best on <strong>${stats.topDay}s</strong> — block your hardest sessions then.`,
      });
    if (stats.avgMins > 0)
      tips.push({
        icon: Clock,
        label: 'Session Depth',
        text: `Your average session runs <strong>${fmtMins(stats.avgMins)}</strong>. ${stats.avgMins < 25 ? 'Extend to 25-min sprints for better depth.' : stats.avgMins >= 60 ? 'Long sessions show exceptional focus stamina.' : 'Solid depth — maintain this rhythm.'}`,
      });
    tips.push({
      icon: Target,
      label: 'Completion Rate',
      text: `<strong>${stats.completionPct}%</strong> of sessions completed. ${stats.completionPct < 60 ? 'Set a single, specific outcome before each session to close more.' : 'Exceptional follow-through — a rare quality.'}`,
    });
    if (stats.habitLoop)
      tips.push({
        icon: Repeat,
        label: 'Habit Loop',
        text: `You often study in the <strong>${stats.habitLoop.time}</strong> for ~<strong>${fmtMins(stats.habitLoop.avgMins)}</strong>. That's a real habit forming — protect that slot.`,
      });
    if (stats.streak > 0)
      tips.push({
        icon: Flame,
        label: 'Active Streak',
        text: `You're on a <strong>${stats.streak}-day streak</strong>. ${stats.streak >= 14 ? 'Two weeks of consistency — your habit is solidifying.' : stats.streak >= 7 ? 'A full week. The compound effect is starting.' : 'Build to 7 days for a self-reinforcing loop.'}`,
      });
    if (stats.deepWorkRatio > 0)
      tips.push({
        icon: Brain,
        label: 'Deep Work Ratio',
        text: `<strong>${stats.deepWorkRatio}%</strong> of your sessions qualify as deep work. ${stats.deepWorkRatio > 60 ? 'Elite-level focus discipline.' : 'Aim to push this above 50% for compounding returns.'}`,
      });
    return tips;
  }, [stats]);

  /* ── Count-up animations ── */
  const countSessions = useCountUp(
      mounted && !loading ? stats.totalSessions : 0,
      1000,
      600,
  );
  const countHours = useCountUp(
      mounted && !loading ? Math.round(stats.totalMins / 60) : 0,
      1200,
      700,
  );
  const countStreak = useCountUp(
      mounted && !loading ? stats.streak : 0,
      800,
      800,
  );
  const countScore = useCountUp(
      mounted && !loading ? stats.score : 0,
      1400,
      400,
  );

  /* ── Loading skeleton ── */
  if (loading || dbLoading) {
    return (
        <>
          <style>{CSS}</style>
          <div className={`an-page${isDark ? ' dark' : ''}`}>
            <div className="an-grain" />
            <AppNavbar />
            <div className="an-hero">
              <div
                  className="sk"
                  style={{ width: 130, height: 12, marginBottom: 20 }}
              />
              <div
                  className="sk"
                  style={{ width: '58%', height: 60, marginBottom: 14 }}
              />
              <div
                  className="sk"
                  style={{ width: '38%', height: 12, marginBottom: 44 }}
              />
              <div style={{ display: 'flex', gap: 44 }}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="sk" style={{ width: 80, height: 52 }} />
                ))}
              </div>
            </div>
            <div className="an-bento">
              {[8, 4, 7, 5, 4, 4, 4, 6, 6, 12].map((span, i) => (
                  <div
                      key={i}
                      className={`bn col-${span}`}
                      style={{ opacity: 1, transform: 'none' }}
                  >
                    <div className="sk" style={{ width: '100%', height: 200 }} />
                  </div>
              ))}
            </div>
          </div>
        </>
    );
  }

  const empty = sessions.length === 0;

  return (
      <>
        <style>{CSS}</style>
        <div className={`an-page${isDark ? ' dark' : ''}`}>
          <div className="an-grain" />
          <AppNavbar />

          {/* ══ HERO ══ */}
          <div className="an-hero">
            <div className="an-hero-bg">
              <div className="an-hero-orb1" />
              <div className="an-hero-orb2" />
            </div>
            <button
                className="an-theme-btn"
                onClick={toggleTheme}
                aria-label="Toggle theme"
            >
              {isDark ? (
                  <Sun size={14} strokeWidth={1.8} />
              ) : (
                  <Moon size={14} strokeWidth={1.8} />
              )}
            </button>
            <div className="an-overline">
              <div className="an-overline-dot" />
              Intelligence Report
            </div>
            <h1 className="an-h1">
              Your <em>Focus</em>
              <br />
              Story
            </h1>
            <p className="an-hero-sub">
              {empty
                  ? 'Start logging sessions to unlock deep behavioral analytics.'
                  : `Analysing ${stats.totalSessions} sessions · ${fmtMins(stats.totalMins)} of focused study`}
            </p>
            {!empty && (
                <div className="an-hero-stats">
                  <HeroStat val={countSessions} label="Sessions" delta={null} />
                  <HeroStat
                      val={`${countHours}h`}
                      label="Focus Time"
                      delta="this month"
                      dir="up"
                  />
                  <HeroStat
                      val={`${countStreak}d`}
                      label="Streak"
                      delta={stats.streak > 0 ? 'active' : 'start today'}
                      dir={stats.streak > 0 ? 'up' : 'flat'}
                  />
                  <HeroStat
                      val={countScore}
                      label="Performance"
                      delta="score / 100"
                      dir={stats.score > 60 ? 'up' : 'flat'}
                  />
                </div>
            )}
          </div>

          <SectionRule label="Deep Intelligence" />

          {/* ══ BENTO GRID ══ */}
          <div className="an-bento">
            {/* 1. Monthly trend — span 8 */}
            <BentoCell span={8} delay={0} noHover>
              <div className="bn-pad-lg">
                <div className="bn-eyebrow">
                  <div className="bn-eyebrow-dot" />
                  Progress Over Time
                </div>
                <div className="bn-title">Monthly Focus Trend</div>
                {empty ? (
                    <EmptyChart />
                ) : (
                    <ResponsiveContainer width="100%" height={188}>
                      <AreaChart
                          data={stats.monthlyData}
                          margin={{ top: 10, right: 4, left: -28, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1">
                            <stop
                                offset="0%"
                                stopColor="var(--amber)"
                                stopOpacity={0.32}
                            />
                            <stop
                                offset="100%"
                                stopColor="var(--amber)"
                                stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--border)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="month"
                            tick={{
                              fontFamily: "'IBM Plex Mono'",
                              fontSize: 10,
                              fill: 'var(--ink-faint)',
                            }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{
                              fontFamily: "'IBM Plex Mono'",
                              fontSize: 10,
                              fill: 'var(--ink-faint)',
                            }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => (v ? `${v}m` : '')}
                        />
                        <Tooltip
                            content={<ChartTooltip />}
                            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="mins"
                            stroke="var(--amber)"
                            strokeWidth={2.5}
                            fill="url(#ag1)"
                            dot={{ r: 3, fill: 'var(--amber)', strokeWidth: 0 }}
                            activeDot={{
                              r: 5,
                              fill: 'var(--amber)',
                              stroke: 'var(--cream)',
                              strokeWidth: 2,
                            }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                )}
              </div>
            </BentoCell>

            {/* 2. Performance score radial — span 4, dark */}
            <BentoCell span={4} delay={80} dark>
              <div
                  className="bn-pad-lg"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 268,
                  }}
              >
                <div className="bn-eyebrow" style={{ justifyContent: 'center' }}>
                  <div className="bn-eyebrow-dot" />
                  Performance Score
                </div>
                <div
                    style={{
                      position: 'relative',
                      width: 165,
                      height: 165,
                      margin: '14px 0 10px',
                    }}
                >
                  <ResponsiveContainer width={165} height={165}>
                    <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="64%"
                        outerRadius="88%"
                        startAngle={225}
                        endAngle={225 - (stats.score / 100) * 270}
                        data={[{ value: stats.score, fill: '#c4913a' }]}
                    >
                      <RadialBar
                          dataKey="value"
                          cornerRadius={6}
                          background={{ fill: 'rgba(240,234,216,.05)' }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="radial-center">
                    <div
                        className="radial-score"
                        style={{ color: 'var(--cream)' }}
                    >
                      {countScore}
                    </div>
                    <div className="radial-label">score</div>
                  </div>
                </div>
                <div className="bn-sub" style={{ textAlign: 'center' }}>
                  {stats.score >= 80
                      ? 'Exceptional · top 10%'
                      : stats.score >= 60
                          ? 'Strong performer'
                          : 'Room to grow'}
                </div>
                {/* Consistency + Discipline mini scores */}
                <div
                    style={{
                      display: 'flex',
                      gap: 20,
                      marginTop: 16,
                      width: '100%',
                    }}
                >
                  {[
                    { lbl: 'Consistency', val: stats.consistencyScore },
                    { lbl: 'Discipline', val: stats.disciplineScore },
                  ].map(({ lbl, val }) => (
                      <div key={lbl} style={{ flex: 1 }}>
                        <div
                            style={{
                              fontFamily: 'var(--f-mono)',
                              fontSize: '.5rem',
                              textTransform: 'uppercase',
                              letterSpacing: '.1em',
                              color: 'rgba(240,234,216,.35)',
                              marginBottom: 5,
                            }}
                        >
                          {lbl}
                        </div>
                        <div
                            style={{
                              height: 4,
                              background: 'rgba(240,234,216,.08)',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                        >
                          <div
                              style={{
                                height: '100%',
                                width: `${val}%`,
                                background: 'var(--amber)',
                                borderRadius: 2,
                                transition: 'width 1s var(--ease)',
                              }}
                          />
                        </div>
                        <div
                            style={{
                              fontFamily: 'var(--f-mono)',
                              fontSize: '.54rem',
                              color: 'rgba(240,234,216,.55)',
                              marginTop: 4,
                            }}
                        >
                          {val}%
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </BentoCell>

            {/* 3. Focus type horizontal bars — span 5 */}
            <BentoCell span={5} delay={120}>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--terra)' }}
                  />
                  Focus Type Split
                </div>
                <div className="bn-title">Time by Focus Type</div>
                {empty ? (
                    <EmptyChart small />
                ) : (
                    <div className="ft-row">
                      {stats.focusTypeDist.map((s, i) => (
                          <div key={s.name} className="ft-item">
                            <div className="ft-item-top">
                              <span className="ft-name">{s.name}</span>
                              <span className="ft-pct">{s.pct}%</span>
                            </div>
                            <div className="ft-track">
                              <div
                                  className="ft-fill"
                                  style={{
                                    width: `${s.pct}%`,
                                    background: FT_COLORS[i % FT_COLORS.length],
                                  }}
                              />
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </div>
            </BentoCell>

            {/* 4. Donut — span 3 */}
            <BentoCell span={3} delay={160}>
              <div
                  className="bn-pad"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
              >
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--sage)' }}
                  />
                  Distribution
                </div>
                <div className="bn-title" style={{ textAlign: 'center' }}>
                  Focus Mix
                </div>
                {empty ? (
                    <EmptyChart small />
                ) : (
                    <>
                      <div
                          style={{
                            position: 'relative',
                            width: 120,
                            height: 120,
                            margin: '10px auto',
                          }}
                      >
                        <ResponsiveContainer width={120} height={120}>
                          <PieChart>
                            <Pie
                                data={stats.donutData}
                                cx="50%"
                                cy="50%"
                                innerRadius={34}
                                outerRadius={56}
                                dataKey="value"
                                strokeWidth={0}
                            >
                              {stats.donutData.map((d, i) => (
                                  <Cell key={i} fill={d.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                            width: '100%',
                          }}
                      >
                        {stats.donutData.slice(0, 3).map((d) => (
                            <div
                                key={d.name}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  fontFamily: 'var(--f-body)',
                                  fontSize: '.72rem',
                                  color: 'var(--ink-muted)',
                                }}
                            >
                              <div
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    background: d.fill,
                                    flexShrink: 0,
                                  }}
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
                              <span
                                  style={{
                                    fontFamily: 'var(--f-mono)',
                                    fontSize: '.58rem',
                                    color: 'var(--ink-faint)',
                                  }}
                              >
                          {d.value}%
                        </span>
                            </div>
                        ))}
                      </div>
                    </>
                )}
              </div>
            </BentoCell>

            {/* 5. Weekly bar — span 4 */}
            <BentoCell span={4} delay={200} noHover>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--slate)' }}
                  />
                  Weekly Rhythm
                </div>
                <div className="bn-title">Focus This Week</div>
                {empty ? (
                    <EmptyChart small />
                ) : (
                    <ResponsiveContainer width="100%" height={135}>
                      <BarChart
                          data={stats.weeklyData}
                          barSize={18}
                          margin={{ top: 8, right: 0, left: -28, bottom: 0 }}
                      >
                        <XAxis
                            dataKey="day"
                            tick={{
                              fontFamily: "'IBM Plex Mono'",
                              fontSize: 9,
                              fill: 'var(--ink-faint)',
                            }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{
                              fontFamily: "'IBM Plex Mono'",
                              fontSize: 9,
                              fill: 'var(--ink-faint)',
                            }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => (v ? `${v}m` : '')}
                        />
                        <Tooltip
                            content={<ChartTooltip />}
                            cursor={{ fill: 'var(--parchment)', radius: 3 }}
                        />
                        <Bar
                            dataKey="mins"
                            radius={[4, 4, 0, 0]}
                            fill="var(--amber)"
                            opacity={0.84}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                )}
              </div>
            </BentoCell>

            {/* 6. This week amber stat — span 4 */}
            <BentoCell span={4} delay={240} amber>
              <div
                  className="bn-pad-lg"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 210,
                  }}
              >
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ background: 'rgba(255,255,255,.5)' }}
                  />
                  This Week
                </div>
                <div>
                  <div className="bn-num" style={{ color: '#fff' }}>
                    {fmtMins(stats.weekMins)}
                  </div>
                  <div className="bn-sub">
                    Weekly focus ·{' '}
                    {stats.weeklyData.reduce((a, d) => a + d.sessions, 0)}{' '}
                    sessions
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 18, marginTop: 16 }}>
                  {[
                    { v: fmtMins(stats.avgMins), l: 'Avg session' },
                    { v: `${stats.completionPct}%`, l: 'Completed' },
                    { v: `${stats.deepWorkRatio}%`, l: 'Deep work' },
                  ].map(({ v, l }, i) => (
                      <div key={l}>
                        <div
                            style={{
                              fontFamily: 'var(--f-serif)',
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: '#fff',
                              letterSpacing: '-.02em',
                            }}
                        >
                          {v}
                        </div>
                        <div
                            style={{
                              fontFamily: 'var(--f-mono)',
                              fontSize: '.54rem',
                              color: 'rgba(255,255,255,.52)',
                              letterSpacing: '.1em',
                              textTransform: 'uppercase',
                              marginTop: 2,
                            }}
                        >
                          {l}
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </BentoCell>
          </div>

          <SectionRule label="Behavioral Intelligence" />

          {/* ══ ROW 2: BEHAVIORAL CARDS ══ */}
          <div className="an-bento">
            {/* 7. Time-of-day analysis — span 4 */}
            <BentoCell span={4} delay={0}>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--slate)' }}
                  />
                  Temporal Pattern
                </div>
                <div className="bn-title">When You Focus Best</div>
                {empty ? (
                    <EmptyChart small />
                ) : (
                    <TimeOfDayChart data={stats.timeOfDay} />
                )}
                {!empty && stats.habitLoop && (
                    <div
                        style={{
                          marginTop: 12,
                          padding: '8px 10px',
                          background: 'var(--amber-pale)',
                          borderRadius: 7,
                          border: '1px solid rgba(196,145,58,.2)',
                        }}
                    >
                      <div
                          style={{
                            fontFamily: 'var(--f-mono)',
                            fontSize: '.55rem',
                            textTransform: 'uppercase',
                            letterSpacing: '.1em',
                            color: 'var(--amber)',
                            marginBottom: 3,
                          }}
                      >
                        Habit Loop Detected
                      </div>
                      <div
                          style={{
                            fontFamily: 'var(--f-body)',
                            fontSize: '.75rem',
                            color: 'var(--ink-muted)',
                            lineHeight: 1.55,
                          }}
                      >
                        You study in the{' '}
                        <strong style={{ color: 'var(--ink)' }}>
                          {stats.habitLoop.time}
                        </strong>{' '}
                        ~{stats.habitLoop.pct}% of the time, averaging{' '}
                        <strong style={{ color: 'var(--ink)' }}>
                          {fmtMins(stats.habitLoop.avgMins)}
                        </strong>{' '}
                        per session.
                      </div>
                    </div>
                )}
              </div>
            </BentoCell>

            {/* 8. Advanced metrics — span 4 */}
            <BentoCell span={4} delay={80}>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--violet)' }}
                  />
                  Cognitive Metrics
                </div>
                <div className="bn-title">Intelligence Scores</div>
                {empty ? (
                    <EmptyChart small />
                ) : (
                    <div className="score-bar-list">
                      {[
                        {
                          name: 'Consistency',
                          val: stats.consistencyScore,
                          color: 'var(--sage)',
                        },
                        {
                          name: 'Discipline',
                          val: stats.disciplineScore,
                          color: 'var(--amber)',
                        },
                        {
                          name: 'Deep Work %',
                          val: stats.deepWorkRatio,
                          color: 'var(--slate)',
                        },
                        {
                          name: 'Completion',
                          val: stats.completionPct,
                          color: 'var(--terra)',
                        },
                      ].map(({ name, val, color }) => (
                          <div key={name} className="score-bar-item">
                            <div className="score-bar-top">
                              <span className="score-bar-name">{name}</span>
                              <span className="score-bar-num">{val}</span>
                            </div>
                            <div className="score-bar-track">
                              <div
                                  className="score-bar-fill"
                                  style={{ width: `${val}%`, background: color }}
                              />
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </div>
            </BentoCell>

            {/* 9. Behavioral pattern cards — span 4 */}
            <BentoCell span={4} delay={160}>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--sepia)' }}
                  />
                  Behavioral Analysis
                </div>
                <div className="bn-title">Pattern Detection</div>
                {empty ? (
                    <EmptyChart small />
                ) : (
                    <>
                      {stats.focusDrop && (
                          <div className="drop-alert">
                            <div className="drop-alert-icon">
                              <TrendingDown size={14} />
                            </div>
                            <div>
                              <div className="drop-alert-text">
                                <strong>
                                  Focus declined {stats.focusDrop.pct}% recently.
                                </strong>{' '}
                                Your last 4 sessions averaged{' '}
                                {fmtMins(Math.round(stats.focusDrop.recentAvg))} vs{' '}
                                {fmtMins(Math.round(stats.focusDrop.olderAvg))}{' '}
                                previously.
                              </div>
                            </div>
                          </div>
                      )}
                      <div
                          className="beh-grid"
                          style={{ marginTop: stats.focusDrop ? 10 : 16 }}
                      >
                        {[
                          {
                            label: 'Study Pattern',
                            val: capFirst(stats.patternType),
                            sub:
                                stats.patternType === 'consistent'
                                    ? 'Excellent habit'
                                    : stats.patternType === 'bursty'
                                        ? 'High intensity bursts'
                                        : 'Variable schedule',
                            cls:
                                stats.patternType === 'consistent'
                                    ? 'positive'
                                    : stats.patternType === 'bursty'
                                        ? 'warning'
                                        : '',
                          },
                          {
                            label: 'Burnout Risk',
                            val: stats.burnoutRisk.label,
                            sub: `Risk indicator: ${stats.burnoutRisk.score}%`,
                            cls: stats.burnoutRisk.color,
                          },
                          {
                            label: 'Best Day',
                            val: stats.topDay || '—',
                            sub: 'Highest focus output',
                            cls: '',
                          },
                          {
                            label: 'Deep Work',
                            val: `${stats.deepWorkRatio}%`,
                            sub: 'Of sessions are deep',
                            cls:
                                stats.deepWorkRatio > 50
                                    ? 'positive'
                                    : stats.deepWorkRatio > 25
                                        ? 'warning'
                                        : 'danger',
                          },
                        ].map(({ label, val, sub, cls }) => (
                            <div key={label} className="beh-card">
                              <div className="beh-card-label">{label}</div>
                              <div className={`beh-card-val${cls ? ' ' + cls : ''}`}>
                                {val}
                              </div>
                              <div className="beh-card-sub">{sub}</div>
                            </div>
                        ))}
                      </div>
                    </>
                )}
              </div>
            </BentoCell>

            {/* 10. AI Insights (enhanced) — span 5 dark */}
            <BentoCell span={5} delay={220} dark>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ background: 'var(--amber-light)' }}
                  />
                  AI Insights
                </div>
                <div
                    className="bn-title"
                    style={{ color: 'var(--cream)', marginBottom: 14 }}
                >
                  What your data reveals
                </div>
                {empty ? (
                    <div className="an-empty">
                      <div className="an-empty-glyph">✦</div>
                      <div
                          className="an-empty-title"
                          style={{ color: 'var(--cream)' }}
                      >
                        No data yet
                      </div>
                    </div>
                ) : (
                    <div className="insight-row">
                      {insights.map((ins, i) => (
                          <div key={i} className="insight-item">
                            <div className="insight-icon">
                              <ins.icon size={14} />
                            </div>
                            <div className="insight-text">
                              <div className="insight-label">{ins.label}</div>
                              <div
                                  className="insight-body"
                                  dangerouslySetInnerHTML={{ __html: ins.text }}
                              />
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </div>
            </BentoCell>

            {/* 11. Optimization suggestions — span 7 */}
            <BentoCell span={7} delay={280}>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--sage)' }}
                  />
                  Optimization
                </div>
                <div className="bn-title">Next-Level Suggestions</div>
                {empty ? (
                    <EmptyChart />
                ) : (
                    <>
                      <div className="opt-list">
                        {optimizations.map((opt, i) => (
                            <div key={i} className="opt-item">
                              <div
                                  className="opt-dot"
                                  style={{
                                    background: [
                                      'var(--sage)',
                                      'var(--amber)',
                                      'var(--slate)',
                                      'var(--terra)',
                                      'var(--violet)',
                                    ][i % 5],
                                  }}
                              />
                              <div
                                  className="opt-text"
                                  dangerouslySetInnerHTML={{ __html: opt.text }}
                              />
                            </div>
                        ))}
                      </div>
                      {optimizations.length === 0 && (
                          <div className="an-empty" style={{ padding: '24px 0' }}>
                            <div
                                className="an-empty-glyph"
                                style={{ fontSize: '2rem' }}
                            >
                              ✓
                            </div>
                            <div className="an-empty-title">You're optimized</div>
                            <div className="an-empty-sub">
                              No major improvements detected. Keep going.
                            </div>
                          </div>
                      )}
                    </>
                )}
              </div>
            </BentoCell>
          </div>

          <SectionRule label="Predictions & Patterns" />

          {/* ══ ROW 3: PREDICTIONS + HEATMAP ══ */}
          <div className="an-bento">
            {/* 12. Predictions — span 5 */}
            <BentoCell span={5} delay={0}>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--violet)' }}
                  />
                  Forecasts
                </div>
                <div className="bn-title">🔮 Predictions</div>
                {empty || predictions.length === 0 ? (
                    <EmptyChart />
                ) : (
                    <div className="pred-list">
                      {predictions.map((p, i) => (
                          <div key={i} className="pred-item">
                            <div className="pred-badge">{p.emoji}</div>
                            <div style={{ flex: 1 }}>
                              <div
                                  className="pred-text"
                                  dangerouslySetInnerHTML={{ __html: p.text }}
                              />
                              <div className="pred-confidence">
                                <span style={{ width: 28 }}>{p.confidence}%</span>
                                <div className="pred-conf-bar">
                                  <div
                                      className="pred-conf-fill"
                                      style={{ width: `${p.confidence}%` }}
                                  />
                                </div>
                                <span>confidence</span>
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </div>
            </BentoCell>

            {/* 13. Day-of-week pattern — span 3 */}
            <BentoCell span={3} delay={80}>
              <div className="bn-pad">
                <div className="bn-eyebrow">
                  <div
                      className="bn-eyebrow-dot"
                      style={{ '--accent-color': 'var(--sage)' }}
                  />
                  Day Rhythm
                </div>
                <div className="bn-title">Best Days</div>
                {empty ? (
                    <EmptyChart small />
                ) : (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart
                          data={stats.dayOfWeekData}
                          barSize={14}
                          margin={{ top: 8, right: 0, left: -30, bottom: 0 }}
                      >
                        <XAxis
                            dataKey="day"
                            tick={{
                              fontFamily: "'IBM Plex Mono'",
                              fontSize: 8,
                              fill: 'var(--ink-faint)',
                            }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{
                              fontFamily: "'IBM Plex Mono'",
                              fontSize: 8,
                              fill: 'var(--ink-faint)',
                            }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => (v ? `${v}m` : '')}
                        />
                        <Tooltip
                            content={<ChartTooltip />}
                            cursor={{ fill: 'var(--parchment)', radius: 3 }}
                        />
                        <Bar dataKey="mins" radius={[3, 3, 0, 0]}>
                          {stats.dayOfWeekData.map((d, i) => (
                              <Cell
                                  key={i}
                                  fill={
                                    d.day === (stats.topDay || '').slice(0, 3)
                                        ? 'var(--amber)'
                                        : 'color-mix(in srgb,var(--amber) 35%,var(--parchment))'
                                  }
                              />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                )}
              </div>
            </BentoCell>

            {/* 14. Heatmap — span 12 */}
            <BentoCell span={12} delay={160} noHover>
              <div className="bn-pad-lg">
                <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 6,
                    }}
                >
                  <div>
                    <div className="bn-eyebrow">
                      <div className="bn-eyebrow-dot" />
                      Activity Matrix
                    </div>
                    <div className="bn-title">Study Intensity — 14 Weeks</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                        style={{
                          fontFamily: 'var(--f-serif)',
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: 'var(--amber)',
                          letterSpacing: '-.03em',
                        }}
                    >
                      {stats.streak}d
                    </div>
                    <div
                        style={{
                          fontFamily: 'var(--f-mono)',
                          fontSize: '.54rem',
                          textTransform: 'uppercase',
                          letterSpacing: '.13em',
                          color: 'var(--ink-faint)',
                        }}
                    >
                      current streak
                    </div>
                  </div>
                </div>
                {empty ? (
                    <EmptyChart />
                ) : (
                    <>
                      <div className="hm-outer">
                        <div className="hm-grid">
                          {stats.heatmapWeeks.map((week, wi) => (
                              <div key={wi} className="hm-week">
                                {week.map((cell) => (
                                    <div
                                        key={cell.date}
                                        className="hm-cell"
                                        data-l={cell.l}
                                        title={`${cell.date}: ${fmtMins(cell.mins)}`}
                                    />
                                ))}
                              </div>
                          ))}
                        </div>
                      </div>
                      <div className="hm-legend">
                        <span className="hm-legend-label">Less</span>
                        {[0, 1, 2, 3, 4].map((l) => (
                            <div
                                key={l}
                                className="hm-cell"
                                data-l={l}
                                style={{ width: 12, height: 12, flexShrink: 0 }}
                            />
                        ))}
                        <span className="hm-legend-label">More</span>
                      </div>
                    </>
                )}
              </div>
            </BentoCell>
          </div>

          {/* ══ NARRATIVE SECTION ══ */}
          {!empty && narrative && (
              <>
                <SectionRule label="Your Story" />
                <div className="narrative-section">
                  <div className="narrative-card">
                    <div className="narrative-bg-glyph">◈</div>
                    <div className="narrative-overline">Personal Narrative</div>
                    <div
                        className="narrative-text"
                        dangerouslySetInnerHTML={{ __html: narrative }}
                    />
                    <div className="narrative-chips">
                      {[
                        { text: capFirst(stats.patternType) + ' learner' },
                        { text: `${stats.streak}d streak` },
                        { text: `${stats.deepWorkRatio}% deep work` },
                        { text: `${stats.completionPct}% completion` },
                        stats.topDay ? { text: `Peak: ${stats.topDay}` } : null,
                      ]
                          .filter(Boolean)
                          .map((chip, i) => (
                              <div key={i} className="narrative-chip">
                                <div className="narrative-chip-dot" />
                                {chip.text}
                              </div>
                          ))}
                    </div>
                  </div>
                </div>
              </>
          )}

          {/* ══ CLOSING QUOTE ══ */}
          {!empty && (
              <div className="an-quote">
                <div className="an-quote-inner">
                  <p className="an-quote-text">
                    "An investment in knowledge pays the best interest."
                  </p>
                  <div className="an-quote-attr">
                    — Benjamin Franklin &nbsp;·&nbsp; Keep building
                  </div>
                </div>
              </div>
          )}
        </div>
      </>
  );
}
