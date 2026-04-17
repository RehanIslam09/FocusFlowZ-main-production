// src/components/GraphView.jsx
/**
 * GraphView — Full Obsidian-style interactive knowledge graph.
 * Phase 6 — Connection fix + visual upgrade.
 *
 * Key fixes:
 *  - Edges use string IDs (not objects) in graphData.links so
 *    react-force-graph-2d resolves them correctly every time.
 *  - Node painter uses post-simulation node.x/y (always numbers).
 *  - Link painter resets globalAlpha after each draw (no bleed).
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import useSupabase from '../hooks/useSupabase';
import useGraphData from '../hooks/useGraphData';
import {
  ArrowLeft,
  Search,
  Tag,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Network,
  X,
  Info,
} from 'lucide-react';

/* ═══ Palette ═══ */
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

function getNodeHue(node) {
  const key = (node.subject || node.title || '').toLowerCase();
  for (const p of SUBJECT_ACCENTS) {
    if (p.keys.some((k) => key.includes(k))) return p.hue;
  }
  return ((node.subject || node.title || 'N').charCodeAt(0) * 137) % 360;
}

function nodeColor(node, alpha = 1) {
  return `hsla(${getNodeHue(node)},70%,62%,${alpha})`;
}

function nodeRadius(node) {
  return (
    5 +
    Math.min((node.connectionCount || 0) + (node.backlinkCount || 0), 20) * 0.85
  );
}

/* ═══ CSS ═══ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800&family=JetBrains+Mono:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap');
:root{--gold:#c4913a;--gold2:#e8b96a;--f-display:'Cormorant Garamond',Georgia,serif;--f-ui:'Cabinet Grotesk',sans-serif;--f-mono:'JetBrains Mono',monospace;--ease:cubic-bezier(.16,1,.3,1);--spring:cubic-bezier(.34,1.56,.64,1);}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

.gv{width:100vw;height:100vh;background:radial-gradient(ellipse at 18% 28%,#0f0a1e 0%,#070609 45%,#060d0a 100%);display:flex;flex-direction:column;overflow:hidden;position:relative;font-family:var(--f-ui);}
.gv-canvas{flex:1;position:relative;overflow:hidden;}
.gv-canvas canvas{display:block;}

/* Topbar */
.gv-topbar{position:absolute;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;gap:12px;padding:14px 20px;background:linear-gradient(to bottom,rgba(7,6,9,.92) 0%,transparent 100%);pointer-events:none;}
.gv-topbar>*{pointer-events:auto;}
.gv-back-btn{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 12px;cursor:pointer;transition:all .2s;flex-shrink:0;}
.gv-back-btn:hover{color:rgba(255,255,255,.9);border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.1);}
.gv-title{font-family:var(--f-display);font-size:1.1rem;font-weight:300;color:rgba(255,255,255,.7);letter-spacing:-.01em;display:flex;align-items:center;gap:8px;}
.gv-title em{font-style:italic;color:var(--gold);}
.gv-title-meta{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.1em;color:rgba(255,255,255,.3);text-transform:uppercase;}
.gv-spacer{flex:1;}

/* Controls */
.gv-controls{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:6px;background:rgba(10,8,14,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:8px 12px;box-shadow:0 8px 32px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06);}
.gv-ctrl-btn{width:32px;height:32px;border-radius:9px;background:transparent;border:1px solid transparent;color:rgba(255,255,255,.45);cursor:pointer;display:grid;place-items:center;transition:all .15s;flex-shrink:0;}
.gv-ctrl-btn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);color:rgba(255,255,255,.9);}
.gv-ctrl-btn.active{background:rgba(196,145,58,.18);border-color:rgba(196,145,58,.35);color:var(--gold);}
.gv-ctrl-divider{width:1px;height:20px;background:rgba(255,255,255,.1);margin:0 2px;}

/* Search */
.gv-search-wrap{position:absolute;top:70px;right:20px;z-index:100;display:flex;flex-direction:column;gap:6px;width:260px;}
.gv-search-inner{display:flex;align-items:center;gap:7px;background:rgba(10,8,14,.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 12px;transition:border-color .2s;}
.gv-search-inner:focus-within{border-color:rgba(196,145,58,.5);}
.gv-search-icon{color:rgba(255,255,255,.3);flex-shrink:0;}
.gv-search-input{flex:1;background:transparent;border:none;outline:none;font-family:var(--f-ui);font-size:.82rem;color:rgba(255,255,255,.85);min-width:0;}
.gv-search-input::placeholder{color:rgba(255,255,255,.25);}
.gv-search-clear{background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;padding:0;display:flex;align-items:center;transition:color .15s;flex-shrink:0;}
.gv-search-clear:hover{color:rgba(255,255,255,.7);}
.gv-search-results{background:rgba(10,8,14,.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden;max-height:240px;overflow-y:auto;}
.gv-search-results::-webkit-scrollbar{width:3px;}
.gv-search-results::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px;}
.gv-search-item{display:flex;align-items:center;gap:9px;padding:9px 12px;width:100%;border:none;background:transparent;cursor:pointer;text-align:left;transition:background .1s;border-bottom:1px solid rgba(255,255,255,.05);}
.gv-search-item:last-child{border-bottom:none;}
.gv-search-item:hover{background:rgba(255,255,255,.06);}
.gv-search-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.gv-search-label{font-family:var(--f-ui);font-size:.8rem;color:rgba(255,255,255,.8);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gv-search-meta{font-family:var(--f-mono);font-size:.46rem;color:rgba(255,255,255,.3);flex-shrink:0;}

/* Tooltip */
.gv-tooltip{position:fixed;z-index:200;background:rgba(10,8,14,.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;pointer-events:none;min-width:160px;max-width:240px;box-shadow:0 8px 28px rgba(0,0,0,.6);animation:gv-tip-in .15s var(--spring);}
@keyframes gv-tip-in{from{opacity:0;transform:scale(.92) translateY(4px)}to{opacity:1;transform:none}}
.gv-tooltip-title{font-family:var(--f-ui);font-size:.88rem;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gv-tooltip-row{display:flex;align-items:center;gap:5px;font-family:var(--f-mono);font-size:.48rem;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-top:2px;}
.gv-tooltip-badge{padding:1px 7px;border-radius:10px;font-family:var(--f-mono);font-size:.46rem;letter-spacing:.06em;}
.gv-tooltip-hint{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-family:var(--f-mono);font-size:.46rem;color:rgba(255,255,255,.25);letter-spacing:.06em;}

/* Stats */
.gv-stats{position:absolute;top:70px;left:20px;z-index:100;display:flex;flex-direction:column;gap:5px;}
.gv-stat-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(10,8,14,.78);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:5px 10px;font-family:var(--f-mono);font-size:.5rem;letter-spacing:.08em;color:rgba(255,255,255,.4);}
.gv-stat-pill strong{color:rgba(255,255,255,.75);font-weight:500;}

/* Selected panel */
.gv-selected-panel{position:absolute;bottom:90px;left:20px;z-index:100;width:240px;background:rgba(10,8,14,.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;animation:gv-panel-in .22s var(--spring);}
@keyframes gv-panel-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
.gv-panel-color-bar{height:3px;}
.gv-panel-body{padding:12px 14px;position:relative;}
.gv-panel-title{font-family:var(--f-ui);font-size:.9rem;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gv-panel-subject{font-family:var(--f-mono);font-size:.5rem;letter-spacing:.08em;color:rgba(255,255,255,.4);margin-bottom:10px;}
.gv-panel-stats{display:flex;gap:8px;margin-bottom:12px;}
.gv-panel-stat{flex:1;background:rgba(255,255,255,.05);border-radius:7px;padding:6px;text-align:center;}
.gv-panel-stat-val{font-family:var(--f-display);font-size:1.3rem;font-weight:300;color:var(--gold);line-height:1;}
.gv-panel-stat-label{font-family:var(--f-mono);font-size:.42rem;letter-spacing:.08em;color:rgba(255,255,255,.3);text-transform:uppercase;margin-top:2px;}
.gv-panel-open-btn{width:100%;padding:8px;border:none;border-radius:8px;background:var(--gold);color:#0c0b09;font-family:var(--f-mono);font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .2s var(--spring);display:flex;align-items:center;justify-content:center;gap:6px;}
.gv-panel-open-btn:hover{background:var(--gold2);transform:translateY(-1px);box-shadow:0 4px 14px rgba(196,145,58,.3);}
.gv-panel-close{position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:5px;background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.4);cursor:pointer;display:grid;place-items:center;transition:all .12s;}
.gv-panel-close:hover{background:rgba(255,255,255,.15);color:rgba(255,255,255,.8);}

/* Empty / Loading */
.gv-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;z-index:50;}
.gv-empty-glyph{font-family:var(--f-display);font-size:4rem;color:var(--gold);opacity:.25;}
.gv-empty-title{font-family:var(--f-display);font-size:1.5rem;font-weight:300;color:rgba(255,255,255,.5);}
.gv-empty-sub{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.1em;color:rgba(255,255,255,.25);max-width:280px;line-height:1.8;}
.gv-loading{position:absolute;inset:0;display:grid;place-items:center;z-index:50;}
.gv-loading-ring{width:40px;height:40px;border-radius:50%;border:2px solid rgba(196,145,58,.15);border-top-color:var(--gold);animation:gv-spin .9s linear infinite;margin:0 auto 14px;}
@keyframes gv-spin{to{transform:rotate(360deg)}}
.gv-loading-text{font-family:var(--f-mono);font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.3);}
`;

/* ═══ Node canvas painter ═══ */
function paintNode(
  node,
  ctx,
  globalScale,
  { hoveredId, selectedId, highlightSet, showLabels },
) {
  // 🛑 HARD GUARD — REQUIRED
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
  const rawR = 5 + Math.min(safeConnections + safeBacklinks, 20) * 0.85;
  const r = Math.max(rawR, 0.5);

  const hue = getNodeHue(node);

  const isHovered = node.id === hoveredId;
  const isSelected = node.id === selectedId;
  const isLit = highlightSet.size === 0 || highlightSet.has(node.id);

  const bodyAlpha = isLit ? (isHovered || isSelected ? 1 : 0.88) : 0.1;

  // 🛑 SAFE GRADIENT RADII
  const innerR = Math.max(r * 0.2, 0.1);
  const outerR = Math.max(r * 3, 0.5);

  // Glow
  if (isHovered || isSelected) {
    const gr = ctx.createRadialGradient(
      node.x,
      node.y,
      innerR,
      node.x,
      node.y,
      outerR,
    );

    gr.addColorStop(0, `hsla(${hue},85%,65%,0.5)`);
    gr.addColorStop(1, `hsla(${hue},85%,65%,0)`);

    ctx.beginPath();
    ctx.arc(node.x, node.y, outerR, 0, 2 * Math.PI);
    ctx.fillStyle = gr;
    ctx.fill();
  }

  // Selection ring
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, Math.max(r + 3.5, 0.5), 0, 2 * Math.PI);
    ctx.strokeStyle = `hsla(${hue},85%,72%,0.9)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 🛑 SAFE BODY GRADIENT
  const bg = ctx.createRadialGradient(
    node.x - r * 0.3,
    node.y - r * 0.3,
    Math.max(r * 0.05, 0.1),
    node.x,
    node.y,
    r,
  );

  bg.addColorStop(0, `hsla(${hue},72%,74%,${bodyAlpha})`);
  bg.addColorStop(1, `hsla(${hue},65%,46%,${bodyAlpha})`);

  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
  ctx.fillStyle = bg;
  ctx.fill();

  // Rim
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
  ctx.strokeStyle = `hsla(${hue},80%,82%,${isLit ? 0.38 : 0.06})`;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Label
  const fs = Math.max(10 / globalScale, 2.2);
  const shouldLabel =
    showLabels ||
    isHovered ||
    isSelected ||
    globalScale > 2.2 ||
    safeConnections > 4;

  if (shouldLabel && fs > 1.5) {
    const label =
      node.title.length > 22 ? node.title.slice(0, 20) + '…' : node.title;

    ctx.font = `500 ${fs}px 'Cabinet Grotesk', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tw = ctx.measureText(label).width;
    const ty = node.y + r + fs + 2;
    const la = isLit ? 1 : 0.08;
    // Pill bg
    const pad = 3;
    ctx.fillStyle = `rgba(7,6,9,${la * 0.78})`;
    ctx.fillRect(node.x - tw / 2 - 3, ty - fs / 2 - 2, tw + 6, fs + 4);
    ctx.beginPath();
    const bx = node.x - tw / 2 - pad,
      by = ty - fs / 2 - 1.5;
    const bw = tw + pad * 2,
      bh = fs + 4,
      br = 3;
    ctx.moveTo(bx + br, by);
    ctx.lineTo(bx + bw - br, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(bx + br, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br);
    ctx.quadraticCurveTo(bx, by, bx + br, by);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${la * 0.88})`;
    ctx.fillText(label, node.x, ty);
  }
}

/* ═══ Link canvas painter ═══ */
function paintLink(link, ctx, highlightLinks) {
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

  const isLit = highlightLinks.has(link);
  const hasFocus = highlightLinks.size > 0;

  // 🎨 COLOR BASED ON SOURCE NODE (THIS IS THE MAGIC)
  const hue = getNodeHue(source);

  // ✨ BASE VISIBILITY (stronger than before)
  const baseAlpha = 0.45;

  ctx.globalAlpha = isLit ? 1 : hasFocus ? 0.12 : baseAlpha;

  // 🌈 GRADIENT LINE (INSANE UPGRADE)
  const gradient = ctx.createLinearGradient(
    source.x,
    source.y,
    target.x,
    target.y,
  );

  gradient.addColorStop(0, `hsla(${hue}, 80%, 65%, 0.9)`);
  gradient.addColorStop(1, `hsla(${hue}, 70%, 55%, 0.4)`);

  ctx.strokeStyle = gradient;

  // ✨ THICKER = more premium
  ctx.lineWidth = isLit ? 2 : 1.2;

  // DRAW LINE
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();

  // ✨ GLOW (this makes it POP)
  if (isLit || !hasFocus) {
    ctx.shadowColor = `hsla(${hue}, 90%, 70%, 0.6)`;
    ctx.shadowBlur = isLit ? 10 : 4;

    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  ctx.globalAlpha = 1;
}

/* ═══ Main ═══ */
export default function GraphView() {
  const navigate = useNavigate();
  const { supabase } = useSupabase();

  const [allNotes, setAllNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('user_notes')
        .select('id,title,subject,tags,links,card_style')
        .order('title');
      setAllNotes(data || []);
      setLoading(false);
    })();
  }, [supabase]);

  const { nodes, edges } = useGraphData(allNotes);

  /* ── Interaction state ── */
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [showLabels, setShowLabels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      setContainerSize({
        w: e.contentRect.width,
        h: e.contentRect.height,
      });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  /* ── Adjacency maps ── */
  const adjacency = useMemo(() => {
    const nodeAdj = new Map(); // id → Set<id>
    const linkAdj = new Map(); // id → Set<link>
    edges.forEach((link) => {
      const s = link.source?.id ?? link.source;
      const t = link.target?.id ?? link.target;
      if (!nodeAdj.has(s)) nodeAdj.set(s, new Set());
      if (!nodeAdj.has(t)) nodeAdj.set(t, new Set());
      nodeAdj.get(s).add(t);
      nodeAdj.get(t).add(s);
      if (!linkAdj.has(s)) linkAdj.set(s, new Set());
      if (!linkAdj.has(t)) linkAdj.set(t, new Set());
      linkAdj.get(s).add(link);
      linkAdj.get(t).add(link);
    });
    return { nodeAdj, linkAdj };
  }, [edges]);

  /* ── Hover ── */
  const handleNodeHover = useCallback(
    (node, _prev, event) => {
      setHoveredNode(node || null);
      if (node) {
        const neighbors = adjacency.nodeAdj.get(node.id) || new Set();
        setHighlightNodes(new Set([node.id, ...neighbors]));
        setHighlightLinks(new Set(adjacency.linkAdj.get(node.id) || []));
        if (event) setTooltipPos({ x: event.clientX, y: event.clientY });
      } else if (!selectedNode) {
        setHighlightNodes(new Set());
        setHighlightLinks(new Set());
      }
    },
    [adjacency, selectedNode],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (hoveredNode) setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    [hoveredNode],
  );

  /* ── Click ── */
  const handleNodeClick = useCallback(
    (node) => {
      setSelectedNode((prev) => {
        if (prev?.id === node.id) {
          setHighlightNodes(new Set());
          setHighlightLinks(new Set());
          return null;
        }
        const neighbors = adjacency.nodeAdj.get(node.id) || new Set();
        setHighlightNodes(new Set([node.id, ...neighbors]));
        setHighlightLinks(new Set(adjacency.linkAdj.get(node.id) || []));
        return node;
      });
      graphRef.current?.centerAt(node.x, node.y, 600);
      graphRef.current?.zoom(2.8, 600);
    },
    [adjacency],
  );

  /* ── Search ── */
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return nodes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.subject?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [searchQuery, nodes]);

  const handleSearchSelect = useCallback(
    (node) => {
      setSearchQuery('');
      setSelectedNode(node);
      const liveNode = graphRef.current
        ?.graphData()
        ?.nodes?.find((n) => n.id === node.id);
      if (liveNode) {
        graphRef.current?.centerAt(liveNode.x, liveNode.y, 700);
        graphRef.current?.zoom(3.2, 700);
      }
      const neighbors = adjacency.nodeAdj.get(node.id) || new Set();
      setHighlightNodes(new Set([node.id, ...neighbors]));
      setHighlightLinks(new Set(adjacency.linkAdj.get(node.id) || []));
    },
    [adjacency],
  );

  /* ── Controls ── */
  const handleZoomIn = () =>
    graphRef.current?.zoom((graphRef.current.zoom() || 1) * 1.4, 300);
  const handleZoomOut = () =>
    graphRef.current?.zoom((graphRef.current.zoom() || 1) / 1.4, 300);
  const handleReset = useCallback(() => {
    graphRef.current?.zoomToFit(500, 60);
    setSelectedNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  /* ── Stable graphData ──
     CRITICAL: pass plain string IDs in links so force-graph resolves nodes correctly.
     After simulation starts, source/target become node objects — we handle both. */
  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    }),
    [nodes, edges],
  );

  /* ── Painters bound to interaction state ── */
  const nodePainter = useCallback(
    (node, ctx, globalScale) => {
      paintNode(node, ctx, globalScale, {
        hoveredId: hoveredNode?.id ?? null,
        selectedId: selectedNode?.id ?? null,
        highlightSet: highlightNodes,
        showLabels,
      });
    },
    [hoveredNode, selectedNode, highlightNodes, showLabels],
  );

  const linkPainter = useCallback(
    (link, ctx) => paintLink(link, ctx, highlightLinks),
    [highlightLinks],
  );

  /* ── Fit on load ── */
  useEffect(() => {
    if (!loading && nodes.length > 0) {
      const t = setTimeout(() => graphRef.current?.zoomToFit(800, 80), 450);
      return () => clearTimeout(t);
    }
  }, [loading, nodes.length]);

  /* ── Keyboard ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (selectedNode) {
          setSelectedNode(null);
          setHighlightNodes(new Set());
          setHighlightLinks(new Set());
        } else {
          navigate('/notes');
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        document.querySelector('.gv-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNode, navigate]);

  const selHue = selectedNode ? getNodeHue(selectedNode) : 0;

  return (
    <div className="gv" onMouseMove={handleMouseMove}>
      <style>{CSS}</style>

      {/* Topbar */}
      <div className="gv-topbar">
        <button className="gv-back-btn" onClick={() => navigate('/notes')}>
          <ArrowLeft size={11} /> Notes
        </button>
        <div className="gv-title">
          <Network size={14} style={{ opacity: 0.6 }} />
          Knowledge <em>Graph</em>
          <span className="gv-title-meta">
            {nodes.length} notes · {edges.length} connections
          </span>
        </div>
        <div className="gv-spacer" />
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="gv-canvas">
        {loading ? (
          <div className="gv-loading">
            <div className="gv-loading-ring" />
            <div className="gv-loading-text">Building graph…</div>
          </div>
        ) : nodes.length === 0 ? (
          <div className="gv-empty">
            <div className="gv-empty-glyph">✦</div>
            <div className="gv-empty-title">No connections yet</div>
            <div className="gv-empty-sub">
              Link notes with [[double brackets]] to grow your knowledge
              network.
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeId="id"
            linkSource="source"
            linkTarget="target"
            d3AlphaDecay={0.018}
            d3VelocityDecay={0.28}
            cooldownTicks={140}
            warmupTicks={80}
            nodeCanvasObject={nodePainter}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeRadius(node) + 5, 0, 2 * Math.PI);
              ctx.fill();
            }}
            linkCanvasObjectMode={() => 'after'}
            linkCanvasObject={linkPainter}
            linkCurvature={0.18}
            linkDirectionalArrowLength={0}
            backgroundColor="transparent"
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            nodeLabel={() => ''}
            width={containerSize.w || undefined}
            height={containerSize.h || undefined}
          />
        )}
      </div>

      {/* Stats */}
      {!loading && nodes.length > 0 && (
        <div className="gv-stats">
          <div className="gv-stat-pill">
            <Network size={10} />
            <strong>{nodes.length}</strong> notes
          </div>
          <div className="gv-stat-pill">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'rgba(196,145,58,.6)',
                display: 'inline-block',
              }}
            />
            <strong>{edges.length}</strong> links
          </div>
          {nodes.filter((n) => n.connectionCount === 0).length > 0 && (
            <div className="gv-stat-pill">
              <Info size={10} style={{ opacity: 0.5 }} />
              <strong>
                {nodes.filter((n) => n.connectionCount === 0).length}
              </strong>{' '}
              isolated
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="gv-search-wrap">
        <div className="gv-search-inner">
          <Search size={13} className="gv-search-icon" />
          <input
            className="gv-search-input"
            placeholder="Find note… (⌘F)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          />
          {searchQuery && (
            <button
              className="gv-search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>
        {searchResults.length > 0 && (searchFocused || searchQuery) && (
          <div className="gv-search-results">
            {searchResults.map((n) => (
              <button
                key={n.id}
                className="gv-search-item"
                onMouseDown={() => handleSearchSelect(n)}
              >
                <span
                  className="gv-search-dot"
                  style={{ background: nodeColor(n) }}
                />
                <span className="gv-search-label">{n.title}</span>
                {n.connectionCount > 0 && (
                  <span className="gv-search-meta">
                    {n.connectionCount} links
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="gv-controls">
        <button className="gv-ctrl-btn" onClick={handleZoomIn} title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button
          className="gv-ctrl-btn"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <div className="gv-ctrl-divider" />
        <button
          className="gv-ctrl-btn"
          onClick={handleReset}
          title="Reset view"
        >
          <RotateCcw size={14} />
        </button>
        <button
          className="gv-ctrl-btn"
          onClick={() => graphRef.current?.zoomToFit(500, 40)}
          title="Fit"
        >
          <Maximize2 size={14} />
        </button>
        <div className="gv-ctrl-divider" />
        <button
          className={`gv-ctrl-btn ${showLabels ? 'active' : ''}`}
          onClick={() => setShowLabels((s) => !s)}
          title="Toggle labels"
        >
          {showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && !selectedNode && (
        <div
          className="gv-tooltip"
          style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 10 }}
        >
          <div className="gv-tooltip-title">{hoveredNode.title}</div>
          {hoveredNode.subject && (
            <div className="gv-tooltip-row">
              <Tag size={9} /> {hoveredNode.subject}
            </div>
          )}
          <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
            <span
              className="gv-tooltip-badge"
              style={{
                background: nodeColor(hoveredNode, 0.14),
                border: `1px solid ${nodeColor(hoveredNode, 0.4)}`,
                color: nodeColor(hoveredNode),
              }}
            >
              {hoveredNode.connectionCount} links
            </span>
            {hoveredNode.backlinkCount > 0 && (
              <span
                className="gv-tooltip-badge"
                style={{
                  background: 'rgba(91,143,204,.12)',
                  border: '1px solid rgba(91,143,204,.35)',
                  color: '#7aaee0',
                }}
              >
                {hoveredNode.backlinkCount} backlinks
              </span>
            )}
          </div>
          <div className="gv-tooltip-hint">
            Click to select · drag to reposition
          </div>
        </div>
      )}

      {/* Selected panel */}
      {selectedNode && (
        <div className="gv-selected-panel">
          <div
            className="gv-panel-color-bar"
            style={{
              background: `linear-gradient(90deg,hsl(${selHue},70%,50%),hsl(${(selHue + 60) % 360},60%,55%))`,
            }}
          />
          <div className="gv-panel-body">
            <button
              className="gv-panel-close"
              onClick={() => {
                setSelectedNode(null);
                setHighlightNodes(new Set());
                setHighlightLinks(new Set());
              }}
            >
              <X size={10} />
            </button>
            <div className="gv-panel-title">{selectedNode.title}</div>
            {selectedNode.subject && (
              <div className="gv-panel-subject">{selectedNode.subject}</div>
            )}
            <div className="gv-panel-stats">
              <div className="gv-panel-stat">
                <div className="gv-panel-stat-val">
                  {selectedNode.connectionCount}
                </div>
                <div className="gv-panel-stat-label">Links</div>
              </div>
              <div className="gv-panel-stat">
                <div className="gv-panel-stat-val">
                  {selectedNode.backlinkCount}
                </div>
                <div className="gv-panel-stat-label">Backlinks</div>
              </div>
            </div>
            <button
              className="gv-panel-open-btn"
              onClick={() => navigate(`/notes/${selectedNode.id}`)}
            >
              Open Note →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
