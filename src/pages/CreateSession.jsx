/**
 * CreateSession.jsx  — Awwwards-level redesign
 *
 * DB schema used (public.sessions):
 *   id, user_id, title, subject, goal, notes,
 *   duration (int4), difficulty (text), date (date),
 *   focus_type (text), ai_plan (jsonb),
 *   is_completed (bool), completed (bool),
 *   created_at, updated_at
 *
 * Max 3 components:
 *   1. CreateSessionPage   — orchestrator
 *   2. SessionForm         — step 1 details
 *   3. PlanBuilder         — step 2 plan (ai + manual)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import AppNavbar from '../components/app/AppNavbar';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  BookOpen,
  Clock,
  Target,
  AlignLeft,
  Loader2,
  CheckCircle2,
  Brain,
  RefreshCw,
  Save,
  Zap,
  BarChart2,
  Calendar,
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  Copy,
  Timer,
  Layers,
  Coffee,
  PenLine,
  Dumbbell,
  Search,
  ChevronRight,
  Flame,
  Sun,
  Moon,
} from 'lucide-react';
import SessionNotesEditor, {
  htmlToMarkdown,
} from '../components/SessionNotesEditor';

/* ═══════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════ */
const FOCUS_TYPES = [
  'Deep Work',
  'Revision',
  'Practice',
  'Reading',
  'Writing',
  'Problem Solving',
  'Research',
  'Creative',
];
const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', glyph: '◎' },
  { value: 'medium', label: 'Medium', glyph: '◈' },
  { value: 'hard', label: 'Hard', glyph: '◉' },
];
const DURATION_PRESETS = [25, 45, 60, 90, 120];

const STEP_TEMPLATES = [
  {
    icon: Coffee,
    label: 'Pomodoro',
    steps: [
      {
        title: 'Focus Sprint',
        time: 25,
        description: 'Deep focus block — single task only.',
        key_concepts: [],
      },
      {
        title: 'Short Break',
        time: 5,
        description: 'Step away, breathe, reset.',
        key_concepts: [],
      },
    ],
  },
  {
    icon: Layers,
    label: 'Review',
    steps: [
      {
        title: 'Active Recall',
        time: 15,
        description: 'Test yourself without notes.',
        key_concepts: [],
      },
      {
        title: 'Gap Analysis',
        time: 10,
        description: 'Identify and note what you missed.',
        key_concepts: [],
      },
      {
        title: 'Re-read Notes',
        time: 15,
        description: 'Fill gaps from source material.',
        key_concepts: [],
      },
    ],
  },
  {
    icon: Dumbbell,
    label: 'Practice',
    steps: [
      {
        title: 'Warm-up',
        time: 10,
        description: 'Easy problems to get in the zone.',
        key_concepts: [],
      },
      {
        title: 'Core Practice',
        time: 30,
        description: 'Main problem set — push yourself.',
        key_concepts: [],
      },
      {
        title: 'Review',
        time: 10,
        description: 'Check answers, note mistakes.',
        key_concepts: [],
      },
    ],
  },
  {
    icon: Search,
    label: 'Research',
    steps: [
      {
        title: 'Question Set',
        time: 10,
        description: 'Write down what you need to find.',
        key_concepts: [],
      },
      {
        title: 'Explore',
        time: 25,
        description: 'Find and read sources.',
        key_concepts: [],
      },
      {
        title: 'Synthesise',
        time: 15,
        description: 'Write key findings in your own words.',
        key_concepts: [],
      },
    ],
  },
];

const mkStep = (overrides = {}) => ({
  id: crypto.randomUUID(),
  title: '',
  time: 15,
  description: '',
  key_concepts: [],
  ...overrides,
});

const EMPTY_PLAN = { summary: '', tips: [], steps: [] };

/* ═══════════════════════════════════════════
   AI SERVICE
═══════════════════════════════════════════ */
async function callAI(form) {
  const n = `${Math.ceil(form.duration / 25)}–${Math.ceil(form.duration / 15)}`;
  const prompt = `You are an expert study coach. Generate a structured study plan.

Session details:
- Title: ${form.title}
- Subject: ${form.subject}
- Focus type: ${form.focus_type || 'General'}
- Duration: ${form.duration} minutes
- Difficulty: ${form.difficulty}
- Goal: ${form.goal || 'General understanding'}
- Notes: ${form.notes || 'None'}

Return ONLY valid JSON (no markdown, no backticks):
{
  "summary": "2-sentence motivational overview",
  "tips": ["tip1","tip2","tip3"],
  "steps": [
    { "id":"uid", "title":"Step title", "time":15,
      "description":"Concrete action for this step",
      "key_concepts":["concept1","concept2"] }
  ]
}

Create ${n} steps totalling ${form.duration} minutes. Be specific and actionable.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const raw = (data.content || [])
    .map((b) => b.text || '')
    .join('')
    .trim();
  const clean = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Could not parse AI response.');
  }
  return {
    summary: parsed.summary || '',
    tips: Array.isArray(parsed.tips) ? parsed.tips : [],
    steps: (Array.isArray(parsed.steps) ? parsed.steps : []).map((s) => ({
      id: s.id || crypto.randomUUID(),
      title: s.title || '',
      time: Number(s.time) || 15,
      description: s.description || '',
      key_concepts: Array.isArray(s.key_concepts) ? s.key_concepts : [],
    })),
  };
}

/* ═══════════════════════════════════════════
   GLOBAL CSS
═══════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

/* ══ LIGHT (default) ══ */
:root {
  color-scheme: light;
  --bg:#faf8f3; --surface:#ffffff; --surface2:#f5f0e6; --surface3:#ede7d8;
  --border:#e2d8c8; --border2:#cfc3ae;
  --ink:#1e1a14; --ink2:#5a4f3e; --ink3:#9c8e7a;
  --gold:#a8751e; --gold2:#c9943a; --gold3:rgba(168,117,30,.12);
  --red:#a83a30; --green:#3a7a3a; --blue:#3a5a80;
  --orb1:#e8d5a8; --orb2:#b8c0e0; --orb-op:.45;
  --sh:0 2px 12px rgba(30,26,20,.06); --sh-h:0 10px 40px rgba(30,26,20,.14);
  --f-display:'Cormorant Garamond',Georgia,serif;
  --f-ui:'Cabinet Grotesk',sans-serif;
  --f-mono:'JetBrains Mono',monospace;
  --ease:cubic-bezier(.16,1,.3,1);
  --spring:cubic-bezier(.34,1.56,.64,1);
  --r:8px;
}
/* ══ DARK ══ */
html.dark {
  color-scheme: dark;
  --bg:#0c0b09; --surface:#131210; --surface2:#1a1815; --surface3:#222019;
  --border:#2a2722; --border2:#35312b;
  --ink:#f0ead8; --ink2:#a89880; --ink3:#6b5f4e;
  --gold:#c9a84c; --gold2:#e8c97a; --gold3:rgba(201,168,76,.12);
  --red:#c0544a; --green:#6b9e6b; --blue:#4a7ca0;
  --orb1:#c9a84c; --orb2:#4a5a9a; --orb-op:.06;
  --sh:0 2px 12px rgba(0,0,0,.3); --sh-h:0 14px 44px rgba(0,0,0,.55);
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── GRAIN ── */
.grain{pointer-events:none;position:fixed;inset:0;z-index:999;opacity:.018;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
html.dark .grain{opacity:.038;mix-blend-mode:screen}

/* ── THEME TOGGLE ── */
.cs-theme-toggle{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border-radius:22px;
  border:1px solid var(--border2);background:var(--surface2);cursor:pointer;
  font-family:var(--f-mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink2);transition:all .3s var(--ease);margin-bottom:12px;user-select:none}
.cs-theme-toggle:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3)}
.cs-tt-track{width:30px;height:17px;border-radius:9px;background:var(--surface3);position:relative;
  flex-shrink:0;border:1.5px solid var(--border2);transition:background .35s,border-color .35s}
html.dark .cs-tt-track{background:var(--gold);border-color:var(--gold)}
.cs-tt-thumb{position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;
  background:var(--ink3);box-shadow:0 1px 4px rgba(0,0,0,.2);
  transition:transform .35s var(--spring),background .3s}
html.dark .cs-tt-thumb{transform:translateX(13px);background:#fff}

/* ── PAGE ── */
.cs{min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--f-ui);position:relative;overflow-x:hidden;transition:background .4s,color .3s}

/* background constellation */
.cs-bg{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.cs-bg-orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:var(--orb-op);transition:opacity .5s,background .5s}
.cs-bg-orb1{width:600px;height:600px;background:var(--orb1);top:-200px;right:-100px}
.cs-bg-orb2{width:400px;height:400px;background:var(--orb2);bottom:-100px;left:-80px}

.cs-wrap{max-width:800px;margin:0 auto;padding:32px 28px 120px;position:relative;z-index:1}
@media(max-width:640px){.cs-wrap{padding:20px 16px 100px}}

/* ── BACK ── */
.cs-back{display:inline-flex;align-items:center;gap:6px;font-family:var(--f-mono);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);background:none;border:none;cursor:pointer;padding:0;margin-bottom:40px;transition:color .2s}
.cs-back:hover{color:var(--gold)}

/* ── PROGRESS BAR ── */
.prog-rail{height:1px;background:var(--border);border-radius:1px;margin-bottom:48px;position:relative;overflow:visible}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:1px;transition:width .6s var(--ease)}
.prog-steps{display:flex;justify-content:space-between;position:absolute;top:-10px;left:0;right:0}
.prog-step{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:default}
.prog-dot{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);display:grid;place-items:center;font-family:var(--f-mono);font-size:.55rem;color:var(--ink3);transition:all .3s var(--ease)}
.prog-dot.active{border-color:var(--gold);background:var(--gold);color:var(--bg)}
.prog-dot.done{border-color:var(--green);background:var(--green);color:#fff}
.prog-label{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);white-space:nowrap;transition:color .3s}
.prog-step.active .prog-label{color:var(--gold)}
.prog-step.done .prog-label{color:var(--green)}

/* ── HERO ── */
.cs-hero{margin-bottom:36px}
.cs-hero-tag{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:14px}
.cs-hero-tag::before{content:'';display:block;width:28px;height:1px;background:currentColor;opacity:.5}
.cs-hero h1{font-family:var(--f-display);font-size:clamp(2.4rem,6vw,4rem);font-weight:300;letter-spacing:-.02em;line-height:1.05;color:var(--ink)}
.cs-hero h1 em{font-style:italic;color:var(--gold)}
.cs-hero p{font-family:var(--f-mono);font-size:.65rem;color:var(--ink3);letter-spacing:.06em;margin-top:10px;line-height:1.7}

/* ── CARD ── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--sh);transition:background .4s,border-color .4s}
.card-head{padding:22px 24px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
.card-head-title{font-family:var(--f-mono);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:7px}
.card-body{padding:24px}

/* ── FORM FIELDS ── */
.field{display:flex;flex-direction:column;gap:7px}
.field-label{font-family:var(--f-mono);font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:5px}
.field-req{color:var(--gold)}
.fgrid{display:grid;gap:16px}
.fgrid-2{grid-template-columns:1fr 1fr}
.fgrid-3{grid-template-columns:1fr 1fr 1fr}
@media(max-width:560px){.fgrid-2,.fgrid-3{grid-template-columns:1fr}}

input.fi,textarea.fi,select.fi{
  background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);
  padding:11px 14px;font-family:var(--f-ui);font-size:.9rem;color:var(--ink);
  outline:none;width:100%;transition:border-color .2s,box-shadow .2s,background .4s;
}
input.fi::placeholder,textarea.fi::placeholder{color:var(--ink3);font-style:italic}
input.fi:focus,textarea.fi:focus,select.fi:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold3)}
textarea.fi{resize:vertical;min-height:80px;line-height:1.65}
select.fi{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239c8e7a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
html.dark select.fi{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b5f4e' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")}
select.fi option{background:var(--surface2)}

/* ── CHIPS ── */
.chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.chip{font-family:var(--f-mono);font-size:.6rem;letter-spacing:.07em;padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--ink3);cursor:pointer;transition:all .15s;white-space:nowrap}
.chip:hover{border-color:var(--gold);color:var(--gold)}
.chip.active{background:var(--gold3);border-color:var(--gold);color:var(--gold)}

/* ── DIFFICULTY ── */
.diff-row{display:flex;gap:8px}
.diff-btn{flex:1;padding:10px 6px;border-radius:var(--r);border:1px solid var(--border2);background:transparent;font-family:var(--f-mono);font-size:.65rem;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;color:var(--ink3);transition:all .18s;display:flex;flex-direction:column;align-items:center;gap:3px}
.diff-btn .glyph{font-size:1rem;line-height:1}
.diff-btn:hover{border-color:var(--border2);color:var(--ink2)}
.diff-btn.easy.on{background:rgba(107,158,107,.1);border-color:var(--green);color:var(--green)}
.diff-btn.medium.on{background:var(--gold3);border-color:var(--gold);color:var(--gold)}
.diff-btn.hard.on{background:rgba(192,84,74,.1);border-color:var(--red);color:var(--red)}

/* ── SECTION DIVIDER ── */
.sdiv{display:flex;align-items:center;gap:10px;margin:6px 0 18px}
.sdiv-line{flex:1;height:1px;background:var(--border)}
.sdiv-label{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);white-space:nowrap}
.sdiv-glyph{font-size:.65rem;color:var(--gold);opacity:.5}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-size:.68rem;letter-spacing:.07em;padding:10px 20px;border-radius:var(--r);border:none;cursor:pointer;transition:all .2s;white-space:nowrap;text-transform:uppercase}
.btn:disabled{opacity:.4;cursor:not-allowed!important}
.btn-gold{background:var(--gold);color:#fff;font-weight:500}
.btn-gold:hover:not(:disabled){background:var(--gold2);transform:translateY(-1px);box-shadow:0 4px 20px var(--gold3)}
.btn-outline{background:transparent;border:1px solid var(--border2);color:var(--ink2)}
.btn-outline:hover:not(:disabled){border-color:var(--ink2);color:var(--ink);background:var(--surface2)}
.btn-ghost{background:transparent;border:none;color:var(--ink3);padding:8px 12px}
.btn-ghost:hover:not(:disabled){color:var(--ink)}
.btn-green{background:rgba(58,122,58,.12);border:1px solid var(--green);color:var(--green)}
html.dark .btn-green{background:rgba(107,158,107,.15)}
.btn-green:hover:not(:disabled){background:rgba(58,122,58,.2)}
html.dark .btn-green:hover:not(:disabled){background:rgba(107,158,107,.25)}
.btn-danger{background:transparent;border:1px solid transparent;color:var(--ink3)}
.btn-danger:hover:not(:disabled){border-color:var(--red);color:var(--red)}
.btn-icon{width:30px;height:30px;padding:0;border-radius:6px;background:transparent;border:1px solid var(--border);display:grid;place-items:center;cursor:pointer;color:var(--ink3);transition:all .15s;flex-shrink:0}
.btn-icon:hover:not(:disabled){border-color:var(--border2);color:var(--ink2)}
.btn-icon.gold:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}
.btn-icon.danger:hover:not(:disabled){border-color:var(--red);color:var(--red)}
.btn-icon:disabled{opacity:.3;cursor:not-allowed}

/* ── ERROR ── */
.err{background:rgba(192,84,74,.1);border:1px solid rgba(192,84,74,.3);border-radius:var(--r);padding:10px 14px;font-family:var(--f-mono);font-size:.65rem;color:var(--red);display:flex;align-items:center;gap:7px;margin-top:14px}

/* ── FORM ACTIONS ── */
.form-foot{display:flex;gap:10px;justify-content:flex-end;padding-top:8px;flex-wrap:wrap}

/* ══════════════════════
   MODE PICKER
══════════════════════ */
.mode-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
@media(max-width:480px){.mode-cards{grid-template-columns:1fr}}
.mode-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:26px 22px;cursor:pointer;transition:all .22s var(--spring);text-align:left;display:flex;flex-direction:column;gap:14px;position:relative;overflow:hidden}
.mode-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--gold3),transparent);opacity:0;transition:opacity .3s}
.mode-card:hover{border-color:var(--gold);transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.4)}
.mode-card:hover::before{opacity:1}
.mode-card-icon{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;position:relative;z-index:1}
.ai-card .mode-card-icon{background:linear-gradient(135deg,var(--gold),#a06020);color:var(--bg)}
.manual-card .mode-card-icon{background:var(--surface2);border:1px solid var(--border2);color:var(--ink2)}
.mode-card-title{font-family:var(--f-display);font-size:1.3rem;font-weight:400;color:var(--ink);position:relative;z-index:1}
.mode-card-desc{font-family:var(--f-mono);font-size:.6rem;color:var(--ink3);letter-spacing:.04em;line-height:1.7;position:relative;z-index:1}
.mode-card-badge{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:20px;align-self:flex-start;position:relative;z-index:1}
.ai-card .mode-card-badge{background:var(--gold3);color:var(--gold);border:1px solid rgba(201,168,76,.25)}
.manual-card .mode-card-badge{background:var(--surface2);color:var(--ink3);border:1px solid var(--border)}

/* ══════════════════════
   PLAN BUILDER
══════════════════════ */

/* time meter */
.time-meter{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px}
.tm-bar-wrap{flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
.tm-bar-fill{height:100%;border-radius:2px;transition:width .5s var(--ease),background .3s}
.tm-info{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0}
.tm-nums{font-family:var(--f-mono);font-size:.75rem;color:var(--ink);font-weight:500}
.tm-label{font-family:var(--f-mono);font-size:.55rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink3)}

/* AI header */
.ai-head{background:linear-gradient(135deg,#2c2010,#1e180c);border:1px solid rgba(168,117,30,.25);border-radius:12px 12px 0 0;padding:24px 26px;position:relative;overflow:hidden}
html.dark .ai-head{background:linear-gradient(135deg,#1a1508,#12100a);border-color:rgba(201,168,76,.2)}
.ai-head::after{content:'✦';position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:8rem;color:rgba(201,168,76,.04);font-family:var(--f-display);pointer-events:none;line-height:1}
.ai-head-badge{display:inline-flex;align-items:center;gap:5px;background:var(--gold);color:var(--bg);font-family:var(--f-mono);font-size:.55rem;letter-spacing:.12em;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:10px;font-weight:500}
.ai-head-title{font-family:var(--f-display);font-size:1.5rem;font-weight:300;color:var(--ink);position:relative;z-index:1}
.ai-summary-ta{background:rgba(255,255,255,.05);border:1px solid rgba(201,168,76,.15);border-radius:6px;padding:9px 13px;font-family:var(--f-ui);font-size:.82rem;color:rgba(240,234,216,.75);outline:none;width:100%;margin-top:10px;line-height:1.65;font-style:italic;resize:none;position:relative;z-index:1;transition:border-color .2s}
.ai-summary-ta:focus{border-color:rgba(201,168,76,.4)}
.ai-body{background:var(--surface);border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;padding:22px 24px}

/* manual header */
.manual-head{background:var(--surface);border:1px solid var(--border);border-radius:12px 12px 0 0;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px}
.mh-title{font-family:var(--f-display);font-size:1.2rem;font-weight:300;color:var(--ink)}
.mh-meta{font-family:var(--f-mono);font-size:.58rem;color:var(--ink3);letter-spacing:.06em;margin-top:3px}
.manual-body{background:var(--surface);border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;padding:20px 24px}

/* tips */
.tips{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 18px;margin-bottom:22px}
.tips-title{font-family:var(--f-mono);font-size:.57rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.tip-row{display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-family:var(--f-ui);font-size:.8rem;color:var(--ink2);line-height:1.55}
.tip-arrow{color:var(--gold);flex-shrink:0;margin-top:1px;opacity:.7}

/* templates */
.templates{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px}
.tpl-btn{display:inline-flex;align-items:center;gap:6px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.07em;padding:6px 13px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--ink3);cursor:pointer;transition:all .15s;text-transform:uppercase}
.tpl-btn:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3)}

/* step list */
.steps-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.steps-label{font-family:var(--f-mono);font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}

.step-card{border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:10px;transition:border-color .2s}
.step-card:hover{border-color:var(--border2)}
.step-view{padding:14px 16px;display:flex;align-items:flex-start;gap:12px;cursor:default}
.step-num{width:24px;height:24px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);display:grid;place-items:center;font-family:var(--f-mono);font-size:.58rem;color:var(--ink3);flex-shrink:0;margin-top:1px}
.step-content{flex:1;min-width:0}
.step-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.step-title{font-family:var(--f-ui);font-size:.9rem;font-weight:500;color:var(--ink);line-height:1.3}
.step-right{display:flex;align-items:center;gap:5px;flex-shrink:0}
.step-badge{display:inline-flex;align-items:center;gap:3px;font-family:var(--f-mono);font-size:.57rem;color:var(--ink3);background:var(--surface2);border:1px solid var(--border);padding:2px 7px;border-radius:20px;white-space:nowrap}
.step-desc{font-family:var(--f-ui);font-size:.8rem;color:var(--ink3);line-height:1.55;margin-top:5px}
.step-concepts{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
.concept-tag{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.06em;background:var(--gold3);border:1px solid rgba(201,168,76,.2);color:var(--gold);padding:2px 7px;border-radius:4px;text-transform:uppercase}

/* step edit */
.step-edit{padding:16px;background:var(--surface2);border-top:1px solid var(--border);display:flex;flex-direction:column;gap:12px}
.step-edit input,.step-edit textarea{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-family:var(--f-ui);font-size:.85rem;color:var(--ink);outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
.step-edit input:focus,.step-edit textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(201,168,76,.1)}
.step-edit textarea{resize:vertical;min-height:60px;line-height:1.6}
.step-edit-2col{display:grid;grid-template-columns:1fr 90px;gap:10px}
@media(max-width:420px){.step-edit-2col{grid-template-columns:1fr}}
.se-label{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px}
.se-actions{display:flex;gap:7px;justify-content:flex-end}

/* add step */
.add-step{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;border:1.5px dashed var(--border);border-radius:8px;background:transparent;color:var(--ink3);font-family:var(--f-mono);font-size:.63rem;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-top:14px;transition:all .2s}
.add-step:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3)}

/* plan actions */
.plan-actions{display:flex;gap:9px;margin-top:22px;flex-wrap:wrap}

/* ══════════════════════
   GENERATING STATE
══════════════════════ */
.gen-wrap{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:80px 30px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}
.gen-orb{width:60px;height:60px;border-radius:50%;background:var(--gold3);border:1px solid rgba(201,168,76,.3);display:grid;place-items:center;color:var(--gold);position:relative}
.gen-orb::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:1px dashed rgba(201,168,76,.2);animation:orbSpin 4s linear infinite}
.gen-title{font-family:var(--f-display);font-size:1.4rem;font-weight:300;color:var(--ink)}
.gen-sub{font-family:var(--f-mono);font-size:.6rem;color:var(--ink3);letter-spacing:.1em;text-transform:uppercase}
.gen-steps{display:flex;flex-direction:column;gap:6px;text-align:left;max-width:260px;width:100%;margin-top:4px}
.gen-step-item{display:flex;align-items:center;gap:9px;font-family:var(--f-mono);font-size:.62rem;color:var(--ink3);padding:6px 12px;border-radius:6px;background:var(--surface2);border:1px solid var(--border);transition:all .3s}
.gen-step-item.active{border-color:var(--gold);color:var(--gold);background:var(--gold3)}
.gen-step-item.done{border-color:var(--green);color:var(--green);background:rgba(107,158,107,.08)}
.gen-step-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}

/* ══════════════════════
   SUCCESS
══════════════════════ */
.success-wrap{padding:72px 30px;background:var(--surface);border:1px solid var(--border);border-radius:12px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}
.success-icon{width:72px;height:72px;border-radius:50%;background:rgba(107,158,107,.1);border:1px solid var(--green);display:grid;place-items:center;color:var(--green);position:relative}
.success-icon::after{content:'';position:absolute;inset:-8px;border-radius:50%;border:1px dashed rgba(107,158,107,.25)}
.success-title{font-family:var(--f-display);font-size:2.2rem;font-weight:300;letter-spacing:-.02em;color:var(--ink)}
.success-sub{font-family:var(--f-ui);font-size:.85rem;color:var(--ink3);line-height:1.7;max-width:340px}
.success-actions{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;justify-content:center}

/* ══════════════════════
   EMPTY STATE
══════════════════════ */
.empty-steps{padding:40px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
.empty-steps-icon{width:48px;height:48px;border-radius:50%;background:var(--surface2);border:1px dashed var(--border);display:grid;place-items:center;color:var(--ink3)}
.empty-steps-title{font-family:var(--f-display);font-size:1.1rem;font-weight:300;color:var(--ink2)}
.empty-steps-sub{font-family:var(--f-mono);font-size:.6rem;color:var(--ink3);letter-spacing:.04em;line-height:1.6;max-width:260px}

/* ══════════════════════
   ANIMATIONS
══════════════════════ */
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes orbSpin{to{transform:rotate(360deg)}}
@keyframes dotPulse{0%,80%,100%{opacity:.3;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}
@keyframes shimmer{0%{opacity:.4}50%{opacity:1}100%{opacity:.4}}

.anim-up{animation:fadeUp .5s var(--ease) both}
.anim-up-1{animation:fadeUp .5s .06s var(--ease) both}
.anim-up-2{animation:fadeUp .5s .12s var(--ease) both}
.anim-up-3{animation:fadeUp .5s .18s var(--ease) both}
.anim-fade{animation:fadeIn .3s ease both}

.spin{animation:orbSpin .8s linear infinite}
`;

/* ═══════════════════════════════════════════
   COMPONENT 2 — SessionForm
═══════════════════════════════════════════ */
function SessionForm({
  values,
  onChange,
  onContinue,
  onSaveDirect,
  isSaving,
  notesHtml,
  onNotesChange,
  notesSaveState,
}) {
  const [err, setErr] = useState('');

  const set = (k, v) => onChange({ ...values, [k]: v });

  const validate = () => {
    if (!values.title.trim()) {
      setErr('Session title is required.');
      return false;
    }
    if (!values.subject.trim()) {
      setErr('Subject is required.');
      return false;
    }
    setErr('');
    return true;
  };

  return (
    <div className="anim-up-2">
      <div className="card">
        <div className="card-head">
          <span className="card-head-title">
            <BookOpen size={12} /> Session Details
          </span>
        </div>
        <div
          className="card-body"
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          {/* Title */}
          <div className="field">
            <label className="field-label">
              Title <span className="field-req">*</span>
            </label>
            <input
              className="fi"
              placeholder="e.g. DSA Practice — Linked Lists"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>

          <div className="fgrid fgrid-2">
            <div className="field">
              <label className="field-label">
                Subject <span className="field-req">*</span>
              </label>
              <input
                className="fi"
                placeholder="e.g. Data Structures"
                value={values.subject}
                onChange={(e) => set('subject', e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">
                <Calendar size={10} /> Date
              </label>
              <input
                type="date"
                className="fi"
                value={values.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
          </div>

          <div className="sdiv">
            <div className="sdiv-line" />
            <span className="sdiv-glyph">✦</span>
            <span className="sdiv-label">Preferences</span>
            <span className="sdiv-glyph">✦</span>
            <div className="sdiv-line" />
          </div>

          <div className="fgrid fgrid-2">
            <div className="field">
              <label className="field-label">
                <Clock size={10} /> Duration (mins)
              </label>
              <input
                type="number"
                className="fi"
                min={10}
                max={480}
                value={values.duration}
                onChange={(e) => set('duration', Number(e.target.value))}
              />
              <div className="chip-row">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    className={`chip${values.duration === d ? ' active' : ''}`}
                    onClick={() => set('duration', d)}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Difficulty</label>
              <div className="diff-row">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    className={`diff-btn ${d.value}${values.difficulty === d.value ? ' on' : ''}`}
                    onClick={() => set('difficulty', d.value)}
                  >
                    <span className="glyph">{d.glyph}</span>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Focus Type</label>
            <div className="chip-row">
              {FOCUS_TYPES.map((t) => (
                <button
                  key={t}
                  className={`chip${values.focus_type === t ? ' active' : ''}`}
                  onClick={() => set('focus_type', t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="sdiv">
            <div className="sdiv-line" />
            <span className="sdiv-glyph">✦</span>
            <span className="sdiv-label">Goal & Context</span>
            <span className="sdiv-glyph">✦</span>
            <div className="sdiv-line" />
          </div>

          <div className="field">
            <label className="field-label">
              <Target size={10} /> Session Goal
            </label>
            <input
              className="fi"
              placeholder="What do you want to achieve?"
              value={values.goal}
              onChange={(e) => set('goal', e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">
              <AlignLeft size={10} /> Session Notes
            </label>
            <SessionNotesEditor
              value={notesHtml}
              onChange={onNotesChange}
              saveState={notesSaveState}
              placeholder="Add context, goals, or pre-session notes… (type / for commands)"
              minHeight={160}
            />
          </div>

          {err && (
            <div className="err">
              <X size={13} />
              {err}
            </div>
          )}

          <div className="form-foot">
            <button
              className="btn btn-outline"
              onClick={() => {
                if (validate()) onSaveDirect();
              }}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 size={12} className="spin" />
              ) : (
                <Save size={12} />
              )}
              Save without plan
            </button>
            <button
              className="btn btn-gold"
              onClick={() => {
                if (validate()) onContinue();
              }}
            >
              Continue <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT 3 — PlanBuilder
═══════════════════════════════════════════ */
function PlanBuilder({ mode, sessionForm, onSave, onBack, isSaving }) {
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [loading, setLoading] = useState(false);
  const [genPhase, setGenPhase] = useState(0); // 0-3
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});
  const [generated, setGenerated] = useState(false);
  const phaseRef = useRef(null);

  // AI generation phases for rich loading UI
  const GEN_PHASES = [
    'Analysing your session…',
    'Structuring the plan…',
    'Writing study steps…',
    'Polishing & finalising…',
  ];

  const runGenerate = useCallback(async () => {
    setLoading(true);
    setError('');
    setGenPhase(0);
    phaseRef.current = setInterval(
      () => setGenPhase((p) => Math.min(p + 1, 3)),
      900,
    );
    try {
      const result = await callAI(sessionForm);
      setPlan(result);
      setGenerated(true);
    } catch (e) {
      setError(e.message || 'Generation failed. Try again.');
    } finally {
      clearInterval(phaseRef.current);
      setLoading(false);
      setGenPhase(0);
    }
  }, [sessionForm]);

  // Auto-generate on mount for AI mode
  const didInit = useRef(false);
  useEffect(() => {
    if (mode === 'ai' && !didInit.current) {
      didInit.current = true;
      runGenerate();
    }
  }, [mode, runGenerate]);

  /* ── step helpers ── */
  const addStep = (overrides = {}) => {
    const s = mkStep(overrides);
    setPlan((p) => ({ ...p, steps: [...p.steps, s] }));
    setEditId(s.id);
    setDraft({ ...s, conceptsRaw: (s.key_concepts || []).join(', ') });
  };

  const addTemplate = (tpl) => {
    const steps = tpl.steps.map((s) => mkStep(s));
    setPlan((p) => ({ ...p, steps: [...p.steps, ...steps] }));
  };

  const duplicateStep = (id) => {
    const s = plan.steps.find((x) => x.id === id);
    if (!s) return;
    const ns = { ...s, id: crypto.randomUUID(), title: s.title + ' (copy)' };
    const idx = plan.steps.findIndex((x) => x.id === id);
    setPlan((p) => {
      const steps = [...p.steps];
      steps.splice(idx + 1, 0, ns);
      return { ...p, steps };
    });
  };

  const deleteStep = (id) => {
    if (editId === id) {
      setEditId(null);
      setDraft({});
    }
    setPlan((p) => ({ ...p, steps: p.steps.filter((s) => s.id !== id) }));
  };

  const moveStep = (id, dir) => {
    setPlan((p) => {
      const idx = p.steps.findIndex((s) => s.id === id);
      if (
        (dir === -1 && idx === 0) ||
        (dir === 1 && idx === p.steps.length - 1)
      )
        return p;
      const steps = [...p.steps];
      [steps[idx], steps[idx + dir]] = [steps[idx + dir], steps[idx]];
      return { ...p, steps };
    });
  };

  const startEdit = (step) => {
    setEditId(step.id);
    setDraft({ ...step, conceptsRaw: (step.key_concepts || []).join(', ') });
  };

  const commitEdit = () => {
    setPlan((p) => ({
      ...p,
      steps: p.steps.map((s) =>
        s.id === editId
          ? {
              ...s,
              title: draft.title || s.title,
              time: Number(draft.time) || s.time,
              description: draft.description ?? s.description,
              key_concepts: (draft.conceptsRaw || '')
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean),
            }
          : s,
      ),
    }));
    setEditId(null);
    setDraft({});
  };

  const cancelEdit = () => {
    const step = plan.steps.find((s) => s.id === editId);
    if (step && !step.title) deleteStep(editId);
    setEditId(null);
    setDraft({});
  };

  const total = plan.steps.reduce((a, s) => a + (Number(s.time) || 0), 0);
  const target = sessionForm.duration;
  const pct = Math.min(100, (total / target) * 100);
  const over = total > target;
  const under = total < target * 0.6;
  const meterColor = over
    ? 'var(--red)'
    : under
      ? 'var(--gold)'
      : 'var(--green)';

  /* ── loading state ── */
  if (loading)
    return (
      <div className="gen-wrap anim-fade">
        <div className="gen-orb">
          <Sparkles size={22} />
        </div>
        <div className="gen-title">Crafting your plan…</div>
        <div className="gen-sub">Claude is building</div>
        <div className="gen-steps">
          {GEN_PHASES.map((label, i) => (
            <div
              key={i}
              className={`gen-step-item${i === genPhase ? ' active' : i < genPhase ? ' done' : ''}`}
            >
              <div className="gen-step-dot" />
              {i < genPhase ? <CheckCircle2 size={11} /> : null}
              {label}
            </div>
          ))}
        </div>
      </div>
    );

  const isAI = mode === 'ai';

  return (
    <div className="anim-up">
      {/* ── Header ── */}
      {isAI ? (
        <div className="ai-head">
          <div className="ai-head-badge">
            <Sparkles size={10} /> AI-Generated
          </div>
          <div className="ai-head-title">{sessionForm.title}</div>
          <textarea
            className="ai-summary-ta"
            rows={2}
            value={plan.summary}
            placeholder="Add a session overview…"
            onChange={(e) =>
              setPlan((p) => ({ ...p, summary: e.target.value }))
            }
          />
        </div>
      ) : (
        <div className="manual-head">
          <div>
            <div className="mh-title">{sessionForm.title}</div>
            <div className="mh-meta">
              {plan.steps.length} step{plan.steps.length !== 1 ? 's' : ''} ·{' '}
              {sessionForm.subject}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className={isAI ? 'ai-body' : 'manual-body'}>
        {/* Time meter */}
        <div className="time-meter">
          <Timer size={14} style={{ color: 'var(--ink3)', flexShrink: 0 }} />
          <div className="tm-bar-wrap">
            <div
              className="tm-bar-fill"
              style={{ width: `${pct}%`, background: meterColor }}
            />
          </div>
          <div className="tm-info">
            <div className="tm-nums" style={{ color: meterColor }}>
              {total}m / {target}m
            </div>
            <div className="tm-label">
              {over ? 'Over target' : under ? 'Under target' : 'On target'}
            </div>
          </div>
        </div>

        {/* AI Tips */}
        {isAI && plan.tips.length > 0 && (
          <div className="tips">
            <div className="tips-title">
              <Zap size={10} /> Study Tips
            </div>
            {plan.tips.map((t, i) => (
              <div key={i} className="tip-row">
                <ArrowRight size={11} className="tip-arrow" />
                {t}
              </div>
            ))}
          </div>
        )}

        {/* Step Templates (manual or after AI generation) */}
        <div className="steps-head">
          <span className="steps-label">Study Steps</span>
          <div className="templates">
            {STEP_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                className="tpl-btn"
                onClick={() => addTemplate(tpl)}
              >
                <tpl.icon size={11} />
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {plan.steps.length === 0 && (
          <div className="empty-steps">
            <div className="empty-steps-icon">
              <PenLine size={20} />
            </div>
            <div className="empty-steps-title">No steps yet</div>
            <div className="empty-steps-sub">
              Add steps manually or use a template above to scaffold your
              session.
            </div>
          </div>
        )}

        {/* Steps */}
        {plan.steps.map((step, idx) => (
          <div
            key={step.id}
            className="step-card"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* View row */}
            <div className="step-view">
              <div className="step-num">{idx + 1}</div>
              <div className="step-content">
                <div className="step-title-row">
                  <span className="step-title">
                    {step.title || (
                      <em style={{ opacity: 0.4, fontStyle: 'italic' }}>
                        Untitled
                      </em>
                    )}
                  </span>
                  <div className="step-right">
                    {step.time > 0 && (
                      <span className="step-badge">
                        <Clock size={9} />
                        {step.time}m
                      </span>
                    )}
                    <button
                      className="btn-icon"
                      onClick={() => moveStep(step.id, -1)}
                      disabled={idx === 0}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => moveStep(step.id, 1)}
                      disabled={idx === plan.steps.length - 1}
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      className="btn-icon gold"
                      onClick={() => duplicateStep(step.id)}
                      title="Duplicate"
                    >
                      <Copy size={11} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => startEdit(step)}
                      title="Edit"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      className="btn-icon danger"
                      onClick={() => deleteStep(step.id)}
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                {step.description && (
                  <p className="step-desc">{step.description}</p>
                )}
                {step.key_concepts?.length > 0 && (
                  <div className="step-concepts">
                    {step.key_concepts.map((c, i) => (
                      <span key={i} className="concept-tag">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Inline edit */}
            {editId === step.id && (
              <div className="step-edit">
                <div>
                  <div className="se-label">Title & Duration</div>
                  <div className="step-edit-2col">
                    <input
                      placeholder="Step title"
                      autoFocus
                      value={draft.title ?? step.title}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, title: e.target.value }))
                      }
                    />
                    <input
                      type="number"
                      placeholder="mins"
                      min={1}
                      value={draft.time ?? step.time}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, time: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <div className="se-label">Description</div>
                  <textarea
                    placeholder="What to do in this step…"
                    value={draft.description ?? step.description}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, description: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <div className="se-label">Key Concepts (comma-separated)</div>
                  <input
                    placeholder="e.g. recursion, base case, call stack"
                    value={
                      draft.conceptsRaw ?? (step.key_concepts || []).join(', ')
                    }
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, conceptsRaw: e.target.value }))
                    }
                  />
                </div>
                <div className="se-actions">
                  <button className="btn btn-ghost" onClick={cancelEdit}>
                    Cancel
                  </button>
                  <button className="btn btn-gold" onClick={commitEdit}>
                    <Check size={12} />
                    Save Step
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <button className="add-step" onClick={() => addStep()}>
          <Plus size={14} /> Add Step
        </button>

        {error && (
          <div className="err">
            <X size={13} />
            {error}
          </div>
        )}

        <div className="plan-actions">
          <button className="btn btn-outline" onClick={onBack}>
            <ArrowLeft size={12} />
            Back
          </button>
          {isAI && (
            <button
              className="btn btn-outline"
              onClick={runGenerate}
              disabled={loading}
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          )}
          <button
            className="btn btn-green"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => onSave(plan)}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            Save Session
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPONENT 1 — CreateSessionPage
═══════════════════════════════════════════ */
export default function CreateSessionPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { supabase } = useSupabase();
  const { theme, toggleTheme } = useTheme();

  // "form" | "mode" | "ai" | "manual" | "success"
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({
    title: '',
    subject: '',
    date: new Date().toISOString().split('T')[0],
    duration: 60,
    difficulty: 'medium',
    focus_type: '',
    goal: '',
    notes: '',
  });
  const [notesHtml, setNotesHtml] = useState('');
  const [notesSaveState, setNotesSaveState] = useState('idle');
  const notesSaveTimer = useRef(null);
  const [isSaving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const STEPS = ['form', 'mode', 'ai', 'success'];
  const stepIdx = { form: 0, mode: 1, ai: 2, manual: 2, success: 3 };
  const progPct =
    { form: 0, mode: 33, ai: 66, manual: 66, success: 100 }[step] || 0;

  const handleNotesChange = (html) => {
    setNotesHtml(html);
    setNotesSaveState('saving');
    clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(() => {
      setNotesSaveState('saved');
      setTimeout(() => setNotesSaveState('idle'), 2000);
    }, 800);
    setForm((prev) => ({
      ...prev,
      notes: htmlToMarkdown(html),
    }));
  };

  const saveSession = async (plan) => {
    if (!supabase) {
      setSaveErr('Database not connected.');
      return;
    }
    setSaving(true);
    setSaveErr('');
    try {
      const markdownNotes = htmlToMarkdown(notesHtml);
      const { data: sessions, error } = await supabase
        .from('sessions')
        .insert([
          {
            user_id: user?.id,
            title: form.title,
            subject: form.subject,
            date: form.date,
            duration: Number(form.duration),
            difficulty: form.difficulty,
            focus_type: form.focus_type || null,
            goal: form.goal,
            notes: markdownNotes || form.notes || null,
            notes_html: notesHtml || null,
            ai_plan: plan || null,
            completed: false,
            is_completed: false,
          },
        ])
        .select()
        .single();
      if (error) throw error;

      // Sync notes to user_notes so the Notes page picks them up
      if (markdownNotes && user?.id) {
        const noteContent = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: form.title || 'Session Notes' }],
            },
            ...(form.goal
              ? [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        marks: [{ type: 'italic' }],
                        text: `Goal: ${form.goal}`,
                      },
                    ],
                  },
                ]
              : []),
            { type: 'horizontalRule' },
            ...markdownNotes
              .split('\n')
              .filter(Boolean)
              .map((line) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
              })),
          ],
        };
        await supabase.from('user_notes').insert({
          user_id: user.id,
          title: `${form.title || 'Session'} — Notes`,
          subject: form.subject || 'Study Session',
          tags: [
            'session-note',
            form.focus_type?.toLowerCase().replace(' ', '-') || 'planned',
          ].filter(Boolean),
          content: noteContent,
          word_count: markdownNotes.split(/\s+/).filter(Boolean).length,
        });
        window.dispatchEvent(new CustomEvent('notes:updated'));
      }

      setStep('success');
    } catch (e) {
      setSaveErr(e.message || 'Failed to save session.');
    } finally {
      setSaving(false);
    }
  };

  const heroTitles = {
    form: {
      tag: 'New Study Session',
      h1: (
        <>
          Plan Your <em>Focus</em>
        </>
      ),
      sub: 'Fill in your session details to get started.',
    },
    mode: {
      tag: 'Choose Approach',
      h1: (
        <>
          Build Your <em>Plan</em>
        </>
      ),
      sub: 'Select how you want to structure this session.',
    },
    ai: {
      tag: 'AI Plan Builder',
      h1: (
        <>
          Craft with <em>Claude</em>
        </>
      ),
      sub: 'Your personalised plan is being crafted.',
    },
    manual: {
      tag: 'Manual Builder',
      h1: (
        <>
          Design Your <em>Plan</em>
        </>
      ),
      sub: 'Add steps and build your session structure.',
    },
    success: {
      tag: 'Session Saved',
      h1: (
        <>
          You're all <em>Set</em>
        </>
      ),
      sub: 'Your session is ready to begin.',
    },
  };
  const hero = heroTitles[step] || heroTitles.form;

  return (
    <>
      <style>{CSS}</style>
      <div className="cs">
        <div className="grain" />
        <div className="cs-bg">
          <div className="cs-bg-orb cs-bg-orb1" />
          <div className="cs-bg-orb cs-bg-orb2" />
        </div>

        <AppNavbar />

        <div className="cs-wrap">
          {/* Back */}
          {step !== 'success' && (
            <button className="cs-back" onClick={() => navigate('/sessions')}>
              <ArrowLeft size={12} /> Sessions
            </button>
          )}

          {/* Progress */}
          <div className="prog-rail">
            <div className="prog-fill" style={{ width: `${progPct}%` }} />
            <div className="prog-steps">
              {[
                { key: 'form', label: 'Details' },
                { key: 'mode', label: 'Plan Mode' },
                { key: 'ai', label: 'Build' },
                { key: 'success', label: 'Done' },
              ].map((s, i) => {
                const cur = stepIdx[step];
                const cls = cur > i ? 'done' : cur === i ? 'active' : '';
                return (
                  <div key={s.key} className={`prog-step ${cls}`}>
                    <div className={`prog-dot ${cls}`}>
                      {cls === 'done' ? <Check size={10} /> : i + 1}
                    </div>
                    <span className="prog-label">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hero */}
          <div className="cs-hero anim-up">
            <div className="cs-hero-tag">
              <Brain size={11} />
              {hero.tag}
            </div>
            <h1>{hero.h1}</h1>
            <p>{hero.sub}</p>
          </div>

          {/* ── STEP: form ── */}
          {step === 'form' && (
            <>
              <SessionForm
                values={form}
                onChange={setForm}
                isSaving={isSaving}
                onContinue={() => setStep('mode')}
                onSaveDirect={() => saveSession(null)}
                notesHtml={notesHtml}
                onNotesChange={handleNotesChange}
                notesSaveState={notesSaveState}
              />
              {saveErr && (
                <div className="err">
                  <X size={13} />
                  {saveErr}
                </div>
              )}
            </>
          )}

          {/* ── STEP: mode ── */}
          {step === 'mode' && (
            <div className="anim-up-2">
              <button
                className="cs-back"
                style={{ marginBottom: 20 }}
                onClick={() => setStep('form')}
              >
                <ArrowLeft size={12} /> Edit Details
              </button>
              <div className="mode-cards">
                <button
                  className="mode-card ai-card"
                  onClick={() => setStep('ai')}
                >
                  <div className="mode-card-icon">
                    <Sparkles size={20} />
                  </div>
                  <div className="mode-card-title">Generate with AI</div>
                  <div className="mode-card-desc">
                    Claude builds a structured, step-by-step plan tailored to
                    your subject, goal, and duration. Edit freely after.
                  </div>
                  <span className="mode-card-badge">Recommended</span>
                </button>
                <button
                  className="mode-card manual-card"
                  onClick={() => setStep('manual')}
                >
                  <div className="mode-card-icon">
                    <PenLine size={20} />
                  </div>
                  <div className="mode-card-title">Build Manually</div>
                  <div className="mode-card-desc">
                    Write your own steps, set durations, add key concepts. Use
                    templates to scaffold quickly.
                  </div>
                  <span className="mode-card-badge">Custom</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: ai ── */}
          {step === 'ai' && (
            <>
              <PlanBuilder
                mode="ai"
                sessionForm={form}
                isSaving={isSaving}
                onBack={() => setStep('mode')}
                onSave={saveSession}
              />
              {saveErr && (
                <div className="err">
                  <X size={13} />
                  {saveErr}
                </div>
              )}
            </>
          )}

          {/* ── STEP: manual ── */}
          {step === 'manual' && (
            <>
              <PlanBuilder
                mode="manual"
                sessionForm={form}
                isSaving={isSaving}
                onBack={() => setStep('mode')}
                onSave={saveSession}
              />
              {saveErr && (
                <div className="err">
                  <X size={13} />
                  {saveErr}
                </div>
              )}
            </>
          )}

          {/* ── STEP: success ── */}
          {step === 'success' && (
            <div className="success-wrap anim-up">
              <div className="success-icon">
                <CheckCircle2 size={28} />
              </div>
              <div className="success-title">Session Created!</div>
              <p className="success-sub">
                <strong style={{ color: 'var(--ink)' }}>{form.title}</strong>{' '}
                has been saved. Your study plan is ready to guide your next
                focus block.
              </p>
              <div className="success-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setForm({
                      title: '',
                      subject: '',
                      date: new Date().toISOString().split('T')[0],
                      duration: 60,
                      difficulty: 'medium',
                      focus_type: '',
                      goal: '',
                      notes: '',
                    });
                    setStep('form');
                    setSaveErr('');
                  }}
                >
                  <Brain size={13} /> Create Another
                </button>
                <button
                  className="btn btn-gold"
                  onClick={() => navigate('/sessions')}
                >
                  View Sessions <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
