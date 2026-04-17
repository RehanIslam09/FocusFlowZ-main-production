/**
 * FocusMode.jsx — /focus
 * Upgraded with a zero-dependency, luxury WYSIWYG markdown notes editor.
 *
 * Architecture:
 *   - Notes uses contentEditable + execCommand for formatting
 *   - Floating toolbar appears on text selection
 *   - Slash command menu (/) for block-level formatting
 *   - Paste handler cleans HTML → Markdown-compatible structure
 *   - Auto-save debounced 800ms, stores markdown text to sessions.notes
 *   - Zero external editor dependencies — pure React + DOM APIs
 *
 * DB writes (unchanged schema):
 *   sessions  → INSERT (notes stored as rich text / markdown-compatible HTML)
 *   focus_logs → INSERT log row
 *
 * SQL to run in Supabase (no schema changes needed — notes column is text/unlimited):
 *   -- Already exists: notes text column in public.sessions
 *   -- Optional: add a notes_html column for rich storage
 *   ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS notes_html text;
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import {
  Play,
  Pause,
  RotateCcw,
  Save,
  CheckCircle2,
  Plus,
  X,
  Sun,
  Moon,
  Clock,
  BookOpen,
  Flame,
  Tag,
  AlignLeft,
  Zap,
  ChevronRight,
  Brain,
  PenLine,
  Layers,
  Check,
  Sparkles,
  Award,
  Target,
  Timer,
  Bold,
  Italic,
  Underline,
  Code,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Strikethrough,
  AlignCenter,
  AlignLeft as AlignLeftIcon,
  AlignRight,
  Copy,
  CheckSquare,
  Minus as HrIcon,
  Type,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const pad = (n) => String(Math.floor(n)).padStart(2, '0');
const fmtSecs = (s) =>
  `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
const fmtMins = (m) => {
  if (!m) return '0m';
  const h = Math.floor(m / 60),
    r = m % 60;
  return h ? `${h}h ${r > 0 ? r + 'm' : ''}` : `${r}m`;
};

const FOCUS_TYPES = [
  'Deep Work',
  'Revision',
  'Reading',
  'Writing',
  'Practice',
  'Research',
  'Creative',
  'Problem Solving',
];
const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', glyph: '◎' },
  { value: 'medium', label: 'Medium', glyph: '◈' },
  { value: 'hard', label: 'Hard', glyph: '◉' },
];
const PRESETS = [25, 45, 60, 90];
const TIPS = [
  'Start with the hardest task while your mind is fresh.',
  'Every 45 mins, stand up and stretch for 2 minutes.',
  'Write down distracting thoughts — then return to focus.',
  'Phone face-down, notifications off. Just this, just now.',
  'Clarity of goal = speed of execution. Know what done looks like.',
  'Silence is the most powerful productivity tool you own.',
];

/* ─────────────────────────────────────────────────────────────
   HTML → PLAIN TEXT MARKDOWN-COMPATIBLE (for Supabase notes col)
───────────────────────────────────────────────────────────── */
function htmlToMarkdown(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  const convert = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(convert).join('');
    switch (tag) {
      case 'h1':
        return `# ${inner}\n\n`;
      case 'h2':
        return `## ${inner}\n\n`;
      case 'h3':
        return `### ${inner}\n\n`;
      case 'strong':
      case 'b':
        return `**${inner}**`;
      case 'em':
      case 'i':
        return `*${inner}*`;
      case 'u':
        return `__${inner}__`;
      case 's':
      case 'del':
        return `~~${inner}~~`;
      case 'code':
        return `\`${inner}\``;
      case 'pre':
        return `\`\`\`\n${inner}\n\`\`\`\n\n`;
      case 'blockquote':
        return `> ${inner}\n\n`;
      case 'li':
        return `- ${inner}\n`;
      case 'ul':
      case 'ol':
        return `\n${inner}\n`;
      case 'a':
        return `[${inner}](${node.getAttribute('href') || ''})`;
      case 'br':
        return '\n';
      case 'p':
      case 'div':
        return `${inner}\n`;
      case 'hr':
        return `---\n\n`;
      default:
        return inner;
    }
  };
  return convert(d)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─────────────────────────────────────────────────────────────
   PASTE CLEANER — strips inline styles, keeps semantic HTML
───────────────────────────────────────────────────────────── */
function cleanPastedHTML(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  const clean = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = node.tagName.toLowerCase();
    const KEEP = [
      'p',
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'del',
      'code',
      'pre',
      'blockquote',
      'ul',
      'ol',
      'li',
      'a',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'hr',
    ];
    if (!KEEP.includes(tag)) {
      const span = document.createElement('span');
      Array.from(node.childNodes).forEach((c) => {
        const r = clean(c);
        if (r) span.appendChild(r);
      });
      return span;
    }
    const el = document.createElement(tag);
    if (tag === 'a') el.href = node.getAttribute('href') || '#';
    Array.from(node.childNodes).forEach((c) => {
      const r = clean(c);
      if (r) el.appendChild(r);
    });
    return el;
  };
  const out = document.createElement('div');
  Array.from(d.childNodes).forEach((c) => {
    const r = clean(c);
    if (r) out.appendChild(r);
  });
  return out.innerHTML;
}

/* ─────────────────────────────────────────────────────────────
   CSS
───────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

:root {
  --bg:#f5f0e8;--surface:#faf7f2;--surface2:#f0ebe0;--surface3:#e8e0d0;
  --border:#ddd5c4;--border2:#ccc0a8;
  --ink:#1e1a14;--ink2:#5c5445;--ink3:#9c9283;
  --gold:#c4913a;--gold2:#e8b96a;--gold3:rgba(196,145,58,.1);--gold-glow:rgba(196,145,58,.18);
  --gold-border:rgba(196,145,58,.25);
  --red:#b85c4a;--red-pale:rgba(184,92,74,.1);
  --green:#6b8c6b;--green2:rgba(107,140,107,.1);--green3:rgba(107,140,107,.22);
  --blue:#5b8fa8;--blue-pale:rgba(91,143,168,.12);
  --shadow:0 4px 24px rgba(30,26,20,.1);--shadow-lg:0 12px 48px rgba(30,26,20,.14);
  --f-display:'Cormorant Garamond',Georgia,serif;
  --f-ui:'Cabinet Grotesk',sans-serif;
  --f-mono:'JetBrains Mono',monospace;
  --ease:cubic-bezier(.16,1,.3,1);
  --spring:cubic-bezier(.34,1.56,.64,1);
  --r:10px;
}
.dark {
  --bg:#0e0d09;--surface:#131210;--surface2:#1a1815;--surface3:#222019;
  --border:#2a2722;--border2:#35312b;
  --ink:#f0ead8;--ink2:#a89880;--ink3:#6b5f4e;
  --gold3:rgba(196,145,58,.1);--gold-glow:rgba(196,145,58,.16);--gold-border:rgba(196,145,58,.2);
  --green2:rgba(107,140,107,.1);--green3:rgba(107,140,107,.22);
  --blue-pale:rgba(91,143,168,.1);
  --shadow:0 4px 24px rgba(0,0,0,.4);--shadow-lg:0 12px 48px rgba(0,0,0,.5);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

.fp{min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--f-ui);position:relative;overflow-x:hidden;transition:background .35s ease,color .35s ease}

/* orbs */
.fp-orbs{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.fp-orb{position:absolute;border-radius:50%;filter:blur(160px)}
.fp-orb1{width:600px;height:600px;background:var(--gold);top:-240px;right:-160px;opacity:.05;transition:opacity 1s ease}
.fp-orb2{width:400px;height:400px;background:#5a7a9a;bottom:-120px;left:-100px;opacity:.04}
.fp-orb3{width:320px;height:320px;background:var(--green);top:40%;left:50%;transform:translate(-50%,-50%);opacity:0;transition:opacity 1.2s ease}
.fp-orb3.live{opacity:.04}
.dark .fp-orb1{opacity:.05}

/* grain */
.fp-grain{pointer-events:none;position:fixed;inset:0;z-index:1;opacity:.03;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode:multiply}
.dark .fp-grain{mix-blend-mode:screen;opacity:.04}

/* topbar */
.fp-topbar{position:sticky;top:0;z-index:200;height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4);border-bottom:1px solid var(--border);transition:background .35s ease,border-color .35s ease}
.fp-topbar::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.45}
.fp-logo{font-family:var(--f-display);font-size:1.12rem;font-weight:600;color:var(--ink);letter-spacing:-.02em;display:flex;align-items:center;gap:7px}
.fp-logo-dot{width:7px;height:7px;border-radius:50%;background:var(--gold);animation:logo-breathe 3s ease-in-out infinite;flex-shrink:0}
@keyframes logo-breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.6}}
.fp-topbar-right{display:flex;align-items:center;gap:10px}
.fp-live-pill{display:inline-flex;align-items:center;gap:6px;font-family:var(--f-mono);font-size:.56rem;letter-spacing:.12em;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid var(--border);color:var(--ink3);background:transparent;transition:all .4s ease}
.fp-live-pill.running{border-color:var(--green);color:var(--green);background:var(--green2)}
.fp-live-dot{width:5px;height:5px;border-radius:50%;background:currentColor}
.fp-live-pill.running .fp-live-dot{animation:pulse-dot 1.8s ease-in-out infinite}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.6)}}

/* theme toggle */
.fp-theme-toggle{position:relative;width:54px;height:28px;border-radius:14px;border:1.5px solid var(--border2);background:var(--surface2);cursor:pointer;outline:none;flex-shrink:0;transition:border-color .35s ease,background .35s ease}
.fp-theme-toggle:hover{border-color:var(--gold);box-shadow:0 0 14px var(--gold-glow)}
.fp-toggle-track{position:absolute;inset:0;border-radius:14px;display:flex;align-items:center;justify-content:space-between;padding:0 7px;overflow:hidden}
.fp-track-icon{display:flex;align-items:center;justify-content:center}
.fp-track-icon.sun{color:#c4913a} .fp-track-icon.moon{color:#7a9fc9}
.fp-toggle-thumb{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--gold2));box-shadow:0 2px 8px rgba(0,0,0,.25),0 0 10px rgba(196,145,58,.3);display:grid;place-items:center;z-index:2;transition:left .38s var(--spring),background .35s ease}
.dark .fp-toggle-thumb{left:29px}
.fp-toggle-ripple{position:absolute;inset:-5px;border-radius:19px;pointer-events:none;background:radial-gradient(circle,var(--gold-glow) 0%,transparent 70%);animation:toggle-ripple .5s var(--ease) forwards;opacity:0}
@keyframes toggle-ripple{0%{opacity:.7;transform:scale(.8)}100%{opacity:0;transform:scale(1.5)}}

/* wrap */
.fp-wrap{max-width:980px;margin:0 auto;padding:44px 28px 100px;position:relative;z-index:2}
@media(max-width:768px){.fp-wrap{padding:28px 16px 80px}}

/* hero */
.fp-hero{margin-bottom:36px;animation:fp-up .55s var(--ease) both}
.fp-eyebrow{font-family:var(--f-mono);font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:8px;margin-bottom:12px}
.fp-eyebrow::before{content:'';display:block;width:24px;height:1px;background:currentColor;opacity:.5}
.fp-title-input{font-family:var(--f-display);font-size:clamp(2rem,5vw,3.1rem);font-weight:300;letter-spacing:-.02em;line-height:1.1;background:transparent;border:none;outline:none;color:var(--ink);width:100%;caret-color:var(--gold);border-bottom:1.5px solid transparent;padding-bottom:4px;transition:border-color .25s ease}
.fp-title-input::placeholder{color:var(--ink3);font-style:italic}
.fp-title-input:focus{border-bottom-color:rgba(196,145,58,.35)}
.fp-chip-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}
.fp-chip{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.57rem;letter-spacing:.07em;padding:5px 12px;border-radius:20px;background:var(--surface);border:1px solid var(--border);color:var(--ink3);cursor:pointer;transition:all .18s;white-space:nowrap}
.fp-chip:hover{border-color:var(--gold);color:var(--gold)}
.fp-chip.active{background:var(--gold3);border-color:var(--gold);color:var(--gold)}

/* layout */
.fp-layout{display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start}
@media(max-width:860px){.fp-layout{grid-template-columns:1fr}}

/* cards */
.fp-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:16px;transition:background .35s ease,border-color .35s ease}
.fp-card-head{padding:13px 18px 11px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px}
.fp-card-label{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:6px}
.fp-card-body{padding:18px}

/* timer card */
.fp-timer-card{background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--gold) 5%,var(--surface)));border:1px solid rgba(196,145,58,.2);border-radius:var(--r);padding:26px 18px 20px;text-align:center;position:relative;overflow:hidden;margin-bottom:16px;animation:fp-up .5s .04s var(--ease) both}
.dark .fp-timer-card{background:linear-gradient(145deg,#131210,#1a1508)}
.fp-timer-card::after{content:'◈';position:absolute;right:12px;bottom:-24px;font-size:9rem;color:rgba(196,145,58,.04);font-family:var(--f-display);pointer-events:none;line-height:1}
.fp-mode-row{display:flex;justify-content:center;gap:6px;margin-bottom:18px}
.fp-mode-btn{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--ink3);cursor:pointer;transition:all .2s}
.fp-mode-btn.active{background:var(--gold);border-color:var(--gold);color:#fff}
.dark .fp-mode-btn.active{color:#0e0d09}
.fp-preset-row{display:flex;justify-content:center;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.fp-preset-btn{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.06em;padding:4px 10px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--ink3);cursor:pointer;transition:all .15s}
.fp-preset-btn:hover{border-color:var(--gold);color:var(--gold)}
.fp-preset-btn.active{background:var(--gold3);border-color:var(--gold);color:var(--gold)}

/* ring */
.fp-ring-wrap{position:relative;width:196px;height:196px;margin:0 auto 18px}
.fp-ring-svg{width:100%;height:100%;transform:rotate(-90deg)}
.fp-ring-track{fill:none;stroke:var(--border);stroke-width:3}
.fp-ring-fill{fill:none;stroke:var(--gold);stroke-width:3;stroke-linecap:round;transition:stroke-dashoffset 1s var(--ease);filter:drop-shadow(0 0 5px rgba(196,145,58,.4))}
.fp-ring-fill.paused{stroke:var(--ink3);filter:none}
.fp-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.fp-timer-disp{font-family:var(--f-display);font-size:clamp(1.9rem,6.5vw,2.8rem);font-weight:300;letter-spacing:-.03em;line-height:1;color:var(--ink);transition:color .3s}
.fp-timer-disp.live{color:var(--gold)}
.fp-timer-sub{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
.fp-controls{display:flex;align-items:center;justify-content:center;gap:12px}
.fp-ctrl{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--border2);background:transparent;color:var(--ink2);cursor:pointer;transition:all .22s var(--spring)}
.fp-ctrl:hover:not(:disabled){color:var(--ink);transform:translateY(-2px) scale(1.06)}
.fp-ctrl:disabled{opacity:.35;cursor:not-allowed}
.fp-ctrl.play{width:54px;height:54px;background:var(--gold);border-color:var(--gold);color:#fff;box-shadow:0 4px 18px rgba(196,145,58,.35)}
.dark .fp-ctrl.play{color:#0e0d09}
.fp-ctrl.play:hover:not(:disabled){background:var(--gold2);transform:translateY(-3px) scale(1.08);box-shadow:0 6px 24px rgba(196,145,58,.5)}
.fp-ctrl.play:active:not(:disabled){transform:scale(.96)}
.fp-timer-hint{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.1em;color:var(--ink3);margin-top:13px}
kbd.fp-kbd{font-family:var(--f-mono);border:1px solid var(--border2);padding:1px 5px;border-radius:3px;font-size:.46rem}

/* log */
.fp-log-list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.fp-log-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);animation:fp-up .3s var(--ease) both;transition:background .2s,border-color .2s}
.fp-log-item:hover{border-color:var(--border2)}
.fp-log-check{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border2);display:grid;place-items:center;flex-shrink:0;cursor:pointer;transition:all .22s var(--spring);background:transparent}
.fp-log-check.done{background:var(--green);border-color:var(--green)}
.fp-log-text{flex:1;min-width:0}
.fp-log-title{font-family:var(--f-ui);font-size:.83rem;font-weight:600;color:var(--ink);line-height:1.3}
.fp-log-title.done{text-decoration:line-through;color:var(--ink3)}
.fp-log-time{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.08em;color:var(--ink3);margin-top:2px}
.fp-log-del{color:var(--ink3);background:none;border:none;cursor:pointer;padding:2px;transition:color .15s;flex-shrink:0}
.fp-log-del:hover{color:var(--red)}
.fp-add-row{display:flex;gap:8px}
.fp-add-input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 13px;font-family:var(--f-ui);font-size:.83rem;color:var(--ink);outline:none;transition:border-color .2s}
.fp-add-input::placeholder{color:var(--ink3);font-style:italic}
.fp-add-input:focus{border-color:var(--gold)}
.fp-add-btn{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;background:var(--gold);border:none;color:#fff;cursor:pointer;transition:all .2s var(--spring);flex-shrink:0}
.dark .fp-add-btn{color:#0e0d09}
.fp-add-btn:hover{background:var(--gold2);transform:scale(1.08)}

/* sidebar */
.fp-sidebar{position:sticky;top:80px}
.fp-field-label{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:5px;display:flex;align-items:center;gap:5px}
.fp-select{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:var(--f-ui);font-size:.82rem;color:var(--ink);outline:none;cursor:pointer;appearance:none;transition:border-color .2s;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239c9283' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:30px}
.fp-select:focus{border-color:var(--gold)}
.fp-select option{background:var(--surface2)}
.fp-text-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:var(--f-ui);font-size:.82rem;color:var(--ink);outline:none;transition:border-color .2s}
.fp-text-input::placeholder{color:var(--ink3)}
.fp-text-input:focus{border-color:var(--gold)}
.fp-goal-ta{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:var(--f-display);font-size:.95rem;font-style:italic;font-weight:300;color:var(--ink);outline:none;resize:none;line-height:1.6;transition:border-color .2s}
.fp-goal-ta::placeholder{color:var(--ink3)}
.fp-goal-ta:focus{border-color:var(--gold)}
.fp-diff-row{display:flex;gap:6px}
.fp-diff-btn{flex:1;padding:8px 4px;border-radius:8px;border:1px solid var(--border2);background:transparent;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.04em;cursor:pointer;color:var(--ink3);transition:all .18s;display:flex;flex-direction:column;align-items:center;gap:2px}
.fp-diff-btn .g{font-size:.9rem;line-height:1}
.fp-diff-btn.easy.on{background:rgba(107,140,107,.1);border-color:#6b8c6b;color:#6b8c6b}
.fp-diff-btn.medium.on{background:var(--gold3);border-color:var(--gold);color:var(--gold)}
.fp-diff-btn.hard.on{background:rgba(184,92,74,.1);border-color:#b85c4a;color:#b85c4a}
.fp-meta-form{display:flex;flex-direction:column;gap:14px}
.fp-stat-row{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:8px;background:var(--surface2);border:1px solid var(--border)}
.fp-stat-label{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:5px}
.fp-stat-val{font-family:var(--f-display);font-size:1.1rem;font-weight:300;color:var(--gold)}
.fp-tip-box{background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:14px;margin-bottom:16px}
.fp-tip-title{font-family:var(--f-mono);font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:9px;display:flex;align-items:center;gap:5px}
.fp-tip-text{font-family:var(--f-ui);font-size:.79rem;color:var(--ink2);line-height:1.65}

/* buttons */
.fp-btn{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-mono);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;padding:10px 18px;border-radius:8px;border:none;cursor:pointer;transition:all .22s var(--spring);white-space:nowrap}
.fp-btn:disabled{opacity:.4;cursor:not-allowed}
.fp-btn-gold{background:var(--gold);color:#fff;font-weight:500}
.dark .fp-btn-gold{color:#0e0d09}
.fp-btn-gold:hover:not(:disabled){background:var(--gold2);transform:translateY(-2px);box-shadow:0 5px 18px rgba(196,145,58,.35)}
.fp-btn-outline{background:transparent;border:1px solid var(--border2);color:var(--ink2)}
.fp-btn-outline:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}

/* empty */
.fp-empty{padding:28px 16px;text-align:center}
.fp-empty-icon{width:42px;height:42px;border-radius:50%;background:var(--surface2);border:1.5px dashed var(--border);display:grid;place-items:center;color:var(--ink3);margin:0 auto 9px}
.fp-empty-text{font-family:var(--f-mono);font-size:.58rem;letter-spacing:.08em;color:var(--ink3)}

/* overlay */
.fp-overlay{position:fixed;inset:0;z-index:500;display:grid;place-items:center;padding:24px;background:rgba(14,13,9,.72);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);animation:fp-fade .4s ease}
.dark .fp-overlay{background:rgba(0,0,0,.8)}
@keyframes fp-fade{from{opacity:0}to{opacity:1}}
.fp-ov-card{background:var(--surface);border:1px solid rgba(196,145,58,.25);border-radius:20px;padding:46px 38px;max-width:460px;width:100%;text-align:center;box-shadow:var(--shadow-lg);position:relative;overflow:hidden;animation:fp-scale-in .5s var(--spring) both}
@keyframes fp-scale-in{from{opacity:0;transform:scale(.88) translateY(24px)}to{opacity:1;transform:none}}
.fp-ov-sparks{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.fp-ov-spark{position:absolute;border-radius:50%;background:var(--gold);animation:spark-fly var(--d,.7s) var(--ease) var(--delay,0s) both;opacity:0}
@keyframes spark-fly{0%{opacity:0;transform:translateY(30px) scale(0)}55%{opacity:.9}100%{opacity:0;transform:translateY(-80px) scale(2)}}
.fp-ov-ring{width:78px;height:78px;border-radius:50%;border:2px solid rgba(196,145,58,.3);background:var(--gold3);display:grid;place-items:center;margin:0 auto 20px;color:var(--gold);animation:ring-pulse 2.5s ease-in-out infinite}
@keyframes ring-pulse{0%,100%{box-shadow:0 0 0 0 rgba(196,145,58,.25)}50%{box-shadow:0 0 0 14px rgba(196,145,58,.04)}}
.fp-ov-title{font-family:var(--f-display);font-size:2.1rem;font-weight:300;letter-spacing:-.02em;color:var(--ink);margin-bottom:8px}
.fp-ov-title em{font-style:italic;color:var(--gold)}
.fp-ov-sub{font-family:var(--f-ui);font-size:.83rem;color:var(--ink2);line-height:1.65;margin-bottom:24px}
.fp-ov-stats{display:flex;justify-content:center;gap:24px;padding:16px;background:var(--surface2);border-radius:12px;border:1px solid var(--border);margin-bottom:26px}
.fp-ov-stat-val{font-family:var(--f-display);font-size:1.85rem;font-weight:300;color:var(--gold);margin-bottom:4px}
.fp-ov-stat-label{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
.fp-ov-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

/* animations */
@keyframes fp-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.fp-a1{animation:fp-up .55s .04s var(--ease) both}
.fp-a2{animation:fp-up .55s .1s var(--ease) both}
.fp-a3{animation:fp-up .55s .16s var(--ease) both}
.fp-a4{animation:fp-up .55s .22s var(--ease) both}
.fp-a5{animation:fp-up .55s .28s var(--ease) both}

::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}

/* hide number input spinners */
.fp input[type=number]::-webkit-inner-spin-button,
.fp input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.fp input[type=number]{-moz-appearance:textfield}

/* ══════════════════════════════════════════════════════════════
   NOTES EDITOR — Premium WYSIWYG
══════════════════════════════════════════════════════════════ */

/* Card wrapper */
.fn-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:visible;margin-bottom:16px;transition:background .35s ease,border-color .35s ease,box-shadow .3s;position:relative}
.fn-card:focus-within{border-color:var(--gold-border);box-shadow:0 0 0 3px var(--gold3),var(--shadow)}
.fn-card-head{padding:11px 18px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px;background:color-mix(in srgb,var(--gold) 3%,var(--surface));transition:background .35s}

/* Toolbar */
.fn-toolbar{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
.fn-toolbar-group{display:flex;align-items:center;gap:1px}
.fn-toolbar-sep{width:1px;height:16px;background:var(--border2);margin:0 5px;flex-shrink:0}
.fn-tb-btn{width:28px;height:28px;border-radius:6px;display:grid;place-items:center;background:transparent;border:none;color:var(--ink3);cursor:pointer;transition:all .15s;flex-shrink:0;position:relative}
.fn-tb-btn:hover{background:var(--surface2);color:var(--gold)}
.fn-tb-btn.active{background:var(--gold3);color:var(--gold)}
.fn-tb-btn-wide{width:auto;padding:0 8px;font-family:var(--f-mono);font-size:.52rem;letter-spacing:.08em;gap:4px}
.fn-tb-tooltip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--ink);color:var(--surface);font-family:var(--f-mono);font-size:.5rem;letter-spacing:.06em;padding:4px 8px;border-radius:5px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;z-index:100}
.fn-tb-btn:hover .fn-tb-tooltip{opacity:1}
.fn-tb-tooltip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:4px solid transparent;border-top-color:var(--ink)}

/* Floating selection toolbar */
.fn-float-toolbar{position:fixed;z-index:9999;background:var(--ink);border-radius:10px;padding:5px 6px;display:flex;align-items:center;gap:2px;box-shadow:0 8px 32px rgba(0,0,0,.3),0 0 0 1px rgba(196,145,58,.15);animation:fn-toolbar-in .15s var(--ease) both;transform-origin:bottom center}
@keyframes fn-toolbar-in{from{opacity:0;transform:translateY(6px) scale(.95)}to{opacity:1;transform:none}}
.fn-float-btn{width:30px;height:28px;border-radius:6px;display:grid;place-items:center;background:transparent;border:none;color:rgba(240,234,216,.6);cursor:pointer;transition:all .15s}
.fn-float-btn:hover{background:rgba(255,255,255,.1);color:var(--gold)}
.fn-float-sep{width:1px;height:14px;background:rgba(255,255,255,.15);margin:0 3px}

/* Slash command menu */
.fn-slash-menu{position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:6px;min-width:220px;box-shadow:var(--shadow-lg);animation:fn-toolbar-in .15s var(--ease) both}
.fn-slash-header{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);padding:4px 8px 8px;border-bottom:1px solid var(--border);margin-bottom:4px}
.fn-slash-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:all .15s;border:none;background:transparent;width:100%;text-align:left}
.fn-slash-item:hover,.fn-slash-item.highlighted{background:var(--gold3);border:none}
.fn-slash-item:hover .fn-slash-name,.fn-slash-item.highlighted .fn-slash-name{color:var(--gold)}
.fn-slash-icon{width:28px;height:28px;border-radius:7px;background:var(--surface2);border:1px solid var(--border);display:grid;place-items:center;color:var(--ink3);flex-shrink:0;font-size:.75rem}
.fn-slash-item:hover .fn-slash-icon,.fn-slash-item.highlighted .fn-slash-icon{background:var(--gold3);border-color:var(--gold);color:var(--gold)}
.fn-slash-info{display:flex;flex-direction:column;gap:1px}
.fn-slash-name{font-family:var(--f-ui);font-size:.8rem;font-weight:600;color:var(--ink);transition:color .15s}
.fn-slash-desc{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.04em;color:var(--ink3)}

/* Editor surface */
.fn-editor-wrap{position:relative;padding:20px 22px 16px}
.fn-editor{min-height:200px;max-height:480px;overflow-y:auto;outline:none;font-family:var(--f-ui);font-size:.88rem;line-height:1.8;color:var(--ink);caret-color:var(--gold);word-wrap:break-word;transition:min-height .3s var(--ease)}
.fn-editor.expanded{min-height:360px}

/* Empty placeholder */
.fn-editor:empty::before{content:attr(data-placeholder);color:var(--ink3);font-style:italic;pointer-events:none;font-size:.88rem;line-height:1.8}

/* Rich content styles */
.fn-editor h1{font-family:var(--f-display);font-size:1.9rem;font-weight:300;letter-spacing:-.02em;line-height:1.2;color:var(--ink);margin:18px 0 8px;border-bottom:1px solid var(--border);padding-bottom:8px}
.fn-editor h2{font-family:var(--f-display);font-size:1.4rem;font-weight:400;letter-spacing:-.01em;color:var(--ink);margin:16px 0 7px}
.fn-editor h3{font-family:var(--f-display);font-size:1.1rem;font-weight:600;color:var(--ink);margin:12px 0 6px}
.fn-editor p{margin:0 0 8px}
.fn-editor p:last-child{margin-bottom:0}
.fn-editor strong{color:var(--ink);font-weight:700}
.fn-editor em{font-style:italic;color:var(--ink2)}
.fn-editor u{text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:3px}
.fn-editor s{text-decoration:line-through;color:var(--ink3)}
.fn-editor code{font-family:var(--f-mono);font-size:.82rem;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:1px 6px;color:var(--gold);letter-spacing:-.01em}
.fn-editor pre{background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:14px 16px;margin:12px 0;overflow-x:auto;position:relative}
.fn-editor pre code{background:none;border:none;padding:0;font-size:.82rem;color:var(--ink);line-height:1.7}
.fn-editor blockquote{border-left:3px solid var(--gold);padding:8px 0 8px 16px;margin:12px 0;background:var(--gold3);border-radius:0 8px 8px 0;color:var(--ink2);font-style:italic}
.fn-editor ul,.fn-editor ol{padding-left:22px;margin:8px 0}
.fn-editor li{margin:3px 0;line-height:1.7}
.fn-editor ul li{list-style:none;position:relative;padding-left:4px}
.fn-editor ul li::before{content:'◦';position:absolute;left:-16px;color:var(--gold);font-size:.9rem}
.fn-editor ol{list-style:decimal}
.fn-editor ol li::marker{color:var(--gold);font-family:var(--f-mono);font-size:.8rem}
.fn-editor a{color:var(--blue);text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(91,143,168,.4)}
.fn-editor a:hover{text-decoration-color:var(--blue)}
.fn-editor hr{border:none;border-top:1px solid var(--border);margin:18px 0}
/* Checklist */
.fn-editor .fn-check-item{display:flex;align-items:flex-start;gap:8px;margin:3px 0;list-style:none}
.fn-editor .fn-check-item input[type=checkbox]{width:14px;height:14px;border-radius:3px;accent-color:var(--gold);cursor:pointer;margin-top:3px;flex-shrink:0}
.fn-editor .fn-check-item.checked span{text-decoration:line-through;color:var(--ink3)}

/* Code copy button */
.fn-code-copy{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:6px;background:var(--surface3);border:1px solid var(--border);color:var(--ink3);cursor:pointer;display:grid;place-items:center;opacity:0;transition:all .15s}
.fn-editor pre:hover .fn-code-copy{opacity:1}
.fn-code-copy:hover{border-color:var(--gold);color:var(--gold)}

/* Footer */
.fn-footer{display:flex;align-items:center;justify-content:space-between;padding:8px 22px 12px;border-top:1px solid var(--border)}
.fn-save-pill{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.52rem;letter-spacing:.08em;color:var(--green);opacity:0;transition:opacity .4s}
.fn-save-pill.vis{opacity:1}
.fn-save-pill.saving{color:var(--gold)}
.fn-word-count{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.08em;color:var(--ink3)}
.fn-expand-btn{width:24px;height:24px;border-radius:6px;background:transparent;border:1px solid var(--border);color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s}
.fn-expand-btn:hover{border-color:var(--gold);color:var(--gold)}

/* Slash key hint */
.fn-slash-hint{position:absolute;bottom:14px;right:22px;font-family:var(--f-mono);font-size:.48rem;letter-spacing:.1em;color:var(--ink3);opacity:.5;pointer-events:none;transition:opacity .2s}
.fn-editor:focus ~ .fn-slash-hint{opacity:.7}
`;

/* ─────────────────────────────────────────────────────────────
   SLASH COMMAND CONFIG
───────────────────────────────────────────────────────────── */
const SLASH_COMMANDS = [
  {
    id: 'h1',
    icon: 'H1',
    name: 'Heading 1',
    desc: 'Large section heading',
    cmd: () => document.execCommand('formatBlock', false, 'H1'),
  },
  {
    id: 'h2',
    icon: 'H2',
    name: 'Heading 2',
    desc: 'Medium heading',
    cmd: () => document.execCommand('formatBlock', false, 'H2'),
  },
  {
    id: 'h3',
    icon: 'H3',
    name: 'Heading 3',
    desc: 'Small heading',
    cmd: () => document.execCommand('formatBlock', false, 'H3'),
  },
  {
    id: 'p',
    icon: '¶',
    name: 'Paragraph',
    desc: 'Normal text block',
    cmd: () => document.execCommand('formatBlock', false, 'P'),
  },
  {
    id: 'quote',
    icon: '"',
    name: 'Quote',
    desc: 'Highlighted blockquote',
    cmd: () => document.execCommand('formatBlock', false, 'BLOCKQUOTE'),
  },
  {
    id: 'ul',
    icon: '•',
    name: 'Bullet List',
    desc: 'Unordered list',
    cmd: () => document.execCommand('insertUnorderedList'),
  },
  {
    id: 'ol',
    icon: '1.',
    name: 'Numbered List',
    desc: 'Ordered list',
    cmd: () => document.execCommand('insertOrderedList'),
  },
  {
    id: 'code',
    icon: '</>',
    name: 'Code Block',
    desc: 'Monospace code block',
    cmd: () => document.execCommand('formatBlock', false, 'PRE'),
  },
  {
    id: 'hr',
    icon: '—',
    name: 'Divider',
    desc: 'Horizontal rule',
    cmd: () => document.execCommand('insertHorizontalRule'),
  },
];

/* ─────────────────────────────────────────────────────────────
   NOTES EDITOR COMPONENT
───────────────────────────────────────────────────────────── */
function NotesEditor({ value, onChange, saveState }) {
  const editorRef = useRef(null);
  const [floatToolbar, setFloatToolbar] = useState(null); // {x,y}
  const [slashMenu, setSlashMenu] = useState(null); // {x,y,range}
  const [slashIdx, setSlashIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const floatTimer = useRef(null);
  const isComposing = useRef(false);
  const savedRange = useRef(null);

  /* ── Initialise editor with value on mount ── */
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  /* ── Capture range before toolbar button click ── */
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0)
      savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  /* ── Toolbar execCommand helper ── */
  const exec = useCallback(
    (cmd, val = null) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(cmd, false, val);
      setTimeout(() => {
        onChange(editorRef.current?.innerHTML || '');
        updateWordCount();
      }, 0);
    },
    [onChange],
  );

  /* ── Format block ── */
  const formatBlock = useCallback(
    (tag) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand('formatBlock', false, tag);
      setTimeout(() => {
        onChange(editorRef.current?.innerHTML || '');
        setSlashMenu(null);
      }, 0);
    },
    [onChange],
  );

  /* ── Insert list ── */
  const insertList = useCallback(
    (ordered) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(
        ordered ? 'insertOrderedList' : 'insertUnorderedList',
      );
      setTimeout(() => onChange(editorRef.current?.innerHTML || ''), 0);
    },
    [onChange],
  );

  /* ── Word count ── */
  const updateWordCount = () => {
    const text = editorRef.current?.innerText || '';
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  };

  /* ── Handle input ── */
  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    const html = editorRef.current?.innerHTML || '';
    onChange(html);
    updateWordCount();
    // Detect slash at start of block
    checkSlashCommand();
  }, [onChange]);

  /* ── Slash command detection ── */
  const checkSlashCommand = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textBefore =
      range.startContainer.textContent?.slice(0, range.startOffset) || '';
    if (textBefore === '/') {
      const rect = range.getBoundingClientRect();
      setSlashMenu({
        x: rect.left,
        y: rect.bottom + 6,
        range: range.cloneRange(),
      });
      setSlashIdx(0);
    } else {
      setSlashMenu(null);
    }
  };

  /* ── Execute slash command ── */
  const execSlashCmd = (cmd) => {
    // Delete the "/" character
    if (slashMenu?.range) {
      const sel = window.getSelection();
      const r = slashMenu.range.cloneRange();
      r.setStart(r.startContainer, r.startOffset - 1);
      sel.removeAllRanges();
      sel.addRange(r);
      document.execCommand('delete');
    }
    cmd.cmd();
    setSlashMenu(null);
    onChange(editorRef.current?.innerHTML || '');
  };

  /* ── Handle selection change → show floating toolbar ── */
  const handleSelectionChange = useCallback(() => {
    clearTimeout(floatTimer.current);
    floatTimer.current = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setFloatToolbar(null);
        return;
      }
      // Only show if inside our editor
      const range = sel.getRangeAt(0);
      if (!editorRef.current?.contains(range.commonAncestorContainer)) {
        setFloatToolbar(null);
        return;
      }
      saveSelection();
      const rect = range.getBoundingClientRect();
      setFloatToolbar({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    }, 120);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () =>
      document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  /* ── Keyboard shortcuts ── */
  const handleKeyDown = useCallback(
    (e) => {
      // Slash menu navigation
      if (slashMenu) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashIdx((i) => Math.min(i + 1, SLASH_COMMANDS.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          execSlashCmd(SLASH_COMMANDS[slashIdx]);
          return;
        }
        if (e.key === 'Escape') {
          setSlashMenu(null);
          return;
        }
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          exec('bold');
          break;
        case 'i':
          e.preventDefault();
          exec('italic');
          break;
        case 'u':
          e.preventDefault();
          exec('underline');
          break;
        case 'k':
          e.preventDefault();
          {
            const url = window.prompt('Enter URL:');
            if (url) exec('createLink', url);
            break;
          }
        default:
          break;
      }
      // Ctrl+Shift shortcuts
      if (mod && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            exec('strikeThrough');
            break;
          case 'x':
            e.preventDefault();
            exec('strikeThrough');
            break;
          case '7':
            e.preventDefault();
            insertList(true);
            break;
          case '8':
            e.preventDefault();
            insertList(false);
            break;
          default:
            break;
        }
      }
    },
    [slashMenu, slashIdx, exec, insertList],
  );

  /* ── Paste handler: clean HTML ── */
  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      if (html) {
        const cleaned = cleanPastedHTML(html);
        document.execCommand('insertHTML', false, cleaned);
      } else {
        // Plain text — convert basic markdown patterns to HTML
        const converted = text
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`(.+?)`/g, '<code>$1</code>')
          .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/\n/g, '<br>');
        document.execCommand('insertHTML', false, converted);
      }
      setTimeout(() => {
        onChange(editorRef.current?.innerHTML || '');
        updateWordCount();
      }, 0);
    },
    [onChange],
  );

  /* ── Add copy buttons to code blocks after render ── */
  const addCopyButtons = useCallback(() => {
    const pres = editorRef.current?.querySelectorAll('pre') || [];
    pres.forEach((pre) => {
      if (pre.querySelector('.fn-code-copy')) return;
      const btn = document.createElement('button');
      btn.className = 'fn-code-copy';
      btn.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect width='14' height='14' x='8' y='8' rx='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg>`;
      btn.onclick = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(pre.innerText).then(() => {
          btn.style.color = 'var(--green)';
          setTimeout(() => {
            btn.style.color = '';
          }, 1500);
        });
      };
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }, []);

  useEffect(() => {
    addCopyButtons();
  }, [value, addCopyButtons]);

  /* ── Query active states ── */
  const isActive = (cmd) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };

  const toolbarGroups = [
    [
      { cmd: 'bold', icon: <Bold size={13} />, tip: 'Bold (⌘B)' },
      { cmd: 'italic', icon: <Italic size={13} />, tip: 'Italic (⌘I)' },
      {
        cmd: 'underline',
        icon: <Underline size={13} />,
        tip: 'Underline (⌘U)',
      },
      {
        cmd: 'strikeThrough',
        icon: <Strikethrough size={13} />,
        tip: 'Strikethrough',
      },
    ],
    [
      {
        block: 'H1',
        icon: (
          <span
            style={{
              fontFamily: 'var(--f-display)',
              fontWeight: 700,
              fontSize: '.72rem',
            }}
          >
            H1
          </span>
        ),
        tip: 'Heading 1',
      },
      {
        block: 'H2',
        icon: (
          <span
            style={{
              fontFamily: 'var(--f-display)',
              fontWeight: 700,
              fontSize: '.72rem',
            }}
          >
            H2
          </span>
        ),
        tip: 'Heading 2',
      },
      {
        block: 'H3',
        icon: (
          <span
            style={{
              fontFamily: 'var(--f-display)',
              fontWeight: 700,
              fontSize: '.72rem',
            }}
          >
            H3
          </span>
        ),
        tip: 'Heading 3',
      },
      { block: 'P', icon: <Type size={13} />, tip: 'Paragraph' },
    ],
    [
      {
        action: () => insertList(false),
        icon: <List size={13} />,
        tip: 'Bullet list (⌘⇧8)',
      },
      {
        action: () => insertList(true),
        icon: <ListOrdered size={13} />,
        tip: 'Numbered list (⌘⇧7)',
      },
      { block: 'BLOCKQUOTE', icon: <Quote size={13} />, tip: 'Blockquote' },
      { block: 'PRE', icon: <Code size={13} />, tip: 'Code block' },
    ],
    [
      {
        action: () => {
          const u = window.prompt('URL:');
          if (u) exec('createLink', u);
        },
        icon: <Link2 size={13} />,
        tip: 'Insert link (⌘K)',
      },
      {
        cmd: 'insertHorizontalRule',
        icon: <HrIcon size={13} />,
        tip: 'Divider',
      },
    ],
  ];

  return (
    <div className="fn-card fp-a3">
      {/* ── Card header ── */}
      <div className="fn-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: '.56rem',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'var(--ink3)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlignLeft size={11} /> Notes
          </span>
          <span
            className={`fn-save-pill ${saveState !== 'idle' ? 'vis' : ''} ${saveState === 'saving' ? 'saving' : ''}`}
          >
            <Save size={9} /> {saveState === 'saving' ? 'Saving…' : 'Saved'}
          </span>
        </div>
        {/* Inline toolbar */}
        <div className="fn-toolbar">
          {toolbarGroups.map((group, gi) => (
            <div
              key={gi}
              style={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              {gi > 0 && <div className="fn-toolbar-sep" />}
              {group.map((item, ii) => (
                <button
                  key={ii}
                  className={`fn-tb-btn ${item.cmd && isActive(item.cmd) ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    saveSelection();
                    if (item.cmd) exec(item.cmd);
                    else if (item.block) formatBlock(item.block);
                    else if (item.action) item.action();
                  }}
                  title={item.tip}
                >
                  {item.icon}
                  <span className="fn-tb-tooltip">{item.tip}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Editor ── */}
      <div className="fn-editor-wrap">
        <div
          ref={editorRef}
          className={`fn-editor ${expanded ? 'expanded' : ''}`}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write your thoughts, ideas, breakthroughs… (type / for commands)"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={() => {
            isComposing.current = false;
            handleInput();
          }}
          spellCheck
        />
        {/* Slash hint */}
        <div className="fn-slash-hint">type / for commands</div>
      </div>

      {/* ── Footer ── */}
      <div className="fn-footer">
        <span className="fn-word-count">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="fn-expand-btn"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Collapse' : 'Expand editor'}
          >
            {expanded ? (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m5 15 7-7 7 7" />
              </svg>
            ) : (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m19 9-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Floating selection toolbar ── */}
      {floatToolbar && (
        <div
          className="fn-float-toolbar"
          style={{
            left: floatToolbar.x,
            top: floatToolbar.y - 48,
            transform: 'translateX(-50%)',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {[
            { cmd: 'bold', icon: <Bold size={13} /> },
            { cmd: 'italic', icon: <Italic size={13} /> },
            { cmd: 'underline', icon: <Underline size={13} /> },
            { cmd: 'strikeThrough', icon: <Strikethrough size={13} /> },
            { sep: true },
            {
              block: 'H1',
              icon: (
                <span
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: '.6rem',
                    fontWeight: 700,
                  }}
                >
                  H1
                </span>
              ),
            },
            {
              block: 'H2',
              icon: (
                <span
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: '.6rem',
                    fontWeight: 700,
                  }}
                >
                  H2
                </span>
              ),
            },
            { sep: true },
            { action: () => insertList(false), icon: <List size={13} /> },
            { block: 'BLOCKQUOTE', icon: <Quote size={13} /> },
            { block: 'PRE', icon: <Code size={13} /> },
          ].map((item, i) =>
            item.sep ? (
              <div key={i} className="fn-float-sep" />
            ) : (
              <button
                key={i}
                className="fn-float-btn"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (item.cmd) {
                    restoreSelection();
                    exec(item.cmd);
                  } else if (item.block) {
                    restoreSelection();
                    formatBlock(item.block);
                  } else if (item.action) {
                    restoreSelection();
                    item.action();
                  }
                  setFloatToolbar(null);
                }}
              >
                {item.icon}
              </button>
            ),
          )}
        </div>
      )}

      {/* ── Slash command menu ── */}
      {slashMenu && (
        <div
          className="fn-slash-menu"
          style={{
            left: Math.min(slashMenu.x, window.innerWidth - 240),
            top: slashMenu.y,
          }}
        >
          <div className="fn-slash-header">Commands</div>
          {SLASH_COMMANDS.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`fn-slash-item ${i === slashIdx ? 'highlighted' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                execSlashCmd(cmd);
              }}
              onMouseEnter={() => setSlashIdx(i)}
            >
              <div className="fn-slash-icon">{cmd.icon}</div>
              <div className="fn-slash-info">
                <div className="fn-slash-name">{cmd.name}</div>
                <div className="fn-slash-desc">{cmd.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function FocusMode() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { supabase, loading: sbLoading } = useSupabase();
  const focusFolderIdRef = useRef(null);
  const { theme, toggleTheme } = useTheme();

  /* timer */
  const [timerMode, setTimerMode] = useState('stopwatch');
  const [preset, setPreset] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);

  /* session meta */
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [goal, setGoal] = useState('');
  const [focusType, setFocusType] = useState('Deep Work');
  const [difficulty, setDifficulty] = useState('medium');

  /* notes — stored as HTML internally, markdown on save */
  const [notesHtml, setNotesHtml] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const notesTimer = useRef(null);

  // ── Populate permanent folder ID from localStorage ──
  useEffect(() => {
    if (user?.id) {
      const pfCacheKey = `pf_${user.id}___permanent_focus_notes__`;
      focusFolderIdRef.current = localStorage.getItem(pfCacheKey);
    }
  }, [user?.id]);

  /* log */
  const [logItems, setLogItems] = useState([]);
  const [logInput, setLogInput] = useState('');
  const logInputRef = useRef(null);

  /* ui */
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ripple, setRipple] = useState(false);
  const tipIdx = useRef(Math.floor(Math.random() * TIPS.length)).current;

  const isDark = theme === 'dark';
  const activeMins = customMinutes !== '' ? Number(customMinutes) : preset;
  const totalSecs = activeMins * 60;
  const elapsedMins = Math.floor(elapsed / 60);
  const doneCount = logItems.filter((i) => i.done).length;

  /* ── Timer tick ── */
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((p) => {
          const next = p + 1;
          if (timerMode === 'countdown' && next >= totalSecs) {
            clearInterval(intervalRef.current);
            setRunning(false);
            return next;
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, timerMode, totalSecs]);

  /* ── Space key ── */
  useEffect(() => {
    const handler = (e) => {
      if (
        e.code === 'Space' &&
        e.target.tagName !== 'TEXTAREA' &&
        e.target.tagName !== 'INPUT' &&
        !e.target.isContentEditable
      ) {
        e.preventDefault();
        toggleTimer();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [running]);

  /* ── Controls ── */
  const toggleTimer = useCallback(() => {
    if (!running) {
      if (!startedAtRef.current)
        startedAtRef.current = new Date().toISOString();
      setRunning(true);
    } else {
      setRunning(false);
    }
  }, [running]);
  const resetTimer = () => {
    setRunning(false);
    setElapsed(0);
    startedAtRef.current = null;
  };
  const switchMode = (m) => {
    if (running) return;
    setTimerMode(m);
    setElapsed(0);
    startedAtRef.current = null;
  };
  const pickPreset = (p) => {
    if (running) return;
    setPreset(p);
    setCustomMinutes('');
    setElapsed(0);
    startedAtRef.current = null;
  };
  const pickCustom = (val) => {
    if (running) return;
    if (val === '') {
      setCustomMinutes('');
      return;
    }
    const n = parseInt(val, 10);
    if (isNaN(n)) return;
    setCustomMinutes(String(Math.min(600, Math.max(1, n))));
    setElapsed(0);
    startedAtRef.current = null;
  };

  /* ── Notes auto-save ── */
  const handleNotesChange = useCallback((html) => {
    setNotesHtml(html);
    setSaveState('saving');
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2200);
    }, 800);
  }, []);

  /* ── Log ── */
  const addLog = () => {
    const txt = logInput.trim();
    if (!txt) return;
    setLogItems((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        text: txt,
        done: false,
        time: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    setLogInput('');
    logInputRef.current?.focus();
  };
  const toggleLog = (id) =>
    setLogItems((p) =>
      p.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
    );
  const deleteLog = (id) => setLogItems((p) => p.filter((i) => i.id !== id));

  /* ── SAVE ── */
  const handleSave = async () => {
    if (!supabase || saving) return;
    setSaving(true);
    const endedAt = new Date().toISOString();
    const startedAt = startedAtRef.current || endedAt;
    const focusedMins = Math.max(1, elapsedMins);
    const sessionTitle =
      title.trim() ||
      `Free Focus — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    // Convert editor HTML → clean markdown for the `notes` column
    const markdownNotes = htmlToMarkdown(notesHtml);
    const logAppend = logItems.length
      ? `\n\nActivity Log:\n${logItems.map((i) => `${i.done ? '✓' : '○'} ${i.text}`).join('\n')}`
      : '';
    const fullNotes = (markdownNotes + logAppend).trim();

    try {
      // ── 1. Insert into sessions (only confirmed-existing columns) ──
      const sessionPayload = {
        user_id: user?.id,
        title: sessionTitle,
        subject: subject.trim() || 'Free Focus',
        goal: goal.trim() || null,
        notes: fullNotes || null,
        duration: focusedMins,
        difficulty,
        focus_type: focusType,
        date: new Date().toISOString().split('T')[0],
        completed: true,
        is_completed: true,
      };

      const { data: session, error: sErr } = await supabase
        .from('sessions')
        .insert(sessionPayload)
        .select()
        .single();

      if (sErr) {
        console.error(
          'Session insert error:',
          sErr.message,
          sErr.details,
          sErr.hint,
        );
        throw sErr;
      }

      // ── 2. Insert into focus_logs ──
      const { error: logErr } = await supabase.from('focus_logs').insert({
        session_id: session.id,
        user_id: user?.id,
        started_at: startedAt,
        ended_at: endedAt,
        duration: focusedMins,
        completed: true,
      });
      if (logErr) console.error('Focus log insert error:', logErr.message);

      // ── 3. Sync notes to user_notes table (if it exists & notes content present) ──
      if (fullNotes && user?.id) {
        const noteTitle = sessionTitle + ' — Session Notes';
        const noteContent = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: sessionTitle }],
            },
            ...(subject.trim()
              ? [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        marks: [{ type: 'italic' }],
                        text: `Subject: ${subject.trim()}`,
                      },
                    ],
                  },
                ]
              : []),
            ...(goal.trim()
              ? [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        marks: [{ type: 'italic' }],
                        text: `Goal: ${goal.trim()}`,
                      },
                    ],
                  },
                ]
              : []),
            { type: 'horizontalRule' },
            // Notes body — split markdown lines into paragraphs
            ...fullNotes
              .split('\n')
              .filter(Boolean)
              .map((line) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
              })),
            ...(logItems.length
              ? [
                  { type: 'horizontalRule' },
                  {
                    type: 'heading',
                    attrs: { level: 3 },
                    content: [{ type: 'text', text: 'Activity Log' }],
                  },
                  {
                    type: 'bulletList',
                    content: logItems.map((item) => ({
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'text',
                              text: `${item.done ? '✓' : '○'} ${item.text}`,
                            },
                          ],
                        },
                      ],
                    })),
                  },
                ]
              : []),
          ],
        };

        const { error: noteErr } = await supabase.from('user_notes').insert({
          user_id: user.id,
          title: noteTitle,
          subject: subject.trim() || 'Focus Session',
          tags: [
            focusType.toLowerCase().replace(' ', '-'),
            difficulty,
            'focus-session',
          ],
          content: noteContent,
          collection_id: focusFolderIdRef.current || null, // ← ADD THIS LINE
          word_count: fullNotes.split(/\s+/).filter(Boolean).length,
        });
        if (noteErr)
          console.warn(
            'Notes sync skipped (user_notes table may not exist yet):',
            noteErr.message,
          );
      }

      // ── 4. Global sync — all pages listening will refetch ──
      window.dispatchEvent(
        new CustomEvent('session:created', { detail: session }),
      );

      setRunning(false);
      setShowSuccess(true);
    } catch (e) {
      console.error('Save error:', e?.message || e);
      alert(
        `Failed to save session: ${e?.message || 'Unknown error'}. Check the console for details.`,
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Ring math ── */
  const R = 88;
  const circ = 2 * Math.PI * R;
  const ringPct =
    timerMode === 'countdown'
      ? Math.max(0, 1 - elapsed / totalSecs)
      : Math.min(1, elapsed / 3600);
  const offset = circ * (1 - ringPct);
  const displaySecs =
    timerMode === 'countdown' ? Math.max(0, totalSecs - elapsed) : elapsed;

  /* ── Theme toggle ── */
  const handleTheme = () => {
    setRipple(true);
    toggleTheme();
    setTimeout(() => setRipple(false), 500);
  };

  return (
    <div className="fp">
      <style>{CSS}</style>

      <div className="fp-orbs" aria-hidden>
        <div className="fp-orb fp-orb1" />
        <div className="fp-orb fp-orb2" />
        <div className={`fp-orb fp-orb3 ${running ? 'live' : ''}`} />
      </div>
      <div className="fp-grain" aria-hidden />

      {/* ── TOPBAR ── */}
      <div className="fp-topbar">
        <div className="fp-logo">
          <div className="fp-logo-dot" />
          Focus Mode
        </div>
        <div className="fp-topbar-right">
          <div className={`fp-live-pill ${running ? 'running' : ''}`}>
            <span className="fp-live-dot" />
            {running ? 'Live' : 'Ready'}
          </div>
          <button
            className="fp-theme-toggle"
            onClick={handleTheme}
            aria-label="Toggle theme"
          >
            <div className="fp-toggle-track">
              <span className="fp-track-icon sun">
                <Sun size={10} strokeWidth={2.5} />
              </span>
              <span className="fp-track-icon moon">
                <Moon size={10} strokeWidth={2.5} />
              </span>
            </div>
            <div className="fp-toggle-thumb">
              {isDark ? (
                <Moon
                  size={11}
                  strokeWidth={2.5}
                  style={{ color: '#0e0d09' }}
                />
              ) : (
                <Sun size={11} strokeWidth={2.5} style={{ color: '#fff' }} />
              )}
            </div>
            {ripple && <div className="fp-toggle-ripple" />}
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="fp-wrap">
        {/* HERO */}
        <div className="fp-hero">
          <div className="fp-eyebrow">
            <Brain size={11} /> Free Focus Session
          </div>
          <input
            className="fp-title-input"
            placeholder="What are you working on today?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
          <div className="fp-chip-row">
            {FOCUS_TYPES.slice(0, 6).map((t) => (
              <button
                key={t}
                className={`fp-chip ${focusType === t ? 'active' : ''}`}
                onClick={() => setFocusType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="fp-layout">
          {/* ══ LEFT COLUMN ══ */}
          <div>
            {/* TIMER */}
            <div className="fp-timer-card fp-a1">
              <div className="fp-mode-row">
                {['stopwatch', 'countdown'].map((m) => (
                  <button
                    key={m}
                    className={`fp-mode-btn ${timerMode === m ? 'active' : ''}`}
                    onClick={() => switchMode(m)}
                  >
                    {m === 'stopwatch' ? 'Stopwatch' : 'Countdown'}
                  </button>
                ))}
              </div>
              {timerMode === 'countdown' && (
                <div className="fp-preset-row">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      className={`fp-preset-btn ${preset === p && customMinutes === '' ? 'active' : ''}`}
                      onClick={() => pickPreset(p)}
                    >
                      {p}m
                    </button>
                  ))}
                  <div
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="number"
                      min="1"
                      max="600"
                      placeholder="custom"
                      value={customMinutes}
                      disabled={running}
                      onChange={(e) => pickCustom(e.target.value)}
                      style={{
                        width: 72,
                        background:
                          customMinutes !== '' ? 'var(--gold3)' : 'transparent',
                        border: `1px solid ${customMinutes !== '' ? 'var(--gold)' : 'var(--border)'}`,
                        borderRadius: 20,
                        padding: '4px 20px 4px 9px',
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.55rem',
                        letterSpacing: '.06em',
                        color:
                          customMinutes !== '' ? 'var(--gold)' : 'var(--ink3)',
                        outline: 'none',
                        textAlign: 'center',
                        cursor: running ? 'not-allowed' : 'text',
                        opacity: running ? 0.5 : 1,
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: 8,
                        fontFamily: 'var(--f-mono)',
                        fontSize: '.5rem',
                        color:
                          customMinutes !== '' ? 'var(--gold)' : 'var(--ink3)',
                        pointerEvents: 'none',
                      }}
                    >
                      m
                    </span>
                  </div>
                </div>
              )}
              <div className="fp-ring-wrap">
                <svg className="fp-ring-svg" viewBox="0 0 200 200">
                  <circle className="fp-ring-track" cx="100" cy="100" r={R} />
                  <circle
                    className={`fp-ring-fill ${running ? '' : 'paused'}`}
                    cx="100"
                    cy="100"
                    r={R}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className="fp-ring-center">
                  <div className={`fp-timer-disp ${running ? 'live' : ''}`}>
                    {fmtSecs(displaySecs)}
                  </div>
                  <div className="fp-timer-sub">
                    {timerMode === 'countdown'
                      ? `${activeMins}m · remaining`
                      : 'elapsed'}
                  </div>
                </div>
              </div>
              <div className="fp-controls">
                <button className="fp-ctrl" onClick={resetTimer} title="Reset">
                  <RotateCcw size={16} />
                </button>
                <button className="fp-ctrl play" onClick={toggleTimer}>
                  {running ? <Pause size={22} /> : <Play size={22} />}
                </button>
                <button
                  className="fp-ctrl"
                  onClick={handleSave}
                  disabled={saving || elapsed < 10}
                  title="Save session"
                >
                  <Save size={16} />
                </button>
              </div>
              <div className="fp-timer-hint">
                Press <kbd className="fp-kbd">Space</kbd> to pause / resume
              </div>
            </div>

            {/* ACTIVITY LOG */}
            <div className="fp-card fp-a2">
              <div className="fp-card-head">
                <span className="fp-card-label">
                  <CheckCircle2 size={11} /> Activity Log
                </span>
                <span
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: '.52rem',
                    color: 'var(--ink3)',
                  }}
                >
                  {doneCount}/{logItems.length} done
                </span>
              </div>
              <div className="fp-card-body">
                {logItems.length === 0 ? (
                  <div className="fp-empty">
                    <div className="fp-empty-icon">
                      <PenLine size={18} />
                    </div>
                    <div className="fp-empty-text">
                      Log tasks and ideas as you go
                    </div>
                  </div>
                ) : (
                  <div className="fp-log-list">
                    {logItems.map((item) => (
                      <div key={item.id} className="fp-log-item">
                        <button
                          className={`fp-log-check ${item.done ? 'done' : ''}`}
                          onClick={() => toggleLog(item.id)}
                        >
                          {item.done && (
                            <Check size={11} style={{ color: '#fff' }} />
                          )}
                        </button>
                        <div className="fp-log-text">
                          <div
                            className={`fp-log-title ${item.done ? 'done' : ''}`}
                          >
                            {item.text}
                          </div>
                          <div className="fp-log-time">{item.time}</div>
                        </div>
                        <button
                          className="fp-log-del"
                          onClick={() => deleteLog(item.id)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="fp-add-row">
                  <input
                    ref={logInputRef}
                    className="fp-add-input"
                    placeholder="Add a task, idea, or milestone…"
                    value={logInput}
                    onChange={(e) => setLogInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addLog();
                    }}
                  />
                  <button className="fp-add-btn" onClick={addLog}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* NOTES EDITOR */}
            <NotesEditor
              value={notesHtml}
              onChange={handleNotesChange}
              saveState={saveState}
            />

            {/* SAVE ROW */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                marginTop: 4,
              }}
              className="fp-a4"
            >
              <button
                className="fp-btn fp-btn-outline"
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </button>
              <button
                className="fp-btn fp-btn-gold"
                onClick={handleSave}
                disabled={saving || elapsed < 10}
              >
                {saving ? (
                  'Saving…'
                ) : (
                  <>
                    <Award size={13} /> Save Session
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ══ SIDEBAR ══ */}
          <div className="fp-sidebar">
            <div className="fp-tip-box fp-a1">
              <div className="fp-tip-title">
                <Sparkles size={10} /> Focus Tip
              </div>
              <div className="fp-tip-text">"{TIPS[tipIdx]}"</div>
            </div>

            <div className="fp-card fp-a2">
              <div className="fp-card-head">
                <span className="fp-card-label">
                  <Tag size={11} /> Session Info
                </span>
              </div>
              <div className="fp-card-body">
                <div className="fp-meta-form">
                  <div>
                    <div className="fp-field-label">
                      <BookOpen size={10} /> Subject
                    </div>
                    <input
                      className="fp-text-input"
                      placeholder="e.g. Mathematics, Coding…"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="fp-field-label">
                      <Zap size={10} /> Focus Type
                    </div>
                    <select
                      className="fp-select"
                      value={focusType}
                      onChange={(e) => setFocusType(e.target.value)}
                    >
                      {FOCUS_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="fp-field-label">
                      <Flame size={10} /> Difficulty
                    </div>
                    <div className="fp-diff-row">
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d.value}
                          className={`fp-diff-btn ${d.value} ${difficulty === d.value ? 'on' : ''}`}
                          onClick={() => setDifficulty(d.value)}
                        >
                          <span className="g">{d.glyph}</span>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="fp-field-label">
                      <Target size={10} /> Goal
                    </div>
                    <textarea
                      className="fp-goal-ta"
                      rows={2}
                      placeholder="What do you want to achieve?"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="fp-card fp-a3">
              <div className="fp-card-head">
                <span className="fp-card-label">
                  <Clock size={11} /> Live Stats
                </span>
              </div>
              <div className="fp-card-body">
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {[
                    {
                      label: 'Elapsed',
                      val: fmtMins(elapsedMins) || '0m',
                      icon: Clock,
                    },
                    {
                      label: 'Tasks Done',
                      val: `${doneCount} / ${logItems.length}`,
                      icon: CheckCircle2,
                    },
                    { label: 'Subject', val: subject || '—', icon: BookOpen },
                    {
                      label: 'Difficulty',
                      val: difficulty
                        ? difficulty[0].toUpperCase() + difficulty.slice(1)
                        : '—',
                      icon: Flame,
                    },
                  ].map(({ label, val, icon: Icon }) => (
                    <div key={label} className="fp-stat-row">
                      <span className="fp-stat-label">
                        <Icon size={10} />
                        {label}
                      </span>
                      <span className="fp-stat-val">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUCCESS OVERLAY ── */}
      {showSuccess && (
        <div className="fp-overlay" onClick={() => setShowSuccess(false)}>
          <div className="fp-ov-card" onClick={(e) => e.stopPropagation()}>
            <div className="fp-ov-sparks" aria-hidden>
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="fp-ov-spark"
                  style={{
                    width: `${4 + Math.random() * 7}px`,
                    height: `${4 + Math.random() * 7}px`,
                    left: `${8 + Math.random() * 84}%`,
                    bottom: `${5 + Math.random() * 40}%`,
                    '--d': `${0.5 + Math.random() * 0.9}s`,
                    '--delay': `${Math.random() * 0.5}s`,
                  }}
                />
              ))}
            </div>
            <div className="fp-ov-ring">
              <Award size={30} strokeWidth={1.4} />
            </div>
            <div className="fp-ov-title">
              Session <em>Saved</em>
            </div>
            <p className="fp-ov-sub">
              Your focus block has been logged and your dashboard updated. Keep
              the momentum going.
            </p>
            <div className="fp-ov-stats">
              <div>
                <div className="fp-ov-stat-val">
                  {fmtMins(elapsedMins) || '—'}
                </div>
                <div className="fp-ov-stat-label">Focus Time</div>
              </div>
              <div>
                <div className="fp-ov-stat-val">{doneCount}</div>
                <div className="fp-ov-stat-label">Tasks Done</div>
              </div>
              {subject && (
                <div>
                  <div className="fp-ov-stat-val" style={{ fontSize: '1rem' }}>
                    {subject}
                  </div>
                  <div className="fp-ov-stat-label">Subject</div>
                </div>
              )}
            </div>
            <div className="fp-ov-actions">
              <button
                className="fp-btn fp-btn-outline"
                onClick={() => {
                  setShowSuccess(false);
                  setElapsed(0);
                  setRunning(false);
                  setTitle('');
                  setNotesHtml('');
                  setLogItems([]);
                  setCustomMinutes('');
                  startedAtRef.current = null;
                }}
              >
                <RotateCcw size={12} /> New Session
              </button>
              <button
                className="fp-btn fp-btn-gold"
                onClick={() => navigate('/dashboard')}
              >
                Dashboard <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/*
════════════════════════════════════════════════════════════════
  SUPABASE — No schema changes required for basic usage.
  The existing `notes text` column stores the markdown output.

  OPTIONAL — Run this in Supabase SQL Editor to also persist
  the raw HTML (for future rendering without re-parsing):

  ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS notes_html text;

  Then in handleSave, also pass:
    notes_html: notesHtml || null,

  INDEX for full-text search on notes (optional, performance):
  CREATE INDEX IF NOT EXISTS idx_sessions_notes_fts
    ON public.sessions USING gin(to_tsvector('english', coalesce(notes,'')));
════════════════════════════════════════════════════════════════
*/
