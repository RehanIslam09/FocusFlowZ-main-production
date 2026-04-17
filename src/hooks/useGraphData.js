// src/hooks/useGraphData.js
import { useMemo } from 'react';

export function buildGraph(notes) {
  if (!notes?.length) return { nodes: [], edges: [] };

  const noteSet = new Set(notes.map((n) => n.id));

  const backlinkCount = new Map();
  const connectionCount = new Map();

  notes.forEach((n) => {
    // links is stored as jsonb — could be array of strings or null
    const links = Array.isArray(n.links) ? n.links : [];
    links.forEach((targetId) => {
      if (!noteSet.has(targetId)) return;
      backlinkCount.set(targetId, (backlinkCount.get(targetId) || 0) + 1);
      connectionCount.set(n.id, (connectionCount.get(n.id) || 0) + 1);
      connectionCount.set(targetId, (connectionCount.get(targetId) || 0) + 1);
    });
  });

  const nodes = notes.map((n) => ({
    id: n.id,
    title: n.title || 'Untitled',
    subject: n.subject || '',
    cardStyle: n.card_style || {},
    tags: Array.isArray(n.tags) ? n.tags : [],
    connectionCount: connectionCount.get(n.id) || 0,
    backlinkCount: backlinkCount.get(n.id) || 0,
  }));

  // Deduplicated directed edges
  const edgeSeen = new Set();
  const edges = [];
  notes.forEach((n) => {
    const links = Array.isArray(n.links) ? n.links : [];
    links.forEach((targetId) => {
      if (!noteSet.has(targetId)) return;
      // Use directed key so A→B and B→A are both valid but exact dupes are dropped
      const key = `${n.id}::${targetId}`;
      if (!edgeSeen.has(key)) {
        edgeSeen.add(key);
        edges.push({ source: n.id, target: targetId });
      }
    });
  });

  return { nodes, edges };
}

export default function useGraphData(notes) {
  return useMemo(() => buildGraph(notes), [notes]);
}
