/**
 * CommandPalette.jsx
 *
 * Global command palette — Cmd+K / Ctrl+K to open.
 * Searches notes, collections, and tags.
 * Zero breaking changes to existing code.
 *
 * Usage (add ONE line anywhere inside the component JSX):
 *   <CommandPalette allNotes={allNotes} collections={collections} />
 *
 * Props:
 *   allNotes      — array of note objects (same shape as in NoteEditor / NotesPage)
 *   collections   — array of collection objects
 *   onCreateNote  — optional: () => void — called when "New Note" quick action selected
 *   onCreateCollection — optional: () => void
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCommandPalette from '../hooks/useCommandPalette';
import { getHighlightSegments, getCollectionPath } from '../utils/searchUtils';

/* ─────────────────────────────────────────────
   CSS — scoped with .cp- prefix, uses existing
   CSS variables from NoteEditor (--bg, --ink,
   --gold, --surface, --border, etc.)
───────────────────────────────────────────── */
const CP_CSS = `
.cp-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(6px) saturate(1.2);
  -webkit-backdrop-filter: blur(6px) saturate(1.2);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: clamp(60px, 12vh, 140px);
  animation: cp-fade-in .18s ease both;
}
@keyframes cp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.cp-modal {
  width: min(640px, calc(100vw - 32px));
  background: var(--surface, #faf7f2);
  border: 1px solid var(--border2, #ccc0a8);
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(196,145,58,.12),
    0 8px 32px rgba(0,0,0,.18),
    0 32px 80px rgba(0,0,0,.22);
  overflow: hidden;
  animation: cp-pop .22s cubic-bezier(.34,1.56,.64,1) both;
  display: flex;
  flex-direction: column;
  max-height: min(580px, calc(100vh - 120px));
}
@keyframes cp-pop {
  from { opacity: 0; transform: scale(.94) translateY(-12px); }
  to   { opacity: 1; transform: none; }
}

/* ── Search input row ── */
.cp-search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border, #ddd5c4);
  flex-shrink: 0;
  position: relative;
}
.cp-search-icon {
  color: var(--gold, #c4913a);
  flex-shrink: 0;
  opacity: .85;
}
.cp-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--f-ui, 'Cabinet Grotesk', sans-serif);
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--ink, #1e1a14);
  caret-color: var(--gold, #c4913a);
  line-height: 1.4;
}
.cp-search-input::placeholder {
  color: var(--ink3, #9c9283);
  font-weight: 400;
  font-style: italic;
}
.cp-kbd-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.cp-kbd {
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .48rem;
  letter-spacing: .06em;
  color: var(--ink3, #9c9283);
  background: var(--surface2, #f0ebe0);
  border: 1px solid var(--border, #ddd5c4);
  border-bottom-width: 2px;
  padding: 2px 6px;
  border-radius: 5px;
  line-height: 1.5;
}

/* ── Results scroll area ── */
.cp-results {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--border, #ddd5c4) transparent;
}
.cp-results::-webkit-scrollbar { width: 3px; }
.cp-results::-webkit-scrollbar-thumb { background: var(--border, #ddd5c4); border-radius: 2px; }

/* ── Section label ── */
.cp-section-label {
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .45rem;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--ink3, #9c9283);
  padding: 10px 18px 4px;
  opacity: .75;
}

/* ── Result item ── */
.cp-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 8px 14px;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  border-radius: 0;
  transition: background .08s;
  outline: none;
  position: relative;
}
.cp-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 2px;
  background: var(--gold, #c4913a);
  opacity: 0;
  transition: opacity .12s;
}
.cp-item.selected {
  background: var(--gold3, rgba(196,145,58,.12));
}
.cp-item.selected::before {
  opacity: 1;
}
.cp-item:hover:not(.selected) {
  background: var(--surface2, #f0ebe0);
}

/* ── Item icon ── */
.cp-item-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--surface2, #f0ebe0);
  border: 1px solid var(--border, #ddd5c4);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: .9rem;
  color: var(--ink3, #9c9283);
  transition: all .12s;
}
.cp-item.selected .cp-item-icon {
  background: rgba(196,145,58,.14);
  border-color: rgba(196,145,58,.35);
  color: var(--gold, #c4913a);
}

/* ── Item text ── */
.cp-item-body {
  flex: 1;
  min-width: 0;
}
.cp-item-title {
  font-family: var(--f-ui, 'Cabinet Grotesk', sans-serif);
  font-size: .9rem;
  font-weight: 600;
  color: var(--ink, #1e1a14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.cp-item-meta {
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .48rem;
  color: var(--ink3, #9c9283);
  letter-spacing: .04em;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cp-highlight {
  color: var(--gold, #c4913a);
  font-weight: 700;
  background: rgba(196,145,58,.12);
  border-radius: 2px;
  padding: 0 1px;
}

/* ── Item action badge ── */
.cp-item-action {
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .44rem;
  letter-spacing: .08em;
  color: var(--ink3, #9c9283);
  background: var(--surface2, #f0ebe0);
  border: 1px solid var(--border, #ddd5c4);
  padding: 2px 7px;
  border-radius: 5px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity .12s;
  text-transform: uppercase;
}
.cp-item.selected .cp-item-action {
  opacity: 1;
}

/* ── Empty state ── */
.cp-empty {
  padding: 36px 24px;
  text-align: center;
}
.cp-empty-glyph {
  font-family: var(--f-display, 'Cormorant Garamond', serif);
  font-size: 2.4rem;
  color: var(--gold, #c4913a);
  opacity: .25;
  display: block;
  margin-bottom: 10px;
  line-height: 1;
}
.cp-empty-text {
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .58rem;
  color: var(--ink3, #9c9283);
  letter-spacing: .1em;
  text-transform: uppercase;
}

/* ── Footer bar ── */
.cp-footer {
  border-top: 1px solid var(--border, #ddd5c4);
  padding: 7px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}
.cp-footer-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .44rem;
  color: var(--ink3, #9c9283);
  letter-spacing: .07em;
}
.cp-footer-sep {
  width: 1px;
  height: 12px;
  background: var(--border, #ddd5c4);
}

/* ── Quick actions strip ── */
.cp-quick-actions {
  display: flex;
  gap: 6px;
  padding: 8px 14px 4px;
  flex-wrap: wrap;
}
.cp-quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 7px;
  border: 1px solid var(--border2, #ccc0a8);
  background: transparent;
  color: var(--ink2, #5c5445);
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .5rem;
  letter-spacing: .06em;
  cursor: pointer;
  transition: all .12s;
}
.cp-quick-btn:hover {
  border-color: var(--gold, #c4913a);
  color: var(--gold, #c4913a);
  background: rgba(196,145,58,.07);
}

/* ── Recent searches ── */
.cp-recent-label {
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .44rem;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--ink3, #9c9283);
  padding: 6px 18px 4px;
  opacity: .65;
}
.cp-recent-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 18px;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  color: var(--ink2, #5c5445);
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: .58rem;
  letter-spacing: .04em;
  transition: background .08s;
}
.cp-recent-item:hover {
  background: var(--surface2, #f0ebe0);
}
.cp-recent-icon {
  color: var(--ink3, #9c9283);
  opacity: .7;
}

/* Dark mode tweaks */
.dark .cp-modal {
  box-shadow:
    0 0 0 1px rgba(196,145,58,.1),
    0 8px 32px rgba(0,0,0,.5),
    0 32px 80px rgba(0,0,0,.6);
}
.dark .cp-overlay {
  background: rgba(0,0,0,.72);
}
`;

/* ─────────────────────────────────────────────
   SVG icon helpers (no extra dep)
───────────────────────────────────────────── */
const Icon = {
  Search: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  Note: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Folder: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Tag: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  Clock: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Plus: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  ArrowReturn: () => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  ),
  ArrowUpDown: () => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  ),
};

/* ─────────────────────────────────────────────
   HighlightedText
───────────────────────────────────────────── */
function HighlightedText({ text, query }) {
  const segments = useMemo(
    () => getHighlightSegments(text || '', query || ''),
    [text, query],
  );
  return (
    <span>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className="cp-highlight">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

/* ─────────────────────────────────────────────
   ResultItem
───────────────────────────────────────────── */
function ResultItem({
  item,
  isSelected,
  query,
  collections,
  onSelect,
  onHover,
}) {
  const ref = useRef(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const folderPath = useMemo(
    () =>
      item.type === 'note' && item.collection_id
        ? getCollectionPath(item.collection_id, collections)
        : '',
    [item, collections],
  );

  const metaText = useMemo(() => {
    if (item.type === 'note') {
      const parts = [];
      if (item.subject) parts.push(item.subject);
      if (folderPath) parts.push(`📁 ${folderPath}`);
      if (item.tags?.length) parts.push(`#${item.tags.slice(0, 2).join(' #')}`);
      return parts.join(' · ') || 'Note';
    }
    if (item.type === 'collection') {
      return item.parent_id ? 'Nested folder' : 'Top-level folder';
    }
    if (item.type === 'tag') {
      return 'Tag';
    }
    return '';
  }, [item, folderPath]);

  const renderIcon = () => {
    if (item.type === 'note') {
      return item.card_style?.emoji || <Icon.Note />;
    }
    if (item.type === 'collection') {
      return item.icon || <Icon.Folder />;
    }
    if (item.type === 'tag') {
      return <Icon.Tag />;
    }
    return '?';
  };

  const actionLabel =
    item.type === 'note'
      ? 'Open'
      : item.type === 'collection'
        ? 'Browse'
        : 'Filter';

  return (
    <button
      ref={ref}
      className={`cp-item ${isSelected ? 'selected' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(item);
      }}
      onMouseEnter={() => onHover()}
      type="button"
    >
      <div className="cp-item-icon">{renderIcon()}</div>
      <div className="cp-item-body">
        <div className="cp-item-title">
          <HighlightedText text={item.title} query={query} />
        </div>
        {metaText && <div className="cp-item-meta">{metaText}</div>}
      </div>
      <span className="cp-item-action">{actionLabel}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────
   CommandPalette (main export)
───────────────────────────────────────────── */
export default function CommandPalette({
  allNotes = [],
  collections = [],
  onCreateNote,
  onCreateCollection,
}) {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const {
    isOpen,
    close,
    query,
    setQuery,
    results,
    selectedIndex,
    setSelectedIndex,
    moveUp,
    moveDown,
    recentSearches,
    recordRecent,
    debouncedQuery,
  } = useCommandPalette({ allNotes, collections });

  /* ── Focus input on open ── */
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  /* ── Keyboard navigation inside modal ── */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveUp();
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) handleSelect(results[selectedIndex]);
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, selectedIndex]);

  /* ── Handle selection ── */
  const handleSelect = useCallback(
    (item) => {
      recordRecent(query);
      close();
      if (item.type === 'note') {
        navigate(`/notes/${item.id}`);
      } else if (item.type === 'collection') {
        navigate(`/notes?collection=${item.id}`);
      } else if (item.type === 'tag') {
        navigate(`/notes?tag=${encodeURIComponent(item.title)}`);
      } else if (item.id === '__new_note__') {
        if (onCreateNote) onCreateNote();
        else navigate('/notes');
      } else if (item.id === '__new_collection__') {
        if (onCreateCollection) onCreateCollection();
        else navigate('/notes');
      }
    },
    [navigate, close, query, recordRecent, onCreateNote, onCreateCollection],
  );

  const handleRecentClick = useCallback(
    (recent) => {
      setQuery(recent);
      inputRef.current?.focus();
    },
    [setQuery],
  );

  /* ── Group results by type for labelled sections ── */
  const sections = useMemo(() => {
    const grouped = { note: [], collection: [], tag: [] };
    results.forEach((r) => {
      if (grouped[r.type]) grouped[r.type].push(r);
    });
    const out = [];
    let flatIdx = 0;
    const sectionDefs = [
      { key: 'note', label: 'Notes' },
      { key: 'collection', label: 'Folders' },
      { key: 'tag', label: 'Tags' },
    ];
    sectionDefs.forEach(({ key, label }) => {
      if (grouped[key].length > 0) {
        out.push({
          label,
          items: grouped[key].map((item) => ({ item, flatIdx: flatIdx++ })),
        });
      }
    });
    return out;
  }, [results]);

  if (!isOpen) return null;

  const showRecent = !query && recentSearches.length > 0;
  const showEmpty = !!query && results.length === 0;
  const showQuickActions = !query;

  return (
    <>
      <style>{CP_CSS}</style>
      <div
        className="cp-overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="cp-modal">
          {/* ── Search row ── */}
          <div className="cp-search-row">
            <span className="cp-search-icon">
              <Icon.Search />
            </span>
            <input
              ref={inputRef}
              className="cp-search-input"
              placeholder="Search notes, folders, tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              type="text"
            />
            <div className="cp-kbd-hint">
              <span className="cp-kbd">ESC</span>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="cp-results">
            {/* Quick actions (shown when no query) */}
            {showQuickActions && (
              <div className="cp-quick-actions">
                <button
                  className="cp-quick-btn"
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    close();
                    if (onCreateNote) onCreateNote();
                    else navigate('/notes');
                  }}
                >
                  <Icon.Plus /> New Note
                </button>
                <button
                  className="cp-quick-btn"
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    close();
                    if (onCreateCollection) onCreateCollection();
                    else navigate('/notes');
                  }}
                >
                  <Icon.Plus /> New Folder
                </button>
                <button
                  className="cp-quick-btn"
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    close();
                    navigate('/notes');
                  }}
                >
                  All Notes
                </button>
              </div>
            )}

            {/* Recent searches */}
            {showRecent && (
              <>
                <div className="cp-recent-label">Recent</div>
                {recentSearches.map((r) => (
                  <button
                    key={r}
                    className="cp-recent-item"
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleRecentClick(r);
                    }}
                  >
                    <span className="cp-recent-icon">
                      <Icon.Clock />
                    </span>
                    {r}
                  </button>
                ))}
              </>
            )}

            {/* Grouped results */}
            {sections.map((section) => (
              <div key={section.label}>
                <div className="cp-section-label">{section.label}</div>
                {section.items.map(({ item, flatIdx }) => (
                  <ResultItem
                    key={item.id}
                    item={item}
                    isSelected={flatIdx === selectedIndex}
                    query={debouncedQuery}
                    collections={collections}
                    onSelect={handleSelect}
                    onHover={() => setSelectedIndex(flatIdx)}
                  />
                ))}
              </div>
            ))}

            {/* Empty state */}
            {showEmpty && (
              <div className="cp-empty">
                <span className="cp-empty-glyph">◈</span>
                <div className="cp-empty-text">No results for "{query}"</div>
              </div>
            )}

            {/* Default empty (no query, no recent) */}
            {!query && !showRecent && !showQuickActions && (
              <div className="cp-empty">
                <span className="cp-empty-glyph">⌘</span>
                <div className="cp-empty-text">Type to search…</div>
              </div>
            )}

            {/* Browse all when no query */}
            {!query && results.length > 0 && !showEmpty && (
              <>{sections.map((section) => null)}</>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="cp-footer">
            <span className="cp-footer-hint">
              <Icon.ArrowUpDown /> Navigate
            </span>
            <div className="cp-footer-sep" />
            <span className="cp-footer-hint">
              <Icon.ArrowReturn /> Select
            </span>
            <div className="cp-footer-sep" />
            <span className="cp-footer-hint">
              <span className="cp-kbd" style={{ fontSize: '.4rem' }}>
                ESC
              </span>
              &nbsp;Dismiss
            </span>
            {results.length > 0 && (
              <>
                <div className="cp-footer-sep" style={{ marginLeft: 'auto' }} />
                <span className="cp-footer-hint" style={{ marginLeft: 0 }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
