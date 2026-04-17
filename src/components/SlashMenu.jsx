/**
 * SlashMenu.jsx
 *
 * Full command palette for the slash-command system.
 *
 * Features:
 *  - Grouped categories: Text, Lists, Structure, Media, Advanced
 *  - Live search filtering across all commands
 *  - Smooth keyboard navigation (↑ ↓ Enter Esc)
 *  - Animated entrance (CSS spring)
 *  - Fixed/anchored to cursor position via position prop
 *
 * Props:
 *  position   { top, left }    – pixel coords from ProseMirror coordsAtPos
 *  query      string           – current typed query after "/"
 *  onSelect   (cmd) => void    – called when a command is chosen
 *  onClose    () => void       – called when Esc or outside-click
 */

import { useState, useEffect, useRef, memo } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  Bold,
  Italic,
  Code2,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Minus,
  Table2,
  Image as ImageIcon,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { createPortal } from 'react-dom';

/* ─── Command definitions ─── */
export const COMMANDS = [
  /* ── Text ── */
  {
    id: 'p',
    category: 'Text',
    icon: <Type size={13} />,
    label: 'Paragraph',
    desc: 'Plain text paragraph',
    keywords: ['text', 'plain', 'paragraph', 'p'],
    action: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: 'h1',
    category: 'Text',
    icon: <Heading1 size={13} />,
    label: 'Heading 1',
    desc: 'Large section title',
    keywords: ['h1', 'heading', 'title'],
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    category: 'Text',
    icon: <Heading2 size={13} />,
    label: 'Heading 2',
    desc: 'Medium section heading',
    keywords: ['h2', 'heading', 'subtitle'],
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    category: 'Text',
    icon: <Heading3 size={13} />,
    label: 'Heading 3',
    desc: 'Small section heading',
    keywords: ['h3', 'heading', 'subheading'],
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'quote',
    category: 'Text',
    icon: <Quote size={13} />,
    label: 'Blockquote',
    desc: 'Highlighted pull quote',
    keywords: ['quote', 'blockquote', 'callout'],
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code-inline',
    category: 'Text',
    icon: <Code2 size={13} />,
    label: 'Inline Code',
    desc: 'Inline monospace code span',
    keywords: ['code', 'inline', 'monospace'],
    action: (e) => e.chain().focus().toggleCode().run(),
  },

  /* ── Lists ── */
  {
    id: 'bullet',
    category: 'Lists',
    icon: <List size={13} />,
    label: 'Bullet List',
    desc: 'Unordered list',
    keywords: ['list', 'bullet', 'ul', 'unordered'],
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbered',
    category: 'Lists',
    icon: <ListOrdered size={13} />,
    label: 'Numbered List',
    desc: 'Ordered numbered list',
    keywords: ['list', 'numbered', 'ol', 'ordered'],
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'checklist',
    category: 'Lists',
    icon: <CheckSquare size={13} />,
    label: 'Checklist',
    desc: 'Interactive to-do list',
    keywords: ['task', 'todo', 'check', 'checklist'],
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },

  /* ── Structure ── */
  {
    id: 'divider',
    category: 'Structure',
    icon: <Minus size={13} />,
    label: 'Divider',
    desc: 'Horizontal separator line',
    keywords: ['hr', 'divider', 'separator', 'rule'],
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'code-block',
    category: 'Structure',
    icon: <Code2 size={14} />,
    label: 'Code Block',
    desc: 'Multi-line code snippet',
    keywords: ['code', 'block', 'codeblock', 'pre'],
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'table',
    category: 'Structure',
    icon: <Table2 size={13} />,
    label: 'Table',
    desc: '3×3 grid table',
    keywords: ['table', 'grid', 'spreadsheet'],
    action: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },

  /* ── Callouts ── */
  {
    id: 'callout-info',
    category: 'Callouts',
    icon: <Info size={13} />,
    label: 'Info Callout',
    desc: 'Blue informational note',
    keywords: ['callout', 'info', 'note', 'blue'],
    action: (e) =>
      e.chain().focus().toggleCallout({ type: 'info', icon: 'ℹ️' }).run(),
  },
  {
    id: 'callout-warning',
    category: 'Callouts',
    icon: <AlertTriangle size={13} />,
    label: 'Warning Callout',
    desc: 'Yellow caution block',
    keywords: ['callout', 'warning', 'caution', 'yellow'],
    action: (e) =>
      e.chain().focus().toggleCallout({ type: 'warning', icon: '⚠️' }).run(),
  },
  {
    id: 'callout-success',
    category: 'Callouts',
    icon: <CheckCircle size={13} />,
    label: 'Success Callout',
    desc: 'Green success block',
    keywords: ['callout', 'success', 'tip', 'green'],
    action: (e) =>
      e.chain().focus().toggleCallout({ type: 'success', icon: '✅' }).run(),
  },
  {
    id: 'callout-error',
    category: 'Callouts',
    icon: <AlertCircle size={13} />,
    label: 'Error Callout',
    desc: 'Red critical note',
    keywords: ['callout', 'error', 'danger', 'red'],
    action: (e) =>
      e.chain().focus().toggleCallout({ type: 'error', icon: '🚨' }).run(),
  },

  /* ── AI ── */
  {
    id: 'ai-continue',
    category: 'AI',
    icon: <Sparkles size={13} />,
    label: 'Continue Writing',
    desc: 'Let AI continue from here',
    keywords: ['ai', 'continue', 'write', 'generate', 'gpt'],
    action: () => {}, // handled by parent via cmd.id === 'ai-continue'
  },
];

const CATEGORY_ORDER = ['Text', 'Lists', 'Structure', 'Callouts', 'AI'];

/* ─────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────── */
const SlashMenu = memo(function SlashMenu({
  position,
  query,
  onSelect,
  onClose,
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  /* Filter + group */
  const filtered = query
    ? COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.keywords.some((k) => k.includes(query.toLowerCase())),
      )
    : COMMANDS;

  // Build flat indexed list for keyboard nav
  const flatList = filtered;

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    itemRefs.current[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIdx((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (flatList[selectedIdx]) onSelect(flatList[selectedIdx]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true });
  }, [flatList, selectedIdx, onSelect, onClose]);

  if (!flatList.length) {
    const emptyMenu = (
      <div
        className="ne-slash-menu"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
        }}
      >
        <div className="ne-slash-empty">No commands match "{query}"</div>
      </div>
    );

    return createPortal(emptyMenu, document.body);
  }

  /* Group by category */
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = flatList.filter((c) => c.category === cat);
    if (items.length) acc.push({ category: cat, items });
    return acc;
  }, []);

  let globalIdx = 0;

  const menu = (
    <div
      className="ne-slash-menu"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
      }}
      role="listbox"
      aria-label="Commands"
    >
      {query && (
        <div className="ne-slash-search-hint">
          {flatList.length} result{flatList.length !== 1 ? 's' : ''}
        </div>
      )}
      <div ref={listRef} className="ne-slash-scroll">
        {grouped.map(({ category, items }) => (
          <div key={category} className="ne-slash-group">
            <div className="ne-slash-category">{category}</div>
            {items.map((cmd) => {
              const idx = globalIdx++;
              const isSelected = idx === selectedIdx;
              return (
                <button
                  key={cmd.id}
                  ref={(el) => (itemRefs.current[idx] = el)}
                  className={`ne-slash-item ${isSelected ? 'selected' : ''}`}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => onSelect(cmd)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="ne-slash-icon">{cmd.icon}</div>
                  <div className="ne-slash-text">
                    <div className="ne-slash-label">{cmd.label}</div>
                    <div className="ne-slash-desc">{cmd.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(menu, document.body);
});

export default SlashMenu;
