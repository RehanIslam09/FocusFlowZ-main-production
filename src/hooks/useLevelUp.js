// useLevelUp.js — full replacement (same interface, no component changes needed)

import { useState, useEffect, useRef, useCallback } from 'react';

export function gemsForLevel(level) {
  if (level % 10 === 0) return 100;
  if (level % 5 === 0) return 75;
  return 50;
}

export function useLevelUp({ currentLevel, supabase, userId, onGemsChange }) {
  const lastProcessedLevel = useRef(null); // null = "not yet loaded from DB"
  const isLoaded = useRef(false);
  const [pendingLevelUp, setPendingLevelUp] = useState(null);

  // Step 1: Load the previously-saved level from Supabase on mount
  useEffect(() => {
    if (!supabase || !userId) return;

    supabase
      .from('user_progress')
      .select('last_seen_level')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        // If no row exists yet, treat their current level as baseline (no reward)
        lastProcessedLevel.current = data?.last_seen_level ?? currentLevel;
        isLoaded.current = true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]); // intentionally exclude currentLevel — run once

  // Step 2: Watch for level increases AFTER the baseline is loaded
  useEffect(() => {
    // Don't process until we've loaded the saved baseline
    if (!isLoaded.current) return;
    if (currentLevel === null || currentLevel === undefined) return;
    if (currentLevel <= lastProcessedLevel.current) return; // no increase

    const newLevel = currentLevel;
    const gems = gemsForLevel(newLevel);

    // Update the ref immediately to prevent double-fire
    lastProcessedLevel.current = newLevel;

    const awardGems = async () => {
      if (!supabase || !userId) return;
      try {
        // Save new baseline level to DB
        await supabase
          .from('user_progress')
          .upsert(
            { user_id: userId, last_seen_level: newLevel },
            { onConflict: 'user_id' },
          );

        // Award gems
        const { data: row } = await supabase
          .from('user_gems')
          .select('gems')
          .eq('user_id', userId)
          .single();

        const newTotal = (row?.gems ?? 0) + gems;

        await supabase.from('user_gems').upsert(
          {
            user_id: userId,
            gems: newTotal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

        onGemsChange?.(newTotal);
      } catch (err) {
        console.error('useLevelUp: gem award failed', err);
      }
    };

    awardGems();
    setPendingLevelUp({ newLevel, gemsAwarded: gems });
  }, [currentLevel, supabase, userId, onGemsChange]);

  const clearLevelUp = useCallback(() => setPendingLevelUp(null), []);
  return { pendingLevelUp, clearLevelUp };
}

export default useLevelUp;
