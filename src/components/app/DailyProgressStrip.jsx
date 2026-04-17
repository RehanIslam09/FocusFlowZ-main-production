/**
 * DailyProgressStrip.jsx
 * Compact habit-loop motivator — always visible at top of dashboard.
 * Duolingo-style daily trigger with premium aesthetic.
 */

import { useState, useEffect, useRef, memo } from 'react';
import { Flame, Zap, Target, ChevronRight } from 'lucide-react';

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(target);
  const raf = useRef(null);
  const prev = useRef(target);

  useEffect(() => {
    if (prev.current === target) return;
    const from = prev.current;
    prev.current = target;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return value;
}

const STRIP_CSS = `
.dps-wrap {
  position: relative;
  background: var(--surface-invert);
  border-radius: 12px;
  padding: 14px 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 0;
  overflow: hidden;
  animation: fadeUp .45s var(--ease) both;
  border: 1px solid rgba(196,145,58,.18);
  box-shadow: 0 4px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(196,145,58,.08);
  transition: box-shadow .3s;
  border-top: 1px solid rgba(196,145,58,.22); /* add this line */
}
.dps-wrap:hover {
  box-shadow: 0 6px 32px rgba(0,0,0,.16), 0 0 0 1px rgba(196,145,58,.16);
}
.dps-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at 0% 50%, rgba(196,145,58,.12) 0%, transparent 55%);
}
.dps-shimmer {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 35%, rgba(196,145,58,.05) 50%, transparent 65%);
  animation: dpsShimmer 3.5s ease-in-out infinite;
}
.dps-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.dps-sep {
  width: 1px;
  height: 28px;
  background: rgba(255,255,255,.08);
  margin: 0 4px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.dps-icon {
  width: 28px; height: 28px;
  border-radius: 7px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.08);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.dps-label {
  font-family: var(--f-mono);
  font-size: .54rem;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text-invert-dim);
  line-height: 1;
  margin-bottom: 3px;
}
.dps-value {
  font-family: var(--f-serif);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-invert);
  line-height: 1;
  letter-spacing: -.03em;
  transition: transform .2s var(--spring), color .2s;
}
.dps-value.pulse {
  animation: dpsPulse .4s var(--spring);
}
.dps-xp-val { color: var(--accent-light); }
.dps-streak-val { color: #ff9a5c; }

.dps-bar-wrap {
  flex: 1.4;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.dps-bar-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.dps-bar-title {
  font-family: var(--f-mono);
  font-size: .54rem;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text-invert-dim);
}
.dps-bar-pct {
  font-family: var(--f-mono);
  font-size: .6rem;
  font-weight: 500;
  color: var(--accent-light);
}
.dps-bar-track {
  height: 4px;
  background: rgba(255,255,255,.08);
  border-radius: 3px;
  overflow: hidden;
}
.dps-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-light));
  border-radius: 3px;
  transition: width 1.2s cubic-bezier(.16,1,.3,1);
  position: relative;
}
.dps-bar-fill::after {
  content: '';
  position: absolute;
  right: 0; top: 50%;
  transform: translateY(-50%);
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent-light);
  box-shadow: 0 0 6px var(--accent-light);
}

.dps-cta {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: #fff;
  font-family: var(--f-mono);
  font-size: .6rem;
  font-weight: 500;
  letter-spacing: .07em;
  text-transform: uppercase;
  padding: 9px 14px;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  transition: transform .22s var(--spring), box-shadow .22s, background .2s;
  box-shadow: 0 3px 12px rgba(196,145,58,.35);
}
.dps-cta:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 6px 20px rgba(196,145,58,.45);
  background: var(--accent-dark);
}

.dps-streak-warn {
  position: absolute;
  top: -6px; right: -6px;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #ff6b35;
  box-shadow: 0 0 8px rgba(255,107,53,.6);
  animation: streakWarnPulse 1.8s ease-in-out infinite;
  z-index: 2;
}

@keyframes dpsShimmer {
  0%   { transform: translateX(-100%); }
  60%, 100% { transform: translateX(200%); }
}
@keyframes dpsPulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.18); color: var(--accent-light); }
  100% { transform: scale(1); }
}
@keyframes streakWarnPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .5; transform: scale(.7); }
}

@media (max-width: 680px) {
  .dps-bar-wrap { display: none; }
  .dps-sep:last-of-type { display: none; }
}
@media (max-width: 480px) {
  .dps-wrap { padding: 12px 14px; gap: 0; }
  .dps-value { font-size: .92rem; }
}
`;

export const DailyProgressStrip = memo(
  ({
    xpToday,
    sessionsToday,
    sessionsTotal,
    goalPct,
    streak,
    atStreakRisk,
    onAction,
  }) => {
    const animXP = useCountUp(xpToday);
    const animPct = useCountUp(goalPct);

    // Mission message — Duolingo-style urgency
    const missionMsg = (() => {
      if (atStreakRisk && streak > 1) return `Save your ${streak}-day streak`;
      if (goalPct >= 100) return 'Daily goal complete';
      if (sessionsToday === 0) return 'Start your first session';
      const remaining = sessionsTotal - sessionsToday;
      if (remaining === 1) return '1 session to hit your goal';
      return `${remaining} sessions left today`;
    })();

    return (
      <>
        <style>{STRIP_CSS}</style>
        <div className="dps-wrap" role="status" aria-label="Daily progress">
          <div className="dps-glow" />
          <div className="dps-shimmer" />

          {/* XP Today */}
          <div className="dps-item" style={{ flex: '.9' }}>
            <div className="dps-icon" style={{ color: 'var(--accent-light)' }}>
              <Zap size={13} strokeWidth={2} />
            </div>
            <div>
              <div className="dps-label">XP Today</div>
              <div className={`dps-value dps-xp-val`}>+{animXP}</div>
            </div>
          </div>

          <div className="dps-sep" />

          {/* Sessions */}
          <div className="dps-item" style={{ flex: '.9' }}>
            <div className="dps-icon" style={{ color: 'var(--accent)' }}>
              <Target size={13} strokeWidth={2} />
            </div>
            <div>
              <div className="dps-label">Sessions</div>
              <div className="dps-value">
                {sessionsToday}
                <span
                  style={{
                    fontSize: '.65rem',
                    color: 'var(--text-invert-dim)',
                    fontWeight: 400,
                  }}
                >
                  /{sessionsTotal}
                </span>
              </div>
            </div>
          </div>

          <div className="dps-sep" />

          {/* Streak */}
          <div
            className="dps-item"
            style={{ flex: '.8', position: 'relative' }}
          >
            {atStreakRisk && streak > 1 && <div className="dps-streak-warn" />}
            <div className="dps-icon" style={{ color: '#ff9a5c' }}>
              <Flame size={13} strokeWidth={2} />
            </div>
            <div>
              <div className="dps-label">Streak</div>
              <div className="dps-value dps-streak-val">
                {streak}
                <span
                  style={{
                    fontSize: '.65rem',
                    fontWeight: 400,
                    color: '#ff9a5c',
                    opacity: 0.7,
                  }}
                >
                  d
                </span>
              </div>
            </div>
          </div>

          <div className="dps-sep" />

          {/* Progress bar */}
          <div className="dps-bar-wrap">
            <div className="dps-bar-label">
              <span className="dps-bar-title">{missionMsg}</span>
              <span className="dps-bar-pct">{animPct}%</span>
            </div>
            <div className="dps-bar-track">
              <div
                className="dps-bar-fill"
                style={{ width: `${Math.min(100, goalPct)}%` }}
              />
            </div>
          </div>

          <div className="dps-sep" style={{ marginLeft: 8 }} />

          {/* CTA */}
          <button
            className="dps-cta"
            onClick={onAction}
            style={{ marginLeft: 8 }}
          >
            {goalPct >= 100 ? 'Review' : atStreakRisk ? 'Save Streak' : 'Go'}
            <ChevronRight size={11} />
          </button>
        </div>
      </>
    );
  },
);

export default DailyProgressStrip;
