/**
 * useCommandPalette.js
 *
 * Handles:
 *   - open/close state
 *   - global Cmd+K / Ctrl+K listener
 *   - search query state
 *   - result computation (debounced)
 *   - recent searches (localStorage, max 6)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { buildSearchIndex, searchIndex } from '../utils/searchUtils';

const RECENT_KEY = 'cp_recent_searches';
const MAX_RECENT = 6;

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(queries) {
  try {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(queries.slice(0, MAX_RECENT)),
    );
  } catch {
    /* ignore */
  }
}

export default function useCommandPalette({ allNotes = [], collections = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState(loadRecent);
  const debounceRef = useRef(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  /* ── Build index ── */
  const index = useMemo(
    () => buildSearchIndex(allNotes, collections),
    [allNotes, collections],
  );

  /* ── Debounce query ── */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 80);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  /* ── Results ── */
  const results = useMemo(
    () => searchIndex(index, debouncedQuery, 15),
    [index, debouncedQuery],
  );

  /* ── Reset selection when results change ── */
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, debouncedQuery]);

  /* ── Open / close ── */
  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setDebouncedQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  /* ── Cmd+K global listener ── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen((prev) => {
          if (prev) return false;
          setQuery('');
          setDebouncedQuery('');
          setSelectedIndex(0);
          return true;
        });
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  /* ── Record a recent search ── */
  const recordRecent = useCallback((q) => {
    if (!q || !q.trim()) return;
    const trimmed = q.trim();
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((r) => r !== trimmed)].slice(
        0,
        MAX_RECENT,
      );
      saveRecent(next);
      return next;
    });
  }, []);

  /* ── Navigation ── */
  const moveUp = useCallback(() => {
    setSelectedIndex((i) => Math.max(0, i - 1));
  }, []);

  const moveDown = useCallback(() => {
    setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
  }, [results.length]);

  return {
    isOpen,
    open,
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
  };
}
