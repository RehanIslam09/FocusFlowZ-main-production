/**
 * SessionRewardCard.jsx
 * Persistent dashboard reward card — always visible, shows latest completed session.
 * No dismiss. No timer. No event listeners. Pure props.
 */

import { useState, useEffect, memo } from 'react';
import { Zap, Flame, Star, TrendingUp } from 'lucide-react';

const CARD_CSS = `
.src-persistent-wrap {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--surface-2) 0%, var(--surface-1) 100%);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 22px 24px;
  margin-bottom: 28px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--shadow-md), 0 0 0 1px rgba(196,145,58,.08);
  animation: src-card-in .55s cubic-bezier(.16,1,.3,1) both;
  transition: transform .3s cubic-bezier(.34,1.56,.64,1), box-shadow .3s;
}
.src-persistent-wrap:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(196,145,58,.14);
}

/* Dark mode */
.dark .src-persistent-wrap {
  background: linear-gradient(135deg, rgba(36,32,24,.95) 0%, rgba(28,25,18,.95) 100%);
  border-color: var(--border-mid);
}

@keyframes src-card-in {
  from { opacity: 0; transform: translateY(16px) scale(.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Ambient glow orb */
.src-glow-orb {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at 0% 50%, rgba(196,145,58,.1) 0%, transparent 60%);
}

/* Shimmer sweep */
.src-shimmer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(105deg, transparent 35%, rgba(196,145,58,.06) 50%, transparent 65%);
  animation: src-shimmer-sweep 3.5s ease-in-out 1s infinite;
}
@keyframes src-shimmer-sweep {
  0%        { transform: translateX(-120%); }
  60%, 100% { transform: translateX(220%); }
}

/* Top accent line */
.src-persistent-wrap::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(196,145,58,.5), transparent);
}

/* ── XP BADGE ── */
.src-xp-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  min-width: 72px;
}
.src-xp-number {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 2.2rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -.04em;
  background: linear-gradient(135deg, #c4913a 0%, #e8b96a 50%, #c4913a 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: src-xp-entrance .6s cubic-bezier(.34,1.56,.64,1) .15s both,
             src-xp-gradient 3.5s linear infinite;
}
@keyframes src-xp-entrance {
  from { opacity: 0; transform: scale(.5); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes src-xp-gradient {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.src-xp-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .52rem;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgba(196,145,58,.6);
}

/* ── DIVIDER ── */
.src-divider {
  width: 1px;
  height: 56px;
  background: var(--border-subtle);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

/* ── BODY ── */
.src-body {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.src-eyebrow {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .54rem;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 5px;
}
.src-session-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1rem;
  font-weight: 600;
  font-style: italic;
  color: var(--text-primary);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 10px;
}
.src-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.src-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: .56rem;
  letter-spacing: .07em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 20px;
  animation: src-pill-pop .4s cubic-bezier(.34,1.56,.64,1) both;
}
.src-pill:nth-child(1) { animation-delay: .2s; }
.src-pill:nth-child(2) { animation-delay: .3s; }
.src-pill:nth-child(3) { animation-delay: .4s; }
@keyframes src-pill-pop {
  from { opacity: 0; transform: translateY(6px) scale(.88); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.src-pill-streak {
  background: rgba(196,145,58,.12);
  border: 1px solid rgba(196,145,58,.28);
  color: #e8b96a;
}
.src-pill-diff {
  background: rgba(155,107,174,.12);
  border: 1px solid rgba(155,107,174,.28);
  color: #c09ad0;
}
.src-pill-done {
  background: rgba(107,140,107,.12);
  border: 1px solid rgba(107,140,107,.28);
  color: #8ab88a;
}

/* ── LEVEL PANEL ── */
.src-level-panel {
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex-shrink: 0;
  min-width: 128px;
  position: relative;
  z-index: 1;
}
.src-level-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.src-level-name {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .54rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.src-level-xp {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .56rem;
  color: var(--accent);
  font-weight: 500;
}
.src-level-track {
  height: 4px;
  background: var(--surface-3, rgba(255,255,255,.07));
  border-radius: 3px;
  overflow: hidden;
}
.src-level-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-light));
  border-radius: 3px;
  width: 0%;
  transition: width 1.3s cubic-bezier(.16,1,.3,1);
}
.src-level-title {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .54rem;
  color: rgba(196,145,58,.55);
  letter-spacing: .08em;
  text-transform: uppercase;
}

/* ── TODAY XP HINT ── */
.src-today-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: .54rem;
  color: var(--text-muted);
  margin-top: 6px;
}
.src-today-hint-val {
  color: var(--accent);
  font-weight: 500;
}

@media (max-width: 640px) {
  .src-level-panel { display: none; }
  .src-divider { display: none; }
  .src-persistent-wrap { gap: 14px; padding: 16px 16px; }
}
`;

const SessionRewardCard = memo(({ reward }) => {
  const [fillWidth, setFillWidth] = useState('0%');

  // Animate progress bar on mount / reward change
  useEffect(() => {
    if (!reward) return;
    const id = requestAnimationFrame(() => {
      setTimeout(() => {
        setFillWidth(`${reward.levelInfo?.pct ?? 0}%`);
      }, 80);
    });
    return () => cancelAnimationFrame(id);
  }, [reward]);

  if (!reward) return null;

  const li = reward.levelInfo ?? {
    pct: 0,
    level: 1,
    title: 'Scholar',
    xpNeeded: 100,
    xpCurrent: 0,
  };

  return (
    <>
      <style>{CARD_CSS}</style>
      <div className="src-persistent-wrap">
        <div className="src-glow-orb" />
        <div className="src-shimmer" />

        {/* XP Badge */}
        <div className="src-xp-badge">
          <div className="src-xp-number">+{reward.xp}</div>
          <div className="src-xp-label">Focus XP</div>
        </div>

        <div className="src-divider" />

        {/* Body */}
        <div className="src-body">
          <div className="src-eyebrow">Latest Session</div>
          {reward.sessionTitle && (
            <div className="src-session-title">"{reward.sessionTitle}"</div>
          )}
          <div className="src-pills">
            {reward.streak > 1 && (
              <span className="src-pill src-pill-streak">
                <Flame size={9} /> {reward.streak} day streak
              </span>
            )}
            {reward.difficulty && (
              <span className="src-pill src-pill-diff">
                ⚡ {reward.difficulty}
              </span>
            )}
            <span className="src-pill src-pill-done">
              <Star size={8} /> Completed
            </span>
          </div>

          {/* Today XP hint */}
          <div className="src-today-hint">
            <TrendingUp size={9} />
            <span className="src-today-hint-val">+{reward.xp} XP</span>
            gained this session
          </div>
        </div>

        {/* Level Progress */}
        <div className="src-level-panel">
          <div className="src-level-header">
            <span className="src-level-name">Level {li.level}</span>
            <span className="src-level-xp">
              {li.xpCurrent ?? 0}/{li.xpNeeded ?? 100}
            </span>
          </div>
          <div className="src-level-track">
            <div className="src-level-fill" style={{ width: fillWidth }} />
          </div>
          <div className="src-level-title">{li.title ?? 'Scholar'}</div>
        </div>
      </div>
    </>
  );
});

SessionRewardCard.displayName = 'SessionRewardCard';
export default SessionRewardCard;
