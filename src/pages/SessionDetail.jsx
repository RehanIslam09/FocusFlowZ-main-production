/**
 * SessionDetail.jsx  — /session/:id
 *
 * Features:
 *  - Live countdown / stopwatch focus timer
 *  - Step-by-step plan walkthrough with progress
 *  - Inline notes (autosaved to sessions.notes)
 *  - AI plan viewer with expandable steps
 *  - Mark session complete
 *  - Session metadata (subject, difficulty, focus_type, goal, date)
 *  - Elapsed time tracking → logs to focus_logs on session end
 *  - Edit session title / metadata inline
 *  - Keyboard shortcut: Space = pause/resume timer
 *
 * Schema: sessions (all columns) + focus_logs + study_plans
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import AppNavbar from '../components/app/AppNavbar';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import {
  ArrowLeft,
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Target,
  Brain,
  Sparkles,
  Save,
  Edit2,
  Check,
  X,
  Flame,
  Calendar,
  AlignLeft,
  Zap,
  BarChart2,
  Timer,
  Flag,
  ChevronRight,
  Award,
  Layers,
  Sun,
  Moon,
} from 'lucide-react';
import SessionNotesEditor, {
  htmlToMarkdown,
} from '../components/SessionNotesEditor';

/* ─────────────── helpers ─────────────── */
const fmtMins = (m) => {
  if (!m) return '0m';
  const h = Math.floor(m / 60),
    r = m % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
};
const fmtSecs = (s) => {
  const m = Math.floor(s / 60),
    r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/* diff colors: light vs dark resolved via CSS vars */
const DIFF_GLYPH = { easy: '◎', medium: '◈', hard: '◉' };
const getDiffColor = (d) =>
  ({ easy: 'var(--green)', medium: 'var(--gold)', hard: 'var(--red)' })[d] ||
  'var(--ink3)';

/* ─────────────── CSS ─────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

/* ══ LIGHT (default) ══ */
:root {
  color-scheme: light;
  --bg:#faf8f3; --surface:#ffffff; --surface2:#f5f0e6; --surface3:#ede7d8;
  --border:#e2d8c8; --border2:#cfc3ae;
  --ink:#1e1a14; --ink2:#5a4f3e; --ink3:#9c8e7a;
  --gold:#a8751e; --gold2:#c9943a; --gold3:rgba(168,117,30,.1);
  --red:#a83a30; --green:#3a7a3a; --green2:rgba(58,122,58,.1); --green3:rgba(58,122,58,.2);
  --orb1:#e8d5a8; --orb2:#b8c0e0; --orb-op:.45;
  --sh:0 2px 12px rgba(30,26,20,.06); --sh-h:0 10px 40px rgba(30,26,20,.14);
  --f-display:'Cormorant Garamond',Georgia,serif;
  --f-ui:'Cabinet Grotesk',sans-serif;
  --f-mono:'JetBrains Mono',monospace;
  --ease:cubic-bezier(.16,1,.3,1); --spring:cubic-bezier(.34,1.56,.64,1);
}
/* ══ DARK ══ */
html.dark {
  color-scheme: dark;
  --bg:#0c0b09; --surface:#131210; --surface2:#1a1815; --surface3:#222019;
  --border:#2a2722; --border2:#35312b;
  --ink:#f0ead8; --ink2:#a89880; --ink3:#6b5f4e;
  --gold:#c9a84c; --gold2:#e8c97a; --gold3:rgba(201,168,76,.1);
  --red:#c0544a; --green:#6b9e6b; --green2:rgba(107,158,107,.12); --green3:rgba(107,158,107,.25);
  --orb1:#c9a84c; --orb2:#3a4a8a; --orb-op:.055;
  --sh:0 2px 12px rgba(0,0,0,.3); --sh-h:0 14px 44px rgba(0,0,0,.55);
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── GRAIN ── */
.grain{pointer-events:none;position:fixed;inset:0;z-index:999;opacity:.018;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
html.dark .grain{opacity:.038;mix-blend-mode:screen}

/* ── THEME TOGGLE ── */
.sd-tt{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:22px;
  border:1px solid var(--border2);background:var(--surface2);cursor:pointer;
  font-family:var(--f-mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink2);transition:all .3s var(--ease);user-select:none;white-space:nowrap}
.sd-tt:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3);box-shadow:0 0 0 3px var(--gold3)}
.sd-tt-track{width:30px;height:17px;border-radius:9px;background:var(--surface3);position:relative;
  flex-shrink:0;border:1.5px solid var(--border2);transition:background .35s,border-color .35s}
html.dark .sd-tt-track{background:var(--gold);border-color:var(--gold)}
.sd-tt-thumb{position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;
  background:var(--ink3);box-shadow:0 1px 4px rgba(0,0,0,.2);
  transition:transform .35s var(--spring),background .3s}
html.dark .sd-tt-thumb{transform:translateX(13px);background:#fff}

.sd{min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--f-ui);position:relative;transition:background .4s,color .3s}
.sd-bg{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.sd-orb{position:absolute;border-radius:50%;filter:blur(140px);opacity:var(--orb-op);transition:all .5s}
.sd-orb1{width:600px;height:600px;background:var(--orb1);top:-200px;right:-100px}
.sd-orb2{width:400px;height:400px;background:var(--orb2);bottom:-100px;left:-80px}

.sd-wrap{max-width:1100px;margin:0 auto;padding:36px 32px 100px;position:relative;z-index:1}
@media(max-width:768px){.sd-wrap{padding:20px 16px 80px}}

/* ── TOPBAR ── */
.sd-topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
.sd-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);background:none;border:none;cursor:pointer;padding:0;transition:color .2s}
.sd-back:hover{color:var(--gold)}

/* ── HEADER ── */
.sd-head{margin-bottom:36px;animation:up .5s var(--ease) both}
.sd-tag{font-family:var(--f-mono);font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;display:flex;align-items:center;gap:8px}
.sd-tag::before{content:'';display:block;width:24px;height:1px;background:var(--gold);opacity:.5}
.sd-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.sd-title{font-family:var(--f-display);font-size:clamp(2rem,5vw,3.2rem);font-weight:300;letter-spacing:-.02em;line-height:1.05}
.sd-title em{font-style:italic;color:var(--gold)}
.sd-title-input{font-family:var(--f-display);font-size:clamp(2rem,5vw,3.2rem);font-weight:300;letter-spacing:-.02em;line-height:1.05;background:transparent;border:none;border-bottom:1px solid var(--gold);color:var(--ink);outline:none;width:100%;padding-bottom:4px}
.sd-meta-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.meta-chip{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.58rem;letter-spacing:.07em;padding:4px 10px;border-radius:20px;background:var(--surface2);border:1px solid var(--border);color:var(--ink3)}
.sd-head-actions{display:flex;gap:8px;align-items:flex-start;flex-shrink:0;flex-wrap:wrap}

/* ── LAYOUT ── */
.sd-layout{display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start}
@media(max-width:900px){.sd-layout{grid-template-columns:1fr}}

/* ── CARD ── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:var(--sh);transition:background .4s,border-color .4s}
.card-head{padding:16px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
.card-head-label{font-family:var(--f-mono);font-size:.57rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:7px}
.card-body{padding:20px}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-size:.63rem;letter-spacing:.08em;text-transform:uppercase;padding:9px 18px;border-radius:6px;border:none;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-gold{background:var(--gold);color:#fff;font-weight:500}
.btn-gold:hover:not(:disabled){background:var(--gold2);transform:translateY(-1px);box-shadow:0 4px 20px var(--gold3)}
.btn-outline{background:transparent;border:1px solid var(--border2);color:var(--ink2)}
.btn-outline:hover:not(:disabled){border-color:var(--ink2);color:var(--ink);background:var(--surface2)}
.btn-green{background:var(--green2);border:1px solid var(--green);color:var(--green)}
.btn-green:hover:not(:disabled){background:var(--green3)}
.btn-ghost{background:transparent;border:none;color:var(--ink3);padding:6px 10px}
.btn-ghost:hover:not(:disabled){color:var(--ink)}
.btn-icon{width:30px;height:30px;padding:0;border-radius:6px;background:transparent;border:1px solid var(--border);display:grid;place-items:center;cursor:pointer;color:var(--ink3);transition:all .15s;flex-shrink:0}
.btn-icon:hover:not(:disabled){border-color:var(--border2);color:var(--ink)}
.btn-icon.gold:hover{border-color:var(--gold);color:var(--gold)}
.btn-red{background:rgba(168,58,48,.08);border:1px solid rgba(168,58,48,.25);color:var(--red)}
html.dark .btn-red{background:rgba(192,84,74,.1);border-color:rgba(192,84,74,.3)}
.btn-red:hover:not(:disabled){background:rgba(168,58,48,.16)}
html.dark .btn-red:hover:not(:disabled){background:rgba(192,84,74,.2)}

/* ════════════════════
   TIMER
════════════════════ */
.timer-wrap{background:linear-gradient(135deg,#2c2010,#1e180c);border:1px solid rgba(168,117,30,.25);border-radius:12px;padding:32px 24px;text-align:center;position:relative;overflow:hidden;margin-bottom:20px;animation:up .5s .06s var(--ease) both}
html.dark .timer-wrap{background:linear-gradient(135deg,#1a1508,#12100a);border-color:rgba(201,168,76,.2)}
.timer-wrap::after{content:'◈';position:absolute;right:16px;bottom:-20px;font-size:8rem;color:rgba(201,168,76,.04);font-family:var(--f-display);pointer-events:none;line-height:1}

.timer-mode-row{display:flex;justify-content:center;gap:6px;margin-bottom:20px}
.timer-mode-btn{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--ink3);cursor:pointer;transition:all .15s}
.timer-mode-btn.on{background:var(--gold3);border-color:var(--gold);color:var(--gold)}

.timer-ring-wrap{position:relative;width:180px;height:180px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center}
.timer-ring{position:absolute;inset:0}
.timer-ring circle{fill:none;stroke-linecap:round;transition:stroke-dashoffset .5s var(--ease)}
.timer-display{display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;z-index:1}
.timer-time{font-family:var(--f-mono);font-size:2.6rem;font-weight:400;letter-spacing:-.03em;color:var(--ink);line-height:1;transition:color .3s}
.timer-time.running{color:var(--gold)}
.timer-time.done{color:var(--green)}
.timer-label{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}

.timer-controls{display:flex;justify-content:center;gap:10px;margin-bottom:16px}
.tc-btn{display:flex;align-items:center;justify-content:center;gap:7px;font-family:var(--f-mono);font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;padding:10px 22px;border-radius:7px;border:none;cursor:pointer;transition:all .2s}
.tc-play{background:var(--gold);color:var(--bg);font-weight:500;min-width:100px}
.tc-play:hover{background:var(--gold2);transform:translateY(-1px)}
.tc-reset{background:var(--surface2);border:1px solid var(--border);color:var(--ink2)}
.tc-reset:hover{border-color:var(--border2);color:var(--ink)}

.timer-elapsed{font-family:var(--f-mono);font-size:.6rem;color:var(--ink3);letter-spacing:.08em;text-transform:uppercase}
.timer-kb{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);opacity:.5;margin-top:6px}

/* ════════════════════
   STEP PLAN
════════════════════ */
.plan-progress{height:3px;background:var(--border);border-radius:2px;margin-bottom:16px;overflow:hidden}
.plan-progress-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--green));border-radius:2px;transition:width .5s var(--ease)}

.step-item{border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:8px;transition:border-color .2s}
.step-item.current{border-color:rgba(201,168,76,.4);background:linear-gradient(135deg,rgba(201,168,76,.04),transparent)}
.step-item.completed{border-color:rgba(107,158,107,.25);opacity:.7}
.step-item-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none;transition:background .15s}
.step-item-head:hover{background:var(--surface2)}
.step-num{width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);display:grid;place-items:center;font-family:var(--f-mono);font-size:.55rem;color:var(--ink3);flex-shrink:0;transition:all .3s}
.step-num.current{border-color:var(--gold);background:var(--gold);color:var(--bg)}
.step-num.done{border-color:var(--green);background:var(--green);color:#fff}
.step-item-title{flex:1;font-family:var(--f-ui);font-size:.88rem;font-weight:500;color:var(--ink)}
.step-item-title.done{text-decoration:line-through;color:var(--ink3)}
.step-badge{font-family:var(--f-mono);font-size:.55rem;color:var(--ink3);background:var(--surface2);border:1px solid var(--border);padding:2px 7px;border-radius:20px;display:flex;align-items:center;gap:3px;white-space:nowrap;flex-shrink:0}
.step-expand-ico{color:var(--ink3);flex-shrink:0;transition:transform .2s}
.step-item-body{padding:0 14px 14px;border-top:1px solid var(--border);background:var(--surface2)}
.step-desc{font-family:var(--f-ui);font-size:.82rem;color:var(--ink2);line-height:1.65;padding-top:12px}
.step-concepts{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
.concept{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.06em;background:var(--gold3);border:1px solid rgba(201,168,76,.2);color:var(--gold);padding:2px 7px;border-radius:4px;text-transform:uppercase}
.step-item-actions{display:flex;gap:7px;margin-top:12px}

.steps-nav{display:flex;gap:8px;justify-content:center;margin-top:14px}

/* ════════════════════
   NOTES
════════════════════ */
.notes-ta{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px;font-family:var(--f-ui);font-size:.85rem;color:var(--ink);line-height:1.7;outline:none;resize:vertical;min-height:120px;transition:border-color .2s}
.notes-ta:focus{border-color:var(--gold)}
.notes-ta::placeholder{color:var(--ink3);font-style:italic}
.notes-save-row{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
.notes-saved{font-family:var(--f-mono);font-size:.57rem;color:var(--green);letter-spacing:.07em;display:flex;align-items:center;gap:4px}
.notes-unsaved{font-family:var(--f-mono);font-size:.57rem;color:var(--ink3);letter-spacing:.07em}

/* ════════════════════
   SIDEBAR
════════════════════ */
.sidebar{display:flex;flex-direction:column;gap:16px}

.info-row{display:flex;flex-direction:column;gap:10px}
.info-item{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.info-item:last-child{border-bottom:none}
.info-icon{color:var(--ink3);flex-shrink:0;margin-top:1px}
.info-label{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:2px}
.info-val{font-family:var(--f-ui);font-size:.85rem;color:var(--ink)}
.info-val.gold{color:var(--gold)}

.complete-card{background:var(--green2);border:1px solid rgba(58,122,58,.25);border-radius:12px;padding:20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
html.dark .complete-card{border-color:rgba(107,158,107,.3)}
.complete-card.done{background:rgba(58,122,58,.06);border-color:rgba(58,122,58,.2)}
html.dark .complete-card.done{background:rgba(107,158,107,.08)}
.complete-title{font-family:var(--f-display);font-size:1.1rem;font-weight:400;color:var(--ink)}
.complete-sub{font-family:var(--f-mono);font-size:.6rem;color:var(--ink3);letter-spacing:.04em;line-height:1.6}

.tips-card{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--gold);border-radius:12px;padding:16px 18px;box-shadow:var(--sh)}
.tips-title{font-family:var(--f-mono);font-size:.57rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;display:flex;align-items:center;gap:5px}
.tip-row{display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-family:var(--f-ui);font-size:.8rem;color:var(--ink2);line-height:1.55}
.tip-arrow{color:var(--gold);flex-shrink:0;opacity:.7;margin-top:1px}

/* ── EDIT INLINE ── */
.edit-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
.edit-label{font-family:var(--f-mono);font-size:.57rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.edit-input{background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:9px 12px;font-family:var(--f-ui);font-size:.88rem;color:var(--ink);outline:none;transition:border-color .2s,background .4s;width:100%}
.edit-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold3)}
.edit-input-sm{font-size:.82rem;padding:7px 10px}
.overlay{position:fixed;inset:0;background:rgba(30,26,20,.7);z-index:100;display:flex;align-items:center;justify-content:center;animation:fadeIn .3s ease}
html.dark .overlay{background:rgba(12,11,9,.85)}
.overlay-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:48px 40px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;max-width:440px;width:90%;animation:popIn .4s var(--spring);box-shadow:0 24px 80px rgba(30,26,20,.15)}
html.dark .overlay-card{box-shadow:0 24px 80px rgba(0,0,0,.5)}
.ov-icon{width:72px;height:72px;border-radius:50%;background:var(--green2);border:1px solid var(--green);display:grid;place-items:center;color:var(--green);position:relative}
.ov-icon::after{content:'';position:absolute;inset:-8px;border-radius:50%;border:1px dashed rgba(107,158,107,.3)}
.ov-title{font-family:var(--f-display);font-size:2rem;font-weight:300;color:var(--ink)}
.ov-sub{font-family:var(--f-ui);font-size:.88rem;color:var(--ink2);line-height:1.65;max-width:320px}
.ov-stats{display:flex;gap:24px;margin:4px 0}
.ov-stat{display:flex;flex-direction:column;align-items:center;gap:3px}
.ov-stat-val{font-family:var(--f-display);font-size:1.6rem;font-weight:300;color:var(--gold)}
.ov-stat-label{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.ov-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}

/* ── LOADING / ERROR ── */
.sd-loading{min-height:60vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px}
.sd-loading-orb{width:56px;height:56px;border-radius:50%;border:1px solid var(--gold);border-top-color:transparent;animation:spin .8s linear infinite}
.sd-err{padding:60px 30px;text-align:center}
.sd-err-title{font-family:var(--f-display);font-size:1.5rem;color:var(--ink);margin-bottom:8px}
.sd-err-sub{font-family:var(--f-mono);font-size:.65rem;color:var(--ink3)}

@keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
.anim-up{animation:up .5s var(--ease) both}
.anim-up1{animation:up .5s .07s var(--ease) both}
.anim-up2{animation:up .5s .14s var(--ease) both}
`;

/* ═══════════════════════════════════════════
   TIMER COMPONENT
═══════════════════════════════════════════ */
function FocusTimer({
  durationMins,
  onLog,
  onStateChange,
  onTimerDone,
  sessionState,
  sessionId,
}) {
  const totalSecs = durationMins * 60;
  const tickRef = useRef(null);
  const timerEverStartedRef = useRef(false);

  // localStorage key scoped to session id — passed as new prop `sessionId`
  const LS_KEY = `timer_${sessionId}`;

  const restoreTimer = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!saved) return null;
      // Reject stale data older than 24 hours
      if (!saved.savedAt || Date.now() - saved.savedAt > 86_400_000) {
        localStorage.removeItem(LS_KEY);
        return null;
      }
      // Reject if required fields are missing or nonsensical
      if (
        typeof saved.elapsed !== 'number' ||
        typeof saved.remain !== 'number' ||
        saved.elapsed < 0 ||
        saved.remain < 0
      ) {
        localStorage.removeItem(LS_KEY);
        return null;
      }
      // Derive elapsed from wall clock if it was running when saved
      if (saved.running && saved.savedAt) {
        const drift = Math.max(
          0,
          Math.floor((Date.now() - saved.savedAt) / 1000),
        );
        saved.elapsed = (saved.elapsed || 0) + drift;
        if (saved.mode === 'countdown') {
          const newRemain = Math.max(0, (saved.remain || 0) - drift);
          saved.remain = newRemain;
          if (newRemain <= 0) {
            saved.remain = 0;
            saved.elapsed = saved.elapsed; // already updated above
            saved.running = false;
            saved.done = true;
          }
        }
      }
      return saved;
    } catch {
      return null;
    }
  };

  const initial = restoreTimer();

  const [elapsed, setElapsed] = useState(initial?.elapsed ?? 0);
  const [remain, setRemain] = useState(initial?.remain ?? totalSecs);
  const [running, setRunning] = useState(
    !!(initial?.running && !initial?.done),
  );
  const [done, setDone] = useState(initial?.done ?? false);
  const [mode, setMode] = useState(initial?.mode ?? 'countdown');
  const modeRef = useRef(initial?.mode ?? 'countdown');
  const elapsedRef = useRef(initial?.elapsed ?? 0);

  const onTimerDoneRef = useRef(onTimerDone);
  useEffect(() => {
    onTimerDoneRef.current = onTimerDone;
  }, [onTimerDone]);

  // Add this right after — syncs the ref unconditionally on every render:
  elapsedRef.current = elapsed;

  // Persist timer state on every elapsed change
  useEffect(() => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        elapsed,
        remain,
        running,
        done,
        mode,
        savedAt: Date.now(),
      }),
    );
  }, [elapsed, remain, running, done, mode]);

  // Keyboard: Space = play/pause
  useEffect(() => {
    // Fixed
    const h = (e) => {
      if (
        e.code === 'Space' &&
        e.target.tagName !== 'TEXTAREA' &&
        e.target.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        setRunning((r) => {
          const next = !r;
          if (!timerEverStartedRef.current && next) {
            timerEverStartedRef.current = true;
          }
          onStateChange(next ? 'running' : 'paused');
          if (next)
            window.dispatchEvent(new CustomEvent('session:timerresumed'));
          return next;
        });
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onStateChange]);

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
        elapsedRef.current += 1;

        setRemain((r) => {
          if (modeRef.current !== 'countdown') return r;

          if (r <= 1) {
            setRunning(false);
            setDone(true);
            clearInterval(tickRef.current);
            onTimerDoneRef.current(
              Math.max(1, Math.round(elapsedRef.current / 60)),
            );
            return 0;
          }

          return r - 1;
        });
      }, 1000);
    } else {
      clearInterval(tickRef.current);
    }

    return () => clearInterval(tickRef.current);
  }, [running]);

  useEffect(() => {
    const handler = () => {
      if (!running && !done) {
        setRunning(true);
        if (!timerEverStartedRef.current) {
          timerEverStartedRef.current = true;
        }
        onStateChange('running');
      }
    };
    window.addEventListener('session:beginstep', handler);
    return () => window.removeEventListener('session:beginstep', handler);
  }, [running, done, onStateChange]);

  // Add this useEffect inside FocusTimer, after all useState declarations:
  useEffect(() => {
    if (running && !done) {
      onStateChange('running');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only

  // Fixed — use the ref
  const handleReset = () => {
    if (elapsedRef.current > 30) {
      onLog(Math.max(1, Math.floor(elapsedRef.current / 60)), true);
    }
    localStorage.removeItem(LS_KEY);
    setRunning(false);
    setElapsed(0);
    setRemain(totalSecs);
    setDone(false);
    elapsedRef.current = 0;
    timerEverStartedRef.current = false;
    onStateChange('idle');
  };
  // Fixed
  const handleFinish = () => {
    setRunning(false);
    const mins = Math.max(1, Math.floor(elapsedRef.current / 60));
    onLog(mins);
    onStateChange('paused');
    setDone(true);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Focus session complete! 🎯', {
        body: `You focused for ${fmtMins(mins)}. Head back to mark your session done.`,
        icon: '/favicon.ico',
        tag: 'focus-timer-done',
      });
    }
  };

  // Ring progress
  const R = 78;
  const CIRC = 2 * Math.PI * R;
  const pct =
    mode === 'countdown'
      ? (totalSecs - remain) / totalSecs
      : Math.min(1, elapsed / totalSecs);
  const offset = CIRC * (1 - pct);

  const displayTime = mode === 'countdown' ? remain : elapsed;
  const isOver = mode === 'stopwatch' && elapsed > totalSecs;

  return (
    <div className="timer-wrap">
      <div className="timer-mode-row">
        <button
          className={`timer-mode-btn${mode === 'countdown' ? ' on' : ''}`}
          onClick={() => {
            if (running) return;
            if (mode === 'countdown') return; // already in this mode, no-op
            if (
              elapsed > 30 &&
              !window.confirm(
                'Switch to Countdown? Current progress will be reset.',
              )
            )
              return;
            setMode('countdown');
            modeRef.current = 'countdown';
            handleReset();
          }}
          disabled={running || sessionState === 'paused'}
        >
          Countdown
        </button>
        <button
          className={`timer-mode-btn${mode === 'stopwatch' ? ' on' : ''}`}
          onClick={() => {
            if (running) return;
            if (mode === 'stopwatch') return;
            if (
              elapsed > 30 &&
              !window.confirm(
                'Switch to Stopwatch? Current progress will be reset.',
              )
            )
              return;
            setMode('stopwatch');
            modeRef.current = 'stopwatch';
            handleReset();
          }}
          disabled={running || sessionState === 'paused'}
        >
          Stopwatch
        </button>
      </div>

      <div className="timer-ring-wrap">
        <svg className="timer-ring" viewBox="0 0 180 180">
          {/* track */}
          <circle
            cx="90"
            cy="90"
            r={R}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="4"
          />
          {/* fill */}
          <circle
            cx="90"
            cy="90"
            r={R}
            stroke={
              done ? 'var(--green)' : isOver ? 'var(--red)' : 'var(--gold)'
            }
            strokeWidth="4"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
        </svg>
        <div className="timer-display">
          <div
            className={`timer-time${running ? ' running' : ''}${done ? ' done' : ''}`}
          >
            {fmtSecs(displayTime)}
          </div>
          <div className="timer-label">
            {done ? 'Complete!' : running ? 'Focusing…' : 'Ready'}
          </div>
        </div>
      </div>

      <div className="timer-controls">
        <button className="tc-btn tc-reset" onClick={handleReset}>
          <RotateCcw size={13} /> Reset
        </button>
        <button
          className="tc-btn tc-play"
          onClick={() => {
            if (done) {
              handleReset();
              return;
            }
            const next = !running;
            setRunning(next);
            if (!timerEverStartedRef.current && next) {
              timerEverStartedRef.current = true;
            }
            onStateChange(next ? 'running' : 'paused');
            if (next) {
              window.dispatchEvent(new CustomEvent('session:timerresumed'));
            }
          }}
        >
          {done ? (
            <>
              <RotateCcw size={13} />
              Again
            </>
          ) : running ? (
            <>
              <Pause size={13} />
              Pause
            </>
          ) : (
            <>
              <Play size={13} />
              Start
            </>
          )}
        </button>
        {elapsed > 30 && !done && (
          <button
            className="tc-btn tc-reset"
            onClick={handleFinish}
            style={{
              background: 'var(--green2)',
              border: '1px solid var(--green)',
              color: 'var(--green)',
            }}
          >
            <Flag size={13} /> Finish
          </button>
        )}
      </div>

      <div className="timer-elapsed">
        {elapsed > 0 && `${fmtMins(Math.floor(elapsed / 60))} elapsed`}
      </div>
      <div className="timer-kb">Press Space to pause / resume</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════ */
export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { supabase, loading: dbLoading } = useSupabase();
  const { theme, toggleTheme } = useTheme();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // notes — stored as HTML, synced as markdown to sessions.notes
  const [notesHtml, setNotesHtml] = useState('');
  const [saveState, setSaveState] = useState('idle'); // 'idle'|'saving'|'saved'
  const notesTimer = useRef(null);

  const sessionFolderIdRef = useRef(null);
  // SessionDetail — correct location, alongside other refs

  // plan steps
  const [steps, setSteps] = useState([]);
  const [stepsDone, setStepsDone] = useState(new Set());
  const [expandedStep, setExpandedStep] = useState(null);
  // REMOVE useState for currentStep entirely. Replace with a derived constant
  // computed fresh on every render, placed just before the steps.map() call:
  const currentStep = steps.findIndex((s, i) => !stepsDone.has(s.id ?? i));
  // currentStep === -1 means all steps are done
  const [activeStepId, setActiveStepId] = useState(null); // which step is "begun"
  const [stepStartedAt, setStepStartedAt] = useState(null); // wall-clock ms when begun
  const stepStartTimeRef = useRef(null); // kept for MIN_STEP_MS guard, now set on Begin not expand

  const [, setTickNow] = useState(0); // dummy state to drive re-renders for step progress

  // completion
  const [completing, setCompleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loggedMins, setLoggedMins] = useState(0);

  // Session lifecycle: 'idle' | 'running' | 'paused' | 'completed'
  const [sessionState, setSessionState] = useState(() => {
    // Hydrate from timer localStorage so UI is correct on first render
    try {
      const saved = JSON.parse(localStorage.getItem(`timer_${id}`) || 'null'); // id from useParams above
      if (saved?.running && !saved?.done) return 'running';
      if (saved?.done) return 'paused';
    } catch {}
    return 'idle';
  });

  const sessionRef = useRef(null);

  // Keep it updated whenever session changes:
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Request notification permission once when the session page loads
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Tick every second while a step is active to update progress bar
  useEffect(() => {
    if (activeStepId === null) return;
    const interval = setInterval(() => {
      setTickNow(Date.now()); // just trigger re-render
    }, 1000);
    return () => clearInterval(interval);
  }, [activeStepId]);

  /* ── fetch ── */
  const fetchSession = useCallback(async () => {
    if (!supabase || !id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setSession(data);
    // Grab the permanent Session Notes folder ID for this user
    const pfCacheKey = `pf_${user?.id}___permanent_session_notes__`;
    const sessionFolderId = localStorage.getItem(pfCacheKey);
    // Store it in a ref so saveNotes can access it
    sessionFolderIdRef.current = sessionFolderId;

    setNotesHtml(data.notes_html || data.notes || '');
    // parse AI plan steps
    if (data.ai_plan?.steps) {
      setSteps(data.ai_plan.steps);
    }
    // Restore persisted step progress
    if (data.ai_plan?.steps_done) {
      setStepsDone(new Set(data.ai_plan.steps_done));
      // Restore currentStep to first incomplete
      const firstIncomplete = data.ai_plan.steps.findIndex(
        (s, i) => !data.ai_plan.steps_done.includes(s.id ?? i),
      );
      // setCurrentStep(
      //   firstIncomplete === -1
      //     ? data.ai_plan.steps.length - 1
      //     : firstIncomplete,
      // );
    }

    // Restore active step if session was mid-step
    if (data.ai_plan?.active_step_id != null) {
      setActiveStepId(data.ai_plan.active_step_id);

      if (data.ai_plan.step_started_at) {
        setStepStartedAt(data.ai_plan.step_started_at);
        stepStartTimeRef.current = data.ai_plan.step_started_at;
      }
    }

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    if (!dbLoading) fetchSession();
  }, [dbLoading, fetchSession]);

  // useEffect(() => {
  //   const handler = () => {
  //     if (
  //       stepStartTimeRef.current !== null &&
  //       stepStartTimeRef.current < 1e10
  //     ) {
  //       // Both ref and state hold a frozen duration — convert back to an anchored timestamp
  //       const reanchored = Date.now() - stepStartTimeRef.current;
  //       stepStartTimeRef.current = reanchored;
  //       setStepStartedAt(reanchored);
  //     }
  //   };
  //   window.addEventListener('session:timerresumed', handler);
  //   return () => window.removeEventListener('session:timerresumed', handler);
  // }, []); // no deps needed — reads from ref, sets state directly

  const saveNotes = useCallback(
    async (html) => {
      if (!supabase || !id) return;
      const markdown = htmlToMarkdown(html);
      const { error } = await supabase
        .from('sessions')
        .update({ notes: markdown, notes_html: html })
        .eq('id', id);
      if (!error) {
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2200);
        if (markdown && user?.id && session) {
          const noteTitle = `${session.title || 'Session'} — Notes`;
          const { data: existing } = await supabase
            .from('user_notes')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', noteTitle)
            .maybeSingle();
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
          if (existing?.id) {
            await supabase
              .from('user_notes')
              .update({
                content: noteContent,
                collection_id: sessionFolderIdRef.current || null,
                word_count: markdown.split(/\s+/).filter(Boolean).length,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('user_notes').insert({
              user_id: user.id,
              title: noteTitle,
              subject: session.subject || 'Study Session',
              tags: [
                'session-note',
                session.focus_type?.toLowerCase().replace(' ', '-') ||
                  'session',
              ].filter(Boolean),
              content: noteContent,
              collection_id: sessionFolderIdRef.current || null,
              word_count: markdown.split(/\s+/).filter(Boolean).length,
            });
          }
          window.dispatchEvent(new CustomEvent('notes:updated'));
        }
      }
    },
    [supabase, id, user, session],
  );

  /* ── notes autosave ── */
  const handleNotesChange = useCallback(
    (html) => {
      setNotesHtml(html);
      setSaveState('saving');
      clearTimeout(notesTimer.current);
      notesTimer.current = setTimeout(() => saveNotes(html), 900);
    },
    [saveNotes],
  );
  /* ── edit session ── */
  const startEdit = () => {
    setEditDraft({
      title: session.title || '',
      subject: session.subject || '',
      goal: session.goal || '',
      focus_type: session.focus_type || '',
      difficulty: session.difficulty || '',
    });
    setEditing(true);
  };

  const commitEdit = async () => {
    setSavingEdit(true);
    const { error } = await supabase
      .from('sessions')
      .update(editDraft)
      .eq('id', id);
    if (!error) {
      setSession((s) => ({ ...s, ...editDraft }));
      setEditing(false);
    }
    setSavingEdit(false);
  };

  // Then in toggleStep:
  const toggleStep = useCallback(
    (stepId) => {
      setStepsDone((prev) => {
        const n = new Set(prev);
        n.has(stepId) ? n.delete(stepId) : n.add(stepId);
        const doneArr = Array.from(n);
        const currentAiPlan = sessionRef.current?.ai_plan || {};
        supabase
          .from('sessions')
          .update({
            ai_plan: { ...currentAiPlan, steps_done: doneArr },
          })
          .eq('id', id)
          .then(() => {});
        return n;
      });
    },
    [supabase, id], // removed `session` from deps
  );

  /* ── log focus time ── */
  const logFocusTime = useCallback(
    async (mins, interrupted = false) => {
      if (!supabase || !user || mins < 1) return;
      setLoggedMins(mins);
      await supabase.from('focus_logs').insert({
        session_id: id,
        user_id: user.id,
        duration: mins,
        completed: false,
        state: interrupted ? 'interrupted' : 'focused',
        started_at: new Date(Date.now() - mins * 60000).toISOString(),
        ended_at: new Date().toISOString(),
      });
    },
    [supabase, user, id],
  );

  const handleStateChange = useCallback((state) => {
    setSessionState(state);
  }, []);

  const handleTimerDone = useCallback(
    (mins) => {
      logFocusTime(mins);
      setSessionState('paused');
      // Fire browser notification so user knows timer is done even on another tab
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Focus session complete! 🎯', {
          body: `You focused for ${fmtMins(mins)}. Head back to mark your session done.`,
          icon: '/favicon.ico',
          tag: 'focus-timer-done', // prevents duplicate notifications
        });
      }
    },
    [logFocusTime],
  );
  /* ── complete session ── */
  const handleComplete = async () => {
    if (!supabase || completing) return;

    const newVal = !session.completed;

    // Validate before marking complete
    if (newVal) {
      const hasTime = loggedMins > 0 || sessionState === 'paused';
      // Fixed — derive it inline
      const allStepsDone =
        steps.length > 0 ? stepsDone.size === steps.length : true;

      // If all steps are explicitly done, allow completion regardless of time logged
      if (allStepsDone) {
        // fall through — no blocking condition applies
      } else {
        if (!hasTime && !allStepsDone) {
          return;
        }
        const minTimeThreshold = (session.duration || 25) * 0.5;
        if (loggedMins > 0 && loggedMins < minTimeThreshold && !allStepsDone) {
          return;
        }
      }
    }

    setCompleting(true);
    // ... rest unchanged

    // Update sessions table
    const { error: e1 } = await supabase
      .from('sessions')
      .update({ completed: newVal })
      .eq('id', id);
    if (e1) {
      setCompleting(false);
      return;
    }

    if (newVal) {
      // Insert completion log
      await supabase.from('focus_logs').insert({
        session_id: id,
        user_id: user?.id,
        completed: true,
        duration: session.duration || 0,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      });
      setShowSuccess(true);
    } else {
      // Remove completion logs
      await supabase
        .from('focus_logs')
        .delete()
        .eq('session_id', id)
        .eq('completed', true);
    }

    setSession((s) => ({ ...s, completed: newVal }));
    setCompleting(false);
  };

  /* ── render ── */
  if (loading || dbLoading)
    return (
      <>
        <style>{CSS}</style>
        <div className="sd">
          <div className="grain" />
          <div className="sd-bg">
            <div className="sd-orb sd-orb1" />
            <div className="sd-orb sd-orb2" />
          </div>
          <AppNavbar />
          <div className="sd-wrap">
            <div className="sd-topbar">
              <button className="sd-back" onClick={() => navigate('/sessions')}>
                <ArrowLeft size={12} /> Sessions
              </button>
              <button className="sd-tt" onClick={toggleTheme}>
                <div className="sd-tt-track">
                  <div className="sd-tt-thumb" />
                </div>
                {theme === 'dark' ? (
                  <>
                    <Moon size={11} />
                    Dark
                  </>
                ) : (
                  <>
                    <Sun size={11} />
                    Light
                  </>
                )}
              </button>
            </div>
            <div className="sd-loading">
              <div className="sd-loading-orb" />
              <span
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: '.65rem',
                  color: 'var(--ink3)',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                }}
              >
                Loading session…
              </span>
            </div>
          </div>
        </div>
      </>
    );

  if (notFound)
    return (
      <>
        <style>{CSS}</style>
        <div className="sd">
          <div className="grain" />
          <div className="sd-bg">
            <div className="sd-orb sd-orb1" />
            <div className="sd-orb sd-orb2" />
          </div>
          <AppNavbar />
          <div className="sd-wrap">
            <div className="sd-topbar">
              <button className="sd-back" onClick={() => navigate('/sessions')}>
                <ArrowLeft size={12} /> Sessions
              </button>
              <button className="sd-tt" onClick={toggleTheme}>
                <div className="sd-tt-track">
                  <div className="sd-tt-thumb" />
                </div>
                {theme === 'dark' ? (
                  <>
                    <Moon size={11} />
                    Dark
                  </>
                ) : (
                  <>
                    <Sun size={11} />
                    Light
                  </>
                )}
              </button>
            </div>
            <div className="sd-err">
              <div className="sd-err-title">Session not found</div>
              <div className="sd-err-sub">
                This session may have been deleted or you don't have access.
              </div>
              <button
                className="btn btn-gold"
                style={{ marginTop: 20 }}
                onClick={() => navigate('/sessions')}
              >
                Back to Sessions
              </button>
            </div>
          </div>
        </div>
      </>
    );

  const plan = session.ai_plan || {};
  const hasPlan = steps.length > 0;
  const doneCount = stepsDone.size;
  const diffColor = getDiffColor(session.difficulty);

  return (
    <>
      <style>{CSS}</style>
      <div className="sd">
        <div className="grain" />
        <div className="sd-bg">
          <div className="sd-orb sd-orb1" />
          <div className="sd-orb sd-orb2" />
        </div>
        <AppNavbar />

        <div className="sd-wrap">
          {/* ── TOPBAR: back + theme toggle ── */}
          <div className="sd-topbar">
            <button className="sd-back" onClick={() => navigate('/sessions')}>
              <ArrowLeft size={12} /> Sessions
            </button>
          </div>

          {/* ── HEADER ── */}
          <div className="sd-head">
            <div className="sd-tag">
              <BookOpen size={11} />
              {session.focus_type || 'Study Session'}
            </div>
            <div className="sd-title-row">
              <div style={{ flex: 1 }}>
                {editing ? (
                  <input
                    className="sd-title-input"
                    value={editDraft.title}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, title: e.target.value }))
                    }
                    autoFocus
                  />
                ) : (
                  <h1 className="sd-title">{session.title}</h1>
                )}
                <div className="sd-meta-chips">
                  {session.subject && (
                    <span className="meta-chip">
                      <BookOpen size={10} />
                      {session.subject}
                    </span>
                  )}
                  {session.difficulty && (
                    <span
                      className="meta-chip"
                      style={{
                        color: diffColor,
                        borderColor: `${diffColor}40`,
                      }}
                    >
                      {DIFF_GLYPH[session.difficulty]}{' '}
                      {capFirst(session.difficulty)}
                    </span>
                  )}
                  {session.duration && (
                    <span className="meta-chip">
                      <Clock size={10} />
                      {fmtMins(session.duration)}
                    </span>
                  )}
                  {session.date && (
                    <span className="meta-chip">
                      <Calendar size={10} />
                      {new Date(session.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  {session.completed && (
                    <span
                      className="meta-chip"
                      style={{
                        color: 'var(--green)',
                        borderColor: 'rgba(107,158,107,.3)',
                      }}
                    >
                      <CheckCircle2 size={10} /> Completed
                    </span>
                  )}
                </div>
              </div>
              <div className="sd-head-actions">
                {editing ? (
                  <>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditing(false)}
                    >
                      <X size={13} />
                      Cancel
                    </button>
                    <button
                      className="btn btn-gold"
                      onClick={commitEdit}
                      disabled={savingEdit}
                    >
                      {savingEdit ? (
                        'Saving…'
                      ) : (
                        <>
                          <Check size={13} />
                          Save
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-outline"
                      onClick={startEdit}
                      disabled={sessionState === 'running'}
                      title={
                        sessionState === 'running'
                          ? 'Pause session before editing'
                          : undefined
                      }
                    >
                      <Edit2 size={13} />
                      Edit
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => navigate('/sessions')}
                    >
                      <ArrowLeft size={13} />
                      Back
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── EDIT FIELDS ── */}
          {editing && (
            <div className="card anim-up" style={{ marginBottom: 20 }}>
              <div className="card-head">
                <span className="card-head-label">
                  <Edit2 size={11} /> Edit Session
                </span>
              </div>
              <div className="card-body">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 14,
                  }}
                >
                  {[
                    { k: 'subject', l: 'Subject' },
                    { k: 'goal', l: 'Goal' },
                    { k: 'focus_type', l: 'Focus Type' },
                    { k: 'difficulty', l: 'Difficulty' },
                  ].map(({ k, l }) => (
                    <div key={k} className="edit-field">
                      <div className="edit-label">{l}</div>
                      <input
                        className="edit-input edit-input-sm"
                        value={editDraft[k] || ''}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, [k]: e.target.value }))
                        }
                        placeholder={l}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 2-COL LAYOUT ── */}
          <div className="sd-layout">
            {/* LEFT */}
            <div>
              {/* TIMER */}
              <FocusTimer
                durationMins={session.duration || 25}
                onLog={logFocusTime}
                sessionState={sessionState}
                sessionId={id}
                onStateChange={handleStateChange}
                onTimerDone={handleTimerDone}
              />

              {/* PLAN / STEPS */}
              {hasPlan && (
                <div className="card anim-up1">
                  <div className="card-head">
                    <span className="card-head-label">
                      <Layers size={11} /> Study Plan
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.58rem',
                        color: 'var(--ink3)',
                      }}
                    >
                      {doneCount}/{steps.length} steps
                    </span>
                  </div>
                  <div className="card-body">
                    {/* plan summary */}
                    {plan.summary && (
                      <p
                        style={{
                          fontFamily: 'var(--f-ui)',
                          fontSize: '.82rem',
                          color: 'var(--ink2)',
                          lineHeight: 1.65,
                          fontStyle: 'italic',
                          marginBottom: 14,
                          paddingBottom: 14,
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {plan.summary}
                      </p>
                    )}

                    {/* progress bar */}
                    <div className="plan-progress">
                      <div
                        className="plan-progress-fill"
                        style={{
                          width: `${(doneCount / steps.length) * 100}%`,
                        }}
                      />
                    </div>

                    {/* steps */}
                    {steps.map((step, idx) => {
                      const stepId = step.id ?? idx; // normalize FIRST

                      const isDone = stepsDone.has(stepId);
                      const isCurrent = idx === currentStep && !isDone;
                      const isExpanded = expandedStep === stepId;
                      const isActive = activeStepId === stepId;
                      const stepElapsedMs =
                        isActive && stepStartedAt
                          ? Date.now() - stepStartedAt
                          : 0;

                      const stepTotalMs = (step.time || 0) * 60 * 1000;

                      const stepProgress =
                        stepTotalMs > 0
                          ? Math.min(1, stepElapsedMs / stepTotalMs)
                          : 0;
                      return (
                        <div
                          key={step.id}
                          className={`step-item${isCurrent ? ' current' : ''}${isDone ? ' completed' : ''}`}
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <div
                            className="step-item-head"
                            onClick={() => {
                              if (
                                activeStepId !== null &&
                                stepId !== activeStepId
                              )
                                return;

                              const effectiveCurrent =
                                currentStep === -1 ? steps.length : currentStep;

                              if (!isDone && idx > effectiveCurrent) return;

                              setExpandedStep(isExpanded ? null : stepId);
                            }}
                            style={{
                              ...(isActive ? { position: 'relative' } : {}),

                              cursor:
                                (activeStepId !== null &&
                                  stepId !== activeStepId) ||
                                (!isDone &&
                                  idx >
                                    (currentStep === -1
                                      ? steps.length
                                      : currentStep))
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                          >
                            <div
                              className={`step-num${isCurrent ? ' current' : ''}${isDone ? ' done' : ''}`}
                            >
                              {isDone ? <Check size={10} /> : idx + 1}
                            </div>
                            <span
                              className={`step-item-title${isDone ? ' done' : ''}`}
                            >
                              {step.title}
                            </span>
                            {step.time > 0 && (
                              <span className="step-badge">
                                <Clock size={9} />
                                {step.time}m
                              </span>
                            )}
                            <span
                              className="step-expand-ico"
                              style={{
                                transform: isExpanded
                                  ? 'rotate(180deg)'
                                  : 'none',
                              }}
                            >
                              <ChevronDown size={13} />
                            </span>

                            {isActive && stepTotalMs > 0 && !isExpanded && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: 2,
                                  background: 'var(--border)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    background: 'var(--gold)',
                                    width: `${stepProgress * 100}%`,
                                    transition: 'width 1s linear',
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="step-item-body">
                              {step.description && (
                                <p className="step-desc">{step.description}</p>
                              )}
                              {step.key_concepts?.length > 0 && (
                                <div className="step-concepts">
                                  {step.key_concepts.map((c, i) => (
                                    <span key={i} className="concept">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Per-step progress bar — only when active and step has a time budget */}
                              {isActive && stepTotalMs > 0 && (
                                <div
                                  style={{
                                    height: 2,
                                    background: 'var(--border)',
                                    borderRadius: 2,
                                    margin: '10px 0 4px',
                                    overflow: 'hidden',
                                    width: '100%',
                                  }}
                                >
                                  <div
                                    style={{
                                      height: '100%',
                                      background: 'var(--gold)',
                                      width: `${stepProgress * 100}%`,
                                      transition: 'width 1s linear',
                                    }}
                                  />
                                </div>
                              )}

                              <div className="step-item-actions">
                                <button
                                  className="btn btn-ghost"
                                  style={{
                                    fontSize: '.6rem',
                                    padding: '6px 10px',
                                  }}
                                  onClick={() => {
                                    setExpandedStep(Math.max(0, idx - 1));
                                  }}
                                >
                                  <ChevronUp size={11} /> Prev
                                </button>

                                {!isDone &&
                                  (currentStep === -1
                                    ? false
                                    : idx === currentStep) &&
                                  activeStepId !== stepId && (
                                    <button
                                      className="btn btn-gold"
                                      style={{
                                        fontSize: '.62rem',
                                        padding: '7px 14px',
                                      }}
                                      onClick={() => {
                                        const now = Date.now();
                                        setActiveStepId(stepId);
                                        setStepStartedAt(now);
                                        stepStartTimeRef.current = now;
                                        setExpandedStep(stepId); // ← keep step expanded so progress bar is visible
                                        const currentAiPlan =
                                          sessionRef.current?.ai_plan || {};
                                        supabase
                                          .from('sessions')
                                          .update({
                                            ai_plan: {
                                              ...currentAiPlan,
                                              active_step_id: stepId,
                                              step_started_at: now,
                                            },
                                          })
                                          .eq('id', id)
                                          .then(({ error }) => {
                                            if (error) {
                                              // DB write failed — roll back local active step state
                                              setActiveStepId(null);
                                              setStepStartedAt(null);
                                              stepStartTimeRef.current = null;
                                            }
                                          });
                                        if (sessionState !== 'running') {
                                          window.dispatchEvent(
                                            new CustomEvent(
                                              'session:beginstep',
                                            ),
                                          );
                                        }
                                      }}
                                    >
                                      <Play size={12} /> Begin Step
                                    </button>
                                  )}

                                {!isDone && isActive && (
                                  <button
                                    className="btn btn-green"
                                    style={{
                                      fontSize: '.62rem',
                                      padding: '7px 14px',
                                    }}
                                    onClick={() => {
                                      // Issue 5: must be current step AND actively started
                                      if (
                                        currentStep === -1 ||
                                        idx !== currentStep ||
                                        !isActive
                                      )
                                        return;

                                      // Issue 6: no valid start time = cannot validate duration
                                      if (!stepStartedAt) return;

                                      // Issue 2: always derive elapsed from stepStartedAt state, never the ref
                                      const spent = Date.now() - stepStartedAt;

                                      // Issue 1 + 3: dynamic 40% requirement with fallback for steps with no time budget
                                      const REQUIRED_RATIO = 0.4;
                                      const MIN_FALLBACK_MS = 10_000;
                                      const stepTotalMs =
                                        (step.time || 0) * 60 * 1000;
                                      const requiredMs =
                                        stepTotalMs > 0
                                          ? stepTotalMs * REQUIRED_RATIO
                                          : MIN_FALLBACK_MS;
                                      if (spent < requiredMs) return;

                                      // Issue 4: single consistent clearing flow — update ref first so
                                      // toggleStep's closure reads the already-cleared ai_plan
                                      const currentAiPlan =
                                        sessionRef.current?.ai_plan || {};
                                      const clearedPlan = {
                                        ...currentAiPlan,
                                        active_step_id: null,
                                        step_started_at: null,
                                      };
                                      sessionRef.current = {
                                        ...sessionRef.current,
                                        ai_plan: clearedPlan,
                                      };

                                      // toggleStep handles the single DB write with the cleared ai_plan
                                      toggleStep(stepId);

                                      // Clear local state exactly once
                                      setActiveStepId(null);
                                      setStepStartedAt(null);
                                      stepStartTimeRef.current = null;
                                      setExpandedStep(null);
                                    }}
                                  >
                                    <Check size={12} /> Done
                                  </button>
                                )}

                                {isDone && activeStepId === null && (
                                  <button
                                    className="btn btn-outline"
                                    style={{
                                      fontSize: '.62rem',
                                      padding: '7px 14px',
                                    }}
                                    onClick={() => {
                                      toggleStep(stepId);
                                      // setCurrentStep(idx);
                                    }}
                                  >
                                    <Circle size={12} /> Undo
                                  </button>
                                )}

                                {idx < steps.length - 1 && isDone && (
                                  <button
                                    className="btn btn-ghost"
                                    style={{
                                      fontSize: '.6rem',
                                      padding: '6px 10px',
                                    }}
                                    onClick={() => {
                                      setExpandedStep(idx + 1);
                                    }}
                                  >
                                    Next <ChevronDown size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NOTES */}
              <div className="anim-up2">
                <SessionNotesEditor
                  value={notesHtml}
                  onChange={handleNotesChange}
                  saveState={saveState}
                  placeholder="Jot down thoughts, questions, key takeaways… (type / for commands)"
                  minHeight={220}
                />
              </div>
            </div>

            {/* SIDEBAR */}
            <div className="sidebar">
              {/* COMPLETE CTA */}
              <div
                className={`complete-card${session.completed ? ' done' : ''}`}
              >
                {session.completed ? (
                  <CheckCircle2 size={28} color="var(--green)" />
                ) : (
                  <Target size={28} color="var(--ink3)" />
                )}
                <div className="complete-title">
                  {session.completed ? 'Session Complete!' : 'Ready to Begin?'}
                </div>
                <p className="complete-sub">
                  {session.completed
                    ? 'Great work. You can unmark this session to redo it.'
                    : 'Start the timer and work through your plan step by step.'}
                </p>
                <button
                  className={`btn ${session.completed ? 'btn-outline' : 'btn-green'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleComplete}
                  disabled={completing}
                >
                  {completing ? (
                    'Saving…'
                  ) : session.completed ? (
                    <>
                      <Circle size={13} />
                      Mark Incomplete
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      Mark Complete
                    </>
                  )}
                </button>
              </div>

              {/* INFO */}
              <div className="card">
                <div className="card-head">
                  <span className="card-head-label">
                    <BarChart2 size={11} /> Details
                  </span>
                </div>
                <div className="card-body">
                  <div className="info-row">
                    {[
                      {
                        icon: BookOpen,
                        label: 'Subject',
                        val: session.subject || '—',
                      },
                      { icon: Target, label: 'Goal', val: session.goal || '—' },
                      {
                        icon: Flame,
                        label: 'Difficulty',
                        val: capFirst(session.difficulty || '—'),
                        color: diffColor,
                      },
                      {
                        icon: Zap,
                        label: 'Focus Type',
                        val: session.focus_type || '—',
                      },
                      {
                        icon: Clock,
                        label: 'Duration',
                        val: fmtMins(session.duration),
                      },
                      {
                        icon: Calendar,
                        label: 'Date',
                        val: session.date
                          ? new Date(session.date).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—',
                      },
                    ].map(({ icon: Icon, label, val, color }) => (
                      <div key={label} className="info-item">
                        <div className="info-icon">
                          <Icon size={13} strokeWidth={1.6} />
                        </div>
                        <div>
                          <div className="info-label">{label}</div>
                          <div
                            className="info-val"
                            style={color ? { color } : {}}
                          >
                            {val}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI TIPS */}
              {plan.tips?.length > 0 && (
                <div className="tips-card">
                  <div className="tips-title">
                    <Sparkles size={10} /> Study Tips
                  </div>
                  {plan.tips.map((t, i) => (
                    <div key={i} className="tip-row">
                      <ChevronRight size={11} className="tip-arrow" />
                      {t}
                    </div>
                  ))}
                </div>
              )}

              {/* PROGRESS */}
              {hasPlan && (
                <div className="card">
                  <div className="card-head">
                    <span className="card-head-label">
                      <Award size={11} /> Progress
                    </span>
                  </div>
                  <div className="card-body">
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--f-mono)',
                            fontSize: '.6rem',
                            color: 'var(--ink3)',
                            letterSpacing: '.08em',
                          }}
                        >
                          Steps done
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--f-display)',
                            fontSize: '1.4rem',
                            fontWeight: 300,
                            color: 'var(--gold)',
                          }}
                        >
                          {doneCount}/{steps.length}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 4,
                          background: 'var(--border)',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            background:
                              'linear-gradient(90deg,var(--gold),var(--green))',
                            borderRadius: 2,
                            width: `${(doneCount / steps.length) * 100}%`,
                            transition: 'width .5s var(--ease)',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--f-mono)',
                          fontSize: '.57rem',
                          color: 'var(--ink3)',
                          marginTop: 2,
                        }}
                      >
                        {steps.length - doneCount} remaining
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SUCCESS OVERLAY ── */}
        {showSuccess && (
          <div className="overlay" onClick={() => setShowSuccess(false)}>
            <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
              <div className="ov-icon">
                <Award size={30} />
              </div>
              <div className="ov-title">Session Complete!</div>
              <p className="ov-sub">
                You finished <strong>{session.title}</strong>. Excellent focus
                work — keep the momentum going.
              </p>
              {loggedMins > 0 && (
                <div className="ov-stats">
                  <div className="ov-stat">
                    <div className="ov-stat-val">{fmtMins(loggedMins)}</div>
                    <div className="ov-stat-label">Focus Time</div>
                  </div>
                  {hasPlan && (
                    <div className="ov-stat">
                      <div className="ov-stat-val">
                        {doneCount}/{steps.length}
                      </div>
                      <div className="ov-stat-label">Steps Done</div>
                    </div>
                  )}
                </div>
              )}
              <div className="ov-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setShowSuccess(false);
                    navigate('/sessions');
                  }}
                >
                  View All Sessions
                </button>
                <button
                  className="btn btn-gold"
                  onClick={() => {
                    setShowSuccess(false);
                    navigate('/create-session');
                  }}
                >
                  New Session <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
