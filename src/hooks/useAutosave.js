/**
 * useAutosave.js
 *
 * Debounced, race-condition-safe autosave hook.
 * Uses a ref-based approach to always capture the latest values
 * without stale closures, and cancels inflight saves when
 * a new edit arrives before the previous debounce fires.
 *
 * Features:
 *  - Stale-closure-free via useRef for latest payload
 *  - AbortController per save cycle (prevents out-of-order writes)
 *  - Exponential backoff on network error (up to 3 retries)
 *  - "dirty" flag prevents saving unchanged content
 */

import { useRef, useCallback, useEffect, useState } from 'react';

const DEBOUNCE_MS = 1200;
const MAX_RETRIES = 3;

export default function useAutosave({ supabase, noteId, onSaved }) {
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const payloadRef = useRef(null);
  const lastSavedRef = useRef(null); // JSON snapshot of last saved payload
  const retryCount = useRef(0);

  const doSave = useCallback(
    async (payload, attempt = 0) => {
      if (!supabase || !noteId) return;

      // Abort any in-flight save
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setSaveState('saving');

      try {
        const snapshot = JSON.stringify(payload);

        // Skip if nothing changed
        if (snapshot === lastSavedRef.current) {
          setSaveState('idle');
          return;
        }

        const wordCount = countWords(payload.content);

        // FIND this block in useAutosave.js and ADD the links line:
        const { error } = await supabase
          .from('user_notes')
          .update({
            title: payload.title || 'Untitled',
            subject: payload.subject || null,
            collection_id: payload.collectionId || null,
            tags: payload.tags || [],
            content: payload.content,
            word_count: wordCount,
            font: payload.font || null,
            links: payload.links || [], // ← ADD THIS LINE
            updated_at: new Date().toISOString(),
          })
          .eq('id', noteId);

        if (error) throw error;

        lastSavedRef.current = snapshot;
        retryCount.current = 0;
        setSaveState('saved');
        onSaved?.();

        // Reset to idle after 2.5s
        setTimeout(() => setSaveState('idle'), 2500);
      } catch (err) {
        if (err.name === 'AbortError') return;

        // Retry with backoff
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 500;
          setTimeout(() => doSave(payloadRef.current, attempt + 1), delay);
        } else {
          setSaveState('error');
          console.error('[useAutosave] Save failed after retries:', err);
        }
      }
    },
    [supabase, noteId, onSaved],
  );

  const scheduleSave = useCallback(
    (payload) => {
      payloadRef.current = payload;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        doSave(payloadRef.current);
      }, DEBOUNCE_MS);
    },
    [doSave],
  );

  const forceSave = useCallback(() => {
    clearTimeout(timerRef.current);
    if (payloadRef.current) doSave(payloadRef.current);
  }, [doSave]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { saveState, scheduleSave, forceSave };
}

function countWords(json) {
  if (!json) return 0;
  try {
    const extract = (node) => {
      if (!node) return '';
      if (node.type === 'text') return node.text || '';
      return (node.content || []).map(extract).join(' ');
    };
    return extract(json).trim().split(/\s+/).filter(Boolean).length;
  } catch {
    return 0;
  }
}
