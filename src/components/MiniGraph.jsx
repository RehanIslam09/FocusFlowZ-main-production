// src/components/MiniGraph.jsx
/**
 * MiniGraph — lightweight neighbourhood graph shown in the editor left sidebar.
 *
 * Shows all notes but highlights the current note + its 1-hop neighbours.
 * Uses react-force-graph-2d with a low-energy simulation so it settles quickly.
 * Click any node → navigate to that note.
 */
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';

const SUBJECT_ACCENTS = [
  { keys: ['math', 'calculus', 'algebra', 'geometry', 'statistics'], hue: 250 },
  { keys: ['physics', 'science', 'chemistry', 'biology', 'nature'], hue: 150 },
  { keys: ['history', 'literature', 'philosophy', 'humanities'], hue: 35 },
  {
    keys: [
      'code',
      'programming',
      'computer',
      'software',
      'engineering',
      'tech',
      'dev',
      'web',
    ],
    hue: 210,
  },
  { keys: ['design', 'ui', 'ux', 'creative', 'visual'], hue: 285 },
  {
    keys: ['business', 'finance', 'economics', 'marketing', 'product'],
    hue: 20,
  },
  {
    keys: ['language', 'english', 'spanish', 'french', 'writing', 'grammar'],
    hue: 165,
  },
  { keys: ['music', 'audio', 'sound', 'composition'], hue: 310 },
  {
    keys: ['health', 'medicine', 'psychology', 'wellness', 'fitness'],
    hue: 350,
  },
  { keys: ['personal', 'journal', 'notes', 'diary', 'ideas', 'todo'], hue: 50 },
];

function getHue(node) {
  const key = (node.subject || node.title || '').toLowerCase();
  for (const p of SUBJECT_ACCENTS) {
    if (p.keys.some((k) => key.includes(k))) return p.hue;
  }
  return ((node.subject || node.title || 'N').charCodeAt(0) * 137) % 360;
}

function nodeR(node) {
  return (
    3 +
    Math.min((node.connectionCount || 0) + (node.backlinkCount || 0), 14) * 0.7
  );
}

const CSS = `
.mg-wrap {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(ellipse at 40% 40%, #0e0b18 0%, #07060a 100%);
  border: 1px solid rgba(255,255,255,.07);
  position: relative;
}
.mg-wrap canvas { display: block; }
.mg-label {
  position: absolute;
  top: 8px; left: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: .44rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(255,255,255,.3);
  pointer-events: none;
  z-index: 10;
}
.mg-empty {
  display: flex; align-items: center; justify-content: center;
  height: 100%;
  font-family: 'JetBrains Mono', monospace;
  font-size: .48rem;
  letter-spacing: .1em;
  color: rgba(255,255,255,.2);
  text-transform: uppercase;
}
`;

export default function MiniGraph({
  allNotes,
  currentNoteId,
  width = 220,
  height = 180,
}) {
  const navigate = useNavigate();
  const graphRef = useRef(null);

  // Build graph data from allNotes
  const { graphData, neighborSet } = useMemo(() => {
    if (!allNotes?.length)
      return { graphData: { nodes: [], links: [] }, neighborSet: new Set() };

    const noteSet = new Set(allNotes.map((n) => n.id));

    // Compute connection counts
    const connCount = new Map();
    const blCount = new Map();
    allNotes.forEach((n) => {
      const links = Array.isArray(n.links) ? n.links : [];
      links.forEach((tid) => {
        if (!noteSet.has(tid)) return;
        connCount.set(n.id, (connCount.get(n.id) || 0) + 1);
        connCount.set(tid, (connCount.get(tid) || 0) + 1);
        blCount.set(tid, (blCount.get(tid) || 0) + 1);
      });
    });

    const nodes = allNotes.map((n) => ({
      id: n.id,
      title: n.title || 'Untitled',
      subject: n.subject || '',
      connectionCount: connCount.get(n.id) || 0,
      backlinkCount: blCount.get(n.id) || 0,
    }));

    // Edges
    const seen = new Set();
    const links = [];
    allNotes.forEach((n) => {
      (Array.isArray(n.links) ? n.links : []).forEach((tid) => {
        if (!noteSet.has(tid)) return;
        const key = `${n.id}::${tid}`;
        if (!seen.has(key)) {
          seen.add(key);
          links.push({ source: n.id, target: tid });
        }
      });
    });

    // 1-hop neighbours of current note
    const neighbors = new Set();
    if (currentNoteId) {
      neighbors.add(currentNoteId);
      links.forEach((l) => {
        const s = l.source?.id ?? l.source;
        const t = l.target?.id ?? l.target;
        if (s === currentNoteId) neighbors.add(t);
        if (t === currentNoteId) neighbors.add(s);
      });
    }

    return {
      graphData: { nodes, links },
      neighborSet: neighbors,
    };
  }, [allNotes, currentNoteId]);

  // Fit on mount / data change
  useEffect(() => {
    const t = setTimeout(() => {
      graphRef.current?.zoomToFit(300, 20);
    }, 350);
    return () => clearTimeout(t);
  }, [graphData]);

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      // 🛑 HARD GUARD — positions must exist
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
        return;
      }

      // 🛑 SAFE DATA
      const safeConnections = Number.isFinite(node.connectionCount)
        ? node.connectionCount
        : 0;

      const safeBacklinks = Number.isFinite(node.backlinkCount)
        ? node.backlinkCount
        : 0;

      // 🛑 SAFE RADIUS
      const rawR = 3 + Math.min(safeConnections + safeBacklinks, 14) * 0.7;
      const r = Math.max(rawR, 0.5); // never 0

      const hue = getHue(node);
      const isCurrent = node.id === currentNoteId;
      const isNeighbor = neighborSet.has(node.id);

      const alpha = neighborSet.size === 0 || isNeighbor ? 1 : 0.18;
      const fillAlpha = isCurrent ? 1 : isNeighbor ? 0.78 : 0.18;

      // 🛑 SAFE GRADIENT RADII
      const innerR = Math.max(r * 0.2, 0.1);
      const outerR = Math.max(r * 3, 0.5);

      // Glow for current note
      if (isCurrent) {
        const grd = ctx.createRadialGradient(
          node.x,
          node.y,
          innerR,
          node.x,
          node.y,
          outerR,
        );

        grd.addColorStop(0, `hsla(${hue},85%,65%,0.5)`);
        grd.addColorStop(1, `hsla(${hue},85%,65%,0)`);

        ctx.beginPath();
        ctx.arc(node.x, node.y, outerR, 0, 2 * Math.PI);
        ctx.fillStyle = grd;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(r + 2.5, 0.5), 0, 2 * Math.PI);
        ctx.strokeStyle = `hsla(${hue},80%,70%,0.95)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Body
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(${hue},70%,60%,${fillAlpha})`;
      ctx.fill();

      // Rim
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.strokeStyle = `hsla(${hue},80%,80%,${alpha * 0.35})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Label — only for current + neighbours at low zoom
      const showLabel = isCurrent || (isNeighbor && globalScale > 1.4);
      if (showLabel) {
        const fs = Math.max(8 / globalScale, 2);
        ctx.font = `500 ${fs}px 'Cabinet Grotesk', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label =
          node.title.length > 16 ? node.title.slice(0, 14) + '…' : node.title;
        const tw = ctx.measureText(label).width;
        const ty = node.y + r + fs + 1;
        ctx.fillStyle = `rgba(7,6,9,0.75)`;
        ctx.fillRect(node.x - tw / 2 - 2, ty - fs / 2 - 1, tw + 4, fs + 3);
        ctx.fillStyle = isCurrent
          ? `hsla(${hue},85%,72%,0.95)`
          : `rgba(255,255,255,0.75)`;
        ctx.fillText(label, node.x, ty);
      }
    },
    [currentNoteId, neighborSet],
  );

  const paintLink = useCallback(
    (link, ctx) => {
      const source = link.source;
      const target = link.target;

      // 🛑 SAFETY
      if (
        !Number.isFinite(source?.x) ||
        !Number.isFinite(source?.y) ||
        !Number.isFinite(target?.x) ||
        !Number.isFinite(target?.y)
      ) {
        return;
      }

      const s = source.id ?? source;
      const t = target.id ?? target;

      const isActive =
        neighborSet.size > 0 && (s === currentNoteId || t === currentNoteId);

      const hasFocus = neighborSet.size > 0;

      // 🎨 COLOR BASED ON SOURCE NODE
      const hue = getHue(source);

      // ✨ BETTER VISIBILITY
      const baseAlpha = 0.5;

      ctx.globalAlpha = isActive ? 1 : hasFocus ? 0.1 : baseAlpha;

      // 🌈 GRADIENT (same as main graph)
      const gradient = ctx.createLinearGradient(
        source.x,
        source.y,
        target.x,
        target.y,
      );

      gradient.addColorStop(0, `hsla(${hue},80%,65%,0.9)`);
      gradient.addColorStop(1, `hsla(${hue},70%,55%,0.4)`);

      ctx.strokeStyle = gradient;

      ctx.lineWidth = isActive ? 1.6 : 0.9;

      // DRAW
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // ✨ SUBTLE GLOW
      if (isActive || !hasFocus) {
        ctx.shadowColor = `hsla(${hue},90%,70%,0.6)`;
        ctx.shadowBlur = isActive ? 8 : 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
    },
    [currentNoteId, neighborSet],
  );

  if (!allNotes?.length) return null;

  return (
    <div className="mg-wrap" style={{ height }}>
      <style>{CSS}</style>
      <div className="mg-label">Graph</div>
      {graphData.nodes.length === 0 ? (
        <div className="mg-empty">No notes</div>
      ) : (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeId="id"
          width={width}
          height={height}
          backgroundColor="transparent"
          nodeLabel={() => ''}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR(node) + 3, 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={paintLink}
          linkCurvature={0.2}
          d3AlphaDecay={0.04}
          d3VelocityDecay={0.5}
          cooldownTicks={80}
          onNodeClick={(node) => navigate(`/notes/${node.id}`)}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      )}
    </div>
  );
}
