// src/components/EditorSidebar.jsx
/**
 * EditorSidebar — VS Code-style file explorer, updated for hierarchical folders.
 *
 * Changes from previous version:
 *  - CollectionGroup replaced with recursive FolderNode tree
 *  - Supports infinite nesting via buildCollectionTree
 *  - Inline creation at any depth level
 *  - "New Sub-folder" in context menu for collections
 *  - All previous features retained (context menu, graph, etc.)
 */

import { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MiniGraph from './MiniGraph';
import {
  buildCollectionTree,
  buildCollectionsMap,
  getDirectNotes,
} from '../lib/collectionTree';
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Trash2,
  Network,
  FilePlus,
  Check,
  X,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   CSS — original classes preserved + tree additions
───────────────────────────────────────────────────────────── */
const CSS = `
.es-root{width:220px;flex-shrink:0;height:100%;display:flex;flex-direction:column;background:#0f0e0c;border-right:1px solid rgba(255,255,255,.07);font-family:'Cabinet Grotesk',sans-serif;overflow:hidden;user-select:none;position:relative}
.es-header{padding:10px 12px 8px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
.es-header-row{display:flex;align-items:center;justify-content:space-between}
.es-header-title{font-family:'JetBrains Mono',monospace;font-size:.46rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.es-header-actions{display:flex;align-items:center;gap:3px;position:relative}
.es-new-btn{width:20px;height:20px;border-radius:5px;background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.4);cursor:pointer;display:grid;place-items:center;transition:all .15s;flex-shrink:0}
.es-new-btn:hover{border-color:rgba(196,145,58,.5);color:#c4913a;background:rgba(196,145,58,.08)}
.es-new-btn.active{border-color:rgba(196,145,58,.5);color:#c4913a;background:rgba(196,145,58,.1)}
.es-header-dropdown{position:absolute;top:calc(100% + 6px);right:0;min-width:162px;background:#1a1814;border:1px solid rgba(255,255,255,.1);border-radius:9px;box-shadow:0 12px 36px rgba(0,0,0,.55);z-index:9000;overflow:hidden;animation:es-pop .16s cubic-bezier(.34,1.56,.64,1)}
@keyframes es-pop{from{opacity:0;transform:scale(.93) translateY(-5px)}to{opacity:1;transform:none}}
.es-dropdown-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:transparent;color:rgba(255,255,255,.55);font-family:'Cabinet Grotesk',sans-serif;font-size:.75rem;cursor:pointer;transition:background .1s,color .1s;text-align:left}
.es-dropdown-item:hover{background:rgba(255,255,255,.05);color:rgba(255,255,255,.9)}
.es-dropdown-item svg{flex-shrink:0;color:rgba(196,145,58,.7)}
.es-dropdown-sep{height:1px;background:rgba(255,255,255,.06);margin:3px 0}

/* File tree */
.es-tree{flex:1;overflow-y:auto;padding:4px 0 8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent;min-height:0}
.es-tree::-webkit-scrollbar{width:3px}
.es-tree::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}

/* ── Recursive folder node ── */
.es-folder-node{position:relative}
.es-folder-row{display:flex;align-items:center;gap:5px;padding:4px 8px;cursor:pointer;color:rgba(255,255,255,.45);font-size:.72rem;font-weight:600;letter-spacing:.02em;transition:color .12s,background .12s;border-radius:4px;margin:0 4px;position:relative;border:none;background:transparent;width:calc(100% - 8px);text-align:left}
.es-folder-row:hover{color:rgba(255,255,255,.75);background:rgba(255,255,255,.04)}
.es-folder-row.active-folder{background:rgba(196,145,58,.08);color:rgba(255,255,255,.8)}
.es-folder-children{padding-left:12px;border-left:1px solid rgba(255,255,255,.06);margin-left:12px}
.es-folder-icon{flex-shrink:0;opacity:.7}
.es-folder-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.es-folder-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.es-folder-count{font-family:'JetBrains Mono',monospace;font-size:.42rem;color:rgba(255,255,255,.2);letter-spacing:.04em;flex-shrink:0}
.es-chevron{flex-shrink:0;color:rgba(255,255,255,.25);transition:transform .18s cubic-bezier(.34,1.2,.64,1)}
.es-chevron.open{transform:rotate(90deg)}
.es-folder-actions{display:flex;align-items:center;gap:2px;opacity:0;transition:opacity .12s;flex-shrink:0}
.es-folder-row:hover .es-folder-actions{opacity:1}
.es-folder-action-btn{width:16px;height:16px;border-radius:4px;background:transparent;border:none;color:rgba(255,255,255,.35);cursor:pointer;display:grid;place-items:center;transition:all .12s;flex-shrink:0}
.es-folder-action-btn:hover{background:rgba(196,145,58,.15);color:#c4913a}

/* Note row */
.es-note{display:flex;align-items:center;gap:5px;padding:4px 8px 4px 20px;cursor:pointer;color:rgba(255,255,255,.38);font-size:.76rem;font-weight:400;border-radius:4px;transition:background .1s,color .1s;position:relative;min-width:0;margin:0 4px}
.es-note:hover{background:rgba(255,255,255,.05);color:rgba(255,255,255,.8)}
.es-note:hover .es-note-delete{opacity:1}
.es-note.active{background:rgba(196,145,58,.12);color:rgba(255,255,255,.9)}
.es-note.active::before{content:'';position:absolute;left:-4px;top:2px;bottom:2px;width:2px;background:#c4913a;border-radius:2px}
.es-note-icon{flex-shrink:0;color:rgba(255,255,255,.2)}
.es-note.active .es-note-icon{color:rgba(196,145,58,.7)}
.es-note-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.76rem}
.es-note-delete{width:16px;height:16px;border-radius:4px;background:transparent;border:none;color:rgba(255,80,60,.5);cursor:pointer;display:grid;place-items:center;opacity:0;transition:all .12s;flex-shrink:0}
.es-note-delete:hover{background:rgba(255,80,60,.12);color:rgba(255,80,60,.9);opacity:1}

/* Inline input */
.es-inline-input-row{display:flex;align-items:center;gap:5px;padding:3px 8px 3px 20px;margin:1px 4px;background:rgba(196,145,58,.07);border:1px solid rgba(196,145,58,.25);border-radius:5px;animation:es-inline-in .14s ease}
@keyframes es-inline-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.es-inline-input-row.collection-level{padding-left:10px;background:rgba(196,145,58,.05)}
.es-inline-input{flex:1;background:transparent;border:none;outline:none;font-family:'Cabinet Grotesk',sans-serif;font-size:.76rem;color:rgba(255,255,255,.85);caret-color:#c4913a;min-width:0}
.es-inline-input::placeholder{color:rgba(255,255,255,.2)}
.es-inline-actions{display:flex;align-items:center;gap:2px;flex-shrink:0}
.es-inline-confirm,.es-inline-cancel{width:16px;height:16px;border-radius:3px;border:none;background:transparent;cursor:pointer;display:grid;place-items:center;transition:all .1s}
.es-inline-confirm{color:rgba(107,158,107,.8)}
.es-inline-confirm:hover{background:rgba(107,158,107,.15);color:#6b9e6b}
.es-inline-cancel{color:rgba(255,80,60,.5)}
.es-inline-cancel:hover{background:rgba(255,80,60,.12);color:rgba(255,80,60,.9)}

/* Section label */
.es-section-label{font-family:'JetBrains Mono',monospace;font-size:.42rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.18);padding:10px 12px 3px}

/* Graph section */
.es-graph-section{flex-shrink:0;padding:10px 10px 12px;border-top:1px solid rgba(255,255,255,.06)}
.es-graph-label{display:flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;font-size:.42rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:7px;cursor:pointer;transition:color .15s}
.es-graph-label:hover{color:rgba(255,255,255,.5)}

/* Context menu */
.es-ctx-menu{position:fixed;z-index:9999;background:#1a1814;border:1px solid rgba(255,255,255,.1);border-radius:9px;box-shadow:0 14px 44px rgba(0,0,0,.6);min-width:170px;overflow:hidden;animation:es-pop .15s cubic-bezier(.34,1.4,.64,1);padding:4px}
.es-ctx-item{display:flex;align-items:center;gap:9px;width:100%;padding:7px 10px;border:none;background:transparent;color:rgba(255,255,255,.55);font-family:'Cabinet Grotesk',sans-serif;font-size:.76rem;cursor:pointer;border-radius:6px;transition:background .1s,color .1s;text-align:left}
.es-ctx-item:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.9)}
.es-ctx-item.danger:hover{background:rgba(255,80,60,.1);color:rgba(255,100,80,.9)}
.es-ctx-item svg{flex-shrink:0;color:rgba(196,145,58,.65)}
.es-ctx-item.danger svg{color:rgba(255,80,60,.6)}
.es-ctx-sep{height:1px;background:rgba(255,255,255,.06);margin:3px 0}

/* Empty */
.es-empty{padding:20px 12px;font-family:'JetBrains Mono',monospace;font-size:.48rem;color:rgba(255,255,255,.2);letter-spacing:.08em;text-align:center}
`;

/* ═══ ContextMenu ═══ */
const ContextMenu = memo(function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const t = setTimeout(() => {
      window.addEventListener('mousedown', onDown);
      window.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const style = useMemo(() => {
    const W = window.innerWidth,
      H = window.innerHeight;
    const mw = 180,
      mh = items.length * 36 + 16;
    return { left: Math.min(x, W - mw - 8), top: Math.min(y, H - mh - 8) };
  }, [x, y, items.length]);
  return (
    <div ref={ref} className="es-ctx-menu" style={style}>
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="es-ctx-sep" />
        ) : (
          <button
            key={item.label}
            className={`es-ctx-item ${item.danger ? 'danger' : ''}`}
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ),
      )}
    </div>
  );
});

/* ═══ InlineInput ═══ */
const InlineInput = memo(function InlineInput({
  placeholder,
  onConfirm,
  onCancel,
  isCollectionLevel = false,
}) {
  const [val, setVal] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const confirm = () => {
    const v = val.trim();
    if (v) onConfirm(v);
    else onCancel();
  };
  return (
    <div
      className={`es-inline-input-row ${isCollectionLevel ? 'collection-level' : ''}`}
    >
      <FileText
        size={10}
        style={{ color: 'rgba(196,145,58,.5)', flexShrink: 0 }}
      />
      <input
        ref={ref}
        className="es-inline-input"
        placeholder={placeholder}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirm();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="es-inline-actions">
        <button
          className="es-inline-confirm"
          onClick={confirm}
          title="Create (Enter)"
        >
          <Check size={9} />
        </button>
        <button
          className="es-inline-cancel"
          onClick={onCancel}
          title="Cancel (Esc)"
        >
          <X size={9} />
        </button>
      </div>
    </div>
  );
});

/* ═══ NoteRow ═══ */
const NoteRow = memo(function NoteRow({ note, isActive, onClick, onDelete }) {
  return (
    <div
      className={`es-note ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={note.title}
    >
      <FileText size={11} className="es-note-icon" />
      <span className="es-note-name">{note.title || 'Untitled'}</span>
      <button
        className="es-note-delete"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Delete "${note.title}"?`)) onDelete();
        }}
        title="Delete"
      >
        <Trash2 size={9} />
      </button>
    </div>
  );
});

/* ═══ FolderNode — recursive ═══ */
const FolderNode = memo(function FolderNode({
  node,
  allNotes,
  currentNoteId,
  onNoteClick,
  onDeleteNote,
  onNewNoteInline,
  onNewFolderInline,
  inlineCreating, // { type: 'note'|'folder', targetId } | null
  onInlineNoteConfirm,
  onInlineFolderConfirm,
  onInlineCancel,
  onContextMenu,
  depth,
}) {
  const [open, setOpen] = useState(depth === 0);
  const colColor = node.color || 'rgba(255,255,255,.2)';

  // Notes directly in this folder
  const notes = useMemo(
    () => getDirectNotes(node.id, allNotes),
    [node.id, allNotes],
  );
  const hasChildren = node.children.length > 0;
  const hasAnything = hasChildren || notes.length > 0;
  const totalCount =
    notes.length + node.children.reduce((acc, c) => acc + 1, 0);

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, node);
    },
    [onContextMenu, node],
  );

  const isCreatingNoteHere =
    inlineCreating?.type === 'note' && inlineCreating?.targetId === node.id;
  const isCreatingFolderHere =
    inlineCreating?.type === 'folder' && inlineCreating?.targetId === node.id;

  return (
    <div className="es-folder-node">
      <div
        className="es-folder-row"
        style={{ paddingLeft: 8 + depth * 10 }}
        onClick={() => {
          setOpen((o) => !o);
        }}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setOpen((o) => !o);
        }}
      >
        <span className={`es-chevron ${open ? 'open' : ''}`}>
          <ChevronRight size={11} />
        </span>

        <span className="es-folder-dot" style={{ background: colColor }} />

        <span className="es-folder-name">
          {node.icon} {node.name}
        </span>

        <span className="es-folder-count">{totalCount}</span>

        <div className="es-folder-actions">
          <button
            className="es-folder-action-btn"
            title="New note here"
            onClick={(e) => {
              e.stopPropagation(); // ✅ prevents toggle
              setOpen(true);
              onNewNoteInline(node.id);
            }}
          >
            <FilePlus size={10} />
          </button>

          <button
            className="es-folder-action-btn"
            title="New sub-folder"
            onClick={(e) => {
              e.stopPropagation(); // ✅ prevents toggle
              setOpen(true);
              onNewFolderInline(node.id);
            }}
          >
            <FolderPlus size={10} />
          </button>
        </div>
      </div>

      {open && (
        <div
          className="es-folder-children"
          style={{ borderLeftColor: `${colColor}30` }}
        >
          {/* Inline note creation */}
          {isCreatingNoteHere && (
            <InlineInput
              placeholder="Note name…"
              onConfirm={(title) => onInlineNoteConfirm(title, node.id)}
              onCancel={onInlineCancel}
            />
          )}
          {/* Inline sub-folder creation */}
          {isCreatingFolderHere && (
            <InlineInput
              placeholder="Folder name…"
              isCollectionLevel
              onConfirm={(name) => onInlineFolderConfirm(name, node.id)}
              onCancel={onInlineCancel}
            />
          )}

          {/* Child folders (recursive) */}
          {node.children.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              allNotes={allNotes}
              currentNoteId={currentNoteId}
              onNoteClick={onNoteClick}
              onDeleteNote={onDeleteNote}
              onNewNoteInline={onNewNoteInline}
              onNewFolderInline={onNewFolderInline}
              inlineCreating={inlineCreating}
              onInlineNoteConfirm={onInlineNoteConfirm}
              onInlineFolderConfirm={onInlineFolderConfirm}
              onInlineCancel={onInlineCancel}
              onContextMenu={onContextMenu}
              depth={depth + 1}
            />
          ))}

          {/* Notes in this folder */}
          {notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              isActive={note.id === currentNoteId}
              onClick={() => onNoteClick(note.id)}
              onDelete={() => onDeleteNote(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   Main EditorSidebar
═══════════════════════════════════════════════════════════════ */
export default function EditorSidebar({
  allNotes,
  collections,
  currentNoteId,
  onNewNote,
  onDeleteNote,
  onNewCollection,
  showGraph = true,
}) {
  const navigate = useNavigate();
  const [graphOpen, setGraphOpen] = useState(true);
  const [headerDropOpen, setHeaderDropOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  // { type: 'note'|'folder', targetId: string|null }
  const [inlineCreating, setInlineCreating] = useState(null);
  const headerDropRef = useRef(null);

  /* ── Close header dropdown on outside click ── */
  useEffect(() => {
    if (!headerDropOpen) return;
    const handler = (e) => {
      if (headerDropRef.current && !headerDropRef.current.contains(e.target))
        setHeaderDropOpen(false);
    };
    const t = setTimeout(
      () => window.addEventListener('mousedown', handler),
      0,
    );
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', handler);
    };
  }, [headerDropOpen]);

  /* ── Build tree ── */
  const collectionsTree = useMemo(
    () => buildCollectionTree(collections),
    [collections],
  );

  /* ── Uncollected notes (no collection_id) ── */
  const uncollectedNotes = useMemo(
    () => allNotes.filter((n) => !n.collection_id),
    [allNotes],
  );

  /* ── Navigation ── */
  const handleNoteClick = useCallback(
    (id) => navigate(`/notes/${id}`),
    [navigate],
  );

  /* ── Context menu ── */
  const openCtxMenu = useCallback((e, node) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, node });
  }, []);
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const ctxItems = useMemo(() => {
    if (!ctxMenu) return [];
    const node = ctxMenu.node;
    if (node) {
      return [
        {
          label: 'New Note here',
          icon: <FilePlus size={12} />,
          action: () => setInlineCreating({ type: 'note', targetId: node.id }),
        },
        {
          label: 'New Sub-folder',
          icon: <FolderPlus size={12} />,
          action: () =>
            setInlineCreating({ type: 'folder', targetId: node.id }),
        },
      ];
    }
    return [
      {
        label: 'New Note',
        icon: <FilePlus size={12} />,
        action: () => setInlineCreating({ type: 'note', targetId: null }),
      },
      {
        label: 'New Folder',
        icon: <FolderPlus size={12} />,
        action: () => setInlineCreating({ type: 'folder', targetId: null }),
      },
    ];
  }, [ctxMenu]);

  /* ── Inline creation handlers ── */
  const handleInlineNoteConfirm = useCallback(
    (title, collectionId) => {
      if (onNewNote) {
        onNewNote({
          title,
          collection_id: collectionId, // ✅ FIXED KEY
        });
      }
      setInlineCreating(null);
    },
    [onNewNote],
  );
  const handleInlineFolderConfirm = useCallback(
    (name, parentId) => {
      if (onNewCollection)
        onNewCollection({
          name,
          icon: '📁',
          color: '#c4913a',
          parent_id: parentId || null,
        });
      setInlineCreating(null);
    },
    [onNewCollection],
  );

  const cancelInline = useCallback(() => setInlineCreating(null), []);

  const headerDropItems = [
    {
      label: 'New Note',
      icon: <FilePlus size={12} />,
      action: () => {
        setHeaderDropOpen(false);
        setInlineCreating({ type: 'note', targetId: null });
      },
    },
    {
      label: 'New Folder',
      icon: <FolderPlus size={12} />,
      action: () => {
        setHeaderDropOpen(false);
        setInlineCreating({ type: 'folder', targetId: null });
      },
    },
  ];

  return (
    <aside className="es-root">
      <style>{CSS}</style>

      {/* Header */}
      <div className="es-header">
        <div className="es-header-row">
          <span className="es-header-title">Explorer</span>
          <div className="es-header-actions" ref={headerDropRef}>
            <button
              className={`es-new-btn ${headerDropOpen ? 'active' : ''}`}
              onClick={() => setHeaderDropOpen((p) => !p)}
              title="New…"
            >
              <Plus size={11} />
            </button>
            {headerDropOpen && (
              <div className="es-header-dropdown">
                {headerDropItems.map((item) => (
                  <button
                    key={item.label}
                    className="es-dropdown-item"
                    onClick={item.action}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File tree */}
      <div
        className="es-tree"
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) openCtxMenu(e, null);
        }}
      >
        {/* Root-level inline folder creation */}
        {inlineCreating?.type === 'folder' &&
          inlineCreating.targetId === null && (
            <InlineInput
              placeholder="Folder name…"
              isCollectionLevel
              onConfirm={(name) => handleInlineFolderConfirm(name, null)}
              onCancel={cancelInline}
            />
          )}

        {/* Root-level inline note creation */}
        {inlineCreating?.type === 'note' &&
          inlineCreating.targetId === null && (
            <InlineInput
              placeholder="Note name…"
              onConfirm={(title) => handleInlineNoteConfirm(title, null)}
              onCancel={cancelInline}
            />
          )}

        {/* Recursive folder tree */}
        {collectionsTree.map((node) => (
          <FolderNode
            key={node.id}
            node={node}
            allNotes={allNotes}
            currentNoteId={currentNoteId}
            onNoteClick={handleNoteClick}
            onDeleteNote={onDeleteNote}
            onNewNoteInline={(colId) =>
              setInlineCreating({ type: 'note', targetId: colId })
            }
            onNewFolderInline={(colId) =>
              setInlineCreating({ type: 'folder', targetId: colId })
            }
            inlineCreating={inlineCreating}
            onInlineNoteConfirm={handleInlineNoteConfirm}
            onInlineFolderConfirm={handleInlineFolderConfirm}
            onInlineCancel={cancelInline}
            onContextMenu={openCtxMenu}
            depth={0}
          />
        ))}

        {/* Uncollected notes */}
        {uncollectedNotes.length > 0 && (
          <>
            <div className="es-section-label">Notes</div>
            {uncollectedNotes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                isActive={note.id === currentNoteId}
                onClick={() => handleNoteClick(note.id)}
                onDelete={() => onDeleteNote(note.id)}
              />
            ))}
          </>
        )}

        {allNotes.length === 0 &&
          collections.length === 0 &&
          !inlineCreating && <div className="es-empty">No notes yet</div>}
      </div>

      {/* Mini graph */}
      {showGraph && (
        <div className="es-graph-section">
          <div
            className="es-graph-label"
            onClick={() => setGraphOpen((o) => !o)}
          >
            <Network size={10} /> Knowledge Graph
            <span style={{ marginLeft: 'auto' }}>
              <ChevronRight
                size={9}
                style={{
                  transform: graphOpen ? 'rotate(90deg)' : '',
                  transition: 'transform .15s',
                }}
              />
            </span>
          </div>
          {graphOpen && (
            <MiniGraph
              allNotes={allNotes}
              currentNoteId={currentNoteId}
              width={198}
              height={165}
            />
          )}
        </div>
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxItems}
          onClose={closeCtxMenu}
        />
      )}
    </aside>
  );
}
