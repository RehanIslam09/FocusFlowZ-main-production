/**
 * NoteEditor.jsx — Phase 5: Knowledge Engine
 *
 * ✅ PRESERVED: All Phase 4 systems (font, toolbar, autosave, slash, block menu)
 * ✅ PRESERVED: All existing CSS and editor config
 * ✅ FIXED: allNotes query now includes collection_id so sidebar tree renders notes
 *
 * NEW — Phase 5 additions:
 *   🔗 InternalLinkExtension — TipTap mark for [[note]] links
 *   🔍 [[ trigger → WikiLinkMenu — searchable dropdown with ↑↓Enter navigation
 *   🔁 BacklinksPanel — "Referenced by" section at bottom of sidebar
 *   🧠 useLinkParser — debounced link extraction from editor JSON
 *   💾 links[] saved to user_notes.links (text[] column) on every save
 *   📊 buildGraph() — in-memory graph data foundation
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import useSupabase from '../hooks/useSupabase';
import useTheme from '../hooks/useTheme';
import useAutosave from '../hooks/useAutosave';
import useEditorConfig from '../hooks/useEditorConfig';
import { EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import EditorToolbar, { FONTS } from '../components/EditorToolbar';
import SlashMenu from '../components/SlashMenu';
import TagInput from '../components/TagInput';
import BlockMenu from '../components/BlockMenu';
import EditorSidebar from '../components/EditorSidebar';
import { createNote, createCollection } from '../lib/notesApi';
import { buildCollectionTree, flattenTree } from '../lib/collectionTree';
import CommandPalette from '../components/CommandPalette';
import {
  ArrowLeft,
  Bold,
  Italic,
  Strikethrough,
  Code2,
  Quote,
  Heading1,
  Heading2,
  Check,
  Loader2,
  AlertTriangle,
  Trash2,
  Sun,
  Moon,
  Focus,
  AlignLeft,
  Hash,
  BookOpen,
  Folder,
  Sparkles,
  Link2,
  FileText,
  Network,
  Sidebar,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   LINK PARSER UTILITY
═══════════════════════════════════════════════════════════════ */
function extractWikiLinks(content) {
  if (!content) return [];
  const links = [];
  const seen = new Set();

  const walk = (node) => {
    if (!node) return;
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'internalLink' && mark.attrs?.noteId) {
          const key = mark.attrs.noteId;
          if (!seen.has(key)) {
            seen.add(key);
            links.push({
              noteId: mark.attrs.noteId,
              title: mark.attrs.title || '',
            });
          }
        }
      }
    }
    if (node.type === 'text' && node.text) {
      const regex = /\[\[([^\]]+)\]\]/g;
      let m;
      while ((m = regex.exec(node.text)) !== null) {
        const title = m[1].trim();
        if (!seen.has(`raw:${title}`)) {
          seen.add(`raw:${title}`);
          links.push({ noteId: null, title });
        }
      }
    }
    if (node.content) node.content.forEach(walk);
  };

  walk(content);
  return links;
}

/* ═══════════════════════════════════════════════════════════════
   useBacklinks HOOK
═══════════════════════════════════════════════════════════════ */
function useBacklinks(noteId, allNotes) {
  return useMemo(() => {
    if (!noteId || !allNotes.length)
      return { backlinks: [], outgoingLinks: [] };

    const backlinks = allNotes.filter((n) => {
      if (n.id === noteId) return false;
      return (Array.isArray(n.links) ? n.links : []).includes(noteId);
    });

    const currentNote = allNotes.find((n) => n.id === noteId);
    const outgoingIds = Array.isArray(currentNote?.links)
      ? currentNote.links
      : [];
    const outgoingLinks = outgoingIds
      .map((id) => allNotes.find((n) => n.id === id))
      .filter(Boolean);

    return { backlinks, outgoingLinks };
  }, [noteId, allNotes]);
}

/* ═══════════════════════════════════════════════════════════════
   buildGraph UTILITY
═══════════════════════════════════════════════════════════════ */
function buildGraph(notes) {
  const nodes = notes.map((n) => ({ id: n.id, title: n.title || 'Untitled' }));
  const edges = [];
  notes.forEach((n) => {
    (Array.isArray(n.links) ? n.links : []).forEach((targetId) => {
      if (notes.find((t) => t.id === targetId)) {
        edges.push({ source: n.id, target: targetId });
      }
    });
  });
  return { nodes, edges };
}

/* ═══════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Lato:wght@300;400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Space+Grotesk:wght@400;500;700&family=Outfit:wght@300;400;600&family=Inter:wght@300;400;600&family=Lora:ital,wght@0,400;0,600;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

:root {
  --bg: #f5f0e8; --surface: #faf7f2; --surface2: #f0ebe0; --surface3: #e8e0d0;
  --border: #ddd5c4; --border2: #ccc0a8;
  --ink: #1e1a14; --ink2: #5c5445; --ink3: #9c9283;
  --gold: #c4913a; --gold2: #e8b96a; --gold3: rgba(196,145,58,.12); --gold-glow: rgba(196,145,58,.25);
  --red: #b85c4a; --green: #6b9e6b; --blue: #4a7eb8;
  --link-color: #5b8fcc; --link-bg: rgba(91,143,204,.1); --link-border: rgba(91,143,204,.35);
  --callout-info-bg: rgba(74,126,184,.08); --callout-info-border: rgba(74,126,184,.35);
  --callout-warning-bg: rgba(196,145,58,.10); --callout-warning-border: rgba(196,145,58,.40);
  --callout-success-bg: rgba(107,158,107,.10); --callout-success-border: rgba(107,158,107,.40);
  --callout-error-bg: rgba(184,92,74,.10); --callout-error-border: rgba(184,92,74,.40);
  --shadow: 0 2px 12px rgba(30,26,20,.08); --shadow-md: 0 6px 24px rgba(30,26,20,.12); --shadow-lg: 0 20px 60px rgba(30,26,20,.18);
  --f-display: 'Cormorant Garamond', Georgia, serif;
  --f-ui: 'Cabinet Grotesk', sans-serif;
  --f-mono: 'JetBrains Mono', monospace;
  --ease: cubic-bezier(.16,1,.3,1); --spring: cubic-bezier(.34,1.56,.64,1);
  --radius: 10px;
}
.dark {
  --bg: #0d0c0a; --surface: #131210; --surface2: #1a1815; --surface3: #222019;
  --border: #2a2722; --border2: #38332c;
  --ink: #f0ead8; --ink2: #a89880; --ink3: #6b5f4e;
  --link-color: #7aaee0; --link-bg: rgba(91,143,204,.12); --link-border: rgba(91,143,204,.30);
  --shadow: 0 2px 12px rgba(0,0,0,.40); --shadow-md: 0 6px 24px rgba(0,0,0,.50); --shadow-lg: 0 20px 60px rgba(0,0,0,.65);
  --callout-info-bg: rgba(74,126,184,.12); --callout-info-border: rgba(74,126,184,.30);
}
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

.ne { min-height: 100vh; background: var(--bg); color: var(--ink); font-family: var(--f-ui); display: flex; flex-direction: column; transition: background .3s, color .3s; }
.ne.focus-mode .ne-topbar { opacity: 0; pointer-events: none; transform: translateY(-4px); transition: opacity .3s, transform .3s; }
.ne.focus-mode:hover .ne-topbar, .ne.focus-mode:focus-within .ne-topbar { opacity: 1; pointer-events: auto; transform: none; }
.ne.focus-mode .ne-meta-sidebar { transform: translateX(100%); pointer-events: none; }

.ne-topbar { position: sticky; top: 0; z-index: 200; height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 20px; background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4); border-bottom: 1px solid var(--border); transition: opacity .3s, transform .3s, background .3s; }
.ne-topbar::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 5%, var(--gold) 40%, var(--gold2) 60%, transparent 95%); opacity: .25; pointer-events: none; }
.ne-back-btn { display: inline-flex; align-items: center; gap: 5px; font-family: var(--f-mono); font-size: .58rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink3); background: none; border: none; cursor: pointer; padding: 5px 0; transition: color .2s; flex-shrink: 0; }
.ne-back-btn:hover { color: var(--gold); }
.ne-topbar-center { flex: 1; display: flex; align-items: center; justify-content: center; }
.ne-save-indicator { display: inline-flex; align-items: center; gap: 5px; font-family: var(--f-mono); font-size: .52rem; letter-spacing: .1em; color: var(--ink3); padding: 3px 9px; border-radius: 20px; border: 1px solid transparent; transition: all .25s; }
.ne-save-indicator.saving { color: var(--gold); border-color: rgba(196,145,58,.2); background: rgba(196,145,58,.06); }
.ne-save-indicator.saved { color: var(--green); border-color: rgba(107,158,107,.25); background: rgba(107,158,107,.08); }
.ne-save-indicator.error { color: var(--red); border-color: rgba(184,92,74,.3); background: rgba(184,92,74,.08); }
.ne-topbar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.ne-tb-btn { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border2); background: transparent; color: var(--ink3); cursor: pointer; display: grid; place-items: center; transition: all .15s; }
.ne-tb-btn:hover { border-color: var(--gold); color: var(--gold); background: var(--gold3); }
.ne-tb-btn.active { background: var(--gold3); border-color: rgba(196,145,58,.5); color: var(--gold); }

.ne-layout { display: flex; flex: 1; position: relative; overflow: hidden; }

.ne-toolbar { position: sticky; top: 52px; z-index: 100; background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 5px 14px; display: flex; align-items: center; gap: 2px; flex-wrap: wrap; overflow: visible; flex-shrink: 0; }
.ne-tool-divider { width: 1px; height: 18px; background: var(--border); margin: 0 5px; flex-shrink: 0; }
.ne-tool-btn { width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; color: var(--ink3); cursor: pointer; display: grid; place-items: center; transition: all .12s; flex-shrink: 0; }
.ne-tool-btn:hover { background: var(--surface2); color: var(--ink); }
.ne-tool-btn.active { background: var(--gold3); color: var(--gold); }
.ne-tool-btn:disabled { opacity: .28; cursor: not-allowed; }
.ne-tool-label { font-family: var(--f-mono); font-size: .5rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink3); white-space: nowrap; user-select: none; }

.ne-font-picker-btn { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 9px; border-radius: 7px; border: 1px solid var(--border2); background: transparent; color: var(--ink3); cursor: pointer; font-family: var(--f-mono); font-size: .52rem; letter-spacing: .07em; transition: all .15s; flex-shrink: 0; }
.ne-font-picker-btn:hover { border-color: var(--gold); color: var(--gold); }
.ne-font-picker-label { max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .75rem; }
.ne-font-dropdown { position: absolute; top: calc(100% + 6px); left: 0; z-index: 9999; background: var(--surface); border: 1px solid var(--border2); border-radius: var(--radius); box-shadow: var(--shadow-lg); padding: 5px; min-width: 195px; max-height: 380px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; animation: ne-pop .18s var(--spring); }
.ne-font-dropdown::-webkit-scrollbar { width: 3px; }
.ne-font-dropdown::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.ne-font-separator { height: 1px; background: var(--border); margin: 4px 0; }
.ne-font-group-label { font-family: var(--f-mono); font-size: .44rem; letter-spacing: .16em; text-transform: uppercase; color: var(--ink3); padding: 6px 9px 3px; opacity: .65; }
.ne-font-option { display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 9px; border: none; background: transparent; border-radius: 7px; cursor: pointer; transition: background .1s; color: var(--ink); }
.ne-font-option:hover { background: var(--surface2); }
.ne-font-option.active { background: var(--gold3); }
.ne-font-preview { font-size: 1.05rem; width: 26px; text-align: center; flex-shrink: 0; color: var(--gold); line-height: 1; }
.ne-font-name { font-size: .82rem; flex: 1; text-align: left; }
.ne-font-check { font-size: .7rem; color: var(--gold); margin-left: auto; flex-shrink: 0; }

.ne-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; position: relative; }
.ne-editor-wrap { flex: 1; overflow-y: auto; padding: 36px 0 120px; position: relative; }
.ne-editor-wrap::-webkit-scrollbar { width: 5px; }
.ne-editor-wrap::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

.ne-editor-inner { max-width: 740px; margin: 0 auto; padding: 0 56px 0 80px; }
@media (max-width: 900px) { .ne-editor-inner { padding: 0 24px 0 56px; } }
@media (max-width: 600px) { .ne-editor-inner { padding: 0 16px; } }

.ne-title-input { width: 100%; background: transparent; border: none; outline: none; font-family: var(--f-display); font-size: clamp(2rem,5vw,2.9rem); font-weight: 300; letter-spacing: -.02em; line-height: 1.15; color: var(--ink); caret-color: var(--gold); margin-bottom: 4px; padding: 0; resize: none; overflow: hidden; transition: color .3s; }
.ne-title-input::placeholder { color: var(--ink3); font-style: italic; }

.ne-meta-row { display: flex; align-items: center; gap: 10px; padding: 10px 0 14px; border-bottom: 1px solid var(--border); margin-bottom: 24px; flex-wrap: wrap; min-height: 40px; }
.ne-meta-item { display: inline-flex; align-items: center; gap: 4px; font-family: var(--f-mono); font-size: .54rem; letter-spacing: .08em; color: var(--ink3); cursor: pointer; padding: 3px 8px; border-radius: 20px; border: 1px solid transparent; transition: all .15s; }
.ne-meta-item:hover { background: var(--surface2); color: var(--ink2); border-color: var(--border); }
.ne-meta-item.has-value { color: var(--ink2); border-color: var(--border); }

.ne-editor-inner .ProseMirror { outline: none; font-family: 'Cabinet Grotesk', sans-serif; font-size: 1rem; line-height: 1.85; color: var(--ink); caret-color: var(--gold); }
.ne-editor-inner .ProseMirror > * + * { margin-top: .5em; }
.ne-editor-inner .ProseMirror p { margin-bottom: .6em; line-height: 1.85; }
.ne-editor-inner .ProseMirror h1 { font-family: var(--f-display); font-size: 2.1rem; font-weight: 600; letter-spacing: -.025em; line-height: 1.2; color: var(--ink); margin: 1.6em 0 .5em; padding-bottom: .25em; border-bottom: 1px solid var(--border); }
.ne-editor-inner .ProseMirror h2 { font-family: var(--f-display); font-size: 1.6rem; font-weight: 400; letter-spacing: -.015em; line-height: 1.25; color: var(--ink); margin: 1.4em 0 .4em; }
.ne-editor-inner .ProseMirror h3 { font-family: var(--f-display); font-size: 1.25rem; font-weight: 400; letter-spacing: -.01em; line-height: 1.3; color: var(--ink2); margin: 1.2em 0 .35em; }
.ne-editor-inner .ProseMirror h1 em,.ne-editor-inner .ProseMirror h2 em { font-style: italic; color: var(--gold); }
.ne-editor-inner .ProseMirror span[data-font-family] { transition: font-family 0s; }
.ne-editor-inner .ProseMirror strong { font-weight: 700; }
.ne-editor-inner .ProseMirror em { font-style: italic; color: var(--ink2); }
.ne-editor-inner .ProseMirror s { text-decoration: line-through; opacity: .55; }
.ne-editor-inner .ProseMirror code { font-family: var(--f-mono) !important; font-size: .82em; background: var(--surface2); border: 1px solid var(--border); padding: 1px 5px; border-radius: 5px; color: var(--gold); letter-spacing: -.01em; }
.ne-editor-inner .ProseMirror pre.ne-codeblock { font-family: var(--f-mono) !important; background: var(--surface2); border: 1px solid var(--border); border-left: 3px solid var(--gold); border-radius: var(--radius); padding: 18px 22px; overflow-x: auto; margin: 1.2em 0; position: relative; }
.ne-editor-inner .ProseMirror pre.ne-codeblock::before { content: 'CODE'; position: absolute; top: 8px; right: 12px; font-family: var(--f-mono); font-size: .42rem; letter-spacing: .14em; color: var(--ink3); opacity: .5; }
.ne-editor-inner .ProseMirror pre.ne-codeblock code { background: transparent; border: none; padding: 0; font-size: .88rem; color: var(--ink); line-height: 1.7; }
.ne-editor-inner .ProseMirror blockquote { border-left: 3px solid var(--gold); padding: 8px 0 8px 20px; margin: 1.1em 0; color: var(--ink2); font-style: italic; font-family: var(--f-display); font-size: 1.08rem; line-height: 1.65; }
.ne-editor-inner .ProseMirror ul,.ne-editor-inner .ProseMirror ol { padding-left: 1.6em; margin: .5em 0; }
.ne-editor-inner .ProseMirror li { margin-bottom: .3em; line-height: 1.75; }
.ne-editor-inner .ProseMirror ul li::marker { color: var(--gold); }
.ne-editor-inner .ProseMirror ol li::marker { color: var(--ink3); font-family: var(--f-mono); font-size: .82em; }
.ne-editor-inner .ProseMirror hr { border: none; height: 1px; background: linear-gradient(90deg, transparent, var(--border2) 20%, var(--border2) 80%, transparent); margin: 2.2em 0; }
.ne-editor-inner .ProseMirror a { color: var(--gold); text-decoration: underline; text-underline-offset: 3px; transition: opacity .15s; }
.ne-editor-inner .ProseMirror a:hover { opacity: .7; }
.ne-editor-inner .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: var(--ink3); pointer-events: none; height: 0; font-style: italic; }
.ne-editor-inner .ProseMirror ::selection { background: var(--gold-glow); }
.ne-editor-inner .ProseMirror .ne-task-list { padding-left: .25em; list-style: none; }
.ne-editor-inner .ProseMirror .ne-task-list li { display: flex; align-items: flex-start; gap: 8px; padding: .15em 0; }
.ne-editor-inner .ProseMirror .ne-task-list li > label { display: flex; align-items: center; flex-shrink: 0; padding-top: .15em; cursor: pointer; }
.ne-editor-inner .ProseMirror .ne-task-list li > label input[type="checkbox"] { appearance: none; width: 16px; height: 16px; border: 1.5px solid var(--border2); border-radius: 4px; cursor: pointer; position: relative; transition: all .15s; flex-shrink: 0; }
.ne-editor-inner .ProseMirror .ne-task-list li > label input[type="checkbox"]:checked { background: var(--gold); border-color: var(--gold); }
.ne-editor-inner .ProseMirror .ne-task-list li > label input[type="checkbox"]:checked::after { content: '✓'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: .65rem; color: #fff; font-weight: 700; }
.ne-editor-inner .ProseMirror .ne-task-list li[data-checked="true"] > div { text-decoration: line-through; opacity: .5; }
.ne-editor-inner .ProseMirror .ne-task-list li > div { flex: 1; min-width: 0; }
.ne-editor-inner .ProseMirror .ne-callout { display: flex; gap: 12px; padding: 14px 18px; border-radius: 9px; margin: 1.2em 0; line-height: 1.7; }
.ne-editor-inner .ProseMirror .ne-callout::before { content: attr(data-callout-icon); font-size: 1.1rem; flex-shrink: 0; padding-top: 1px; }
.ne-editor-inner .ProseMirror .ne-callout > * { flex: 1; min-width: 0; }
.ne-editor-inner .ProseMirror .ne-callout[data-callout-type="info"] { background: var(--callout-info-bg); border: 1px solid var(--callout-info-border); border-left: 3px solid var(--blue); }
.ne-editor-inner .ProseMirror .ne-callout[data-callout-type="warning"] { background: var(--callout-warning-bg); border: 1px solid var(--callout-warning-border); border-left: 3px solid var(--gold); }
.ne-editor-inner .ProseMirror .ne-callout[data-callout-type="success"] { background: var(--callout-success-bg); border: 1px solid var(--callout-success-border); border-left: 3px solid var(--green); }
.ne-editor-inner .ProseMirror .ne-callout[data-callout-type="error"] { background: var(--callout-error-bg); border: 1px solid var(--callout-error-border); border-left: 3px solid var(--red); }
.ne-editor-inner .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 1.2em 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.ne-editor-inner .ProseMirror th { background: var(--surface2); font-family: var(--f-mono); font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); padding: 9px 13px; text-align: left; border: 1px solid var(--border); }
.ne-editor-inner .ProseMirror td { padding: 9px 13px; border: 1px solid var(--border); vertical-align: top; line-height: 1.6; }
.ne-editor-inner .ProseMirror tr:nth-child(even) td { background: rgba(0,0,0,.015); }
.dark .ne-editor-inner .ProseMirror tr:nth-child(even) td { background: rgba(255,255,255,.02); }
.ne-editor-inner .ProseMirror .selectedCell { background: var(--gold3) !important; }

.ne-editor-inner .ProseMirror .ne-internal-link { color: var(--link-color); background: var(--link-bg); border: 1px solid var(--link-border); border-radius: 4px; padding: 1px 6px 1px 4px; font-size: .9em; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 3px; transition: all .15s; white-space: nowrap; }
.ne-editor-inner .ProseMirror .ne-internal-link::before { content: '↗'; font-size: .7em; opacity: .6; }
.ne-editor-inner .ProseMirror .ne-internal-link:hover { background: var(--link-border); opacity: .9; }
.ne-editor-inner .ProseMirror .ne-internal-link.unresolved { color: var(--ink3); background: transparent; border-color: var(--border2); border-style: dashed; }
.ne-editor-inner .ProseMirror .ne-internal-link.unresolved::before { content: '?'; }

.ne-wikilink-menu { position: fixed; z-index: 9999; background: var(--surface); border: 1px solid var(--border2); border-radius: var(--radius); box-shadow: var(--shadow-lg); min-width: 260px; max-width: 320px; overflow: hidden; animation: ne-pop .16s var(--spring); }
.ne-wikilink-header { padding: 8px 12px 6px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; font-family: var(--f-mono); font-size: .5rem; letter-spacing: .12em; text-transform: uppercase; color: var(--link-color); }
.ne-wikilink-scroll { max-height: 280px; overflow-y: auto; padding: 5px; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.ne-wikilink-scroll::-webkit-scrollbar { width: 3px; }
.ne-wikilink-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.ne-wikilink-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 10px; border: none; background: transparent; border-radius: 7px; cursor: pointer; text-align: left; transition: background .1s; }
.ne-wikilink-item:hover,.ne-wikilink-item.selected { background: var(--link-bg); }
.ne-wikilink-item.selected { background: var(--link-bg); outline: 1px solid var(--link-border); }
.ne-wikilink-icon { width: 26px; height: 26px; border-radius: 6px; background: var(--surface2); border: 1px solid var(--border); display: grid; place-items: center; color: var(--link-color); flex-shrink: 0; font-size: .8rem; }
.ne-wikilink-info { flex: 1; min-width: 0; }
.ne-wikilink-title { font-family: var(--f-ui); font-size: .84rem; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ne-wikilink-meta { font-family: var(--f-mono); font-size: .48rem; color: var(--ink3); letter-spacing: .05em; margin-top: 1px; }
.ne-wikilink-empty { padding: 18px 12px; text-align: center; font-family: var(--f-mono); font-size: .56rem; color: var(--ink3); }
.ne-wikilink-query-highlight { color: var(--link-color); }

.ne-bubble-menu { display: flex; align-items: center; gap: 2px; padding: 5px 7px; background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; box-shadow: var(--shadow-md); animation: ne-pop .18s var(--spring); }
.ne-bubble-btn { width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent; color: var(--ink3); cursor: pointer; display: grid; place-items: center; transition: all .1s; }
.ne-bubble-btn:hover { background: var(--surface2); color: var(--ink); }
.ne-bubble-btn.active { background: var(--gold3); color: var(--gold); }
.ne-bubble-divider { width: 1px; height: 16px; background: var(--border); margin: 0 2px; }

.ne-slash-menu { position: fixed; z-index: 9999; background: var(--surface); border: 1px solid var(--border2); border-radius: var(--radius); box-shadow: var(--shadow-lg); padding: 6px; min-width: 240px; max-width: 280px; animation: ne-pop .17s var(--spring); overflow: hidden; }
.ne-slash-scroll { max-height: 340px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.ne-slash-scroll::-webkit-scrollbar { width: 3px; }
.ne-slash-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.ne-slash-group { margin-bottom: 4px; }
.ne-slash-category { font-family: var(--f-mono); font-size: .46rem; letter-spacing: .16em; text-transform: uppercase; color: var(--ink3); padding: 6px 10px 3px; opacity: .7; }
.ne-slash-item { display: flex; align-items: center; gap: 9px; padding: 7px 8px; border-radius: 7px; cursor: pointer; transition: background .1s; border: none; background: transparent; width: 100%; text-align: left; }
.ne-slash-item:hover,.ne-slash-item.selected { background: var(--surface2); }
.ne-slash-item.selected { background: var(--gold3); }
.ne-slash-icon { width: 28px; height: 28px; border-radius: 6px; background: var(--surface2); border: 1px solid var(--border); display: grid; place-items: center; color: var(--ink3); flex-shrink: 0; transition: all .12s; }
.ne-slash-item.selected .ne-slash-icon { background: var(--gold3); border-color: rgba(196,145,58,.3); color: var(--gold); }
.ne-slash-text { flex: 1; min-width: 0; }
.ne-slash-label { font-family: var(--f-ui); font-size: .82rem; font-weight: 600; color: var(--ink); line-height: 1.2; }
.ne-slash-desc { font-family: var(--f-mono); font-size: .5rem; color: var(--ink3); letter-spacing: .04em; margin-top: 1px; }
.ne-slash-empty { padding: 16px 12px; font-family: var(--f-mono); font-size: .58rem; color: var(--ink3); text-align: center; }
.ne-slash-search-hint { font-family: var(--f-mono); font-size: .48rem; letter-spacing: .08em; color: var(--ink3); padding: 5px 10px 2px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }

.ne-block-menu { position: absolute; left: -54px; display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .15s; z-index: 50; }
.ne-block-menu-wrap:hover .ne-block-menu,.ne-block-menu:hover { opacity: 1; }
.ne-block-handle,.ne-block-action-btn { width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--border); background: var(--surface); color: var(--ink3); cursor: pointer; display: grid; place-items: center; transition: all .12s; }
.ne-block-handle { cursor: grab; }
.ne-block-handle:hover,.ne-block-action-btn:hover { border-color: var(--gold); color: var(--gold); background: var(--gold3); }
.ne-block-action-btn.active { background: var(--gold3); border-color: var(--gold); color: var(--gold); }
.ne-block-popover { position: absolute; top: calc(100% + 5px); left: 0; z-index: 500; background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; box-shadow: var(--shadow-lg); padding: 5px; min-width: 155px; animation: ne-pop .16s var(--spring); }
.ne-block-pop-item { display: flex; align-items: center; gap: 7px; width: 100%; padding: 7px 9px; border: none; background: transparent; border-radius: 6px; font-family: var(--f-ui); font-size: .78rem; color: var(--ink2); cursor: pointer; transition: all .1s; white-space: nowrap; }
.ne-block-pop-item:hover { background: var(--surface2); color: var(--ink); }
.ne-block-pop-item.danger { color: var(--red); }
.ne-block-pop-item.danger:hover { background: rgba(184,92,74,.1); }
.ne-block-pop-sep { height: 1px; background: var(--border); margin: 4px 0; }

.ne-meta-sidebar { width: 265px; flex-shrink: 0; background: var(--surface); border-left: 1px solid var(--border); padding: 22px 18px; overflow-y: auto; transition: transform .3s var(--ease), width .3s; }
.ne-meta-sidebar::-webkit-scrollbar { width: 3px; }
.ne-meta-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.ne-meta-label { font-family: var(--f-mono); font-size: .5rem; letter-spacing: .16em; text-transform: uppercase; color: var(--ink3); margin-bottom: 7px; display: flex; align-items: center; gap: 5px; }
.ne-meta-section { margin-bottom: 22px; }
.ne-meta-input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; padding: 7px 10px; font-family: var(--f-ui); font-size: .82rem; color: var(--ink); outline: none; transition: border-color .2s; }
.ne-meta-input::placeholder { color: var(--ink3); }
.ne-meta-input:focus { border-color: var(--gold); }
.ne-meta-select { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; padding: 7px 10px; font-family: var(--f-ui); font-size: .82rem; color: var(--ink); outline: none; appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239c9283' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 9px center; padding-right: 26px; transition: border-color .2s; }
.ne-meta-select:focus { border-color: var(--gold); }
.ne-meta-select option { background: var(--surface2); }
.ne-meta-stat { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); }
.ne-meta-stat:last-child { border-bottom: none; }
.ne-meta-stat-label { font-family: var(--f-mono); font-size: .5rem; color: var(--ink3); letter-spacing: .06em; }
.ne-meta-stat-val { font-family: var(--f-display); font-size: 1.05rem; font-weight: 300; color: var(--gold); }

.ne-backlinks-section { border-top: 1px solid var(--border); padding-top: 18px; margin-top: 8px; }
.ne-backlinks-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ne-backlinks-count { font-family: var(--f-mono); font-size: .48rem; letter-spacing: .1em; padding: 2px 8px; border-radius: 10px; background: var(--link-bg); border: 1px solid var(--link-border); color: var(--link-color); }
.ne-backlink-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 9px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: all .15s; margin-bottom: 4px; }
.ne-backlink-item:hover { background: var(--link-bg); border-color: var(--link-border); }
.ne-backlink-dot { width: 22px; height: 22px; border-radius: 5px; background: var(--surface2); border: 1px solid var(--border); display: grid; place-items: center; color: var(--link-color); font-size: .7rem; flex-shrink: 0; margin-top: 1px; }
.ne-backlink-info { flex: 1; min-width: 0; }
.ne-backlink-title { font-family: var(--f-ui); font-size: .8rem; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ne-backlink-meta { font-family: var(--f-mono); font-size: .46rem; color: var(--ink3); letter-spacing: .05em; margin-top: 2px; }
.ne-backlink-empty { font-family: var(--f-mono); font-size: .52rem; color: var(--ink3); font-style: italic; padding: 8px 4px; }
.ne-outgoing-item { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 5px; background: var(--link-bg); border: 1px solid var(--link-border); color: var(--link-color); font-family: var(--f-mono); font-size: .5rem; cursor: pointer; transition: all .12s; margin: 2px; }
.ne-outgoing-item:hover { background: var(--link-border); }

.ne-tag-wrap { display: flex; flex-wrap: wrap; gap: 5px; padding: 6px 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 7px; cursor: text; min-height: 38px; align-items: center; transition: border-color .2s; }
.ne-tag-pill { display: inline-flex; align-items: center; gap: 3px; font-family: var(--f-mono); font-size: .5rem; letter-spacing: .06em; padding: 2px 8px; border-radius: 20px; background: var(--gold3); border: 1px solid rgba(196,145,58,.3); color: var(--gold); }
.ne-tag-pill button { background: none; border: none; cursor: pointer; color: inherit; padding: 0; display: flex; align-items: center; line-height: 1; }
.ne-tag-bare { background: transparent; border: none; outline: none; font-family: var(--f-mono); font-size: .54rem; color: var(--ink); flex: 1; min-width: 60px; }
.ne-tag-bare::placeholder { color: var(--ink3); }
.ne-tag-suggestions { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 200; background: var(--surface); border: 1px solid var(--border2); border-radius: 8px; box-shadow: var(--shadow-md); padding: 4px; animation: ne-pop .15s var(--spring); }
.ne-tag-suggestion-item { display: block; width: 100%; padding: 5px 9px; border: none; background: transparent; border-radius: 5px; font-family: var(--f-mono); font-size: .54rem; color: var(--ink2); cursor: pointer; text-align: left; transition: background .1s; }
.ne-tag-suggestion-item:hover,.ne-tag-suggestion-item.selected { background: var(--gold3); color: var(--gold); }

.ne-btn { display: inline-flex; align-items: center; gap: 6px; font-family: var(--f-mono); font-size: .58rem; letter-spacing: .08em; text-transform: uppercase; padding: 7px 13px; border-radius: 7px; border: none; cursor: pointer; transition: all .2s; white-space: nowrap; }
.ne-btn-ghost { background: transparent; border: 1px solid var(--border2); color: var(--ink3); }
.ne-btn-ghost:hover { border-color: var(--gold); color: var(--gold); }
.ne-btn-danger { background: rgba(184,92,74,.1); border: 1px solid rgba(184,92,74,.3); color: var(--red); }
.ne-btn-danger:hover:not(:disabled) { background: rgba(184,92,74,.2); }
.ne-btn:disabled { opacity: .4; cursor: not-allowed; }

.ne-ai-indicator { display: inline-flex; align-items: center; gap: 6px; font-family: var(--f-mono); font-size: .54rem; letter-spacing: .08em; color: var(--gold); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(196,145,58,.3); background: rgba(196,145,58,.07); animation: ne-pulse 1.5s ease-in-out infinite; position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); }
@keyframes ne-pulse { 0%,100% { opacity: .7; } 50% { opacity: 1; } }

.ne-loading { min-height: 100vh; display: grid; place-items: center; background: var(--bg); }
.ne-loading-inner { text-align: center; }
.ne-loading-glyph { font-family: var(--f-display); font-size: 3.5rem; color: var(--gold); opacity: .35; display: block; animation: ne-rot 5s linear infinite; }
@keyframes ne-rot { to { transform: rotate(360deg); } }
.ne-loading-text { font-family: var(--f-mono); font-size: .6rem; letter-spacing: .18em; text-transform: uppercase; color: var(--ink3); margin-top: 14px; }

@keyframes ne-pop { from { opacity: 0; transform: scale(.93) translateY(5px); } to { opacity: 1; transform: none; } }
@keyframes ne-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.ne-fade-in { animation: ne-up .38s var(--ease) both; }
`;

/* ═══════════════════════════════════════════════════════════════
   WikiLinkMenu
═══════════════════════════════════════════════════════════════ */
function WikiLinkMenu({ query, allNotes, position, onSelect, onClose }) {
  const [selected, setSelected] = useState(0);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allNotes
      .filter((n) => n.title?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allNotes]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[selected]) onSelect(filtered[selected]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [filtered, selected, onSelect, onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        onClose();
    };
    setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  const highlightQuery = (title) => {
    if (!query) return <span>{title}</span>;
    const idx = title.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{title}</span>;
    return (
      <span>
        {title.slice(0, idx)}
        <span className="ne-wikilink-query-highlight">
          {title.slice(idx, idx + query.length)}
        </span>
        {title.slice(idx + query.length)}
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      className="ne-wikilink-menu"
      style={{
        position: 'fixed',
        top: (position?.top ?? 100) + 24,
        left: position?.left ?? 100,
      }}
    >
      <div className="ne-wikilink-header">
        <Link2 size={10} />
        Link to note {query && `· "${query}"`}
      </div>
      <div className="ne-wikilink-scroll">
        {filtered.length === 0 ? (
          <div className="ne-wikilink-empty">
            {query
              ? `No notes match "${query}"`
              : 'Start typing to search notes…'}
          </div>
        ) : (
          filtered.map((note, i) => (
            <button
              key={note.id}
              className={`ne-wikilink-item ${i === selected ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(note);
              }}
              onMouseEnter={() => setSelected(i)}
            >
              <div className="ne-wikilink-icon">
                {note.card_style?.emoji ||
                  note.title?.[0]?.toUpperCase() ||
                  '?'}
              </div>
              <div className="ne-wikilink-info">
                <div className="ne-wikilink-title">
                  {highlightQuery(note.title || 'Untitled')}
                </div>
                <div className="ne-wikilink-meta">
                  {note.subject || ''}
                  {note.tags?.length > 0 && ` · #${note.tags[0]}`}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BacklinksPanel
═══════════════════════════════════════════════════════════════ */
function BacklinksPanel({ backlinks, outgoingLinks, onNavigate }) {
  return (
    <div className="ne-backlinks-section">
      {outgoingLinks.length > 0 && (
        <div className="ne-meta-section" style={{ marginBottom: 16 }}>
          <div className="ne-meta-label">
            <Link2 size={10} /> Links to
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {outgoingLinks.map((n) => (
              <button
                key={n.id}
                className="ne-outgoing-item"
                onClick={() => onNavigate(n.id)}
              >
                ↗ {n.title || 'Untitled'}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ne-meta-section">
        <div className="ne-backlinks-header">
          <div className="ne-meta-label" style={{ margin: 0 }}>
            <Network size={10} /> Referenced by
          </div>
          {backlinks.length > 0 && (
            <span className="ne-backlinks-count">{backlinks.length}</span>
          )}
        </div>
        {backlinks.length === 0 ? (
          <div className="ne-backlink-empty">No notes link here yet</div>
        ) : (
          backlinks.map((note) => (
            <div
              key={note.id}
              className="ne-backlink-item"
              onClick={() => onNavigate(note.id)}
            >
              <div className="ne-backlink-dot">
                {note.card_style?.emoji || <FileText size={11} />}
              </div>
              <div className="ne-backlink-info">
                <div className="ne-backlink-title">
                  {note.title || 'Untitled'}
                </div>
                <div className="ne-backlink-meta">
                  {note.subject || ''}
                  {note.tags?.length > 0 && ` · #${note.tags[0]}`}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { supabase, loading: sbLoading } = useSupabase();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [note, setNote] = useState(null);
  const [collections, setCollections] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Create handlers ── */
  const handleCreateNote = async (data) => {
    console.log('EDITOR RECEIVE:', data); // 🔥 debug

    try {
      const newNote = await createNote(
        supabase,
        {
          title: data.title,
          collection_id: data.collection_id || null, // ✅ EXACT SAME AS NOTES PAGE
          subject: null,
          tags: [],
          content: null,
        },
        user.id,
      );

      editor?.commands.setContent(null);
      navigate(`/notes/${newNote.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCollection = async ({ name, icon, color, parent_id }) => {
    try {
      const newCollection = await createCollection(
        supabase,
        { name, icon, color, parent_id: parent_id || null },
        user.id,
      );
      setCollections((prev) => [...prev, newCollection]);
    } catch (err) {
      console.error(err);
    }
  };

  /* ── Editable metadata ── */
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [tags, setTags] = useState([]);
  const [font, setFont] = useState('cabinet');

  /* ── Link state ── */
  const [parsedLinks, setParsedLinks] = useState([]);
  const linkDebounceRef = useRef(null);

  /* ── UI ── */
  const [focusMode, setFocusMode] = useState(false);
  const [showMeta, setShowMeta] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);

  /* ── WikiLink menu ── */
  const [wikiMenu, setWikiMenu] = useState(null);
  const wikiStartPos = useRef(null);
  const wikiQueryRef = useRef('');
  const isWikiLinking = useRef(false);

  /* ── Slash command ── */
  const [slashMenu, setSlashMenu] = useState(null);
  const slashStartPos = useRef(null);
  const slashQueryRef = useRef('');

  /* ── Refs ── */
  const titleRef = useRef(null);
  const editorWrapRef = useRef(null);
  const contentRef = useRef(null);

  /* ── Autosave ── */
  const { saveState, scheduleSave, forceSave } = useAutosave({
    supabase,
    noteId: id,
  });

  /* ── Ref mirrors (stale-closure-free saves) ── */
  const titleRef2 = useRef(title);
  const subjectRef = useRef(subject);
  const collectionIdRef = useRef(collectionId);
  const tagsRef = useRef(tags);
  const fontRef = useRef(font);
  const parsedLinksRef = useRef(parsedLinks);

  useEffect(() => {
    titleRef2.current = title;
  }, [title]);
  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);
  useEffect(() => {
    collectionIdRef.current = collectionId;
  }, [collectionId]);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);
  useEffect(() => {
    fontRef.current = font;
  }, [font]);
  useEffect(() => {
    parsedLinksRef.current = parsedLinks;
  }, [parsedLinks]);

  const buildPayload = useCallback(
    () => ({
      title: titleRef2.current,
      subject: subjectRef.current,
      collectionId: collectionIdRef.current,
      tags: tagsRef.current,
      font: fontRef.current,
      links: parsedLinksRef.current
        .filter((l) => l.noteId)
        .map((l) => l.noteId),
      content: contentRef.current || {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
    }),
    [],
  );

  const triggerSave = useCallback(() => {
    scheduleSave(buildPayload());
  }, [scheduleSave, buildPayload]);

  /* ── Link parser (debounced 400ms) ── */
  const handleLinkParse = useCallback(
    (json) => {
      clearTimeout(linkDebounceRef.current);
      linkDebounceRef.current = setTimeout(() => {
        const links = extractWikiLinks(json);
        const resolved = links.map((l) => {
          if (l.noteId) return l;
          const match = allNotes.find(
            (n) =>
              n.title?.toLowerCase() === l.title.toLowerCase() && n.id !== id,
          );
          return { ...l, noteId: match?.id || null };
        });
        setParsedLinks(resolved);
      }, 400);
    },
    [allNotes, id],
  );

  /* ── Slash trigger ── */
  const handleSlashTrigger = useCallback((view) => {
    const { from } = view.state.selection;
    const $pos = view.state.doc.resolve(from);
    const lineStart = $pos.start($pos.depth);
    const textBefore = view.state.doc
      .textBetween(lineStart, from, '\n', ' ')
      .trim();
    if (textBefore) return;
    const coords = view.coordsAtPos(from);
    slashStartPos.current = from;
    slashQueryRef.current = '';
    setSlashMenu({ top: coords.top + 16, left: coords.left, query: '' });
  }, []);

  /* ── WikiLink [[ trigger ── */
  const handleWikiLinkTrigger = useCallback((view, from, coords) => {
    isWikiLinking.current = true;
    wikiStartPos.current = from;
    wikiQueryRef.current = '';
    setWikiMenu({ top: coords.top, left: coords.left, query: '' });
  }, []);

  /* ── Editor ── */
  const { editor, wordCount, charCount } = useEditorConfig({
    initialContent: null,
    onUpdate: (json) => {
      contentRef.current = json;
      handleLinkParse(json);
      triggerSave();

      if (!editor) return;
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(
        Math.max(0, from - 30),
        from,
        '\n',
        ' ',
      );
      const wikiMatch = textBefore.match(/\[\[([^\]]*)$/);
      if (wikiMatch && !isWikiLinking.current) {
        const coords = editor.view.coordsAtPos(from);
        handleWikiLinkTrigger(editor.view, from - wikiMatch[0].length, coords);
      } else if (isWikiLinking.current) {
        const match = textBefore.match(/\[\[([^\]]*)$/);
        if (match) {
          wikiQueryRef.current = match[1];
          setWikiMenu((s) => s && { ...s, query: match[1] });
        } else {
          isWikiLinking.current = false;
          wikiStartPos.current = null;
          setWikiMenu(null);
        }
      }
    },
    onSlashTrigger: handleSlashTrigger,
  });

  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  /* ─────────────────────────────────────────────────────────────
     ✅ THE FIX: allNotes query now includes collection_id
     Without this field, getDirectNotes() in EditorSidebar always
     returns [] because every note has (n.collection_id ?? null)
     evaluated against undefined, not the actual stored value.
  ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!supabase || !id) return;
    (async () => {
      setLoading(true);
      const [{ data: n }, { data: c }, { data: allNotesData }] =
        await Promise.all([
          supabase.from('user_notes').select('*').eq('id', id).single(),
          supabase.from('note_collections').select('*').order('name'),
          supabase
            .from('user_notes')
            // ✅ collection_id added — required for sidebar tree placement
            .select(
              'id, title, subject, tags, links, card_style, collection_id, updated_at',
            )
            .order('title'),
        ]);

      if (n) {
        setNote(n);
        setTitle(n.title || '');
        setSubject(n.subject || '');
        setCollectionId(n.collection_id || '');
        setTags(Array.isArray(n.tags) ? n.tags : []);
        setFont(n.font || 'cabinet');
        contentRef.current = n.content;
        if (Array.isArray(n.links)) {
          const resolved = n.links.map((noteId) => ({
            noteId,
            title: allNotesData?.find((x) => x.id === noteId)?.title || '',
          }));
          setParsedLinks(resolved);
        }
      }
      setCollections(c || []);
      const allN = allNotesData || [];
      setAllNotes(allN);
      const flat = allN.flatMap((r) => r.tags || []).filter(Boolean);
      setAllTags([...new Set(flat)]);
      setLoading(false);
    })();
  }, [supabase, id]);

  /* ── Set initial editor content ── */
  useEffect(() => {
    if (!editor) return;
    if (!note) {
      editor.commands.setContent('');
      return;
    }
    editor.commands.setContent(note.content || '');
  }, [note, editor]);

  /* ── Default font ── */
  useEffect(() => {
    if (!editor || editor.isDestroyed || !note) return;
    const fontDef = FONTS.find((f) => f.key === font);
    if (!fontDef) return;
    const applyDefaultFont = () => {
      const { doc } = editor.state;
      if (!doc || doc.nodeSize <= 2) return;
      editor
        .chain()
        .selectAll()
        .setFontFamily(fontDef.stack)
        .setTextSelection(0)
        .run();
    };
    const t = setTimeout(applyDefaultFont, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, editor]);

  /* ── Internal link click handler ── */
  useEffect(() => {
    if (!editor) return;
    const onCreate = () => {
      const editorEl = editor.view.dom;
      const handleClick = (e) => {
        const target = e.target.closest('.ne-internal-link');
        if (!target) return;
        const noteId = target.dataset.noteId;
        if (noteId) {
          e.preventDefault();
          navigate(`/notes/${noteId}`);
        }
      };
      editorEl.addEventListener('click', handleClick);
      return () => editorEl.removeEventListener('click', handleClick);
    };
    editor.on('create', onCreate);
    return () => editor.off('create', onCreate);
  }, [editor, navigate]);

  /* ── Metadata → save ── */
  useEffect(() => {
    if (note) triggerSave();
  }, [title, subject, collectionId, tags, font]);

  /* ── Title resize ── */
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  }, [title]);

  /* ── WikiLink select ── */
  const handleWikiLinkSelect = useCallback(
    (selectedNote) => {
      if (!editor || wikiStartPos.current === null) return;
      const from = wikiStartPos.current;
      const to = editor.state.selection.from;

      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, {
          type: 'text',
          text: selectedNote.title || 'Untitled',
          marks: [
            {
              type: 'internalLink',
              attrs: {
                noteId: selectedNote.id,
                title: selectedNote.title || 'Untitled',
              },
            },
          ],
        })
        .run();

      editor.chain().focus().insertContent(' ').run();
      isWikiLinking.current = false;
      wikiStartPos.current = null;
      wikiQueryRef.current = '';
      setWikiMenu(null);

      setParsedLinks((prev) => {
        if (prev.find((l) => l.noteId === selectedNote.id)) return prev;
        return [
          ...prev,
          { noteId: selectedNote.id, title: selectedNote.title || '' },
        ];
      });
    },
    [editor],
  );

  /* ── Slash query tracking ── */
  useEffect(() => {
    if (!slashMenu) return;
    const handler = (e) => {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) return;
      if (e.key === 'Backspace') {
        const q = slashQueryRef.current;
        if (q.length === 0) {
          setSlashMenu(null);
          slashStartPos.current = null;
        } else {
          slashQueryRef.current = q.slice(0, -1);
          setSlashMenu((s) => s && { ...s, query: slashQueryRef.current });
        }
      } else if (e.key.length === 1 && e.key !== '/') {
        slashQueryRef.current += e.key;
        setSlashMenu((s) => s && { ...s, query: slashQueryRef.current });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [slashMenu]);

  /* ── Slash select ── */
  const handleSlashSelect = useCallback(
    async (cmd) => {
      if (!editor) return;
      const from = slashStartPos.current;
      if (from !== null) {
        const to = editor.state.selection.from;
        if (to > from) editor.chain().focus().deleteRange({ from, to }).run();
      }
      if (cmd.id === 'ai-continue') {
        setSlashMenu(null);
        slashStartPos.current = null;
        await handleAIContinue();
        return;
      }
      cmd.action(editor);
      setSlashMenu(null);
      slashStartPos.current = null;
    },
    [editor],
  );

  /* ── AI Continue ── */
  const handleAIContinue = useCallback(async () => {
    if (!editor) return;
    setAiGenerating(true);
    try {
      const snippet = editor.getText().slice(-1200);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `Continue this text naturally. Output ONLY the continuation, no preamble. Keep the same voice and style:\n\n${snippet}`,
            },
          ],
        }),
      });
      const data = await res.json();
      const continuation = data?.content?.[0]?.text;
      if (continuation)
        editor.chain().focus().insertContent(continuation).run();
    } catch (err) {
      console.error('[AI Continue]', err);
    } finally {
      setAiGenerating(false);
    }
  }, [editor]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        forceSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setFocusMode((f) => !f);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [forceSave]);

  /* ── Delete note ── */
  const handleDelete = useCallback(async () => {
    if (!supabase || !window.confirm('Delete this note permanently?')) return;
    await supabase.from('user_notes').delete().eq('id', id);
    navigate('/notes');
  }, [supabase, id, navigate]);

  /* ── Backlinks ── */
  const { backlinks, outgoingLinks } = useBacklinks(id, allNotes);

  /* ── Graph data ── */
  const graphData = useMemo(() => buildGraph(allNotes), [allNotes]);

  /* ── Current collection ── */
  const currentCollection = useMemo(
    () => collections.find((c) => c.id === collectionId),
    [collections, collectionId],
  );

  /* ── Flat collections for <select> (depth-indented) ── */
  const flatCollections = useMemo(() => {
    const tree = buildCollectionTree(collections);
    return flattenTree(tree);
  }, [collections]);

  /* ── Loading states ── */
  if (sbLoading || loading)
    return (
      <div className="ne-loading">
        <style>{CSS}</style>
        <div className="ne-loading-inner">
          <span className="ne-loading-glyph">◈</span>
          <div className="ne-loading-text">Loading note…</div>
        </div>
      </div>
    );

  if (!note)
    return (
      <div className="ne-loading">
        <style>{CSS}</style>
        <div className="ne-loading-inner">
          <div className="ne-loading-text" style={{ color: 'var(--red)' }}>
            Note not found
          </div>
          <button
            onClick={() => navigate('/notes')}
            style={{
              marginTop: 16,
              fontFamily: 'var(--f-mono)',
              fontSize: '.6rem',
              color: 'var(--gold)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
            }}
          >
            ← Back to Notes
          </button>
        </div>
      </div>
    );

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div
      className={`ne ${isDark ? 'dark' : ''} ${focusMode ? 'focus-mode' : ''}`}
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{CSS}</style>

      {/* ══ TOPBAR ══ */}
      <div className="ne-topbar">
        <button className="ne-back-btn" onClick={() => navigate('/notes')}>
          <ArrowLeft size={12} /> Notes
        </button>
        <div className="ne-topbar-center">
          <span className={`ne-save-indicator ${saveState}`}>
            {saveState === 'saving' && (
              <>
                <Loader2
                  size={10}
                  style={{ animation: 'ne-rot .8s linear infinite' }}
                />{' '}
                Saving…
              </>
            )}
            {saveState === 'saved' && (
              <>
                <Check size={10} /> Saved
              </>
            )}
            {saveState === 'error' && (
              <>
                <AlertTriangle size={10} /> Save failed
              </>
            )}
            {saveState === 'idle' && 'Auto-save on'}
          </span>
        </div>
        <div className="ne-topbar-right">
          {parsedLinks.length > 0 && (
            <span
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: '.48rem',
                letterSpacing: '.08em',
                padding: '3px 8px',
                borderRadius: 10,
                background: 'var(--link-bg)',
                border: '1px solid var(--link-border)',
                color: 'var(--link-color)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Link2 size={9} /> {parsedLinks.length}
            </span>
          )}
          <button
            className={`ne-tb-btn ${showSidebar ? 'active' : ''}`}
            onClick={() => setShowSidebar((s) => !s)}
            title="Toggle file explorer"
          >
            <Sidebar size={13} />
          </button>
          <button
            className={`ne-tb-btn ${focusMode ? 'active' : ''}`}
            onClick={() => setFocusMode((f) => !f)}
            title="Focus mode (⌘⇧F)"
          >
            <Focus size={13} />
          </button>
          <button
            className="ne-tb-btn"
            onClick={() => navigate('/graph')}
            title="Knowledge Graph"
          >
            <Network size={13} />
          </button>
          <button
            className={`ne-tb-btn ${showMeta ? 'active' : ''}`}
            onClick={() => setShowMeta((m) => !m)}
            title="Toggle sidebar"
          >
            <AlignLeft size={13} />
          </button>
          <button
            className="ne-tb-btn"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            {isDark ? (
              <Sun size={13} strokeWidth={1.8} />
            ) : (
              <Moon size={13} strokeWidth={1.8} />
            )}
          </button>
          <button
            className="ne-tb-btn"
            onClick={handleDelete}
            title="Delete note"
          >
            <Trash2 size={13} style={{ color: 'var(--red)', opacity: 0.55 }} />
          </button>
        </div>
      </div>

      {/* ══ TOOLBAR ══ */}
      <EditorToolbar
        editor={editor}
        onFontChange={(key) => setFont(key ?? 'cabinet')}
      />

      {/* ══ LAYOUT ══ */}
      <div
        className="ne-layout"
        style={{ flex: 1, overflow: 'hidden', display: 'flex' }}
      >
        {showSidebar && (
          <EditorSidebar
            allNotes={allNotes}
            collections={collections}
            currentNoteId={id}
            onNewNote={(data) => handleCreateNote(data)}
            onNewCollection={({ name, icon, color, parent_id }) =>
              handleCreateCollection({ name, icon, color, parent_id })
            }
            onDeleteNote={async (noteId) => {
              if (noteId === id) {
                await supabase?.from('user_notes').delete().eq('id', noteId);
                navigate('/notes');
              } else {
                await supabase?.from('user_notes').delete().eq('id', noteId);
                setAllNotes((prev) => prev.filter((n) => n.id !== noteId));
              }
            }}
          />
        )}

        <div className="ne-content">
          <div
            ref={editorWrapRef}
            className="ne-editor-wrap"
            onClick={(e) => {
              if (
                e.target === e.currentTarget ||
                e.target.closest('.ne-editor-inner')
              )
                editor?.chain().focus().run();
            }}
          >
            <div style={{ position: 'relative' }}>
              <BlockMenu editor={editor} wrapRef={editorWrapRef} />
            </div>

            <div className="ne-editor-inner ne-fade-in">
              <textarea
                ref={titleRef}
                className="ne-title-input"
                placeholder="Untitled"
                value={title}
                rows={1}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    editor?.chain().focus().run();
                  }
                }}
              />

              <div className="ne-meta-row">
                {currentCollection && (
                  <span className="ne-meta-item has-value">
                    📁 {currentCollection.name}
                  </span>
                )}
                {subject && (
                  <span className="ne-meta-item has-value">
                    <BookOpen size={11} /> {subject}
                  </span>
                )}
                {tags.map((t) => (
                  <span key={t} className="ne-meta-item has-value">
                    <Hash size={10} />
                    {t}
                  </span>
                ))}
                {backlinks.length > 0 && (
                  <span
                    className="ne-meta-item has-value"
                    style={{
                      color: 'var(--link-color)',
                      borderColor: 'var(--link-border)',
                      background: 'var(--link-bg)',
                    }}
                  >
                    <Link2 size={10} /> {backlinks.length} backlink
                    {backlinks.length !== 1 ? 's' : ''}
                  </span>
                )}
                {note?.updated_at && (
                  <span className="ne-meta-item" style={{ marginLeft: 'auto' }}>
                    {new Date(note.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {editor && <EditorContent editor={editor} />}
            </div>

            {aiGenerating && (
              <div className="ne-ai-indicator">
                <Sparkles
                  size={11}
                  style={{ animation: 'ne-pulse 1.5s ease-in-out infinite' }}
                />{' '}
                Writing…
              </div>
            )}
          </div>
        </div>

        {/* ══ META SIDEBAR ══ */}
        {showMeta && (
          <div className="ne-meta-sidebar">
            <div className="ne-meta-section">
              <div className="ne-meta-label">
                <BookOpen size={10} /> Subject
              </div>
              <input
                className="ne-meta-input"
                placeholder="e.g. Mathematics…"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="ne-meta-section">
              <div className="ne-meta-label">
                <Folder size={10} /> Folder
              </div>
              {/* ✅ Uses flatCollections with depth indentation for nested display */}
              <select
                className="ne-meta-select"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
              >
                <option value="">— None —</option>
                {flatCollections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'  '.repeat(c.depth)}
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ne-meta-section">
              <div className="ne-meta-label">
                <Hash size={10} /> Tags
              </div>
              <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
            </div>
            <div
              className="ne-meta-section"
              style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}
            >
              <div className="ne-meta-label">Document Stats</div>
              {[
                { label: 'Words', val: wordCount },
                { label: 'Characters', val: charCount },
                { label: 'Links', val: parsedLinks.length },
                {
                  label: 'Created',
                  val: note?.created_at
                    ? new Date(note.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—',
                },
                {
                  label: 'Updated',
                  val: note?.updated_at
                    ? new Date(note.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—',
                },
              ].map(({ label, val }) => (
                <div key={label} className="ne-meta-stat">
                  <span className="ne-meta-stat-label">{label}</span>
                  <span className="ne-meta-stat-val">{val}</span>
                </div>
              ))}
            </div>
            <BacklinksPanel
              backlinks={backlinks}
              outgoingLinks={outgoingLinks}
              onNavigate={(noteId) => navigate(`/notes/${noteId}`)}
            />
            <div className="ne-meta-section" style={{ marginTop: 8 }}>
              <button
                className="ne-btn ne-btn-danger"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleDelete}
              >
                <Trash2 size={11} /> Delete Note
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ BUBBLE MENU ══ */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 150, placement: 'top' }}
        >
          <div className="ne-bubble-menu">
            <button
              className={`ne-bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              type="button"
              title="Bold"
            >
              <Bold size={12} />
            </button>
            <button
              className={`ne-bubble-btn ${editor.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              type="button"
              title="Italic"
            >
              <Italic size={12} />
            </button>
            <button
              className={`ne-bubble-btn ${editor.isActive('strike') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              type="button"
              title="Strikethrough"
            >
              <Strikethrough size={12} />
            </button>
            <button
              className={`ne-bubble-btn ${editor.isActive('code') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleCode().run()}
              type="button"
              title="Code"
            >
              <Code2 size={12} />
            </button>
            <div className="ne-bubble-divider" />
            <button
              className={`ne-bubble-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              type="button"
              title="H1"
            >
              <Heading1 size={12} />
            </button>
            <button
              className={`ne-bubble-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              type="button"
              title="H2"
            >
              <Heading2 size={12} />
            </button>
            <div className="ne-bubble-divider" />
            <button
              className={`ne-bubble-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              type="button"
              title="Quote"
            >
              <Quote size={12} />
            </button>
          </div>
        </BubbleMenu>
      )}

      {/* ══ SLASH MENU ══ */}
      {slashMenu && (
        <SlashMenu
          position={slashMenu}
          query={slashMenu.query}
          onSelect={handleSlashSelect}
          onClose={() => {
            setSlashMenu(null);
            slashStartPos.current = null;
            slashQueryRef.current = '';
          }}
        />
      )}

      {/* ══ WIKILINK MENU ══ */}
      {wikiMenu && (
        <WikiLinkMenu
          query={wikiMenu.query}
          allNotes={allNotes.filter((n) => n.id !== id)}
          position={wikiMenu}
          onSelect={handleWikiLinkSelect}
          onClose={() => {
            isWikiLinking.current = false;
            wikiStartPos.current = null;
            wikiQueryRef.current = '';
            setWikiMenu(null);
          }}
        />
      )}
      <CommandPalette allNotes={allNotes} collections={collections} />
    </div>
  );
}
