/**
 * TagInput.jsx
 *
 * Production-grade tag input with:
 *  - Add via Enter or comma
 *  - Remove with Backspace (last tag) or × button
 *  - Lowercase + trim normalisation
 *  - Duplicate prevention
 *  - Optional autocomplete suggestions
 *  - Accessible (keyboard-navigable suggestion list)
 *
 * Props:
 *  tags         string[]   – controlled list of current tags
 *  onChange     (tags) =>  – called whenever the list changes
 *  suggestions  string[]   – optional pool for autocomplete
 */

import { useState, useRef, useCallback, memo } from 'react';
import { X } from 'lucide-react';

const TagInput = memo(function TagInput({
  tags = [],
  onChange,
  suggestions = [],
}) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestIdx, setSuggestIdx] = useState(-1);
  const inputRef = useRef(null);

  /* ── Normalise a raw string into a valid tag ── */
  const normalise = (v) =>
    v
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

  /* ── Add one or more tags (comma-separated input) ── */
  const add = useCallback(
    (raw) => {
      const parts = raw
        .split(',')
        .map(normalise)
        .filter((t) => t.length > 0 && !tags.includes(t));
      if (parts.length) onChange([...tags, ...parts]);
      setInput('');
      setSuggestIdx(-1);
    },
    [tags, onChange],
  );

  /* ── Remove a specific tag ── */
  const remove = useCallback(
    (tag) => onChange(tags.filter((t) => t !== tag)),
    [tags, onChange],
  );

  /* ── Filtered suggestions (exclude existing tags) ── */
  const filtered = input
    ? suggestions.filter(
        (s) => s.includes(input.toLowerCase()) && !tags.includes(s),
      )
    : [];

  const hasSuggestions = focused && filtered.length > 0;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (suggestIdx >= 0 && filtered[suggestIdx]) {
        add(filtered[suggestIdx]);
      } else if (input) {
        add(input);
      }
    } else if (e.key === 'Backspace' && !input && tags.length) {
      remove(tags[tags.length - 1]);
    } else if (e.key === 'ArrowDown' && hasSuggestions) {
      e.preventDefault();
      setSuggestIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp' && hasSuggestions) {
      e.preventDefault();
      setSuggestIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setSuggestIdx(-1);
      setInput('');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="ne-tag-wrap"
        onClick={() => inputRef.current?.focus()}
        style={focused ? { borderColor: 'var(--gold)' } : {}}
      >
        {tags.map((t) => (
          <span key={t} className="ne-tag-pill">
            #{t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(t);
              }}
              aria-label={`Remove tag ${t}`}
            >
              <X size={8} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="ne-tag-bare"
          placeholder={tags.length === 0 ? 'Add tag…' : ''}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setSuggestIdx(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Small delay so click on suggestion registers
            setTimeout(() => {
              setFocused(false);
              setSuggestIdx(-1);
              if (input) add(input);
            }, 150);
          }}
        />
      </div>

      {/* Autocomplete dropdown */}
      {hasSuggestions && (
        <div className="ne-tag-suggestions">
          {filtered.slice(0, 8).map((s, i) => (
            <button
              key={s}
              type="button"
              className={`ne-tag-suggestion-item ${i === suggestIdx ? 'selected' : ''}`}
              onMouseEnter={() => setSuggestIdx(i)}
              onClick={() => add(s)}
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default TagInput;
