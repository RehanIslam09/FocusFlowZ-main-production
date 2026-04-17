/**
 * SubjectBreakdown.jsx
 *
 * Drop-in replacement for the plain subject breakdown card in FocusInsights.
 *
 * Props:
 *   subjectBreakdown  – array of { name, mins, pct } (already computed in stats)
 *   sessions          – full sessions array (for computing per-subject analytics)
 *   isDark            – boolean
 *
 * What it computes:
 *   - Per-subject: total mins, sessions, completion rate, avg duration,
 *     difficulty distribution, streak (consecutive days), focus score avg
 *   - Overall: dominant subject, most improved (recent vs historic)
 *   - Donut chart via Chart.js (right side)
 *   - Left side: ranked breakdown rows with rich micro-stats
 */

import { useMemo, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  TrendingUp,
  CheckCircle2,
  Clock,
  Flame,
  Zap,
  Award,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════
   SUBJECT COLOR PALETTE — deterministic per subject name
══════════════════════════════════════════════════════════ */
const PALETTE = [
  '#c4913a', // gold
  '#9b6bae', // purple
  '#5b8fa8', // blue
  '#6b9e6b', // green
  '#b87a5a', // brown
  '#c06b8a', // pink
  '#6b8aca', // indigo
  '#5a8a9b', // teal
  '#c09040', // amber
  '#8a6bae', // violet
];

function subjectColor(name, index) {
  return PALETTE[index % PALETTE.length];
}

/* ══════════════════════════════════════════════════════════
   ANALYTICS ENGINE
══════════════════════════════════════════════════════════ */
function calcFocusScore(session) {
  let score = 60;
  if (session.completed || session.is_completed) score += 20;
  const dur = session.duration || 0;
  if (dur >= 90) score += 10;
  else if (dur >= 45) score += 7;
  else if (dur >= 25) score += 4;
  if (session.difficulty === 'hard') score += 10;
  else if (session.difficulty === 'medium') score += 5;
  if (session.ai_plan?.steps?.length > 0) score += 5;
  return Math.min(100, score);
}

function fmtMins(m) {
  if (!m) return '0m';
  const h = Math.floor(m / 60),
    r = m % 60;
  return h ? `${h}h${r > 0 ? ` ${r}m` : ''}` : `${r}m`;
}

function computeSubjectStats(name, sessions) {
  const ss = sessions.filter((s) => s.subject === name);
  if (!ss.length) return null;

  const total = ss.length;
  const totalMins = ss.reduce((a, s) => a + (s.duration || 0), 0);
  const avgDuration = Math.round(totalMins / total);
  const completed = ss.filter((s) => s.completed || s.is_completed).length;
  const completionRate = Math.round((completed / total) * 100);
  const avgScore = Math.round(
    ss.reduce((a, s) => a + calcFocusScore(s), 0) / total,
  );

  const diffMap = { easy: 0, medium: 0, hard: 0 };
  ss.forEach((s) => {
    const d = (s.difficulty || '').toLowerCase();
    if (diffMap[d] !== undefined) diffMap[d]++;
  });

  // Dominant difficulty
  const domDiff = Object.entries(diffMap).sort((a, b) => b[1] - a[1])[0][0];

  // Activity days (unique ISO dates)
  const days = new Set(
    ss.map((s) => new Date(s.created_at).toISOString().slice(0, 10)),
  );

  // Recent 7d vs prior 7d: momentum
  const now = new Date();
  const sevenBack = new Date(now);
  sevenBack.setDate(now.getDate() - 7);
  const fourteenBack = new Date(now);
  fourteenBack.setDate(now.getDate() - 14);
  const recentMins = ss
    .filter((s) => new Date(s.created_at) >= sevenBack)
    .reduce((a, s) => a + (s.duration || 0), 0);
  const priorMins = ss
    .filter(
      (s) =>
        new Date(s.created_at) >= fourteenBack &&
        new Date(s.created_at) < sevenBack,
    )
    .reduce((a, s) => a + (s.duration || 0), 0);
  const momentum =
    priorMins === 0
      ? recentMins > 0
        ? 100
        : 0
      : Math.round(((recentMins - priorMins) / priorMins) * 100);

  // Streak
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) streak++;
    else if (i > 0) break;
  }

  return {
    total,
    totalMins,
    avgDuration,
    completed,
    completionRate,
    avgScore,
    domDiff,
    momentum,
    streak,
    days: days.size,
    diffMap,
  };
}

/* ══════════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════════ */
const CSS = `
.sb-root {
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--r);
  overflow:hidden;
}

/* Card header */
.sb-head {
  padding:14px 20px 12px;
  border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; gap:10px;
}
.sb-head-label {
  font-family:var(--f-mono);font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ink3);display:flex;align-items:center;gap:6px;
}
.sb-head-right {
  display:flex;align-items:center;gap:8px;
}
.sb-head-stat {
  font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);
  letter-spacing:.05em; display:flex;align-items:center;gap:4px;
}
.sb-head-stat strong { color:var(--gold);font-weight:500; }

/* Body: two-column split */
.sb-body {
  display:grid;grid-template-columns:1fr 280px;
  min-height:360px;
}
@media(max-width:900px) { .sb-body { grid-template-columns:1fr; } }

/* LEFT: breakdown list */
.sb-left { padding:20px; border-right:1px solid var(--border); }
@media(max-width:900px) { .sb-left { border-right:none; border-bottom:1px solid var(--border); } }

.sb-list { display:flex;flex-direction:column;gap:16px; }

.sb-row {
  position:relative; cursor:default;
  transition:all .22s cubic-bezier(.16,1,.3,1);
}
.sb-row:hover { transform:translateX(3px); }

/* Rank + color dot + name row */
.sb-row-top {
  display:flex;align-items:center;gap:10px;margin-bottom:8px;
}
.sb-rank {
  font-family:var(--f-mono);font-size:.48rem;letter-spacing:.1em;
  color:var(--ink3);width:16px;text-align:right;flex-shrink:0;
}
.sb-color-dot {
  width:10px;height:10px;border-radius:50%;flex-shrink:0;
  transition:transform .2s;
}
.sb-row:hover .sb-color-dot { transform:scale(1.4); }
.sb-name {
  font-family:var(--f-ui);font-size:.88rem;font-weight:700;color:var(--ink);
  flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.sb-time {
  font-family:var(--f-mono);font-size:.58rem;color:var(--ink3);flex-shrink:0;
}
.sb-pct-badge {
  font-family:var(--f-mono);font-size:.5rem;letter-spacing:.06em;
  padding:2px 7px;border-radius:20px;flex-shrink:0;
  color:var(--sb-color,var(--gold));
  background:color-mix(in srgb,var(--sb-color,var(--gold)) 12%,transparent);
  border:1px solid color-mix(in srgb,var(--sb-color,var(--gold)) 30%,transparent);
}

/* Progress bar */
.sb-bar-track {
  height:5px;background:var(--border);border-radius:3px;overflow:hidden;
  margin-bottom:8px;margin-left:26px;
}
.sb-bar-fill {
  height:100%;border-radius:3px;
  transition:width 1.2s cubic-bezier(.16,1,.3,1);
}

/* Micro-stats row */
.sb-microstats {
  display:flex;gap:10px;flex-wrap:wrap;margin-left:26px;
}
.sb-micro {
  display:inline-flex;align-items:center;gap:4px;
  font-family:var(--f-mono);font-size:.5rem;letter-spacing:.04em;
  color:var(--ink3);
}
.sb-micro svg { opacity:.6;flex-shrink:0; }
.sb-micro.highlight { color:var(--sb-color,var(--gold)); }
.sb-micro.up { color:var(--green); }
.sb-micro.down { color:var(--red); }

/* Difficulty mini-bar */
.sb-diff-bar {
  display:flex;height:3px;border-radius:2px;overflow:hidden;gap:1px;width:48px;
}
.sb-diff-seg { height:100%;border-radius:1px; }

/* RIGHT: chart panel */
.sb-right {
  padding:20px;display:flex;flex-direction:column;align-items:center;gap:16px;
}
.sb-chart-title {
  font-family:var(--f-mono);font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink3);align-self:flex-start;
}
.sb-donut-wrap {
  position:relative;width:180px;height:180px;flex-shrink:0;
}
.sb-donut-center {
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;pointer-events:none;
}
.sb-donut-num {
  font-family:'Cormorant Garamond',Georgia,serif;font-size:2rem;
  font-weight:300;color:var(--ink);line-height:1;
}
.sb-donut-label {
  font-family:var(--f-mono);font-size:.44rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink3);margin-top:2px;
}

/* Legend */
.sb-legend {
  display:flex;flex-direction:column;gap:7px;width:100%;
}
.sb-legend-row {
  display:flex;align-items:center;gap:7px;cursor:default;
}
.sb-legend-dot {
  width:8px;height:8px;border-radius:2px;flex-shrink:0;
}
.sb-legend-name {
  font-family:var(--f-ui);font-size:.72rem;color:var(--ink2);
  flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.sb-legend-pct {
  font-family:var(--f-mono);font-size:.52rem;color:var(--ink3);
}

/* Top subject hero strip */
.sb-hero-strip {
  width:100%;padding:10px 14px;border-radius:8px;
  background:color-mix(in srgb,var(--sb-hero-color,var(--gold)) 8%,var(--surface2));
  border:1px solid color-mix(in srgb,var(--sb-hero-color,var(--gold)) 25%,var(--border));
  display:flex;flex-direction:column;gap:3px;
}
.sb-hero-eyebrow {
  font-family:var(--f-mono);font-size:.45rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--sb-hero-color,var(--gold));opacity:.7;
}
.sb-hero-name {
  font-family:'Cormorant Garamond',Georgia,serif;font-size:1rem;font-weight:300;
  color:var(--ink);font-style:italic;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}


.sb-root {
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--r);
  overflow:hidden;
}

/* Card header */
.sb-head {
  padding:10px 16px 9px;
  border-bottom:1px solid var(--border);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.sb-head-label {
  font-family:var(--f-mono);
  font-size:.5rem;
  letter-spacing:.15em;
  text-transform:uppercase;
  color:var(--ink3);
  display:flex;
  align-items:center;
  gap:6px;
  white-space:nowrap;
}
.sb-head-right {
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
  justify-content:flex-end;
}
.sb-head-stat {
  font-family:var(--f-mono);
  font-size:.48rem;
  color:var(--ink3);
  letter-spacing:.04em;
  display:flex;
  align-items:center;
  gap:4px;
  white-space:nowrap;
}
.sb-head-stat strong {
  color:var(--gold);
  font-weight:500;
}

/* Body: two-column split */
.sb-body {
  display:grid;
  grid-template-columns:minmax(0,1fr) 250px;
}
@media(max-width:900px) {
  .sb-body {
    grid-template-columns:1fr;
  }
}

/* LEFT: breakdown list */
.sb-left {
  padding:14px 16px 12px;
  border-right:1px solid var(--border);
}
@media(max-width:900px) {
  .sb-left {
    border-right:none;
    border-bottom:1px solid var(--border);
  }
}

.sb-list {
  display:flex;
  flex-direction:column;
  gap:12px;
}

.sb-row {
  position:relative;
  cursor:default;
  transition:transform .2s cubic-bezier(.16,1,.3,1);
}
.sb-row:hover {
  transform:translateX(2px);
}

/* Rank + color dot + name row */
.sb-row-top {
  display:flex;
  align-items:center;
  gap:8px;
  margin-bottom:5px;
}
.sb-rank {
  font-family:var(--f-mono);
  font-size:.46rem;
  letter-spacing:.08em;
  color:var(--ink3);
  width:16px;
  text-align:right;
  flex-shrink:0;
}
.sb-color-dot {
  width:9px;
  height:9px;
  border-radius:50%;
  flex-shrink:0;
  transition:transform .2s;
}
.sb-row:hover .sb-color-dot {
  transform:scale(1.25);
}
.sb-name {
  font-family:var(--f-ui);
  font-size:.84rem;
  font-weight:700;
  color:var(--ink);
  flex:1;
  min-width:0;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.sb-time {
  font-family:var(--f-mono);
  font-size:.54rem;
  color:var(--ink3);
  flex-shrink:0;
}
.sb-pct-badge {
  font-family:var(--f-mono);
  font-size:.48rem;
  letter-spacing:.05em;
  padding:2px 6px;
  border-radius:999px;
  flex-shrink:0;
  color:var(--sb-color,var(--gold));
  background:color-mix(in srgb,var(--sb-color,var(--gold)) 10%,transparent);
  border:1px solid color-mix(in srgb,var(--sb-color,var(--gold)) 24%,transparent);
}

/* Progress bar */
.sb-bar-track {
  height:4px;
  background:var(--border);
  border-radius:999px;
  overflow:hidden;
  margin-bottom:6px;
  margin-left:24px;
}
.sb-bar-fill {
  height:100%;
  border-radius:999px;
  transition:width 1.1s cubic-bezier(.16,1,.3,1);
}

/* Micro-stats row */
.sb-microstats {
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-left:24px;
}
.sb-micro {
  display:inline-flex;
  align-items:center;
  gap:4px;
  font-family:var(--f-mono);
  font-size:.48rem;
  letter-spacing:.03em;
  color:var(--ink3);
  line-height:1;
}
.sb-micro svg {
  opacity:.6;
  flex-shrink:0;
}
.sb-micro.highlight {
  color:var(--sb-color,var(--gold));
}
.sb-micro.up {
  color:var(--green);
}
.sb-micro.down {
  color:var(--red);
}

/* Difficulty mini-bar */
.sb-diff-bar {
  display:flex;
  height:3px;
  border-radius:2px;
  overflow:hidden;
  gap:1px;
  width:46px;
}
.sb-diff-seg {
  height:100%;
  border-radius:1px;
}

/* RIGHT: chart panel */
.sb-right {
  padding:14px 14px 12px;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:12px;
}
.sb-chart-title {
  font-family:var(--f-mono);
  font-size:.5rem;
  letter-spacing:.1em;
  text-transform:uppercase;
  color:var(--ink3);
  align-self:flex-start;
}

.sb-donut-wrap {
  position:relative;
  width:150px;
  height:150px;
  flex-shrink:0;
}
.sb-donut-center {
  position:absolute;
  inset:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  pointer-events:none;
}
.sb-donut-num {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:1.75rem;
  font-weight:300;
  color:var(--ink);
  line-height:1;
}
.sb-donut-label {
  font-family:var(--f-mono);
  font-size:.42rem;
  letter-spacing:.09em;
  text-transform:uppercase;
  color:var(--ink3);
  margin-top:2px;
}

/* Top subject hero strip */
.sb-hero-strip {
  width:100%;
  padding:9px 12px;
  border-radius:8px;
  background:color-mix(in srgb,var(--sb-hero-color,var(--gold)) 8%,var(--surface2));
  border:1px solid color-mix(in srgb,var(--sb-hero-color,var(--gold)) 25%,var(--border));
  display:flex;
  flex-direction:column;
  gap:2px;
}
.sb-hero-eyebrow {
  font-family:var(--f-mono);
  font-size:.43rem;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:var(--sb-hero-color,var(--gold));
  opacity:.7;
}
.sb-hero-name {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:.95rem;
  font-weight:300;
  color:var(--ink);
  font-style:italic;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* Legend */
.sb-legend {
  display:flex;
  flex-direction:column;
  gap:6px;
  width:100%;
}
.sb-legend-row {
  display:flex;
  align-items:center;
  gap:7px;
  cursor:default;
}
.sb-legend-dot {
  width:7px;
  height:7px;
  border-radius:2px;
  flex-shrink:0;
}
.sb-legend-name {
  font-family:var(--f-ui);
  font-size:.68rem;
  color:var(--ink2);
  flex:1;
  min-width:0;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.sb-legend-pct {
  font-family:var(--f-mono);
  font-size:.48rem;
  color:var(--ink3);
}

/* ═══════════════════════════════════════
   COMPACT RIGHT PANEL PATCH (1–5)
═══════════════════════════════════════ */

/* 1. Compact right panel */
.sb-right {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10px;
}

/* 2. Smaller donut */
.sb-donut-wrap {
  position: relative;
  width: 110px;
  height: 110px;
  flex-shrink: 0;
}

.sb-donut-num {
  font-size: 1.4rem;
}

.sb-donut-label {
  font-size: .38rem;
}

/* 3. Tighten chart header */
.sb-chart-title {
  font-size: .45rem;
  margin-bottom: 2px;
}

/* 4. Compact top subject card */
.sb-hero-strip {
  padding: 6px 10px;
  gap: 1px;
}

.sb-hero-name {
  font-size: .85rem;
}

.sb-hero-eyebrow {
  font-size: .38rem;
}

/* 5. Compact legend (2-column layout) */
.sb-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  width: 100%;
}

.sb-legend-row {
  gap: 6px;
}

.sb-legend-name {
  font-size: .64rem;
}

.sb-legend-pct {
  font-size: .45rem;
}

/* EXTRA: Remove vertical stretch */
.sb-body {
  min-height: unset !important;
}
`;

/* ══════════════════════════════════════════════════════════
   DIFF COLOR
══════════════════════════════════════════════════════════ */
const DIFF_COLORS = { easy: '#6b9e6b', medium: '#c4913a', hard: '#c0544a' };

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function SubjectBreakdown({
  subjectBreakdown = [],
  sessions = [],
  isDark = false,
}) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  // Enrich each subject with full analytics
  const enriched = useMemo(() => {
    return subjectBreakdown.map((s, i) => ({
      ...s,
      color: subjectColor(s.name, i),
      stats: computeSubjectStats(s.name, sessions),
    }));
  }, [subjectBreakdown, sessions]);

  const totalMins = useMemo(
    () => enriched.reduce((a, s) => a + s.mins, 0),
    [enriched],
  );

  const totalSessions = useMemo(
    () => enriched.reduce((a, s) => a + (s.stats?.total || 0), 0),
    [enriched],
  );

  const topSubject = enriched[0];

  // Build / update Chart.js donut
  useEffect(() => {
    if (!chartRef.current || !enriched.length) return;

    const load = () => {
      if (typeof window.Chart === 'undefined') {
        setTimeout(load, 100);
        return;
      }

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const activeColors =
        hovered !== null
          ? enriched.map((s, i) => (i === hovered ? s.color : s.color + '44'))
          : enriched.map((s) => s.color);

      chartInstanceRef.current = new window.Chart(chartRef.current, {
        type: 'doughnut',
        data: {
          labels: enriched.map((s) => s.name),
          datasets: [
            {
              data: enriched.map((s) => s.mins),
              backgroundColor: activeColors,
              borderColor: isDark ? '#131210' : '#faf7f2',
              borderWidth: 3,
              hoverBorderWidth: 3,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const mins = ctx.raw;
                  const h = Math.floor(mins / 60),
                    m = mins % 60;
                  const time = h ? `${h}h ${m}m` : `${m}m`;
                  return ` ${time} · ${Math.round((mins / totalMins) * 100)}%`;
                },
              },
              backgroundColor: isDark ? '#222019' : '#1e1a14',
              titleColor: '#f0ead8',
              bodyColor: '#9c9283',
              borderColor: '#35312b',
              borderWidth: 1,
              padding: 10,
              titleFont: {
                family: "'Cabinet Grotesk',sans-serif",
                size: 12,
                weight: '700',
              },
              bodyFont: { family: "'JetBrains Mono',monospace", size: 10 },
            },
          },
          animation: { duration: 900, easing: 'easeInOutQuart' },
        },
      });
    };

    load();
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [enriched, isDark, hovered, totalMins]);

  if (!enriched.length) return null;

  return (
    <div className={`sb-root${isDark ? ' dark' : ''}`}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="sb-head">
        <span className="sb-head-label">
          <BookOpen size={11} /> Subject Breakdown
        </span>
        <div className="sb-head-right">
          <span className="sb-head-stat">
            <Clock size={10} />
            <strong>{fmtMins(totalMins)}</strong> total
          </span>
          <span className="sb-head-stat">
            <Zap size={10} />
            <strong>{enriched.length}</strong> subjects
          </span>
          <span className="sb-head-stat">
            <CheckCircle2 size={10} />
            <strong>{totalSessions}</strong> sessions
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="sb-body">
        {/* LEFT: ranked rows */}
        <div className="sb-left">
          <div className="sb-list">
            {enriched.map((s, i) => {
              const st = s.stats;
              if (!st) return null;
              const totalDiff =
                st.diffMap.easy + st.diffMap.medium + st.diffMap.hard;
              return (
                <div
                  key={s.name}
                  className="sb-row"
                  style={{ '--sb-color': s.color }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="sb-row-top">
                    <span className="sb-rank">#{i + 1}</span>
                    <span
                      className="sb-color-dot"
                      style={{ background: s.color }}
                    />
                    <span className="sb-name">{s.name}</span>
                    <span className="sb-time">{fmtMins(s.mins)}</span>
                    <span className="sb-pct-badge">{s.pct}%</span>
                  </div>
                  <div className="sb-bar-track">
                    <div
                      className="sb-bar-fill"
                      style={{ width: `${s.pct}%`, background: s.color }}
                    />
                  </div>
                  <div className="sb-microstats">
                    {/* Sessions count */}
                    <span className="sb-micro">
                      <Zap size={9} />
                      {st.total} session{st.total !== 1 ? 's' : ''}
                    </span>
                    {/* Avg duration */}
                    <span className="sb-micro">
                      <Clock size={9} />
                      {fmtMins(st.avgDuration)} avg
                    </span>
                    {/* Completion rate */}
                    <span
                      className={`sb-micro ${st.completionRate >= 80 ? 'up' : st.completionRate >= 50 ? '' : 'down'}`}
                    >
                      <CheckCircle2 size={9} />
                      {st.completionRate}% done
                    </span>
                    {/* Focus score */}
                    <span className="sb-micro highlight">
                      <Award size={9} />
                      {st.avgScore} score
                    </span>
                    {/* Momentum */}
                    {Math.abs(st.momentum) > 0 && (
                      <span
                        className={`sb-micro ${st.momentum > 0 ? 'up' : 'down'}`}
                      >
                        <TrendingUp size={9} />
                        {st.momentum > 0 ? '+' : ''}
                        {st.momentum}% 7d
                      </span>
                    )}
                    {/* Streak */}
                    {st.streak > 1 && (
                      <span className="sb-micro highlight">
                        <Flame size={9} />
                        {st.streak}d streak
                      </span>
                    )}
                    {/* Difficulty bar */}
                    {totalDiff > 0 && (
                      <span
                        className="sb-micro"
                        title={`Easy: ${st.diffMap.easy}  Medium: ${st.diffMap.medium}  Hard: ${st.diffMap.hard}`}
                      >
                        <div className="sb-diff-bar">
                          {st.diffMap.easy > 0 && (
                            <div
                              className="sb-diff-seg"
                              style={{
                                background: DIFF_COLORS.easy,
                                width: `${Math.round((st.diffMap.easy / totalDiff) * 48)}px`,
                              }}
                            />
                          )}
                          {st.diffMap.medium > 0 && (
                            <div
                              className="sb-diff-seg"
                              style={{
                                background: DIFF_COLORS.medium,
                                width: `${Math.round((st.diffMap.medium / totalDiff) * 48)}px`,
                              }}
                            />
                          )}
                          {st.diffMap.hard > 0 && (
                            <div
                              className="sb-diff-seg"
                              style={{
                                background: DIFF_COLORS.hard,
                                width: `${Math.round((st.diffMap.hard / totalDiff) * 48)}px`,
                              }}
                            />
                          )}
                        </div>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: donut chart + legend */}
        <div className="sb-right">
          <div className="sb-chart-title">Distribution</div>

          {/* Donut */}
          <div className="sb-donut-wrap">
            <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
            <div className="sb-donut-center">
              <div className="sb-donut-num">{enriched.length}</div>
              <div className="sb-donut-label">Subjects</div>
            </div>
          </div>

          {/* Top subject hero */}
          {topSubject && (
            <div
              className="sb-hero-strip"
              style={{ '--sb-hero-color': topSubject.color }}
            >
              <div className="sb-hero-eyebrow">Top Subject</div>
              <div className="sb-hero-name">{topSubject.name}</div>
            </div>
          )}

          {/* Legend */}
          <div className="sb-legend">
            {enriched.map((s, i) => (
              <div
                key={s.name}
                className="sb-legend-row"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  opacity: hovered !== null && hovered !== i ? 0.45 : 1,
                  transition: 'opacity .2s',
                }}
              >
                <span
                  className="sb-legend-dot"
                  style={{ background: s.color }}
                />
                <span className="sb-legend-name">{s.name}</span>
                <span className="sb-legend-pct">{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Load Chart.js if not already present */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if (typeof window.Chart === 'undefined') {
              var s = document.createElement('script');
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
              document.head.appendChild(s);
            }
          `,
        }}
      />
    </div>
  );
}
