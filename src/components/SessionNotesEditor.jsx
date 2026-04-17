/**
 * SessionNotesEditor.jsx — Enhanced WYSIWYG Notes Component
 *
 * Improvements over v1:
 *  - Dark mode fully fixed (CSS vars respond to .dark on <html>)
 *  - Smart paste: handles markdown from Claude/ChatGPT (tables, code blocks,
 *    nested lists, strikethrough, task lists, inline code, etc.)
 *  - Syntax highlighting in code blocks (highlight.js via CDN, loaded lazily)
 *  - Table support: insert, navigate with Tab, basic editing
 *  - Export as .md file
 *  - Find & Replace panel (Ctrl+H)
 *  - Word count + reading time
 *  - Improved slash commands (includes table)
 *  - Floating toolbar improved (link edit, clear formatting)
 *  - Better keyboard nav (Tab in tables, Shift+Enter soft break)
 *
 * Props:
 *   value       {string}   — HTML string (initial content)
 *   onChange    {fn}       — called with HTML string on every edit
 *   saveState   {string}   — 'idle' | 'saving' | 'saved'
 *   placeholder {string}   — optional custom placeholder
 *   minHeight   {number}   — optional min height in px (default 200)
 *   title       {string}   — optional note title (shown in export)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Code,
  Quote,
  List,
  ListOrdered,
  Link2,
  Strikethrough,
  AlignLeft,
  Save,
  Type,
  Table,
  Download,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Minus,
  CheckSquare,
  Eraser,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   HTML → MARKDOWN
───────────────────────────────────────────────────────────── */
export function htmlToMarkdown(html) {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;

  const convert = (node, listDepth = 0) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes)
      .map((c) => convert(c, listDepth))
      .join('');

    switch (tag) {
      case 'h1':
        return `# ${inner}\n\n`;
      case 'h2':
        return `## ${inner}\n\n`;
      case 'h3':
        return `### ${inner}\n\n`;
      case 'h4':
        return `#### ${inner}\n\n`;
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
        return node.parentElement?.tagName?.toLowerCase() === 'pre'
          ? inner
          : `\`${inner}\``;
      case 'pre': {
        const codeEl = node.querySelector('code');
        const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
        const codeText = codeEl
          ? codeEl.innerText || codeEl.textContent
          : inner;
        return `\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`;
      }
      case 'blockquote':
        return `> ${inner.replace(/\n/g, '\n> ')}\n\n`;
      case 'li': {
        const indent = '  '.repeat(listDepth);
        const checkbox =
          node.dataset.checked !== undefined
            ? node.dataset.checked === 'true'
              ? '[x] '
              : '[ ] '
            : '';
        return `${indent}- ${checkbox}${inner}\n`;
      }
      case 'ul':
      case 'ol':
        return `\n${inner}\n`;
      case 'a':
        return `[${inner}](${node.getAttribute('href') || ''})`;
      case 'br':
        return '\n';
      case 'hr':
        return `---\n\n`;
      case 'table': {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (!rows.length) return inner;
        const tableRows = rows.map((row) => {
          const cells = Array.from(row.querySelectorAll('th,td'));
          return (
            '| ' +
            cells.map((c) => c.innerText.replace(/\n/g, ' ')).join(' | ') +
            ' |'
          );
        });
        const header = tableRows[0];
        const separator =
          '| ' +
          header
            .split('|')
            .filter(Boolean)
            .map(() => '---')
            .join(' | ') +
          ' |';
        return [header, separator, ...tableRows.slice(1)].join('\n') + '\n\n';
      }
      case 'p':
      case 'div':
        return `${inner}\n`;
      default:
        return inner;
    }
  };

  return convert(d)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─────────────────────────────────────────────────────────────
   MARKDOWN → HTML (for paste from Claude/ChatGPT)
───────────────────────────────────────────────────────────── */
function markdownToHTML(md) {
  let html = md;

  // Escape HTML entities first (avoid XSS on literal <> in md)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (fenced) — must come before inline code
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre data-lang="${lang}"><code${langClass}>${code.trimEnd()}</code></pre>`;
  });

  // Tables
  html = html.replace(
    /(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)*)/g,
    (tableBlock) => {
      const rows = tableBlock.trim().split('\n');
      const headers = rows[0]
        .split('|')
        .filter(Boolean)
        .map((h) => `<th>${h.trim()}</th>`)
        .join('');
      const bodyRows = rows
        .slice(2)
        .map((row) => {
          const cells = row
            .split('|')
            .filter(Boolean)
            .map((c) => `<td>${c.trim()}</td>`)
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `<table><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    },
  );

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Task lists (before regular lists)
  html = html.replace(
    /^- \[x\] (.+)$/gim,
    '<li data-checked="true"><input type="checkbox" checked disabled> $1</li>',
  );
  html = html.replace(
    /^- \[ \] (.+)$/gim,
    '<li data-checked="false"><input type="checkbox" disabled> $1</li>',
  );

  // Unordered lists
  html = html.replace(/^[-*+] (.+)$/gm, '<li>$1</li>');
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Bold + Italic together
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(
    /(<li[^>]*>[\s\S]*?<\/li>\n?)+/g,
    (match) => `<ul>${match}</ul>`,
  );

  // Paragraphs — wrap lines not already in block elements
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|li|pre|table|blockquote|hr)/.test(trimmed))
        return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}

/* ─────────────────────────────────────────────────────────────
   PASTE CLEANER (for HTML pastes)
───────────────────────────────────────────────────────────── */
function cleanPastedHTML(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
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
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'span',
  ];
  const KEEP_ATTRS = {
    a: ['href'],
    code: ['class'],
    pre: ['data-lang'],
    td: [],
    th: [],
    li: ['data-checked'],
  };

  const clean = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = node.tagName.toLowerCase();
    if (!KEEP.includes(tag)) {
      const frag = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((c) => {
        const r = clean(c);
        if (r) frag.appendChild(r);
      });
      return frag;
    }
    const el = document.createElement(tag);
    const allowedAttrs = KEEP_ATTRS[tag] || [];
    allowedAttrs.forEach((attr) => {
      const val = node.getAttribute(attr);
      if (val) el.setAttribute(attr, val);
    });
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
   HIGHLIGHT.JS LAZY LOADER
───────────────────────────────────────────────────────────── */
let hljs = null;
let hljsLoading = false;
const hljsCallbacks = [];

function loadHljs(cb) {
  if (hljs) {
    cb(hljs);
    return;
  }
  hljsCallbacks.push(cb);
  if (hljsLoading) return;
  hljsLoading = true;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
  link.id = 'hljs-style';
  if (!document.getElementById('hljs-style')) document.head.appendChild(link);

  const script = document.createElement('script');
  script.src =
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
  script.onload = () => {
    hljs = window.hljs;
    hljsCallbacks.forEach((fn) => fn(hljs));
    hljsCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

function highlightBlocks(container) {
  const blocks = container.querySelectorAll('pre code');
  if (!blocks.length) return;
  loadHljs((h) =>
    blocks.forEach((b) => {
      if (!b.dataset.highlighted) {
        h.highlightElement(b);
        b.dataset.highlighted = 'yes';
      }
    }),
  );
}

/* ─────────────────────────────────────────────────────────────
   SLASH COMMANDS
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
    id: 'table',
    icon: '⊞',
    name: 'Table',
    desc: 'Insert 3×3 table',
    cmd: null,
    special: 'table',
  },
  {
    id: 'hr',
    icon: '—',
    name: 'Divider',
    desc: 'Horizontal rule',
    cmd: () => document.execCommand('insertHorizontalRule'),
  },
  {
    id: 'todo',
    icon: '☑',
    name: 'To-do List',
    desc: 'Checkbox task list',
    cmd: null,
    special: 'todo',
  },
];

/* ─────────────────────────────────────────────────────────────
   SCOPED CSS
───────────────────────────────────────────────────────────── */
const NOTES_CSS = `
/* ══ SessionNotesEditor v2 ══ */

/* Light theme defaults */
:root {
  --sne-surface: #fff;
  --sne-surface-2: #f5f0e8;
  --sne-border: #e2d8c8;
  --sne-accent: #c4913a;
  --sne-accent-dim: rgba(196,145,58,.1);
  --sne-accent-border: rgba(196,145,58,.35);
  --sne-text-primary: #1e1a14;
  --sne-text-secondary: #5c5445;
  --sne-text-muted: #9c9283;
  --sne-success: #6b8c6b;
  --sne-blue: #5b8fa8;
  --sne-code-bg: #f5f0e8;
  --sne-scrollbar: rgba(196,145,58,.15);
  --sne-selection: rgba(196,145,58,.2);
  --sne-head-bg: color-mix(in srgb, #c4913a 3%, #fff);
  --sne-float-bg: #1e1a14;
  --sne-float-text: rgba(240,234,216,.6);
}

/* Dark theme overrides — triggered by .dark on <html> */
.dark {
  --sne-surface: #1a1714;
  --sne-surface-2: #252118;
  --sne-border: #2e2a22;
  --sne-accent: #d4a44a;
  --sne-accent-dim: rgba(212,164,74,.12);
  --sne-accent-border: rgba(212,164,74,.3);
  --sne-text-primary: #f0ead8;
  --sne-text-secondary: #b8a88a;
  --sne-text-muted: #6b6050;
  --sne-success: #7aaa7a;
  --sne-blue: #7ab5d0;
  --sne-code-bg: #0f0d0a;
  --sne-scrollbar: rgba(212,164,74,.2);
  --sne-selection: rgba(212,164,74,.25);
  --sne-head-bg: color-mix(in srgb, #d4a44a 4%, #1a1714);
  --sne-float-bg: #f0ead8;
  --sne-float-text: rgba(30,26,20,.7);
}

.sne-card {
  background: var(--sne-surface);
  border: 1px solid var(--sne-border);
  border-radius: 10px;
  overflow: visible;
  margin-bottom: 16px;
  transition: border-color .3s, box-shadow .3s;
  position: relative;
}
.sne-card:focus-within {
  border-color: var(--sne-accent-border);
  box-shadow: 0 0 0 3px var(--sne-accent-dim), 0 4px 24px rgba(30,26,20,.08);
}

/* ── Head ── */
.sne-head {
  padding: 8px 12px;
  border-bottom: 1px solid var(--sne-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--sne-head-bg);
  flex-wrap: wrap;
}
.sne-label {
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .56rem;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--sne-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.sne-save-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .52rem;
  letter-spacing: .08em;
  color: var(--sne-success);
  opacity: 0;
  transition: opacity .4s;
}
.sne-save-pill.vis { opacity: 1; }
.sne-save-pill.saving { color: var(--sne-accent); }

/* ── Toolbar ── */
.sne-toolbar {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-wrap: wrap;
}
.sne-toolbar-sep {
  width: 1px;
  height: 14px;
  background: var(--sne-border);
  margin: 0 4px;
  flex-shrink: 0;
}
.sne-tb-btn {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  color: var(--sne-text-muted);
  cursor: pointer;
  transition: all .15s;
  flex-shrink: 0;
  position: relative;
}
.sne-tb-btn:hover {
  background: var(--sne-surface-2);
  color: var(--sne-accent);
}
.sne-tb-btn.active {
  background: var(--sne-accent-dim);
  color: var(--sne-accent);
}
.sne-tb-tooltip {
  position: absolute;
  bottom: calc(100% + 5px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--sne-text-primary);
  color: var(--sne-surface);
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .48rem;
  letter-spacing: .06em;
  padding: 3px 7px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity .15s;
  z-index: 100;
}
.sne-tb-btn:hover .sne-tb-tooltip { opacity: 1; }
.sne-tb-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 3px solid transparent;
  border-top-color: var(--sne-text-primary);
}

/* ── Floating selection toolbar ── */
.sne-float-toolbar {
  position: fixed;
  z-index: 9999;
  background: var(--sne-float-bg);
  border-radius: 9px;
  padding: 4px 5px;
  display: flex;
  align-items: center;
  gap: 2px;
  box-shadow: 0 8px 32px rgba(0,0,0,.3), 0 0 0 1px rgba(196,145,58,.15);
  animation: sne-in .15s ease both;
  transform-origin: bottom center;
}
@keyframes sne-in {
  from { opacity: 0; transform: translateY(5px) scale(.95); }
  to   { opacity: 1; transform: none; }
}
.sne-float-btn {
  width: 28px;
  height: 26px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  color: var(--sne-float-text);
  cursor: pointer;
  transition: all .15s;
}
.sne-float-btn:hover {
  background: rgba(128,128,128,.15);
  color: var(--sne-accent);
}
.sne-float-sep {
  width: 1px;
  height: 13px;
  background: rgba(128,128,128,.25);
  margin: 0 2px;
}

/* ── Slash menu ── */
.sne-slash-menu {
  position: fixed;
  z-index: 9999;
  background: var(--sne-surface);
  border: 1px solid var(--sne-border);
  border-radius: 11px;
  padding: 5px;
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 12px 48px rgba(30,26,20,.14);
  animation: sne-in .15s ease both;
}
.sne-slash-header {
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .5rem;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--sne-text-muted);
  padding: 3px 7px 7px;
  border-bottom: 1px solid var(--sne-border);
  margin-bottom: 3px;
}
.sne-slash-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: 7px;
  cursor: pointer;
  transition: all .15s;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
}
.sne-slash-item:hover, .sne-slash-item.hi {
  background: var(--sne-accent-dim);
}
.sne-slash-item:hover .sne-slash-name, .sne-slash-item.hi .sne-slash-name {
  color: var(--sne-accent);
}
.sne-slash-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--sne-surface-2);
  border: 1px solid var(--sne-border);
  display: grid;
  place-items: center;
  color: var(--sne-text-muted);
  flex-shrink: 0;
  font-size: .72rem;
}
.sne-slash-item:hover .sne-slash-icon, .sne-slash-item.hi .sne-slash-icon {
  background: var(--sne-accent-dim);
  border-color: var(--sne-accent);
  color: var(--sne-accent);
}
.sne-slash-name {
  font-size: .78rem;
  font-weight: 600;
  color: var(--sne-text-primary);
  transition: color .15s;
}
.sne-slash-desc {
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .5rem;
  letter-spacing: .04em;
  color: var(--sne-text-muted);
}

/* ── Editor area ── */
.sne-editor-wrap {
  position: relative;
  padding: 18px 20px 14px;
}
.sne-editor {
  outline: none;
  font-family: var(--f-body,'Cabinet Grotesk',sans-serif);
  font-size: .875rem;
  line-height: 1.8;
  color: var(--sne-text-primary);
  caret-color: var(--sne-accent);
  word-wrap: break-word;
  overflow-y: auto;
  transition: min-height .3s ease;
}
.sne-editor::selection, .sne-editor *::selection {
  background: var(--sne-selection);
}
.sne-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--sne-text-muted);
  font-style: italic;
  pointer-events: none;
}

/* Typography */
.sne-editor h1 {
  font-family: var(--f-serif,'Playfair Display',serif);
  font-size: 1.8rem; font-weight: 400; line-height: 1.2;
  color: var(--sne-text-primary);
  margin: 16px 0 8px;
  border-bottom: 1px solid var(--sne-border);
  padding-bottom: 7px;
}
.sne-editor h2 {
  font-family: var(--f-serif,'Playfair Display',serif);
  font-size: 1.35rem; font-weight: 500;
  color: var(--sne-text-primary); margin: 14px 0 6px;
}
.sne-editor h3 {
  font-family: var(--f-serif,'Playfair Display',serif);
  font-size: 1.1rem; font-weight: 600;
  color: var(--sne-text-primary); margin: 11px 0 5px;
}
.sne-editor h4 {
  font-size: 1rem; font-weight: 700;
  color: var(--sne-text-secondary); margin: 10px 0 4px;
}
.sne-editor p { margin: 0 0 7px; }
.sne-editor p:last-child { margin-bottom: 0; }
.sne-editor strong { font-weight: 700; color: var(--sne-text-primary); }
.sne-editor em { font-style: italic; color: var(--sne-text-secondary); }
.sne-editor u {
  text-decoration: underline;
  text-decoration-color: var(--sne-accent);
  text-underline-offset: 3px;
}
.sne-editor s { text-decoration: line-through; color: var(--sne-text-muted); }
.sne-editor code {
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .8rem;
  background: var(--sne-code-bg);
  border: 1px solid var(--sne-border);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--sne-accent);
}
.sne-editor pre {
  background: var(--sne-code-bg);
  border: 1px solid var(--sne-border);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 10px 0;
  overflow-x: auto;
  position: relative;
}
.sne-editor pre::before {
  content: attr(data-lang);
  position: absolute;
  top: 6px; right: 10px;
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .48rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--sne-text-muted);
  opacity: .6;
}
.sne-editor pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: .8rem;
  color: var(--sne-text-primary);
  line-height: 1.7;
}
/* Override hljs background inside editor */
.sne-editor .hljs { background: transparent !important; }

.sne-editor blockquote {
  border-left: 3px solid var(--sne-accent);
  padding: 7px 0 7px 14px;
  margin: 10px 0;
  background: var(--sne-accent-dim);
  border-radius: 0 7px 7px 0;
  color: var(--sne-text-secondary);
  font-style: italic;
}
.sne-editor ul, .sne-editor ol { padding-left: 20px; margin: 7px 0; }
.sne-editor li { margin: 2px 0; line-height: 1.7; }
.sne-editor ul li { list-style: none; position: relative; padding-left: 3px; }
.sne-editor ul li::before {
  content: '◦';
  position: absolute;
  left: -15px;
  color: var(--sne-accent);
  font-size: .9rem;
}
/* Task list items — hide bullet */
.sne-editor ul li[data-checked]::before { content: ''; }
.sne-editor ul li[data-checked] input[type="checkbox"] {
  accent-color: var(--sne-accent);
  margin-right: 6px;
  cursor: pointer;
}
.sne-editor ol { list-style: decimal; }
.sne-editor ol li::marker {
  color: var(--sne-accent);
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .78rem;
}
.sne-editor a { color: var(--sne-blue); text-decoration: underline; text-underline-offset: 3px; }
.sne-editor hr { border: none; border-top: 1px solid var(--sne-border); margin: 16px 0; }

/* Tables */
.sne-editor table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: .84rem;
}
.sne-editor th, .sne-editor td {
  border: 1px solid var(--sne-border);
  padding: 7px 12px;
  text-align: left;
  color: var(--sne-text-primary);
}
.sne-editor th {
  background: var(--sne-surface-2);
  font-weight: 600;
  color: var(--sne-text-primary);
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .72rem;
  letter-spacing: .05em;
  text-transform: uppercase;
}
.sne-editor tr:hover td { background: var(--sne-accent-dim); }

/* ── Footer ── */
.sne-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 20px 10px;
  border-top: 1px solid var(--sne-border);
  gap: 8px;
  flex-wrap: wrap;
}
.sne-word-count {
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .49rem;
  letter-spacing: .08em;
  color: var(--sne-text-muted);
}
.sne-footer-actions { display: flex; align-items: center; gap: 4px; }
.sne-icon-btn {
  width: 22px; height: 22px;
  border-radius: 5px;
  background: transparent;
  border: 1px solid var(--sne-border);
  color: var(--sne-text-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all .15s;
}
.sne-icon-btn:hover {
  border-color: var(--sne-accent);
  color: var(--sne-accent);
}
.sne-slash-hint {
  position: absolute;
  bottom: 12px; right: 20px;
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .46rem;
  letter-spacing: .1em;
  color: var(--sne-text-muted);
  opacity: .45;
  pointer-events: none;
}

/* ── Find & Replace panel ── */
.sne-find-panel {
  border-top: 1px solid var(--sne-border);
  background: var(--sne-surface-2);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  animation: sne-in .15s ease both;
}
.sne-find-input {
  flex: 1;
  min-width: 120px;
  background: var(--sne-surface);
  border: 1px solid var(--sne-border);
  border-radius: 6px;
  padding: 5px 10px;
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .72rem;
  color: var(--sne-text-primary);
  outline: none;
  transition: border-color .15s;
}
.sne-find-input:focus { border-color: var(--sne-accent); }
.sne-find-input::placeholder { color: var(--sne-text-muted); }
.sne-find-count {
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .55rem;
  color: var(--sne-text-muted);
  white-space: nowrap;
}
.sne-find-btn {
  height: 26px;
  padding: 0 10px;
  border-radius: 5px;
  background: var(--sne-accent-dim);
  border: 1px solid var(--sne-accent-border);
  color: var(--sne-accent);
  font-family: var(--f-mono,'JetBrains Mono',monospace);
  font-size: .58rem;
  letter-spacing: .06em;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}
.sne-find-btn:hover { background: var(--sne-accent); color: #fff; }
.sne-find-sep { width: 1px; height: 18px; background: var(--sne-border); }

/* Scrollbar */
.sne-editor::-webkit-scrollbar { width: 4px; }
.sne-editor::-webkit-scrollbar-track { background: transparent; }
.sne-editor::-webkit-scrollbar-thumb {
  background: var(--sne-scrollbar);
  border-radius: 2px;
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.id = 'sne-v2-css';
  el.textContent = NOTES_CSS;
  document.head.appendChild(el);
  cssInjected = true;
}

/* ─────────────────────────────────────────────────────────────
   TABLE HELPERS
───────────────────────────────────────────────────────────── */
function insertTable(rows = 3, cols = 3) {
  const makeCell = (isHeader) => {
    const cell = document.createElement(isHeader ? 'th' : 'td');
    cell.appendChild(document.createElement('br'));
    return cell;
  };
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const headerRow = document.createElement('tr');
  for (let c = 0; c < cols; c++) headerRow.appendChild(makeCell(true));
  thead.appendChild(headerRow);
  for (let r = 0; r < rows - 1; r++) {
    const row = document.createElement('tr');
    for (let c = 0; c < cols; c++) row.appendChild(makeCell(false));
    tbody.appendChild(row);
  }
  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

function insertTodoItem() {
  const li = document.createElement('li');
  li.dataset.checked = 'false';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.disabled = true;
  li.appendChild(cb);
  li.appendChild(document.createTextNode(' '));
  const ul = document.createElement('ul');
  ul.appendChild(li);
  return ul;
}

/* ─────────────────────────────────────────────────────────────
   EXPORT HELPER
───────────────────────────────────────────────────────────── */
function exportMarkdown(html, title = 'notes') {
  const md = htmlToMarkdown(html);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function SessionNotesEditor({
  value = '',
  onChange,
  saveState = 'idle',
  placeholder = 'Write your thoughts, key takeaways, questions… (type / for commands)',
  minHeight = 200,
  title = 'notes',
}) {
  injectCSS();

  const editorRef = useRef(null);
  const floatTimer = useRef(null);
  const isComposing = useRef(false);
  const savedRange = useRef(null);
  const findInputRef = useRef(null);

  const [floatToolbar, setFloatToolbar] = useState(null);
  const [slashMenu, setSlashMenu] = useState(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIdx, setSlashIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findMatches, setFindMatches] = useState({ total: 0, current: 0 });

  /* init */
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = value;
      updateWordCount();
      highlightBlocks(editorRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* find panel focus */
  useEffect(() => {
    if (showFind) findInputRef.current?.focus();
  }, [showFind]);

  /* ── selection helpers ── */
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

  /* ── execCommand wrapper ── */
  const exec = useCallback(
    (cmd, val = null) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(cmd, false, val);
      setTimeout(() => {
        onChange?.(editorRef.current?.innerHTML || '');
        updateWordCount();
      }, 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [onChange],
  );

  const formatBlock = useCallback(
    (tag) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand('formatBlock', false, tag);
      setTimeout(() => {
        onChange?.(editorRef.current?.innerHTML || '');
        setSlashMenu(null);
      }, 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [onChange],
  );

  const insertList = useCallback(
    (ordered) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(
        ordered ? 'insertOrderedList' : 'insertUnorderedList',
      );
      setTimeout(() => onChange?.(editorRef.current?.innerHTML || ''), 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [onChange],
  );

  const updateWordCount = () => {
    const txt = editorRef.current?.innerText || '';
    setWordCount(txt.trim().split(/\s+/).filter(Boolean).length);
  };

  /* ── input ── */
  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    const html = editorRef.current?.innerHTML || '';
    onChange?.(html);
    updateWordCount();
    checkSlash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange]);

  /* ── slash detection ── */
  const checkSlash = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const before =
      range.startContainer.textContent?.slice(0, range.startOffset) || '';
    const match = before.match(/\/(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      const rect = range.getBoundingClientRect();
      setSlashQuery(query);
      setSlashMenu({
        x: rect.left,
        y: rect.bottom + 6,
        range: range.cloneRange(),
        queryLen: match[0].length,
      });
      setSlashIdx(0);
    } else {
      setSlashMenu(null);
      setSlashQuery('');
    }
  };

  const filteredSlash = SLASH_COMMANDS.filter(
    (c) =>
      !slashQuery ||
      c.name.toLowerCase().includes(slashQuery) ||
      c.id.includes(slashQuery),
  );

  const execSlash = useCallback(
    (cmd) => {
      if (slashMenu?.range) {
        const sel = window.getSelection();
        const r = slashMenu.range.cloneRange();
        r.setStart(r.startContainer, r.startOffset - (slashMenu.queryLen || 1));
        sel.removeAllRanges();
        sel.addRange(r);
        document.execCommand('delete');
      }

      if (cmd.special === 'table') {
        const tbl = insertTable(3, 3);
        document.execCommand('insertHTML', false, tbl.outerHTML);
      } else if (cmd.special === 'todo') {
        const ul = insertTodoItem();
        document.execCommand('insertHTML', false, ul.outerHTML);
      } else if (cmd.cmd) {
        cmd.cmd();
      }

      setSlashMenu(null);
      setSlashQuery('');
      setTimeout(() => {
        onChange?.(editorRef.current?.innerHTML || '');
        highlightBlocks(editorRef.current);
      }, 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [slashMenu, onChange],
  );

  /* ── floating toolbar ── */
  const handleSelectionChange = useCallback(() => {
    clearTimeout(floatTimer.current);
    floatTimer.current = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setFloatToolbar(null);
        return;
      }
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

  /* ── keyboard ── */
  const handleKeyDown = useCallback(
    (e) => {
      // slash menu nav
      if (slashMenu) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashIdx((i) => Math.min(i + 1, filteredSlash.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredSlash[slashIdx]) execSlash(filteredSlash[slashIdx]);
          return;
        }
        if (e.key === 'Escape') {
          setSlashMenu(null);
          return;
        }
      }

      // Tab in tables
      if (e.key === 'Tab') {
        const sel = window.getSelection();
        const cell = sel?.anchorNode?.parentElement?.closest('td,th');
        if (cell) {
          e.preventDefault();
          const cells = Array.from(editorRef.current.querySelectorAll('td,th'));
          const idx = cells.indexOf(cell);
          const next = cells[idx + (e.shiftKey ? -1 : 1)];
          if (next) {
            const r = document.createRange();
            r.selectNodeContents(next);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
          return;
        }
      }

      // Find & replace toggle
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowFind((v) => !v);
        return;
      }
      if (e.key === 'Escape' && showFind) {
        setShowFind(false);
        return;
      }

      // Format shortcuts
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
      if (mod && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 's':
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [slashMenu, slashIdx, filteredSlash, execSlash, exec, insertList, showFind],
  );

  /* ── SMART PASTE ── */
  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');

      let finalHTML = '';
      if (html && html.trim()) {
        // Check if it looks like it's from Claude/ChatGPT (they use markdown-like HTML)
        // Clean and preserve it
        finalHTML = cleanPastedHTML(html);
      } else if (text) {
        // Plain text — run through markdown parser
        finalHTML = markdownToHTML(text);
      }

      if (finalHTML) {
        document.execCommand('insertHTML', false, finalHTML);
        setTimeout(() => {
          onChange?.(editorRef.current?.innerHTML || '');
          updateWordCount();
          highlightBlocks(editorRef.current);
        }, 0);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [onChange],
  );

  /* ── Find & Replace ── */
  const doFind = useCallback(() => {
    if (!findText || !editorRef.current) return;
    const text = editorRef.current.innerHTML;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [...text.matchAll(new RegExp(escaped, 'gi'))];
    setFindMatches({
      total: matches.length,
      current: matches.length > 0 ? 1 : 0,
    });
  }, [findText]);

  const doReplace = useCallback(() => {
    if (!findText || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newHtml = html.replace(new RegExp(escaped, 'gi'), replaceText);
    editorRef.current.innerHTML = newHtml;
    onChange?.(newHtml);
    updateWordCount();
    setFindMatches({ total: 0, current: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findText, replaceText, onChange]);

  const isActive = (cmd) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };

  /* ── Toolbar groups ── */
  const toolbarGroups = [
    [
      { cmd: 'bold', icon: <Bold size={12} />, tip: 'Bold (⌘B)' },
      { cmd: 'italic', icon: <Italic size={12} />, tip: 'Italic (⌘I)' },
      {
        cmd: 'underline',
        icon: <Underline size={12} />,
        tip: 'Underline (⌘U)',
      },
      {
        cmd: 'strikeThrough',
        icon: <Strikethrough size={12} />,
        tip: 'Strikethrough',
      },
    ],
    [
      {
        block: 'H1',
        icon: <span style={{ fontWeight: 700, fontSize: '.68rem' }}>H1</span>,
        tip: 'Heading 1',
      },
      {
        block: 'H2',
        icon: <span style={{ fontWeight: 700, fontSize: '.68rem' }}>H2</span>,
        tip: 'Heading 2',
      },
      {
        block: 'H3',
        icon: <span style={{ fontWeight: 700, fontSize: '.68rem' }}>H3</span>,
        tip: 'Heading 3',
      },
      { block: 'P', icon: <Type size={12} />, tip: 'Paragraph' },
    ],
    [
      {
        action: () => insertList(false),
        icon: <List size={12} />,
        tip: 'Bullet list',
      },
      {
        action: () => insertList(true),
        icon: <ListOrdered size={12} />,
        tip: 'Numbered list',
      },
      { block: 'BLOCKQUOTE', icon: <Quote size={12} />, tip: 'Blockquote' },
      { block: 'PRE', icon: <Code size={12} />, tip: 'Code block' },
    ],
    [
      {
        action: () => {
          const tbl = insertTable(3, 3);
          editorRef.current?.focus();
          document.execCommand('insertHTML', false, tbl.outerHTML);
          setTimeout(() => onChange?.(editorRef.current?.innerHTML || ''), 0);
        },
        icon: <Table size={12} />,
        tip: 'Insert table',
      },
      {
        action: () => {
          const u = window.prompt('URL:');
          if (u) exec('createLink', u);
        },
        icon: <Link2 size={12} />,
        tip: 'Insert link (⌘K)',
      },
      {
        action: () => {
          editorRef.current?.focus();
          restoreSelection();
          document.execCommand('removeFormat');
          setTimeout(() => onChange?.(editorRef.current?.innerHTML || ''), 0);
        },
        icon: <Eraser size={12} />,
        tip: 'Clear formatting',
      },
    ],
  ];

  const editorStyle = {
    minHeight: expanded ? Math.max(minHeight, 360) : minHeight,
    maxHeight: expanded ? 600 : 400,
  };
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="sne-card">
      {/* ── Header ── */}
      <div className="sne-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="sne-label">
            <AlignLeft size={11} /> Notes
          </span>
          <span
            className={`sne-save-pill ${saveState !== 'idle' ? 'vis' : ''} ${saveState === 'saving' ? 'saving' : ''}`}
          >
            <Save size={9} /> {saveState === 'saving' ? 'Saving…' : 'Saved'}
          </span>
        </div>

        {/* Toolbar */}
        <div className="sne-toolbar">
          {toolbarGroups.map((group, gi) => (
            <div
              key={gi}
              style={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              {gi > 0 && <div className="sne-toolbar-sep" />}
              {group.map((item, ii) => (
                <button
                  key={ii}
                  className={`sne-tb-btn ${item.cmd && isActive(item.cmd) ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    saveSelection();
                    if (item.cmd) exec(item.cmd);
                    else if (item.block) formatBlock(item.block);
                    else if (item.action) item.action();
                  }}
                >
                  {item.icon}
                  <span className="sne-tb-tooltip">{item.tip}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Editor ── */}
      <div className="sne-editor-wrap">
        <div
          ref={editorRef}
          className="sne-editor"
          style={editorStyle}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
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
        <div className="sne-slash-hint">type / for commands</div>
      </div>

      {/* ── Find & Replace ── */}
      {showFind && (
        <div className="sne-find-panel">
          <Search
            size={13}
            style={{ color: 'var(--sne-text-muted)', flexShrink: 0 }}
          />
          <input
            ref={findInputRef}
            className="sne-find-input"
            placeholder="Find…"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doFind();
              if (e.key === 'Escape') setShowFind(false);
            }}
          />
          <div className="sne-find-sep" />
          <input
            className="sne-find-input"
            placeholder="Replace…"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doReplace();
            }}
          />
          <button className="sne-find-btn" onClick={doFind}>
            Find
          </button>
          <button className="sne-find-btn" onClick={doReplace}>
            Replace all
          </button>
          {findMatches.total > 0 && (
            <span className="sne-find-count">
              {findMatches.total} match{findMatches.total !== 1 ? 'es' : ''}
            </span>
          )}
          <button
            className="sne-icon-btn"
            onClick={() => setShowFind(false)}
            title="Close"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="sne-footer">
        <span className="sne-word-count">
          {wordCount} {wordCount === 1 ? 'word' : 'words'} · {readingTime} min
          read
        </span>
        <div className="sne-footer-actions">
          <button
            className="sne-icon-btn"
            title="Find & Replace (⌘H)"
            onClick={() => setShowFind((v) => !v)}
          >
            <Search size={11} />
          </button>
          <button
            className="sne-icon-btn"
            title="Export as Markdown"
            onClick={() =>
              exportMarkdown(editorRef.current?.innerHTML || '', title)
            }
          >
            <Download size={11} />
          </button>
          <button
            className="sne-icon-btn"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* ── Floating selection toolbar ── */}
      {floatToolbar && (
        <div
          className="sne-float-toolbar"
          style={{
            left: floatToolbar.x,
            top: floatToolbar.y - 46,
            transform: 'translateX(-50%)',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {[
            { cmd: 'bold', icon: <Bold size={12} /> },
            { cmd: 'italic', icon: <Italic size={12} /> },
            { cmd: 'underline', icon: <Underline size={12} /> },
            { cmd: 'strikeThrough', icon: <Strikethrough size={12} /> },
            { sep: true },
            {
              block: 'H1',
              icon: (
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '.58rem',
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
                    fontFamily: 'monospace',
                    fontSize: '.58rem',
                    fontWeight: 700,
                  }}
                >
                  H2
                </span>
              ),
            },
            { sep: true },
            { action: () => insertList(false), icon: <List size={12} /> },
            { block: 'BLOCKQUOTE', icon: <Quote size={12} /> },
            { sep: true },
            {
              action: () => {
                restoreSelection();
                document.execCommand('removeFormat');
                setTimeout(
                  () => onChange?.(editorRef.current?.innerHTML || ''),
                  0,
                );
                setFloatToolbar(null);
              },
              icon: <Eraser size={12} />,
            },
          ].map((item, i) =>
            item.sep ? (
              <div key={i} className="sne-float-sep" />
            ) : (
              <button
                key={i}
                className="sne-float-btn"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (item.cmd) {
                    restoreSelection();
                    exec(item.cmd);
                  } else if (item.block) {
                    restoreSelection();
                    formatBlock(item.block);
                  } else if (item.action) item.action();
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
      {slashMenu && filteredSlash.length > 0 && (
        <div
          className="sne-slash-menu"
          style={{
            left: Math.min(slashMenu.x, window.innerWidth - 240),
            top: slashMenu.y,
          }}
        >
          <div className="sne-slash-header">
            Commands {slashQuery && `· "${slashQuery}"`}
          </div>
          {filteredSlash.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`sne-slash-item ${i === slashIdx ? 'hi' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                execSlash(cmd);
              }}
              onMouseEnter={() => setSlashIdx(i)}
            >
              <div className="sne-slash-icon">{cmd.icon}</div>
              <div>
                <div className="sne-slash-name">{cmd.name}</div>
                <div className="sne-slash-desc">{cmd.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
