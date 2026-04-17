/**
 * NotesPage.jsx — Phase 5: File Explorer System
 *
 * New in this phase:
 *   📁 Hierarchical collections (folders nest infinitely)
 *   🗂  File-explorer navigation (click folder → enter, back → parent)
 *   🧭 Breadcrumb navigation component
 *   🌲 Recursive sidebar tree with expand/collapse
 *   🃏 CollectionCard — same card customization system as NoteCard
 *   🔀 Mixed grid: folders first, notes after
 *   💾 card_style persisted on collections (jsonb)
 *   🚀 All Phase 4 note features retained (tilt, shine, customizer, etc.)
 */

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import AppNavbar from '../components/app/AppNavbar';
import CommandPalette from '../components/CommandPalette';
import {
  buildCollectionTree,
  buildCollectionsMap,
  getAncestorPath,
  getDirectChildren,
  getDirectNotes,
  flattenTree,
  getDescendantIds,
} from '../lib/collectionTree';
import {
  Plus,
  Search,
  Grid3X3,
  List,
  Pin,
  Trash2,
  BookOpen,
  X,
  ChevronRight,
  ChevronLeft,
  FileText,
  Folder,
  FolderOpen,
  Hash,
  PenLine,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Palette,
  Sparkles,
  Type,
  Smile,
  Zap,
  Link2,
  Network,
  Home,
  FolderPlus,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const timeAgo = (ts) => {
  const d = new Date(ts),
    now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const snippetFromContent = (content) => {
  if (!content) return '';
  try {
    const extract = (node) => {
      if (node.type === 'text') return node.text || '';
      if (node.content) return node.content.map(extract).join(' ');
      return '';
    };
    return extract(content).replace(/\s+/g, ' ').trim().slice(0, 110);
  } catch {
    return '';
  }
};

// ── PERMANENT FOLDER SLUGS (never delete these) ──
const PERMANENT_FOLDER_SLUGS = {
  SESSION_NOTES: '__permanent_session_notes__',
  FOCUS_NOTES: '__permanent_focus_notes__',
};

const COLLECTION_COLORS = [
  '#c4913a',
  '#6b9e6b',
  '#5b8fa8',
  '#b85c4a',
  '#9b6bae',
  '#c06b8a',
  '#5a8a9b',
  '#7a8aca',
];

/* ═══════════════════════════════════════════════════════════════
   CARD PALETTE SYSTEM
═══════════════════════════════════════════════════════════════ */
const SUBJECT_ACCENTS = [
  { keys: ['math', 'calculus', 'algebra', 'geometry', 'statistics'], hue: 250 },
  { keys: ['physics', 'science', 'chemistry', 'biology', 'nature'], hue: 150 },
  { keys: ['history', 'literature', 'philosophy', 'humanities'], hue: 35 },
  {
    keys: [
      'code',
      'programming',
      'computer',
      'software',
      'engineering',
      'tech',
      'dev',
      'web',
    ],
    hue: 210,
  },
  { keys: ['design', 'ui', 'ux', 'creative', 'visual'], hue: 285 },
  {
    keys: ['business', 'finance', 'economics', 'marketing', 'product'],
    hue: 20,
  },
  {
    keys: ['language', 'english', 'spanish', 'french', 'writing', 'grammar'],
    hue: 165,
  },
  { keys: ['music', 'audio', 'sound', 'composition'], hue: 310 },
  {
    keys: ['health', 'medicine', 'psychology', 'wellness', 'fitness'],
    hue: 350,
  },
  { keys: ['personal', 'journal', 'notes', 'diary', 'ideas', 'todo'], hue: 50 },
];

function getCardAccentHue(subject, title) {
  const key = (subject || title || '').toLowerCase();
  for (const p of SUBJECT_ACCENTS) {
    if (p.keys.some((k) => key.includes(k))) return p.hue;
  }
  const code = (subject || title || 'N').charCodeAt(0);
  return (code * 137) % 360;
}

function getCardPalette(subject, title, isDark) {
  const hue = getCardAccentHue(subject, title);
  const sat = 70;
  const bgColor = isDark ? `hsl(${hue},${sat}%,8%)` : `hsl(${hue},${sat}%,96%)`;
  const bgColor2 = isDark
    ? `hsl(${hue},${sat}%,13%)`
    : `hsl(${hue},${sat - 10}%,92%)`;
  const letterColor = isDark
    ? `hsl(${hue},${sat}%,72%)`
    : `hsl(${hue},${sat}%,38%)`;
  const glow = isDark
    ? `hsla(${hue},${sat}%,60%,.35)`
    : `hsla(${hue},${sat}%,40%,.18)`;
  const accent = isDark ? `hsl(${hue},${sat}%,60%)` : `hsl(${hue},${sat}%,40%)`;
  return { bgColor, bgColor2, letterColor, glow, accent, hue };
}

/* ═══════════════════════════════════════════════════════════════
   CARD CUSTOMIZATION SYSTEM
═══════════════════════════════════════════════════════════════ */
const DEFAULT_CARD_STYLE = {
  theme: 'auto',
  accent: null,
  glow: 0.4,
  font: 'sans',
  emoji: null,
  effects: { tilt: true, shine: true, hoverGlow: true },
};

const ACCENT_PRESETS = [
  '#c4913a',
  '#e05b6a',
  '#6b9e8a',
  '#5b8fcc',
  '#9b6bce',
  '#e07840',
  '#50b89e',
  '#b06ba0',
];

const THEME_PRESETS = [
  { id: 'auto', label: 'Auto', icon: '✦' },
  { id: 'gradient-soft', label: 'Gradient', icon: '🌅' },
  { id: 'glass', label: 'Glass', icon: '💎' },
  { id: 'neon', label: 'Neon', icon: '⚡' },
  { id: 'luxury', label: 'Luxury', icon: '✨' },
  { id: 'pastel', label: 'Pastel', icon: '🌸' },
  { id: 'mesh', label: 'Mesh', icon: '🕸' },
  { id: 'aurora', label: 'Aurora', icon: '🌌' },
  { id: 'minimal', label: 'Minimal', icon: '◻' },
];

const FONT_OPTIONS = [
  { id: 'sans', label: 'Sans', style: { fontFamily: 'var(--f-ui)' } },
  {
    id: 'serif',
    label: 'Serif',
    style: { fontFamily: 'var(--f-display)', fontStyle: 'italic' },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    style: { fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800 },
  },
  { id: 'mono', label: 'Mono', style: { fontFamily: 'var(--f-mono)' } },
];

const EMOJI_OPTIONS = [
  null,
  '✦',
  '✨',
  '⚡',
  '🔥',
  '💡',
  '🎯',
  '📌',
  '🌙',
  '☀️',
  '🎨',
  '🔬',
  '💼',
  '🎵',
  '🌱',
  '💎',
  '🚀',
  '🧠',
  '📖',
  '🖊️',
  '📁',
  '🗂',
  '📂',
  '🌐',
  '🔑',
];

function buildHeroStyle(cardStyle, pal, isDark) {
  const cs = { ...DEFAULT_CARD_STYLE, ...cardStyle };
  const accentHex = cs.accent || pal.accent;

  switch (cs.theme) {
    case 'glass':
      return {
        background: isDark
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: isDark
          ? '1px solid rgba(255,255,255,0.08)'
          : '1px solid rgba(255,255,255,0.7)',
        boxShadow: isDark
          ? `inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4)`
          : `inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 32px rgba(0,0,0,0.08)`,
      };
    case 'neon': {
      const neonBg = isDark ? '#050810' : '#f0f4ff';
      const neonBg2 = isDark ? '#0a0f1e' : '#e8eeff';
      return {
        background: `linear-gradient(135deg, ${neonBg}, ${neonBg2})`,
        boxShadow: `0 0 0 1px ${accentHex}44, inset 0 0 30px ${accentHex}18`,
      };
    }
    case 'luxury': {
      const lBase = isDark ? '#0e0a06' : '#fdf8f0';
      const lBase2 = isDark ? '#1a1308' : '#f5ede0';
      return {
        background: `linear-gradient(135deg, ${lBase}, ${lBase2})`,
        boxShadow: `inset 0 0 40px rgba(196,145,58,0.08)`,
      };
    }
    case 'pastel': {
      const hue = pal.hue;
      const pBg = isDark ? `hsl(${hue},30%,12%)` : `hsl(${hue},80%,94%)`;
      const pBg2 = isDark ? `hsl(${hue},25%,16%)` : `hsl(${hue},60%,90%)`;
      return { background: `linear-gradient(135deg, ${pBg}, ${pBg2})` };
    }
    case 'mesh': {
      const hue = pal.hue,
        h2 = (hue + 60) % 360,
        h3 = (hue + 120) % 360;
      return isDark
        ? {
            background: `radial-gradient(ellipse at 20% 20%, hsl(${hue},60%,12%) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, hsl(${h2},60%,10%) 0%, transparent 60%), radial-gradient(ellipse at 50% 100%, hsl(${h3},50%,8%) 0%, transparent 50%), hsl(${hue},20%,7%)`,
          }
        : {
            background: `radial-gradient(ellipse at 20% 20%, hsl(${hue},70%,92%) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, hsl(${h2},70%,90%) 0%, transparent 60%), radial-gradient(ellipse at 50% 100%, hsl(${h3},60%,94%) 0%, transparent 50%), hsl(${hue},20%,97%)`,
          };
    }
    case 'aurora': {
      const hue = pal.hue,
        h2 = (hue + 80) % 360,
        h3 = (hue + 160) % 360;
      return isDark
        ? {
            background: `linear-gradient(135deg, hsl(${hue},70%,7%) 0%, hsl(${h2},60%,9%) 50%, hsl(${h3},65%,7%) 100%)`,
            boxShadow: `inset 0 0 60px hsl(${h2},70%,15%)`,
          }
        : {
            background: `linear-gradient(135deg, hsl(${hue},70%,94%) 0%, hsl(${h2},60%,92%) 50%, hsl(${h3},65%,94%) 100%)`,
          };
    }
    case 'minimal':
      return {
        background: isDark ? 'var(--surface2)' : 'var(--surface)',
        borderBottom: `2px solid ${accentHex}`,
      };
    default: // gradient-soft + auto
      return {
        background: `linear-gradient(135deg,${pal.bgColor},${pal.bgColor2})`,
      };
  }
}

/* ═══════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

:root{
  --bg:#f5f0e8;--surface:#faf7f2;--surface2:#f0ebe0;--surface3:#e8e0d0;
  --border:#ddd5c4;--border2:#ccc0a8;
  --ink:#1e1a14;--ink2:#5c5445;--ink3:#9c9283;
  --gold:#c4913a;--gold2:#e8b96a;--gold3:rgba(196,145,58,.1);--gold-glow:rgba(196,145,58,.2);
  --red:#b85c4a;--red2:rgba(184,92,74,.1);--green:#6b9e6b;--green2:rgba(107,158,107,.1);
  --shadow:0 2px 12px rgba(30,26,20,.08);--shadow-md:0 6px 24px rgba(30,26,20,.12);--shadow-lg:0 16px 48px rgba(30,26,20,.16);
  --f-display:'Cormorant Garamond',Georgia,serif;--f-ui:'Cabinet Grotesk',sans-serif;--f-mono:'JetBrains Mono',monospace;
  --ease:cubic-bezier(.16,1,.3,1);--spring:cubic-bezier(.34,1.56,.64,1);
  --r:12px;--sidebar-w:240px;
}
.dark{
  --bg:#0c0b09;--surface:#131210;--surface2:#1a1815;--surface3:#222019;
  --border:#2a2722;--border2:#35312b;--ink:#f0ead8;--ink2:#a89880;--ink3:#6b5f4e;
  --shadow:0 2px 12px rgba(0,0,0,.35);--shadow-md:0 6px 24px rgba(0,0,0,.45);--shadow-lg:0 16px 48px rgba(0,0,0,.6);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

.np{display:flex;flex-direction:column;min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--f-ui);transition:background .35s,color .35s}
.np-shell{display:flex;flex:1;overflow:hidden;height:calc(100vh - 62px)}

/* ── Sidebar ── */
.np-sidebar{width:var(--sidebar-w);flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;transition:background .35s,border-color .35s,width .3s var(--ease)}
.np-sidebar.collapsed{width:0;overflow:hidden}
.np-sidebar-top{padding:16px 16px 10px;border-bottom:1px solid var(--border);flex-shrink:0}
.np-sidebar-logo{display:flex;align-items:center;gap:8px;font-family:var(--f-display);font-size:1.05rem;font-weight:600;color:var(--ink);letter-spacing:-.01em;margin-bottom:12px}
.np-sidebar-logo em{font-style:italic;color:var(--gold)}
.np-new-note-btn{width:100%;display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1px dashed var(--border2);background:transparent;color:var(--ink3);font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .2s}
.np-new-note-btn:hover{border-color:var(--gold);color:var(--gold);background:var(--gold3)}
.np-sidebar-scroll{flex:1;overflow-y:auto;padding:10px 8px}
.np-sidebar-scroll::-webkit-scrollbar{width:3px}
.np-sidebar-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.np-nav-sec{margin-bottom:16px}
.np-nav-sec-label{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink3);padding:4px 8px;margin-bottom:4px}
.np-nav-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;font-family:var(--f-ui);font-size:.82rem;font-weight:500;color:var(--ink2);cursor:pointer;transition:all .15s;border:none;background:transparent;width:100%;text-align:left;position:relative}
.np-nav-item:hover{background:var(--surface2);color:var(--ink)}
.np-nav-item.active{background:var(--gold3);color:var(--gold)}
.np-nav-item.active::before{content:'';position:absolute;left:0;top:4px;bottom:4px;width:2px;background:var(--gold);border-radius:2px}
.np-nav-item-count{margin-left:auto;font-family:var(--f-mono);font-size:.5rem;color:var(--ink3);background:var(--surface3);padding:1px 6px;border-radius:10px}
.np-sidebar-foot{padding:12px 16px;border-top:1px solid var(--border);flex-shrink:0}
.np-stats-row{display:flex;justify-content:space-between;font-family:var(--f-mono);font-size:.54rem;color:var(--ink3);letter-spacing:.06em}

/* ── Sidebar Tree (recursive) ── */
.np-tree-node{position:relative}
.np-tree-row{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:.8rem;color:var(--ink2);transition:all .12s;border:none;background:transparent;width:100%;text-align:left}
.np-tree-row:hover{background:var(--surface2);color:var(--ink)}
.np-tree-row.active{background:var(--gold3);color:var(--gold)}
.np-tree-row.active::before{content:'';position:absolute;left:0;top:3px;bottom:3px;width:2px;background:var(--gold);border-radius:2px}
.np-tree-chevron{transition:transform .18s var(--ease);flex-shrink:0;color:var(--ink3)}
.np-tree-chevron.open{transform:rotate(90deg)}
.np-tree-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.np-tree-count{font-family:var(--f-mono);font-size:.46rem;color:var(--ink3);flex-shrink:0}
.np-tree-children{padding-left:14px;border-left:1px solid var(--border);margin-left:14px}
.np-tree-add-btn{width:16px;height:16px;border-radius:4px;border:none;background:transparent;color:var(--ink3);cursor:pointer;display:grid;place-items:center;opacity:0;transition:all .12s;flex-shrink:0}
.np-tree-row:hover .np-tree-add-btn{opacity:1}
.np-tree-add-btn:hover{color:var(--gold);background:var(--gold3)}

/* ── Main ── */
.np-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.np-topbar{padding:12px 22px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;background:var(--surface);transition:background .35s}
.np-search-wrap{flex:1;min-width:160px;max-width:340px;position:relative}
.np-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--ink3);pointer-events:none}
.np-search-input{width:100%;padding:8px 10px 8px 32px;background:var(--bg);border:1px solid var(--border);border-radius:9px;font-family:var(--f-ui);font-size:.82rem;color:var(--ink);outline:none;transition:border-color .2s}
.np-search-input::placeholder{color:var(--ink3)}
.np-search-input:focus{border-color:var(--gold)}
.np-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--ink3);cursor:pointer;transition:color .15s}
.np-search-clear:hover{color:var(--ink)}
.np-topbar-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
.np-icon-btn{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:transparent;border:1px solid var(--border2);color:var(--ink3);cursor:pointer;transition:all .15s;flex-shrink:0}
.np-icon-btn:hover{border-color:var(--gold);color:var(--gold)}
.np-icon-btn.active{background:var(--gold3);border-color:var(--gold);color:var(--gold)}
.np-new-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--gold);border:none;border-radius:9px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:#fff;cursor:pointer;transition:all .22s var(--spring);white-space:nowrap;flex-shrink:0}
.dark .np-new-btn{color:#0c0b09}
.np-new-btn:hover{background:var(--gold2);transform:translateY(-1px);box-shadow:0 4px 14px rgba(196,145,58,.3)}
.np-sidebar-toggle{width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s;flex-shrink:0}
.np-sidebar-toggle:hover{border-color:var(--gold);color:var(--gold)}

/* ── Breadcrumbs ── */
.np-breadcrumbs{display:flex;align-items:center;gap:4px;padding:12px 24px 0;flex-shrink:0;flex-wrap:wrap}
.np-bread-item{display:inline-flex;align-items:center;gap:4px;font-family:var(--f-mono);font-size:.56rem;letter-spacing:.08em;color:var(--ink3);cursor:pointer;padding:3px 7px;border-radius:6px;transition:all .15s;border:none;background:transparent}
.np-bread-item:hover{color:var(--gold);background:var(--gold3)}
.np-bread-item.current{color:var(--ink2);cursor:default}
.np-bread-item.current:hover{background:transparent;color:var(--ink2)}
.np-bread-sep{color:var(--ink3);opacity:.4;font-size:.6rem;flex-shrink:0}

/* ── Page head ── */
.np-page-head{padding:16px 24px 0;flex-shrink:0}
.np-page-eyebrow{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:6px;margin-bottom:6px}
.np-page-eyebrow::before{content:'';display:block;width:16px;height:1px;background:currentColor;opacity:.5}
.np-page-title{font-family:var(--f-display);font-size:clamp(1.6rem,3vw,2.2rem);font-weight:300;letter-spacing:-.02em;color:var(--ink)}
.np-page-title em{font-style:italic;color:var(--gold)}
.np-page-sub{font-family:var(--f-mono);font-size:.54rem;color:var(--ink3);letter-spacing:.06em;margin-top:4px}

/* Sort */
.np-sort-wrap{position:relative;flex-shrink:0}
.np-sort-btn{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.06em;padding:6px 26px 6px 10px;border-radius:9px;border:1px solid var(--border2);background:var(--bg);color:var(--ink3);cursor:pointer;outline:none;display:flex;align-items:center;gap:5px;white-space:nowrap;transition:border-color .15s,color .15s;position:relative}
.np-sort-btn::after{content:'';position:absolute;right:9px;top:50%;transform:translateY(-50%);width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:4px solid currentColor;opacity:.6}
.np-sort-btn:hover,.np-sort-btn.open{border-color:var(--gold);color:var(--gold)}
.np-sort-dropdown{position:absolute;top:calc(100% + 6px);left:0;min-width:140px;background:var(--surface);border:1px solid var(--border2);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);z-index:200;overflow:hidden;animation:np-sort-in .18s var(--spring)}
@keyframes np-sort-in{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}
.np-sort-option{display:block;width:100%;padding:8px 14px;font-family:var(--f-mono);font-size:.56rem;letter-spacing:.06em;color:var(--ink2);background:transparent;border:none;cursor:pointer;text-align:left;transition:background .12s,color .12s}
.np-sort-option:hover{background:var(--surface2);color:var(--ink)}
.np-sort-option.selected{color:var(--gold);background:var(--gold3)}

/* ── Content ── */
.np-content{flex:1;overflow-y:auto;padding:14px 24px 40px}
.np-content::-webkit-scrollbar{width:5px}
.np-content::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
.np-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.np-list{display:flex;flex-direction:column;gap:8px}
.np-section-label{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);padding:12px 0 6px;display:flex;align-items:center;gap:6px}
.np-section-label::after{content:'';flex:1;height:1px;background:var(--border);margin-left:6px}

/* ══ COLLECTION CARD ══ */
.cc{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;cursor:pointer;position:relative;transition:transform .28s var(--ease),box-shadow .28s var(--ease),border-color .28s;display:flex;flex-direction:column;transform-style:preserve-3d;will-change:transform}
.cc:hover{box-shadow:0 20px 48px rgba(0,0,0,.14),0 0 0 1px rgba(255,255,255,.03);border-color:var(--border2)}
.cc.effect-glow:hover{box-shadow:0 20px 48px rgba(0,0,0,.14),0 0 32px color-mix(in srgb,var(--nc-glow-color,#c4913a) calc(var(--nc-glow-alpha,.4)*100%),transparent)}
.cc-shine{position:absolute;inset:0;pointer-events:none;z-index:10;opacity:0;transition:opacity .3s;background:linear-gradient(105deg,transparent 20%,rgba(255,255,255,.15) 50%,transparent 80%);transform:translateX(-100%)}
.cc:hover .cc-shine.active{opacity:1;animation:nc-shine-sweep .7s var(--ease) forwards}
@keyframes nc-shine-sweep{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.cc-hero{position:relative;height:100px;overflow:hidden;flex-shrink:0;transition:background .35s}
.cc-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 80% at 50% 110%,var(--nc-glow,transparent),transparent 70%);opacity:.9;pointer-events:none}
.cc-hero::after{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:.06;mix-blend-mode:overlay;pointer-events:none}
.cc-letter{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:4rem;font-weight:700;font-style:italic;line-height:1;color:var(--nc-text,currentColor);letter-spacing:-.04em;text-shadow:0 0 48px var(--nc-glow,transparent);user-select:none;pointer-events:none;transition:transform .35s var(--ease)}
.cc:hover .cc-letter{transform:scale(1.06) translateY(-2px)}
.cc-emoji{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2.8rem;line-height:1;user-select:none;pointer-events:none;transition:transform .35s var(--ease)}
.cc:hover .cc-emoji{transform:scale(1.12) translateY(-3px)}
.cc-folder-badge{position:absolute;bottom:8px;left:10px;font-family:var(--f-mono);font-size:.48rem;letter-spacing:.12em;text-transform:uppercase;padding:2px 7px;border-radius:20px;border:1px solid rgba(128,128,128,.2);backdrop-filter:blur(4px);color:var(--nc-accent,var(--ink3));background:color-mix(in srgb,var(--nc-accent,var(--ink3)) 8%,transparent);pointer-events:none}
.cc-menu-btn{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:7px;background:rgba(0,0,0,.25);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85);cursor:pointer;display:grid;place-items:center;opacity:0;transition:opacity .2s,background .15s;z-index:20}
.cc:hover .cc-menu-btn,.cc-menu-btn.open{opacity:1}
.cc-menu-btn:hover{background:rgba(0,0,0,.45)}
.cc-body{padding:12px 14px 8px;flex:1}
.cc-name{font-family:var(--f-ui);font-size:.92rem;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}
.cc-meta{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);letter-spacing:.04em}
.cc-footer{padding:8px 14px 10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.cc-stats{display:flex;gap:10px}
.cc-stat{font-family:var(--f-mono);font-size:.48rem;color:var(--ink3);display:flex;align-items:center;gap:3px}
.cc-actions{display:flex;gap:4px;opacity:0;transition:opacity .15s}
.cc:hover .cc-actions{opacity:1}
.cc-action{width:24px;height:24px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s}
.cc-action:hover{border-color:var(--gold);color:var(--gold)}
.cc-action.danger:hover{border-color:var(--red);color:var(--red)}
.cc-col-bar{height:3px;flex-shrink:0}
/* navigate arrow */
.cc-nav-arrow{position:absolute;top:8px;left:8px;width:22px;height:22px;border-radius:6px;background:rgba(0,0,0,.2);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.7);display:grid;place-items:center;pointer-events:none;opacity:0;transition:opacity .2s}
.cc:hover .cc-nav-arrow{opacity:1}

/* ══ NOTE CARD ══ */
.nc{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;cursor:pointer;position:relative;transition:transform .28s var(--ease),box-shadow .28s var(--ease),border-color .28s;display:flex;flex-direction:column;transform-style:preserve-3d;will-change:transform}
.nc:hover{box-shadow:0 20px 48px rgba(0,0,0,.14),0 0 0 1px rgba(255,255,255,.03);border-color:var(--border2)}
.nc.pinned{border-color:rgba(196,145,58,.35)}
.nc.effect-glow:hover{box-shadow:0 20px 48px rgba(0,0,0,.14),0 0 32px color-mix(in srgb,var(--nc-glow-color,#c4913a) calc(var(--nc-glow-alpha,.4)*100%),transparent)}
.nc-shine{position:absolute;inset:0;pointer-events:none;z-index:10;opacity:0;transition:opacity .3s;background:linear-gradient(105deg,transparent 20%,rgba(255,255,255,.15) 50%,transparent 80%);transform:translateX(-100%)}
.nc:hover .nc-shine.active{opacity:1;animation:nc-shine-sweep .7s var(--ease) forwards}
.nc-hero{position:relative;height:128px;overflow:hidden;flex-shrink:0;transition:background .35s}
.nc-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 80% at 50% 110%,var(--nc-glow,transparent),transparent 70%);opacity:.9;pointer-events:none}
.nc-hero::after{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:.06;mix-blend-mode:overlay;pointer-events:none}
.nc-letter{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:5.5rem;font-weight:700;font-style:italic;line-height:1;color:var(--nc-text,currentColor);letter-spacing:-.04em;text-shadow:0 0 48px var(--nc-glow,transparent),0 0 16px var(--nc-glow,transparent);transition:transform .35s var(--ease);user-select:none;pointer-events:none}
.nc-letter.font-sans{font-family:var(--f-ui);font-style:normal}
.nc-letter.font-serif{font-family:var(--f-display);font-style:italic}
.nc-letter.font-editorial{font-family:'Cabinet Grotesk',sans-serif;font-weight:800;font-style:normal}
.nc-letter.font-mono{font-family:var(--f-mono);font-style:normal;font-weight:400}
.nc:hover .nc-letter{transform:scale(1.06) translateY(-2px)}
.nc-emoji{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:3.5rem;line-height:1;transition:transform .35s var(--ease);user-select:none;pointer-events:none}
.nc:hover .nc-emoji{transform:scale(1.12) translateY(-3px)}
.nc-subject{position:absolute;bottom:10px;left:12px;font-family:var(--f-mono);font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:20px;border:1px solid rgba(128,128,128,.2);backdrop-filter:blur(4px);pointer-events:none;color:var(--nc-accent,var(--ink3));background:color-mix(in srgb,var(--nc-accent,var(--ink3)) 8%,transparent)}
.nc-pin-dot{position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;background:rgba(128,128,128,.15);backdrop-filter:blur(4px);border:1px solid rgba(128,128,128,.2);display:grid;place-items:center;color:var(--gold)}
.nc-menu-btn{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:7px;background:rgba(0,0,0,.25);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85);cursor:pointer;display:grid;place-items:center;opacity:0;transition:opacity .2s,background .15s,transform .15s var(--spring);z-index:20;flex-shrink:0}
.nc:hover .nc-menu-btn,.nc-menu-btn.open{opacity:1}
.nc-menu-btn:hover{background:rgba(0,0,0,.45);transform:scale(1.08)}
.nc.pinned .nc-menu-btn{right:38px}
.nc-body{padding:14px 15px 8px;flex:1;display:flex;flex-direction:column;gap:6px}
.nc-title{font-family:var(--f-ui);font-size:.92rem;font-weight:700;color:var(--ink);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nc-title.font-serif{font-family:var(--f-display)}
.nc-title.font-editorial{font-family:'Cabinet Grotesk',sans-serif;font-weight:800}
.nc-title.font-mono{font-family:var(--f-mono)}
.nc-snippet{font-family:var(--f-ui);font-size:.74rem;color:var(--ink3);line-height:1.62;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1;min-height:0}
.nc-tags{display:flex;gap:5px;flex-wrap:wrap}
.nc-tag{font-family:var(--f-mono);font-size:.48rem;letter-spacing:.07em;padding:2px 7px;border-radius:20px;background:var(--surface2);border:1px solid var(--border);color:var(--ink3)}
.nc-footer{padding:9px 15px 12px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.nc-date{font-family:var(--f-mono);font-size:.5rem;color:var(--ink3);letter-spacing:.06em}
.nc-actions{display:flex;gap:4px;opacity:0;transition:opacity .15s}
.nc:hover .nc-actions{opacity:1}
.nc-action{width:24px;height:24px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s}
.nc-action:hover{border-color:var(--gold);color:var(--gold)}
.nc-action.danger:hover{border-color:var(--red);color:var(--red)}
.nc-col-bar{height:3px;flex-shrink:0}
.nc-link-badge{display:inline-flex;align-items:center;gap:3px;font-family:var(--f-mono);font-size:.44rem;letter-spacing:.06em;padding:1px 6px;border-radius:10px;background:rgba(91,143,204,.1);border:1px solid rgba(91,143,204,.3);color:#5b8fcc;flex-shrink:0;transition:all .15s}
.dark .nc-link-badge{background:rgba(91,143,204,.14);border-color:rgba(91,143,204,.28);color:#7aaee0}

/* ── LIST cards ── */
.nlc{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all .2s}
.nlc:hover{transform:translateX(3px);box-shadow:var(--shadow);border-color:var(--border2)}
.nlc-dot{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;font-family:var(--f-display);font-size:1.1rem;font-weight:700;font-style:italic;flex-shrink:0;border:1px solid rgba(128,128,128,.12)}
.nlc-content{flex:1;min-width:0}
.nlc-title{font-family:var(--f-ui);font-size:.88rem;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.nlc-meta{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);letter-spacing:.06em}
.nlc-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.nlc-actions{display:flex;gap:4px;opacity:0;transition:opacity .15s}
.nlc:hover .nlc-actions{opacity:1}
/* folder list card */
.flc{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:11px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all .2s}
.flc:hover{transform:translateX(3px);box-shadow:var(--shadow);border-color:var(--border2)}
.flc-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;font-size:1rem;flex-shrink:0;border:1px solid rgba(128,128,128,.12)}
.flc-content{flex:1;min-width:0}
.flc-name{font-family:var(--f-ui);font-size:.88rem;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.flc-meta{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);letter-spacing:.06em}
.flc-actions{display:flex;gap:4px;opacity:0;transition:opacity .15s}
.flc:hover .flc-actions{opacity:1}

/* ══ CARD CUSTOMIZER ══ */
.nc-customizer{position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border2);border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.04);width:280px;overflow:hidden;animation:nc-panel-in .28s var(--spring)}
@keyframes nc-panel-in{from{opacity:0;transform:scale(.92) translateY(-8px)}to{opacity:1;transform:none}}
.nc-panel-head{padding:12px 14px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.nc-panel-title{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);display:flex;align-items:center;gap:5px}
.nc-panel-close{width:22px;height:22px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s}
.nc-panel-close:hover{border-color:var(--red);color:var(--red)}
.nc-panel-body{padding:12px 14px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
.nc-panel-body::-webkit-scrollbar{width:3px}
.nc-panel-body::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.nc-panel-sec-label{font-family:var(--f-mono);font-size:.48rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-bottom:6px;display:flex;align-items:center;gap:4px}
.nc-theme-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.nc-theme-btn{padding:6px 4px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:3px}
.nc-theme-btn:hover{border-color:var(--border2);background:var(--surface3)}
.nc-theme-btn.selected{border-color:var(--gold);background:var(--gold3)}
.nc-theme-icon{font-size:.85rem;line-height:1}
.nc-theme-label{font-family:var(--f-mono);font-size:.42rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
.nc-theme-btn.selected .nc-theme-label{color:var(--gold)}
.nc-accent-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.nc-accent-swatch{width:20px;height:20px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .15s,border-color .15s;flex-shrink:0}
.nc-accent-swatch:hover{transform:scale(1.18)}
.nc-accent-swatch.selected{border-color:var(--ink);transform:scale(1.15)}
.nc-color-input{width:26px;height:26px;border-radius:5px;border:1px solid var(--border2);cursor:pointer;padding:0;overflow:hidden;background:transparent}
.nc-color-input::-webkit-color-swatch-wrapper{padding:2px}
.nc-color-input::-webkit-color-swatch{border-radius:3px;border:none}
.nc-slider-row{display:flex;align-items:center;gap:8px}
.nc-slider{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:var(--border2);outline:none;cursor:pointer}
.nc-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:var(--gold);cursor:pointer;transition:transform .15s var(--spring)}
.nc-slider::-webkit-slider-thumb:hover{transform:scale(1.2)}
.nc-slider-val{font-family:var(--f-mono);font-size:.5rem;color:var(--ink3);width:24px;text-align:right;flex-shrink:0}
.nc-font-row{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.nc-font-btn{padding:6px 4px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;transition:all .15s;font-size:.7rem;color:var(--ink3);text-align:center}
.nc-font-btn:hover{border-color:var(--border2);background:var(--surface3);color:var(--ink)}
.nc-font-btn.selected{border-color:var(--gold);background:var(--gold3);color:var(--gold)}
.nc-emoji-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.nc-emoji-btn{padding:6px;border-radius:7px;border:1px solid transparent;background:transparent;cursor:pointer;font-size:.9rem;text-align:center;transition:all .12s;line-height:1}
.nc-emoji-btn:hover{background:var(--surface2);border-color:var(--border)}
.nc-emoji-btn.selected{background:var(--gold3);border-color:var(--gold)}
.nc-emoji-btn.none{font-family:var(--f-mono);font-size:.52rem;color:var(--ink3)}
.nc-effects-row{display:flex;flex-direction:column;gap:6px}
.nc-effect-item{display:flex;align-items:center;justify-content:space-between;gap:8px}
.nc-effect-label{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.06em;color:var(--ink2)}
.nc-toggle{position:relative;width:32px;height:18px;flex-shrink:0}
.nc-toggle input{opacity:0;width:0;height:0;position:absolute}
.nc-toggle-track{position:absolute;inset:0;border-radius:9px;background:var(--border2);cursor:pointer;transition:background .2s}
.nc-toggle input:checked + .nc-toggle-track{background:var(--gold)}
.nc-toggle-knob{position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:#fff;transition:transform .2s var(--spring)}
.nc-toggle input:checked ~ .nc-toggle-knob{transform:translateX(14px)}
.nc-panel-foot{padding:10px 14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:6px}
.nc-panel-reset{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.08em;padding:6px 10px;border-radius:7px;border:1px solid var(--border2);background:transparent;color:var(--ink3);cursor:pointer;transition:all .15s}
.nc-panel-reset:hover{border-color:var(--red);color:var(--red)}
.nc-panel-save{font-family:var(--f-mono);font-size:.52rem;letter-spacing:.08em;padding:6px 12px;border-radius:7px;border:none;background:var(--gold);color:#fff;cursor:pointer;transition:all .2s var(--spring);display:flex;align-items:center;gap:4px}
.dark .nc-panel-save{color:#0c0b09}
.nc-panel-save:hover{background:var(--gold2);transform:translateY(-1px)}

/* ── Modals ── */
.np-modal-backdrop{position:fixed;inset:0;z-index:500;background:rgba(14,13,9,.65);backdrop-filter:blur(14px);display:grid;place-items:center;padding:20px;animation:np-fade .3s ease}
@keyframes np-fade{from{opacity:0}to{opacity:1}}
.np-modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;width:100%;max-width:500px;box-shadow:var(--shadow-lg);animation:np-modal-in .4s var(--spring)}
@keyframes np-modal-in{from{opacity:0;transform:scale(.92) translateY(20px)}to{opacity:1;transform:none}}
.np-modal-head{padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.np-modal-title{font-family:var(--f-display);font-size:1.4rem;font-weight:300;color:var(--ink)}
.np-modal-title em{font-style:italic;color:var(--gold)}
.np-modal-close{width:28px;height:28px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--ink3);cursor:pointer;display:grid;place-items:center;transition:all .15s;flex-shrink:0;margin-top:2px}
.np-modal-close:hover{border-color:var(--red);color:var(--red)}
.np-modal-body{padding:20px 24px}
.np-modal-foot{padding:14px 24px 20px;display:flex;gap:8px;justify-content:flex-end}
.np-field{margin-bottom:16px}
.np-field-label{font-family:var(--f-mono);font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:5px;display:flex;align-items:center;gap:4px}
.np-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:var(--f-ui);font-size:.88rem;color:var(--ink);outline:none;transition:border-color .2s}
.np-input::placeholder{color:var(--ink3)}
.np-input:focus{border-color:var(--gold)}
.np-select{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:var(--f-ui);font-size:.88rem;color:var(--ink);outline:none;appearance:none;cursor:pointer;transition:border-color .2s;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239c9283' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
.np-select:focus{border-color:var(--gold)}
.np-select option{background:var(--surface2)}
.np-tag-wrap{display:flex;flex-wrap:wrap;gap:5px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;cursor:text;transition:border-color .2s;min-height:40px;align-items:center}
.np-tag-wrap:focus-within{border-color:var(--gold)}
.np-tag-pill{display:inline-flex;align-items:center;gap:4px;font-family:var(--f-mono);font-size:.55rem;letter-spacing:.06em;padding:3px 8px;border-radius:20px;background:var(--gold3);border:1px solid rgba(196,145,58,.3);color:var(--gold)}
.np-tag-pill button{background:none;border:none;cursor:pointer;color:inherit;padding:0;display:flex;align-items:center;line-height:1}
.np-tag-bare{background:transparent;border:none;outline:none;font-family:var(--f-mono);font-size:.6rem;color:var(--ink);flex:1;min-width:80px}
.np-tag-bare::placeholder{color:var(--ink3)}
.np-color-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:6px}
.np-color-swatch{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .15s,border-color .15s}
.np-color-swatch:hover{transform:scale(1.2)}
.np-color-swatch.selected{border-color:var(--ink);transform:scale(1.15)}
.np-btn{display:inline-flex;align-items:center;gap:6px;font-family:var(--f-mono);font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;padding:9px 16px;border-radius:8px;border:none;cursor:pointer;transition:all .2s var(--spring);white-space:nowrap}
.np-btn:disabled{opacity:.4;cursor:not-allowed}
.np-btn-gold{background:var(--gold);color:#fff}
.dark .np-btn-gold{color:#0c0b09}
.np-btn-gold:hover:not(:disabled){background:var(--gold2);transform:translateY(-1px);box-shadow:0 4px 12px rgba(196,145,58,.3)}
.np-btn-outline{background:transparent;border:1px solid var(--border2);color:var(--ink2)}
.np-btn-outline:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}
.np-btn-danger{background:var(--red2);border:1px solid rgba(184,92,74,.3);color:var(--red)}
.np-btn-danger:hover:not(:disabled){background:rgba(184,92,74,.2)}
.np-error{display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--red2);border:1px solid rgba(184,92,74,.3);border-radius:7px;font-family:var(--f-mono);font-size:.58rem;color:var(--red);margin-bottom:12px}

/* ── Empty / Loading ── */
.np-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 24px;text-align:center;gap:14px}
.np-empty-glyph{font-family:var(--f-display);font-size:4rem;color:var(--gold);opacity:.3;line-height:1}
.np-empty-title{font-family:var(--f-display);font-size:1.5rem;font-weight:300;color:var(--ink2)}
.np-empty-sub{font-family:var(--f-mono);font-size:.58rem;letter-spacing:.08em;color:var(--ink3);max-width:260px;line-height:1.7}
.np-skeleton{background:linear-gradient(90deg,var(--border) 25%,var(--surface2) 50%,var(--border) 75%);background-size:200% 100%;animation:np-shimmer 1.5s infinite;border-radius:var(--r)}
@keyframes np-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes np-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.np-a1{animation:np-up .5s .03s var(--ease) both}
.np-a2{animation:np-up .5s .08s var(--ease) both}
.np-a3{animation:np-up .5s .13s var(--ease) both}
`;

/* ═══════════════════════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════════════════════ */
function useBacklinkCounts(notes) {
  return useMemo(() => {
    const map = new Map();
    notes.forEach((n) => {
      (Array.isArray(n.links) ? n.links : []).forEach((targetId) => {
        map.set(targetId, (map.get(targetId) || 0) + 1);
      });
    });
    return map;
  }, [notes]);
}

/* ═══════════════════════════════════════════════════════════════
   SORT DROPDOWN
═══════════════════════════════════════════════════════════════ */
const SORT_OPTIONS = [
  { value: 'updated', label: 'Last updated' },
  { value: 'created', label: 'Date created' },
  { value: 'title', label: 'Title A–Z' },
];

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = SORT_OPTIONS.find((o) => o.value === value);
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="np-sort-wrap">
      <button
        className={`np-sort-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen((p) => !p)}
      >
        {selected?.label}
      </button>
      {open && (
        <div className="np-sort-dropdown">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`np-sort-option ${value === o.value ? 'selected' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAG INPUT
═══════════════════════════════════════════════════════════════ */
function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');
  const ref = useRef(null);
  const add = (v) => {
    const t = v.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };
  const remove = (t) => onChange(tags.filter((x) => x !== t));
  return (
    <div className="np-tag-wrap" onClick={() => ref.current?.focus()}>
      {tags.map((t) => (
        <span key={t} className="np-tag-pill">
          #{t}
          <button
            onClick={(e) => {
              e.stopPropagation();
              remove(t);
            }}
          >
            <X size={9} />
          </button>
        </span>
      ))}
      <input
        ref={ref}
        className="np-tag-bare"
        placeholder={tags.length === 0 ? 'Add tags…' : ''}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(input);
          }
          if (e.key === 'Backspace' && !input && tags.length)
            remove(tags[tags.length - 1]);
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BREADCRUMBS
═══════════════════════════════════════════════════════════════ */
function Breadcrumbs({ currentFolderId, collectionsMap, onNavigate }) {
  const path = useMemo(
    () => getAncestorPath(currentFolderId, collectionsMap),
    [currentFolderId, collectionsMap],
  );

  return (
    <div className="np-breadcrumbs">
      <button className="np-bread-item" onClick={() => onNavigate(null)}>
        <Home size={11} /> All
      </button>
      {path.map((col, i) => (
        <span
          key={col.id}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <ChevronRight size={10} className="np-bread-sep" />
          <button
            className={`np-bread-item ${i === path.length - 1 ? 'current' : ''}`}
            onClick={() => i < path.length - 1 && onNavigate(col.id)}
          >
            {col.icon || '📁'} {col.name}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR TREE NODE (recursive)
═══════════════════════════════════════════════════════════════ */
const SidebarTreeNode = memo(function SidebarTreeNode({
  node,
  currentFolderId,
  noteCounts,
  onNavigate,
  depth = 0,
}) {
  const [open, setOpen] = useState(depth === 0);
  const isActive = currentFolderId === node.id;
  const count = noteCounts.get(node.id) || 0;
  const hasChildren = node.children.length > 0;

  return (
    <div className="np-tree-node">
      <button
        className={`np-tree-row ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: 10 + depth * 12 }}
        onClick={() => {
          onNavigate(node.id);
          if (hasChildren) setOpen((o) => !o);
        }}
      >
        {hasChildren ? (
          <ChevronRight
            size={11}
            className={`np-tree-chevron ${open ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
          />
        ) : (
          <span style={{ width: 11, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: '.82rem', flexShrink: 0 }}>
          {node.icon || '📁'}
        </span>
        <span className="np-tree-name">{node.name}</span>
        {count > 0 && <span className="np-tree-count">{count}</span>}
      </button>
      {open && hasChildren && (
        <div className="np-tree-children">
          {node.children.map((child) => (
            <SidebarTreeNode
              key={child.id}
              node={child}
              currentFolderId={currentFolderId}
              noteCounts={noteCounts}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   CARD CUSTOMIZER PANEL
═══════════════════════════════════════════════════════════════ */
function CardCustomizer({
  targetId,
  targetType,
  initial,
  onSave,
  onClose,
  anchorRect,
}) {
  const [style, setStyle] = useState({ ...DEFAULT_CARD_STYLE, ...initial });
  const panelRef = useRef(null);

  const panelStyle = useMemo(() => {
    if (!anchorRect) return { top: 80, right: 24 };
    const W = window.innerWidth,
      H = window.innerHeight;
    const PW = 280,
      PH = 480;
    let left = anchorRect.right - PW;
    let top = anchorRect.bottom + 8;
    if (left < 10) left = 10;
    if (left + PW > W - 10) left = W - PW - 10;
    if (top + PH > H - 10) top = anchorRect.top - PH - 8;
    if (top < 10) top = 10;
    return { position: 'fixed', top, left };
  }, [anchorRect]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    const h = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    setTimeout(() => window.addEventListener('mousedown', h), 0);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);

  const set = (patch) => setStyle((s) => ({ ...s, ...patch }));
  const setEffect = (key, val) =>
    setStyle((s) => ({
      ...s,
      effects: {
        ...DEFAULT_CARD_STYLE.effects,
        ...(s.effects || {}),
        [key]: val,
      },
    }));
  const effects = { ...DEFAULT_CARD_STYLE.effects, ...(style.effects || {}) };

  return (
    <div ref={panelRef} className="nc-customizer" style={panelStyle}>
      <div className="nc-panel-head">
        <div className="nc-panel-title">
          <Palette size={11} /> Customize{' '}
          {targetType === 'collection' ? 'Folder' : 'Card'}
        </div>
        <button className="nc-panel-close" onClick={onClose}>
          <X size={11} />
        </button>
      </div>
      <div className="nc-panel-body">
        <div>
          <div className="nc-panel-sec-label">
            <Sparkles size={10} /> Theme
          </div>
          <div className="nc-theme-grid">
            {THEME_PRESETS.map((t) => (
              <button
                key={t.id}
                className={`nc-theme-btn ${style.theme === t.id ? 'selected' : ''}`}
                onClick={() => set({ theme: t.id })}
              >
                <span className="nc-theme-icon">{t.icon}</span>
                <span className="nc-theme-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="nc-panel-sec-label">
            <Palette size={10} /> Accent Color
          </div>
          <div className="nc-accent-row">
            {ACCENT_PRESETS.map((c) => (
              <div
                key={c}
                className={`nc-accent-swatch ${style.accent === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => set({ accent: style.accent === c ? null : c })}
              />
            ))}
            <input
              type="color"
              className="nc-color-input"
              value={style.accent || '#c4913a'}
              onChange={(e) => set({ accent: e.target.value })}
              title="Custom color"
            />
          </div>
        </div>
        <div>
          <div className="nc-panel-sec-label">
            <Zap size={10} /> Glow Intensity
          </div>
          <div className="nc-slider-row">
            <input
              type="range"
              className="nc-slider"
              min={0}
              max={1}
              step={0.05}
              value={style.glow ?? 0.4}
              onChange={(e) => set({ glow: parseFloat(e.target.value) })}
            />
            <span className="nc-slider-val">
              {Math.round((style.glow ?? 0.4) * 100)}%
            </span>
          </div>
        </div>
        <div>
          <div className="nc-panel-sec-label">
            <Type size={10} /> Title Font
          </div>
          <div className="nc-font-row">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                className={`nc-font-btn ${style.font === f.id ? 'selected' : ''}`}
                style={f.style}
                onClick={() => set({ font: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="nc-panel-sec-label">
            <Smile size={10} /> Identity
          </div>
          <div className="nc-emoji-grid">
            {EMOJI_OPTIONS.map((em) => (
              <button
                key={em ?? '__none'}
                className={`nc-emoji-btn ${em === null ? 'none' : ''} ${style.emoji === em ? 'selected' : ''}`}
                onClick={() => set({ emoji: em })}
                title={em === null ? 'Letter' : em}
              >
                {em === null ? 'Aa' : em}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="nc-panel-sec-label">
            <Zap size={10} /> Effects
          </div>
          <div className="nc-effects-row">
            {[
              { key: 'tilt', label: 'Parallax tilt' },
              { key: 'shine', label: 'Shine sweep' },
              { key: 'hoverGlow', label: 'Hover glow' },
            ].map(({ key, label }) => (
              <div key={key} className="nc-effect-item">
                <span className="nc-effect-label">{label}</span>
                <label className="nc-toggle">
                  <input
                    type="checkbox"
                    checked={!!effects[key]}
                    onChange={(e) => setEffect(key, e.target.checked)}
                  />
                  <div className="nc-toggle-track" />
                  <div className="nc-toggle-knob" />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="nc-panel-foot">
        <button
          className="nc-panel-reset"
          onClick={() => setStyle({ ...DEFAULT_CARD_STYLE })}
        >
          Reset
        </button>
        <button
          className="nc-panel-save"
          onClick={() => onSave(targetId, targetType, style)}
        >
          <Sparkles size={10} /> Save
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COLLECTION CARD (Grid)
═══════════════════════════════════════════════════════════════ */
const CollectionCard = memo(function CollectionCard({
  collection,
  isDark,
  childCount,
  noteCount,
  onOpen,
  onDelete,
  onCustomize,
  customizerOpen,
}) {
  const cs = { ...DEFAULT_CARD_STYLE, ...(collection.card_style || {}) };
  const effects = { ...DEFAULT_CARD_STYLE.effects, ...(cs.effects || {}) };
  const pal = getCardPalette(collection.subject, collection.name, isDark);
  const accentHex = cs.accent || collection.color || pal.accent;
  const glowAlpha = cs.glow ?? 0.4;
  const glowColor = `${accentHex}${Math.round(glowAlpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
  const heroStyle = buildHeroStyle(cs, { ...pal, accent: accentHex }, isDark);
  const displayEmoji = cs.emoji || collection.icon;
  const letter = (collection.name || 'F')[0].toUpperCase();

  const cardRef = useRef(null);
  const menuBtnRef = useRef(null);

  const handleMouseMove = useCallback(
    (e) => {
      if (!effects.tilt || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cardRef.current.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-5px) scale(1.012)`;
    },
    [effects.tilt],
  );

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transform = '';
  }, []);

  const handleMenuClick = useCallback(
    (e) => {
      e.stopPropagation();
      const rect = menuBtnRef.current?.getBoundingClientRect();
      onCustomize(collection.id, 'collection', rect);
    },
    [collection.id, onCustomize],
  );

  return (
    <div
      ref={cardRef}
      className={`cc ${effects.hoverGlow ? 'effect-glow' : ''}`}
      style={{
        '--nc-glow': glowColor,
        '--nc-glow-color': accentHex,
        '--nc-glow-alpha': glowAlpha,
        '--nc-text': cs.accent ? cs.accent : pal.letterColor,
        '--nc-accent': accentHex,
      }}
      onClick={() => onOpen(collection.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {effects.shine && <div className="cc-shine active" />}
      <div className="cc-hero" style={heroStyle}>
        {/* Navigate arrow indicator */}
        <div className="cc-nav-arrow">
          <ChevronRight size={11} />
        </div>
        {displayEmoji ? (
          <div className="cc-emoji">{displayEmoji}</div>
        ) : (
          <div className="cc-letter">{letter}</div>
        )}
        <div className="cc-folder-badge">
          {childCount > 0
            ? `${childCount} folder${childCount !== 1 ? 's' : ''}`
            : 'Folder'}
        </div>
        <button
          ref={menuBtnRef}
          className={`cc-menu-btn ${customizerOpen ? 'open' : ''}`}
          onClick={handleMenuClick}
          title="Customize folder"
        >
          <MoreHorizontal size={13} />
        </button>
      </div>
      <div className="cc-body">
        <div className="cc-name">{collection.name}</div>
        <div className="cc-meta">
          {childCount > 0 &&
            `${childCount} sub-folder${childCount !== 1 ? 's' : ''} · `}
          {noteCount} note{noteCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="cc-footer">
        <div className="cc-stats">
          <span className="cc-stat">
            <Folder size={9} />
            {childCount + noteCount} items
          </span>
        </div>
        <div className="cc-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="cc-action danger"
            onClick={() => onDelete(collection.id)}
            title="Delete folder"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div
        className="cc-col-bar"
        style={{ background: collection.color || accentHex }}
      />
    </div>
  );
});

/* Collection List Card */
const CollectionListCard = memo(function CollectionListCard({
  collection,
  isDark,
  childCount,
  noteCount,
  onOpen,
  onDelete,
}) {
  const pal = getCardPalette(null, collection.name, isDark);
  const cs = { ...DEFAULT_CARD_STYLE, ...(collection.card_style || {}) };
  const accentHex = cs.accent || collection.color || pal.accent;
  return (
    <div className="flc" onClick={() => onOpen(collection.id)}>
      <div
        className="flc-icon"
        style={{
          background: `linear-gradient(135deg,${pal.bgColor},${pal.bgColor2})`,
          color: accentHex,
          fontSize: '1rem',
        }}
      >
        {cs.emoji || collection.icon || '📁'}
      </div>
      <div className="flc-content">
        <div className="flc-name">{collection.name}</div>
        <div className="flc-meta">
          {childCount > 0 &&
            `${childCount} sub-folder${childCount !== 1 ? 's' : ''} · `}
          {noteCount} note{noteCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="flc-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="nc-action danger"
          onClick={() => onDelete(collection.id)}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NOTE CARD (Grid)
═══════════════════════════════════════════════════════════════ */
const NoteCard = memo(function NoteCard({
  note,
  collections,
  isDark,
  onOpen,
  onPin,
  onDelete,
  onCustomize,
  customizerOpen,
  backlinkCount,
}) {
  const col = collections.find((c) => c.id === note.collection_id);
  const snippet = snippetFromContent(note.content);
  const pal = getCardPalette(note.subject, note.title, isDark);
  const cs = { ...DEFAULT_CARD_STYLE, ...(note.card_style || {}) };
  const effects = { ...DEFAULT_CARD_STYLE.effects, ...(cs.effects || {}) };
  const displayEmoji = cs.emoji;
  const letter = (note.subject || note.title || 'N')[0].toUpperCase();
  const accentHex = cs.accent || pal.accent;
  const glowAlpha = cs.glow ?? 0.4;
  const glowColor = `${accentHex}${Math.round(glowAlpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
  const heroStyle = buildHeroStyle(cs, pal, isDark);
  const cardRef = useRef(null);
  const menuBtnRef = useRef(null);

  const handleMouseMove = useCallback(
    (e) => {
      if (!effects.tilt || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cardRef.current.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-5px) scale(1.012)`;
    },
    [effects.tilt],
  );
  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transform = '';
  }, []);
  const handleMenuClick = useCallback(
    (e) => {
      e.stopPropagation();
      const rect = menuBtnRef.current?.getBoundingClientRect();
      onCustomize(note.id, 'note', rect);
    },
    [note.id, onCustomize],
  );

  return (
    <div
      ref={cardRef}
      className={`nc ${note.is_pinned ? 'pinned' : ''} ${effects.hoverGlow ? 'effect-glow' : ''}`}
      style={{
        '--nc-glow': glowColor,
        '--nc-glow-color': accentHex,
        '--nc-glow-alpha': glowAlpha,
        '--nc-text': cs.accent ? cs.accent : pal.letterColor,
        '--nc-accent': accentHex,
      }}
      onClick={() => onOpen(note.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {effects.shine && <div className="nc-shine active" />}
      <div className="nc-hero" style={heroStyle}>
        {displayEmoji ? (
          <div className="nc-emoji">{displayEmoji}</div>
        ) : (
          <div className={`nc-letter font-${cs.font || 'serif'}`}>{letter}</div>
        )}
        {(note.subject || col) && (
          <div className="nc-subject">{note.subject || col?.name}</div>
        )}
        {note.is_pinned && (
          <div className="nc-pin-dot" style={{ right: 38 }}>
            <Pin size={11} />
          </div>
        )}
        <button
          ref={menuBtnRef}
          className={`nc-menu-btn ${customizerOpen ? 'open' : ''}`}
          onClick={handleMenuClick}
          title="Customize card"
          style={note.is_pinned ? { right: 38 } : {}}
        >
          <MoreHorizontal size={13} />
        </button>
      </div>
      <div className="nc-body">
        <div className={`nc-title font-${cs.font || 'sans'}`}>{note.title}</div>
        {snippet && <div className="nc-snippet">{snippet}</div>}
        {note.tags?.length > 0 && (
          <div className="nc-tags">
            {note.tags.slice(0, 3).map((t) => (
              <span key={t} className="nc-tag">
                #{t}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="nc-tag">+{note.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
      <div className="nc-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {backlinkCount > 0 && (
            <span className="nc-link-badge">
              <Link2 size={9} />
              {backlinkCount}
            </span>
          )}
          <span className="nc-date">{timeAgo(note.updated_at)}</span>
        </div>
        <div className="nc-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="nc-action"
            onClick={() => onPin(note)}
            title={note.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={11} />
          </button>
          <button
            className="nc-action danger"
            onClick={() => onDelete(note.id)}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div
        className="nc-col-bar"
        style={{ background: col?.color || 'var(--border)' }}
      />
    </div>
  );
});

/* Note List Card */
const NoteListCard = memo(function NoteListCard({
  note,
  collections,
  isDark,
  onOpen,
  onPin,
  onDelete,
  backlinkCount,
}) {
  const col = collections.find((c) => c.id === note.collection_id);
  const pal = getCardPalette(note.subject, note.title, isDark);
  const cs = { ...DEFAULT_CARD_STYLE, ...(note.card_style || {}) };
  const accentHex = cs.accent || pal.accent;
  return (
    <div className="nlc" onClick={() => onOpen(note.id)}>
      <div
        className="nlc-dot"
        style={{
          background: `linear-gradient(135deg,${pal.bgColor},${pal.bgColor2})`,
          color: accentHex,
        }}
      >
        {cs.emoji || (note.subject || note.title || 'N')[0].toUpperCase()}
      </div>
      <div className="nlc-content">
        <div className="nlc-title">{note.title}</div>
        <div className="nlc-meta">
          {col ? `${col.name} · ` : ''}
          {timeAgo(note.updated_at)}
          {note.tags?.length > 0 &&
            ` · ${note.tags
              .slice(0, 2)
              .map((t) => '#' + t)
              .join(' ')}`}
        </div>
      </div>
      <div className="nlc-right">
        {backlinkCount > 0 && (
          <span className="nc-link-badge">
            <Link2 size={9} />
            {backlinkCount}
          </span>
        )}
        {note.is_pinned && (
          <Pin size={11} style={{ color: 'var(--gold)', opacity: 0.7 }} />
        )}
        <div className="nlc-actions" onClick={(e) => e.stopPropagation()}>
          <button className="nc-action" onClick={() => onPin(note)}>
            <Pin size={11} />
          </button>
          <button
            className="nc-action danger"
            onClick={() => onDelete(note.id)}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════════ */
function CreateNoteModal({
  collections,
  currentFolderId,
  onClose,
  onCreate,
  saving,
}) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [collection, setCollection] = useState(currentFolderId || '');
  const [tags, setTags] = useState([]);
  const [error, setError] = useState('');

  // Flatten collections for select (with depth indentation)
  const flatCollections = useMemo(() => {
    const tree = buildCollectionTree(collections);
    return flattenTree(tree);
  }, [collections]);

  const submit = () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    onCreate({
      title: title.trim(),
      subject: subject.trim() || null,
      collection_id: collection || null,
      tags,
    });
  };

  return (
    <div className="np-modal-backdrop" onClick={onClose}>
      <div className="np-modal" onClick={(e) => e.stopPropagation()}>
        <div className="np-modal-head">
          <div className="np-modal-title">
            Create <em>Note</em>
          </div>
          <button className="np-modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="np-modal-body">
          {error && (
            <div className="np-error">
              <AlertCircle size={12} />
              {error}
            </div>
          )}
          <div className="np-field">
            <div className="np-field-label">
              <PenLine size={10} /> Title *
            </div>
            <input
              className="np-input"
              autoFocus
              placeholder="Note title…"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="np-field">
            <div className="np-field-label">
              <BookOpen size={10} /> Subject
            </div>
            <input
              className="np-input"
              placeholder="e.g. Mathematics, Design…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="np-field">
            <div className="np-field-label">
              <Folder size={10} /> Folder
            </div>
            <select
              className="np-select"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            >
              <option value="">— Root (no folder) —</option>
              {flatCollections.map((c) => (
                <option key={c.id} value={c.id}>
                  {'  '.repeat(c.depth)}
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="np-field">
            <div className="np-field-label">
              <Hash size={10} /> Tags
            </div>
            <TagInput tags={tags} onChange={setTags} />
          </div>
        </div>
        <div className="np-modal-foot">
          <button className="np-btn np-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="np-btn np-btn-gold"
            onClick={submit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2
                  size={12}
                  style={{ animation: 'spin .8s linear infinite' }}
                />{' '}
                Saving…
              </>
            ) : (
              <>
                <Plus size={12} /> Create Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateCollectionModal({
  collections,
  currentFolderId,
  onClose,
  onCreate,
  saving,
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState(COLLECTION_COLORS[0]);
  const [parentId, setParentId] = useState(currentFolderId || '');
  const [error, setError] = useState('');
  const ICONS = [
    '📁',
    '📚',
    '💡',
    '🎯',
    '🔬',
    '✍️',
    '🎨',
    '💼',
    '🌱',
    '⚡',
    '🗂',
    '📂',
  ];

  const flatCollections = useMemo(() => {
    const tree = buildCollectionTree(collections);
    return flattenTree(tree);
  }, [collections]);

  const submit = () => {
    if (!name.trim()) {
      setError('Name required.');
      return;
    }
    onCreate({ name: name.trim(), icon, color, parent_id: parentId || null });
  };

  return (
    <div className="np-modal-backdrop" onClick={onClose}>
      <div className="np-modal" onClick={(e) => e.stopPropagation()}>
        <div className="np-modal-head">
          <div className="np-modal-title">
            New <em>Folder</em>
          </div>
          <button className="np-modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="np-modal-body">
          {error && (
            <div className="np-error">
              <AlertCircle size={12} />
              {error}
            </div>
          )}
          <div className="np-field">
            <div className="np-field-label">Name *</div>
            <input
              className="np-input"
              autoFocus
              placeholder="e.g. Research"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="np-field">
            <div className="np-field-label">Parent Folder</div>
            <select
              className="np-select"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">— Root level —</option>
              {flatCollections.map((c) => (
                <option key={c.id} value={c.id}>
                  {'  '.repeat(c.depth)}
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="np-field">
            <div className="np-field-label">Icon</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  style={{
                    fontSize: '1.3rem',
                    background:
                      icon === ic ? 'var(--gold3)' : 'var(--surface2)',
                    border: `1px solid ${icon === ic ? 'rgba(196,145,58,.4)' : 'var(--border)'}`,
                    borderRadius: 7,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="np-field">
            <div className="np-field-label">Color</div>
            <div className="np-color-row">
              {COLLECTION_COLORS.map((c) => (
                <div
                  key={c}
                  className={`np-color-swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="np-modal-foot">
          <button className="np-btn np-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="np-btn np-btn-gold"
            onClick={submit}
            disabled={saving}
          >
            {saving ? (
              'Saving…'
            ) : (
              <>
                <Plus size={12} /> Create Folder
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ onClose, onConfirm, message }) {
  return (
    <div className="np-modal-backdrop" onClick={onClose}>
      <div
        className="np-modal"
        style={{ maxWidth: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="np-modal-head">
          <div className="np-modal-title" style={{ color: 'var(--red)' }}>
            Confirm Delete
          </div>
          <button className="np-modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="np-modal-body">
          <p
            style={{
              fontFamily: 'var(--f-ui)',
              fontSize: '.84rem',
              color: 'var(--ink2)',
              lineHeight: 1.65,
            }}
          >
            {message ||
              'This will be permanently deleted. This action cannot be undone.'}
          </p>
        </div>
        <div className="np-modal-foot">
          <button className="np-btn np-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="np-btn np-btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

async function ensurePermanentFolders(supabase, userId) {
  const definitions = [
    {
      slug: PERMANENT_FOLDER_SLUGS.SESSION_NOTES,
      name: 'Session Notes',
      icon: '🗒️',
      color: '#5b8fa8',
    },
    {
      slug: PERMANENT_FOLDER_SLUGS.FOCUS_NOTES,
      name: 'Focus Notes',
      icon: '🎯',
      color: '#6b9e6b',
    },
  ];

  const ids = {};

  for (const def of definitions) {
    // Check localStorage cache first (avoids extra DB call on every load)
    const cacheKey = `pf_${userId}_${def.slug}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      ids[def.slug] = cached;
      continue;
    }

    // Check if it already exists in DB (by matching the icon+color combo as a fingerprint)
    const { data: existing } = await supabase
      .from('note_collections')
      .select('id')
      .eq('user_id', userId)
      .eq('name', def.name)
      .eq('icon', def.icon)
      .maybeSingle();

    if (existing) {
      ids[def.slug] = existing.id;
      localStorage.setItem(cacheKey, existing.id);
    } else {
      // Create it
      const { data: created } = await supabase
        .from('note_collections')
        .insert({
          user_id: userId,
          name: def.name,
          icon: def.icon,
          color: def.color,
          parent_id: null,
        })
        .select()
        .single();

      if (created) {
        ids[def.slug] = created.id;
        localStorage.setItem(cacheKey, created.id);
      }
    }
  }

  return ids; // { '__permanent_session_notes__': 'uuid...', '__permanent_focus_notes__': 'uuid...' }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function NotesPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { supabase, loading: sbLoading } = useSupabase();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  /* ── Data ── */
  const [notes, setNotes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permanentFolderIds, setPermanentFolderIds] = useState({});

  /* ── Navigation ── */
  const [currentFolderId, setCurrentFolderId] = useState(null); // null = root

  /* ── UI ── */
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [sidebarOpen, setSB] = useState(true);

  /* ── Modals ── */
  const [showCreateNote, setSCN] = useState(false);
  const [showCreateColl, setSCC] = useState(false);
  const [deleteTarget, setDT] = useState(null); // { id, type: 'note'|'collection' }

  /* ── Customizer ── */
  const [customizerTarget, setCustomizerTarget] = useState(null);
  // { id, type: 'note'|'collection', anchorRect }

  /* ── Load data ── */
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      setLoading(true);
      const [{ data: n }, { data: c }] = await Promise.all([
        supabase
          .from('user_notes')
          .select('*')
          .order('updated_at', { ascending: false }),
        supabase.from('note_collections').select('*').order('name'),
      ]);
      setNotes(n || []);
      setCollections(c || []);

      // Ensure the two permanent folders exist and grab their IDs
      const pfIds = await ensurePermanentFolders(supabase, user?.id);
      setPermanentFolderIds(pfIds);

      setLoading(false);
    })();
  }, [supabase]);

  /* ── Derived tree data ── */
  const collectionsMap = useMemo(
    () => buildCollectionsMap(collections),
    [collections],
  );
  const collectionsTree = useMemo(
    () => buildCollectionTree(collections),
    [collections],
  );

  /* ── Counts per collection (direct notes only) ── */
  const directNoteCounts = useMemo(() => {
    const map = new Map();
    notes.forEach((n) => {
      if (n.collection_id)
        map.set(n.collection_id, (map.get(n.collection_id) || 0) + 1);
    });
    return map;
  }, [notes]);

  /* ── Count of direct children per collection ── */
  const childCounts = useMemo(() => {
    const map = new Map();
    collections.forEach((c) => {
      if (c.parent_id) map.set(c.parent_id, (map.get(c.parent_id) || 0) + 1);
    });
    return map;
  }, [collections]);

  /* ── Backlinks ── */
  const backlinkCounts = useBacklinkCounts(notes);

  const currentFolders = useMemo(() => {
    const q = search.trim().toLowerCase();

    // 🔍 GLOBAL SEARCH MODE
    if (q) {
      return collections.filter((c) => c.name.toLowerCase().includes(q));
    }

    // 📁 NORMAL FOLDER MODE
    return getDirectChildren(currentFolderId, collections);
  }, [currentFolderId, collections, search]);

  /* ── Current folder contents ── */
  const currentNotes = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list;

    // 🔥 GLOBAL SEARCH MODE
    if (q) {
      list = notes.filter((n) => {
        const title = n.title?.toLowerCase() || '';
        const subject = n.subject?.toLowerCase() || '';
        const tags = (n.tags || []).join(' ').toLowerCase();
        const content = snippetFromContent(n.content)?.toLowerCase() || '';
        const links = (n.links || []).join(' ').toLowerCase();

        return (
          title.includes(q) ||
          subject.includes(q) ||
          tags.includes(q) ||
          content.includes(q) ||
          links.includes(q)
        );
      });
    } else {
      // 📁 NORMAL FOLDER MODE
      list = getDirectNotes(currentFolderId, notes);
    }

    // 🔃 Sorting (same as your logic)
    if (sort === 'updated')
      list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    else if (sort === 'created')
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === 'title')
      list.sort((a, b) => a.title.localeCompare(b.title));

    // 📌 Pin handling
    return [
      ...list.filter((n) => n.is_pinned),
      ...list.filter((n) => !n.is_pinned),
    ];
  }, [currentFolderId, notes, search, sort]);

  /* ── Current folder metadata ── */
  const currentFolder = currentFolderId
    ? collectionsMap.get(currentFolderId)
    : null;

  /* ── CRUD handlers ── */
  const handleCreateNote = useCallback(
    async (data) => {
      if (!supabase) return;
      setSaving(true);
      const { data: newNote, error } = await supabase
        .from('user_notes')
        .insert({
          user_id: user?.id,
          title: data.title,
          subject: data.subject,
          collection_id: data.collection_id,
          tags: data.tags,
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        })
        .select()
        .single();
      setSaving(false);
      if (error) {
        console.error(error.message);
        return;
      }
      if (newNote) {
        setNotes((p) => [newNote, ...p]);
        setSCN(false);
        navigate(`/notes/${newNote.id}`);
      }
    },
    [supabase, user, navigate],
  );

  const handleCreateCollection = useCallback(
    async (data) => {
      if (!supabase) return;
      setSaving(true);
      const { data: newCol, error } = await supabase
        .from('note_collections')
        .insert({
          user_id: user?.id,
          name: data.name,
          icon: data.icon,
          color: data.color,
          parent_id: data.parent_id || null,
        })
        .select()
        .single();
      setSaving(false);
      if (error) {
        console.error(error.message);
        return;
      }
      if (newCol) {
        setCollections((p) => [...p, newCol]);
        setSCC(false);
      }
    },
    [supabase, user],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;
    if (type === 'note') {
      setNotes((p) => p.filter((n) => n.id !== id));
      await supabase?.from('user_notes').delete().eq('id', id);
    } else {
      // Block deletion of permanent folders
      const isPermanent = Object.values(permanentFolderIds).includes(id);
      if (isPermanent) {
        alert(
          'This folder is permanent and cannot be deleted. You can delete notes inside it.',
        );
        setDT(null);
        return;
      }
      // Delete collection — notes inside become uncategorised (collection_id set to null)
      // Child collections cascade via DB trigger (ON DELETE CASCADE)
      setCollections((p) => p.filter((c) => c.id !== id));
      setNotes((p) =>
        p.map((n) =>
          n.collection_id === id ? { ...n, collection_id: null } : n,
        ),
      );
      if (currentFolderId === id) setCurrentFolderId(null);
      await supabase?.from('note_collections').delete().eq('id', id);
    }
    setDT(null);
  }, [supabase, deleteTarget, currentFolderId]);

  const handlePin = useCallback(
    async (note) => {
      const next = !note.is_pinned;
      setNotes((p) =>
        p.map((n) => (n.id === note.id ? { ...n, is_pinned: next } : n)),
      );
      await supabase
        ?.from('user_notes')
        .update({ is_pinned: next })
        .eq('id', note.id);
    },
    [supabase],
  );

  /* ── Customizer handlers ── */
  const handleOpenCustomizer = useCallback((id, type, anchorRect) => {
    setCustomizerTarget((prev) =>
      prev?.id === id && prev?.type === type ? null : { id, type, anchorRect },
    );
  }, []);

  const handleSaveCardStyle = useCallback(
    async (id, type, cardStyle) => {
      if (type === 'note') {
        setNotes((p) =>
          p.map((n) => (n.id === id ? { ...n, card_style: cardStyle } : n)),
        );
        await supabase
          ?.from('user_notes')
          .update({ card_style: cardStyle })
          .eq('id', id);
      } else {
        setCollections((p) =>
          p.map((c) => (c.id === id ? { ...c, card_style: cardStyle } : c)),
        );
        await supabase
          ?.from('note_collections')
          .update({ card_style: cardStyle })
          .eq('id', id);
      }
      setCustomizerTarget(null);
    },
    [supabase],
  );

  /* ── Navigation ── */
  const handleNavigateToFolder = useCallback((id) => {
    setCurrentFolderId(id);
    setSearch('');
  }, []);

  /* ── All tags for sidebar ── */
  const allTags = useMemo(() => {
    const map = {};
    notes.forEach((n) =>
      n.tags?.forEach((t) => {
        map[t] = (map[t] || 0) + 1;
      }),
    );
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [notes]);

  /* ─── Total note count per tree node (for sidebar) ─── */
  const treeNoteCounts = useMemo(() => {
    // For each collection, count ALL notes in its subtree
    const map = new Map();
    collections.forEach((col) => {
      const descendantIds = getDescendantIds(col.id, collectionsMap);
      let count = 0;
      notes.forEach((n) => {
        if (descendantIds.has(n.collection_id)) count++;
      });
      map.set(col.id, count);
    });
    return map;
  }, [collections, collectionsMap, notes]);

  return (
    <div className="np">
      <style>{CSS}</style>
      <AppNavbar />

      <div className="np-shell">
        {/* ══ SIDEBAR ══ */}
        <aside className={`np-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="np-sidebar-top">
            <div className="np-sidebar-logo">
              ✦ <em>Notes</em>
            </div>
            <button className="np-new-note-btn" onClick={() => setSCN(true)}>
              <Plus size={13} /> New Note
            </button>
          </div>
          <div className="np-sidebar-scroll">
            {/* Library nav */}
            <div className="np-nav-sec">
              <div className="np-nav-sec-label">Library</div>
              <button
                className={`np-nav-item ${currentFolderId === null ? 'active' : ''}`}
                onClick={() => handleNavigateToFolder(null)}
              >
                <Home size={13} /> All Notes
                <span className="np-nav-item-count">{notes.length}</span>
              </button>
            </div>

            {/* Folder tree */}
            {collectionsTree.length > 0 && (
              <div className="np-nav-sec">
                <div
                  className="np-nav-sec-label"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingRight: 8,
                  }}
                >
                  Folders
                  <button
                    onClick={() => setSCC(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink3)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    <FolderPlus size={11} />
                  </button>
                </div>
                {collectionsTree.map((node) => (
                  <SidebarTreeNode
                    key={node.id}
                    node={node}
                    currentFolderId={currentFolderId}
                    noteCounts={treeNoteCounts}
                    onNavigate={handleNavigateToFolder}
                  />
                ))}
              </div>
            )}

            {/* Tags */}
            {allTags.length > 0 && (
              <div className="np-nav-sec">
                <div className="np-nav-sec-label">Tags</div>
                {allTags.map(([tag, count]) => (
                  <button
                    key={tag}
                    className="np-nav-item"
                    onClick={() => {
                      setSearch(tag);
                      setCurrentFolderId(null);
                    }}
                  >
                    <Hash size={12} />#{tag}
                    <span className="np-nav-item-count">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="np-sidebar-foot">
            <div className="np-stats-row">
              <span>{notes.length} notes</span>
              <span>{collections.length} folders</span>
            </div>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main className="np-main">
          {/* Topbar */}
          <div className="np-topbar">
            <button
              className="np-sidebar-toggle"
              onClick={() => setSB((p) => !p)}
            >
              {sidebarOpen ? (
                <ChevronLeft size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
            <div className="np-search-wrap">
              <Search size={13} className="np-search-icon" />
              <input
                className="np-search-input"
                placeholder="Search notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="np-search-clear"
                  onClick={() => setSearch('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="np-topbar-actions">
              <SortDropdown value={sort} onChange={setSort} />
              <button
                className={`np-icon-btn ${view === 'grid' ? 'active' : ''}`}
                onClick={() => setView('grid')}
                title="Grid"
              >
                <Grid3X3 size={14} />
              </button>
              <button
                className={`np-icon-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
                title="List"
              >
                <List size={14} />
              </button>
              <button
                className="np-icon-btn"
                onClick={() => navigate('/graph')}
                title="Knowledge Graph"
                style={{
                  width: 'auto',
                  padding: '0 10px',
                  gap: 5,
                  fontSize: '.58rem',
                  fontFamily: 'var(--f-mono)',
                  letterSpacing: '.06em',
                }}
              >
                <Network size={14} />
              </button>
              <button
                className="np-icon-btn"
                onClick={() => setSCC(true)}
                title="New Folder"
                style={{
                  width: 'auto',
                  padding: '0 10px',
                  gap: 5,
                  fontSize: '.58rem',
                  fontFamily: 'var(--f-mono)',
                  letterSpacing: '.06em',
                }}
              >
                <FolderPlus size={14} />
              </button>
              <button className="np-new-btn" onClick={() => setSCN(true)}>
                <Plus size={13} /> New Note
              </button>
            </div>
          </div>

          {/* Breadcrumbs */}
          {(currentFolderId || search) && (
            <Breadcrumbs
              currentFolderId={currentFolderId}
              collectionsMap={collectionsMap}
              onNavigate={handleNavigateToFolder}
            />
          )}

          {/* Page head */}
          <div className="np-page-head np-a1">
            <div className="np-page-eyebrow">
              <PenLine size={10} /> Notes
            </div>
            <div className="np-page-title">
              {currentFolder ? (
                <>
                  {currentFolder.icon || '📁'} <em>{currentFolder.name}</em>
                </>
              ) : search ? (
                <>
                  Search <em>Results</em>
                </>
              ) : (
                <>
                  All <em>Notes</em>
                </>
              )}
            </div>
            {currentFolder && (
              <div className="np-page-sub">
                {currentFolders.length} sub-folder
                {currentFolders.length !== 1 ? 's' : ''} · {currentNotes.length}{' '}
                note{currentNotes.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="np-content np-a3">
            {loading ? (
              <div className={view === 'grid' ? 'np-grid' : 'np-list'}>
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="np-skeleton"
                    style={{
                      height: view === 'grid' ? 280 : 60,
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <>
                {/* ── FOLDERS SECTION ── */}
                {currentFolders.length > 0 && !search && (
                  <>
                    <div className="np-section-label">
                      <Folder size={11} /> Folders
                    </div>
                    {view === 'grid' ? (
                      <div className="np-grid" style={{ marginBottom: 24 }}>
                        {currentFolders.map((col) => (
                          <CollectionCard
                            key={col.id}
                            collection={col}
                            isDark={isDark}
                            childCount={childCounts.get(col.id) || 0}
                            noteCount={directNoteCounts.get(col.id) || 0}
                            onOpen={handleNavigateToFolder}
                            onDelete={(id) => setDT({ id, type: 'collection' })}
                            onCustomize={handleOpenCustomizer}
                            customizerOpen={
                              customizerTarget?.id === col.id &&
                              customizerTarget?.type === 'collection'
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="np-list" style={{ marginBottom: 16 }}>
                        {currentFolders.map((col) => (
                          <CollectionListCard
                            key={col.id}
                            collection={col}
                            isDark={isDark}
                            childCount={childCounts.get(col.id) || 0}
                            noteCount={directNoteCounts.get(col.id) || 0}
                            onOpen={handleNavigateToFolder}
                            onDelete={(id) => setDT({ id, type: 'collection' })}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── NOTES SECTION ── */}
                {currentNotes.length > 0 && (
                  <>
                    {currentFolders.length > 0 && !search && (
                      <div className="np-section-label">
                        <FileText size={11} /> Notes
                      </div>
                    )}
                    {view === 'grid' ? (
                      <div className="np-grid">
                        {currentNotes.map((n) => (
                          <NoteCard
                            key={n.id}
                            note={n}
                            collections={collections}
                            isDark={isDark}
                            onOpen={(id) => navigate(`/notes/${id}`)}
                            onPin={handlePin}
                            onDelete={(id) => setDT({ id, type: 'note' })}
                            onCustomize={handleOpenCustomizer}
                            customizerOpen={
                              customizerTarget?.id === n.id &&
                              customizerTarget?.type === 'note'
                            }
                            backlinkCount={backlinkCounts.get(n.id) || 0}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="np-list">
                        {currentNotes.map((n) => (
                          <NoteListCard
                            key={n.id}
                            note={n}
                            collections={collections}
                            isDark={isDark}
                            onOpen={(id) => navigate(`/notes/${id}`)}
                            onPin={handlePin}
                            onDelete={(id) => setDT({ id, type: 'note' })}
                            backlinkCount={backlinkCounts.get(n.id) || 0}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── EMPTY STATE ── */}
                {currentFolders.length === 0 && currentNotes.length === 0 && (
                  <div className="np-empty">
                    <div className="np-empty-glyph">{search ? '🔍' : '📁'}</div>
                    <div className="np-empty-title">
                      {search
                        ? 'No matches'
                        : currentFolder
                          ? 'Empty folder'
                          : 'No notes yet'}
                    </div>
                    <div className="np-empty-sub">
                      {search
                        ? `No notes match "${search}".`
                        : currentFolder
                          ? 'Create a note or a sub-folder here.'
                          : 'Create your first note to begin.'}
                    </div>
                    {!search && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="np-btn np-btn-gold"
                          onClick={() => setSCN(true)}
                        >
                          <Plus size={13} /> New Note
                        </button>
                        <button
                          className="np-btn np-btn-outline"
                          onClick={() => setSCC(true)}
                        >
                          <FolderPlus size={13} /> New Folder
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ══ MODALS ══ */}
      {showCreateNote && (
        <CreateNoteModal
          collections={collections}
          currentFolderId={currentFolderId}
          permanentFolderIds={permanentFolderIds}
          saving={saving}
          onClose={() => setSCN(false)}
          onCreate={handleCreateNote}
        />
      )}
      {showCreateColl && (
        <CreateCollectionModal
          collections={collections}
          currentFolderId={currentFolderId}
          saving={saving}
          onClose={() => setSCC(false)}
          onCreate={handleCreateCollection}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          message={
            deleteTarget.type === 'collection'
              ? 'This folder will be deleted. Notes inside will be moved to root. Sub-folders will also be deleted. This cannot be undone.'
              : 'This note will be permanently deleted. This action cannot be undone.'
          }
          onClose={() => setDT(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* ══ CARD CUSTOMIZER ══ */}
      {customizerTarget && (
        <CardCustomizer
          targetId={customizerTarget.id}
          targetType={customizerTarget.type}
          initial={
            customizerTarget.type === 'note'
              ? notes.find((n) => n.id === customizerTarget.id)?.card_style ||
                {}
              : collections.find((c) => c.id === customizerTarget.id)
                  ?.card_style || {}
          }
          anchorRect={customizerTarget.anchorRect}
          onSave={handleSaveCardStyle}
          onClose={() => setCustomizerTarget(null)}
        />
      )}
      <CommandPalette allNotes={notes} collections={collections} />
    </div>
  );
}
