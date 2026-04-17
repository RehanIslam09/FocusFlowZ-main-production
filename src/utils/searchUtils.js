/**
 * searchUtils.js — Command Palette Search Utilities
 * Fuzzy match, scoring, and result ranking helpers.
 * NO external dependencies.
 */

/**
 * Fuzzy match: returns a score (0 = no match, higher = better match).
 * Prefers consecutive character runs and prefix matches.
 */
export function fuzzyScore(haystack, needle) {
  if (!needle) return 1;
  if (!haystack) return 0;

  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();

  // Exact match → highest score
  if (h === n) return 1000;

  // Starts-with → high score
  if (h.startsWith(n)) return 900;

  // Contains (substring) → medium score
  const idx = h.indexOf(n);
  if (idx !== -1) return 700 - idx; // earlier occurrences rank higher

  // Character-by-character fuzzy match
  let ni = 0;
  let consecutive = 0;
  let score = 0;

  for (let hi = 0; hi < h.length && ni < n.length; hi++) {
    if (h[hi] === n[ni]) {
      score += 10 + consecutive * 5;
      consecutive++;
      ni++;
    } else {
      consecutive = 0;
    }
  }

  return ni === n.length ? score : 0;
}

/**
 * Highlight matching characters in a string.
 * Returns an array of { text, highlight } segments.
 */
export function getHighlightSegments(text, query) {
  if (!query || !text) return [{ text, highlight: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Try substring match first
  const idx = lowerText.indexOf(lowerQuery);
  if (idx !== -1) {
    const segments = [];
    if (idx > 0) segments.push({ text: text.slice(0, idx), highlight: false });
    segments.push({
      text: text.slice(idx, idx + query.length),
      highlight: true,
    });
    if (idx + query.length < text.length)
      segments.push({ text: text.slice(idx + query.length), highlight: false });
    return segments;
  }

  // Fallback: highlight individually matched chars
  const segments = [];
  let ni = 0;
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    if (ni < lowerQuery.length && text[i].toLowerCase() === lowerQuery[ni]) {
      if (buf) {
        segments.push({ text: buf, highlight: false });
        buf = '';
      }
      segments.push({ text: text[i], highlight: true });
      ni++;
    } else {
      buf += text[i];
    }
  }
  if (buf) segments.push({ text: buf, highlight: false });
  return segments;
}

/**
 * Build flat searchable index from notes + collections.
 */
export function buildSearchIndex(notes = [], collections = []) {
  const items = [];

  notes.forEach((note) => {
    items.push({
      type: 'note',
      id: note.id,
      title: note.title || 'Untitled',
      subject: note.subject || '',
      tags: Array.isArray(note.tags) ? note.tags : [],
      collection_id: note.collection_id || null,
      links: Array.isArray(note.links) ? note.links : [],
      updated_at: note.updated_at || null,
      card_style: note.card_style || null,
      _searchText: [
        note.title || '',
        note.subject || '',
        ...(Array.isArray(note.tags) ? note.tags : []),
      ]
        .join(' ')
        .toLowerCase(),
    });
  });

  collections.forEach((col) => {
    items.push({
      type: 'collection',
      id: col.id,
      title: col.name || 'Unnamed Folder',
      icon: col.icon || '📁',
      color: col.color || null,
      parent_id: col.parent_id || null,
      _searchText: (col.name || '').toLowerCase(),
    });
  });

  // Deduplicate tags across all notes
  const tagSet = new Set();
  notes.forEach((n) =>
    (Array.isArray(n.tags) ? n.tags : []).forEach((t) => tagSet.add(t)),
  );
  tagSet.forEach((tag) => {
    items.push({
      type: 'tag',
      id: `tag:${tag}`,
      title: tag,
      _searchText: tag.toLowerCase(),
    });
  });

  return items;
}

/**
 * Search the index and return ranked results (max `limit`).
 */
export function searchIndex(index, query, limit = 15) {
  if (!query.trim()) {
    // No query → return recent notes first, then collections
    return index
      .filter((i) => i.type === 'note' || i.type === 'collection')
      .slice(0, limit);
  }

  const scored = index
    .map((item) => ({
      ...item,
      score: fuzzyScore(item._searchText, query.trim().toLowerCase()),
    }))
    .filter((i) => i.score > 0)
    .sort((a, b) => {
      // Type priority: notes first, then collections, then tags
      const typePriority = { note: 0, collection: 1, tag: 2 };
      const scoresDiff = b.score - a.score;
      if (Math.abs(scoresDiff) > 50) return scoresDiff;
      return (typePriority[a.type] || 0) - (typePriority[b.type] || 0);
    })
    .slice(0, limit);

  return scored;
}

/**
 * Group results by type for display.
 */
export function groupResults(results) {
  const groups = { note: [], collection: [], tag: [] };
  results.forEach((r) => {
    if (groups[r.type]) groups[r.type].push(r);
  });
  return groups;
}

/**
 * Get collection name by id (with parent path).
 */
export function getCollectionPath(collectionId, collections) {
  if (!collectionId || !collections.length) return '';
  const col = collections.find((c) => c.id === collectionId);
  if (!col) return '';
  if (col.parent_id) {
    const parent = collections.find((c) => c.id === col.parent_id);
    return parent ? `${parent.name} / ${col.name}` : col.name;
  }
  return col.name;
}
