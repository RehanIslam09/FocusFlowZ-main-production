/**
 * EditorToolbar.jsx
 *
 * // UPDATED — FontPicker calls editor.commands.setFontFamily (mark-based)
 * // UPDATED — Active font detection reads from the mark at the current selection
 * // UPDATED — FontPicker receives `editor` prop for command dispatch + active detection
 * // UPDATED — Expanded FONTS list with more typeface options
 * // REMOVED — onFont prop passed to FontPicker (font state no longer drives editor)
 * // REMOVED — font prop passed to FontPicker (active font is read from editor marks)
 * // REMOVED — Any DOM manipulation or CSS variable usage
 *
 * How the font system now works:
 * ──────────────────────────────
 * The toolbar manages two separate concerns:
 *
 * 1. DB persistence (`font` prop / `onFont` callback on EditorToolbar):
 *    NoteEditor still tracks a `font` string in state so it can save a
 *    "default note font" to user_notes.font. This is used to pre-apply a
 *    font when the note loads (see NoteEditor). It is NOT used to drive
 *    the editor's internal font state.
 *
 * 2. Active font detection (inside FontPicker):
 *    `editor.getAttributes('fontFamily').fontFamily` reads the fontFamily
 *    mark at the current cursor/selection — the single source of truth.
 *    This means the picker always reflects what's actually at the cursor,
 *    whether that came from a toolbar click, a keyboard shortcut, or
 *    loaded JSON from the database.
 */

import { useState, useRef, useEffect, memo } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code2,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table2,
  Type,
  ChevronDown,
  Undo2,
  Redo2,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   // UPDATED — FONTS list (expanded, grouped by style)
   // Each entry has: key, label, stack, category, previewText
───────────────────────────────────────────────────────────── */
export const FONTS = [
  // ── Sans-serif / UI ──
  {
    key: 'cabinet',
    label: 'Cabinet',
    stack: "'Cabinet Grotesk', sans-serif",
    category: 'Sans',
    previewText: 'Aa',
  },
  {
    key: 'inter',
    label: 'Inter',
    stack: "'Inter', sans-serif",
    category: 'Sans',
    previewText: 'Aa',
  },
  {
    key: 'space-grotesk',
    label: 'Space Grotesk',
    stack: "'Space Grotesk', sans-serif",
    category: 'Sans',
    previewText: 'Aa',
  },
  {
    key: 'outfit',
    label: 'Outfit',
    stack: "'Outfit', sans-serif",
    category: 'Sans',
    previewText: 'Aa',
  },
  // ── Serif ──
  {
    key: 'cormorant',
    label: 'Cormorant',
    stack: "'Cormorant Garamond', serif",
    category: 'Serif',
    previewText: 'Aa',
  },
  {
    key: 'eb-garamond',
    label: 'EB Garamond',
    stack: "'EB Garamond', serif",
    category: 'Serif',
    previewText: 'Aa',
  },
  {
    key: 'playfair',
    label: 'Playfair',
    stack: "'Playfair Display', serif",
    category: 'Serif',
    previewText: 'Aa',
  },
  {
    key: 'lora',
    label: 'Lora',
    stack: "'Lora', serif",
    category: 'Serif',
    previewText: 'Aa',
  },
  {
    key: 'libre',
    label: 'Libre Bask.',
    stack: "'Libre Baskerville', serif",
    category: 'Serif',
    previewText: 'Aa',
  },
  {
    key: 'fraunces',
    label: 'Fraunces',
    stack: "'Fraunces', serif",
    category: 'Serif',
    previewText: 'Aa',
  },
  // ── Monospace ──
  {
    key: 'jetbrains',
    label: 'JetBrains Mono',
    stack: "'JetBrains Mono', monospace",
    category: 'Mono',
    previewText: 'Aa',
  },
];

/* ─────────────────────────────────────────────────────────────
   // UNCHANGED — Tiny shared button primitive
───────────────────────────────────────────────────────────── */
function ToolBtn({ active, disabled, title, onClick, children }) {
  return (
    <button
      className={`ne-tool-btn ${active ? 'active' : ''}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="ne-tool-divider" />;
}

/* ─────────────────────────────────────────────────────────────
   // UPDATED — FontPicker
   //
   // Changes from previous version:
   // - REMOVED `font` prop (was used as controlled state driving the picker)
   // - REMOVED `onFont` prop (was a callback to update NoteEditor state)
   // - NEW: `editor` prop used for both command dispatch AND active detection
   // - NEW: `onFontChange` prop (optional) — called AFTER the mark is applied,
   //   so NoteEditor can sync its `font` state for DB persistence. Receives the
   //   font key (not the stack), matching the existing DB schema.
   // - NEW: Active font is derived from editor.getAttributes('fontFamily')
   //   on every render — no stale state.
   // - NEW: Category grouping in the dropdown
   // - REMOVED: DOM hacks, CSS variable writes
───────────────────────────────────────────────────────────── */
const CATEGORY_ORDER = ['Sans', 'Serif', 'Mono'];

function FontPicker({ editor, onFontChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // // NEW — Active font detected from the mark at the cursor, not from state
  const activeFontStack =
    editor?.getAttributes('fontFamily')?.fontFamily ?? null;
  const activeFont = FONTS.find((f) => f.stack === activeFontStack) ?? null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (fontDef) => {
    if (!editor) return;

    if (activeFontStack === fontDef.stack) {
      // Clicking the active font removes the mark (reset to inherited)
      editor.chain().focus().unsetFontFamily().run();
      onFontChange?.(null);
    } else {
      // // UPDATED — setFontFamily is now a mark command (selection-aware)
      editor.chain().focus().setFontFamily(fontDef.stack).run();
      onFontChange?.(fontDef.key);
    }
    setOpen(false);
  };

  // Group fonts by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    fonts: FONTS.filter((f) => f.category === cat),
  }));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="ne-font-picker-btn"
        onClick={() => setOpen((o) => !o)}
        title="Font family"
        type="button"
      >
        <Type size={12} />
        {/* // NEW — label shows active font from mark, not from state */}
        <span
          className="ne-font-picker-label"
          style={activeFont ? { fontFamily: activeFont.stack } : undefined}
        >
          {activeFont ? activeFont.label : 'Font'}
        </span>
        <ChevronDown size={10} style={{ opacity: 0.6, marginLeft: 1 }} />
      </button>

      {open && (
        <div className="ne-font-dropdown">
          {/* // NEW — Reset to inherited option */}
          <button
            className={`ne-font-option ${!activeFontStack ? 'active' : ''}`}
            onClick={() => {
              editor?.chain().focus().unsetFontFamily().run();
              onFontChange?.(null);
              setOpen(false);
            }}
            type="button"
          >
            <span className="ne-font-preview" style={{ opacity: 0.5 }}>
              —
            </span>
            <span className="ne-font-name">Default</span>
            {!activeFontStack && <span className="ne-font-check">✓</span>}
          </button>

          <div className="ne-font-separator" />

          {/* // NEW — Grouped by category */}
          {grouped.map(({ category, fonts }) => (
            <div key={category}>
              <div className="ne-font-group-label">{category}</div>
              {fonts.map((f) => {
                const isActive = activeFontStack === f.stack;
                return (
                  <button
                    key={f.key}
                    className={`ne-font-option ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelect(f)}
                    type="button"
                  >
                    {/* Preview text rendered in the actual font */}
                    <span
                      className="ne-font-preview"
                      style={{ fontFamily: f.stack }}
                    >
                      {f.previewText}
                    </span>
                    {/* Font name rendered in the actual font for authenticity */}
                    <span
                      className="ne-font-name"
                      style={{ fontFamily: f.stack }}
                    >
                      {f.label}
                    </span>
                    {isActive && <span className="ne-font-check">✓</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   // UPDATED — EditorToolbar
   // REMOVED — `font` prop (no longer needed to drive picker display)
   // UPDATED — FontPicker receives `editor` and `onFontChange` only
   // UNCHANGED — All other toolbar buttons
───────────────────────────────────────────────────────────── */
const EditorToolbar = memo(function EditorToolbar({ editor, onFontChange }) {
  if (!editor) return null;

  const insertTable = () =>
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();

  return (
    <div className="ne-toolbar" role="toolbar" aria-label="Text formatting">
      {/* Headings */}
      <ToolBtn
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={14} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={14} />
      </ToolBtn>

      <Divider />

      {/* Inline marks */}
      <ToolBtn
        active={editor.isActive('bold')}
        title="Bold (⌘B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={13} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('italic')}
        title="Italic (⌘I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={13} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('strike')}
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={13} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('code')}
        title="Inline code"
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code2 size={13} />
      </ToolBtn>

      <Divider />

      {/* Lists */}
      <ToolBtn
        active={editor.isActive('bulletList')}
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={13} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('orderedList')}
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={13} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('taskList')}
        title="Checklist"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <CheckSquare size={13} />
      </ToolBtn>

      <Divider />

      {/* Alignment */}
      <ToolBtn
        active={editor.isActive({ textAlign: 'left' })}
        title="Align left"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft size={13} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive({ textAlign: 'center' })}
        title="Align center"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter size={13} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive({ textAlign: 'right' })}
        title="Align right"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight size={13} />
      </ToolBtn>

      <Divider />

      {/* Blocks */}
      <ToolBtn
        active={editor.isActive('codeBlock')}
        title="Code block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={14} />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('blockquote')}
        title="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={13} />
      </ToolBtn>
      <ToolBtn
        title="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={13} />
      </ToolBtn>
      <ToolBtn title="Insert table" onClick={insertTable}>
        <Table2 size={13} />
      </ToolBtn>

      <Divider />

      {/* Undo / Redo */}
      <ToolBtn
        disabled={!editor.can().undo()}
        title="Undo (⌘Z)"
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={13} />
      </ToolBtn>
      <ToolBtn
        disabled={!editor.can().redo()}
        title="Redo (⌘⇧Z)"
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={13} />
      </ToolBtn>

      <Divider />

      {/* // UPDATED — FontPicker: editor for dispatch+detection, onFontChange for DB sync */}
      <FontPicker editor={editor} onFontChange={onFontChange} />

      <span className="ne-tool-label" style={{ marginLeft: 'auto' }}>
        / for commands
      </span>
    </div>
  );
});

export default EditorToolbar;
export { FontPicker };
