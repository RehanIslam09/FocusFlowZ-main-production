/**
 * XPRewardModal.jsx
 *
 * Full-screen reward moment after session completion.
 * Shows XP gained, streak, optional achievement unlock.
 * Animates in with scale + glow, auto-dismisses in 4s.
 *
 * Props:
 *   reward: {
 *     xp: number,
 *     sessionTitle: string,
 *     streak: number,
 *     achievement?: { icon: string, label: string, rarity: string } | null,
 *     difficulty?: string,
 *   } | null
 *   onDismiss: () => void
 */

import { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Zap, Flame, Award, X, Star, ArrowRight } from 'lucide-react';

const MODAL_CSS = `
.xprm-backdrop {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(14,13,9,.82);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  animation: xprm-bd-in .35s cubic-bezier(.16,1,.3,1) both;
}
@keyframes xprm-bd-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.xprm-panel {
  width: 100%; max-width: 440px;
  background: #1a1610;
  border: 1px solid rgba(196,145,58,.4);
  border-radius: 20px;
  padding: 40px 36px 32px;
  position: relative; overflow: hidden;
  text-align: center;
  box-shadow: 0 40px 120px rgba(0,0,0,.7), 0 0 0 1px rgba(196,145,58,.15);
  animation: xprm-panel-in .5s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes xprm-panel-in {
  from { opacity: 0; transform: scale(.88) translateY(24px); }
  to   { opacity: 1; transform: scale(1)  translateY(0); }
}

/* Animated glow orb behind XP number */
.xprm-orb {
  position: absolute; width: 320px; height: 320px; border-radius: 50%;
  background: radial-gradient(circle, rgba(196,145,58,.18) 0%, transparent 70%);
  top: 50%; left: 50%; transform: translate(-50%,-50%);
  pointer-events: none;
  animation: xprm-orb-pulse 2s ease-in-out infinite;
}
@keyframes xprm-orb-pulse {
  0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: .8; }
  50%       { transform: translate(-50%,-50%) scale(1.15); opacity: 1; }
}

/* Shimmer sweep */
.xprm-shimmer {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 35%, rgba(196,145,58,.07) 50%, transparent 65%);
  animation: xprm-shimmer 2.4s ease-in-out 0.3s infinite;
}
@keyframes xprm-shimmer {
  0%        { transform: translateX(-100%); }
  60%, 100% { transform: translateX(200%); }
}

/* Close button */
.xprm-close {
  position: absolute; top: 14px; right: 14px;
  width: 28px; height: 28px; border-radius: 7px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08);
  color: rgba(240,234,216,.4); cursor: pointer;
  display: grid; place-items: center;
  transition: color .2s, background .2s;
  z-index: 2;
}
.xprm-close:hover { color: #c4913a; background: rgba(196,145,58,.12); }

/* Tag above XP */
.xprm-tag {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .56rem; letter-spacing: .18em; text-transform: uppercase;
  color: rgba(196,145,58,.7); margin-bottom: 20px; position: relative; z-index: 1;
}

/* Main XP number */
.xprm-xp {
  position: relative; z-index: 1;
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 5rem; font-weight: 700; line-height: 1;
  letter-spacing: -.06em;
  background: linear-gradient(135deg, #c4913a, #e8b96a, #c4913a);
  background-size: 200% auto;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: xprm-xp-in .55s cubic-bezier(.34,1.56,.64,1) .1s both,
             xprm-gradient 3s linear infinite;
}
@keyframes xprm-xp-in {
  from { opacity: 0; transform: scale(.6); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes xprm-gradient {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

.xprm-xp-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .65rem; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(196,145,58,.6); margin-bottom: 6px;
  position: relative; z-index: 1;
}

/* Session title */
.xprm-session-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.1rem; font-weight: 600; font-style: italic;
  color: rgba(240,234,216,.85); line-height: 1.3; margin-bottom: 24px;
  position: relative; z-index: 1;
}

/* Pill row */
.xprm-pills {
  display: flex; align-items: center; justify-content: center;
  flex-wrap: wrap; gap: 8px; margin-bottom: 28px;
  position: relative; z-index: 1;
}
.xprm-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: .6rem; letter-spacing: .07em;
  padding: 6px 13px; border-radius: 20px;
  animation: xprm-pill-in .4s cubic-bezier(.34,1.56,.64,1) both;
}
.xprm-pill:nth-child(1) { animation-delay: .2s; }
.xprm-pill:nth-child(2) { animation-delay: .3s; }
.xprm-pill:nth-child(3) { animation-delay: .4s; }
@keyframes xprm-pill-in {
  from { opacity: 0; transform: translateY(8px) scale(.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.xprm-pill-streak {
  background: rgba(196,145,58,.14); border: 1px solid rgba(196,145,58,.3);
  color: #e8b96a;
}
.xprm-pill-diff {
  background: rgba(155,107,174,.14); border: 1px solid rgba(155,107,174,.3);
  color: #c09ad0;
}
.xprm-pill-done {
  background: rgba(107,140,107,.14); border: 1px solid rgba(107,140,107,.3);
  color: #8ab88a;
}

/* Achievement unlock */
.xprm-achievement {
  background: rgba(201,168,76,.08);
  border: 1px solid rgba(201,168,76,.35);
  border-radius: 12px; padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 24px; position: relative; z-index: 1;
  animation: xprm-ach-in .5s cubic-bezier(.34,1.56,.64,1) .3s both;
}
@keyframes xprm-ach-in {
  from { opacity: 0; transform: scale(.9); }
  to   { opacity: 1; transform: scale(1); }
}
.xprm-ach-icon {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  background: rgba(201,168,76,.15); border: 1px solid rgba(201,168,76,.3);
  display: grid; place-items: center; font-size: 1.3rem;
}
.xprm-ach-tag {
  font-family: 'IBM Plex Mono', monospace; font-size: .5rem;
  letter-spacing: .14em; text-transform: uppercase; color: #c9a84c;
  margin-bottom: 2px;
}
.xprm-ach-label {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: .9rem; font-weight: 600; color: rgba(240,234,216,.9);
}

/* Progress bar to next level */
.xprm-level-section {
  margin-bottom: 28px; position: relative; z-index: 1;
}
.xprm-level-row {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 7px;
}
.xprm-level-label {
  font-family: 'IBM Plex Mono', monospace; font-size: .56rem;
  letter-spacing: .1em; text-transform: uppercase; color: rgba(240,234,216,.35);
}
.xprm-level-val {
  font-family: 'IBM Plex Mono', monospace; font-size: .58rem;
  color: #c4913a; font-weight: 500;
}
.xprm-level-track {
  height: 5px; background: rgba(255,255,255,.06); border-radius: 3px; overflow: hidden;
}
.xprm-level-fill {
  height: 100%;
  background: linear-gradient(90deg, #c4913a, #e8b96a);
  border-radius: 3px;
  transition: width 1.2s cubic-bezier(.16,1,.3,1);
}

/* CTA */
.xprm-cta {
  display: flex; align-items: center; gap: 8px;
  justify-content: center;
  width: 100%; padding: 13px 24px; border-radius: 9px; border: none;
  background: linear-gradient(135deg, #c4913a, #e8b96a);
  color: #fff; cursor: pointer;
  font-family: 'IBM Plex Mono', monospace;
  font-size: .68rem; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
  transition: transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s;
  box-shadow: 0 6px 20px rgba(196,145,58,.35);
  position: relative; z-index: 1;
}
.xprm-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(196,145,58,.45);
}

/* Auto-dismiss progress rail at bottom */
.xprm-dismiss-rail {
  position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
  background: rgba(196,145,58,.12);
  border-radius: 0 0 20px 20px; overflow: hidden;
}
.xprm-dismiss-fill {
  height: 100%;
  background: rgba(196,145,58,.5);
  border-radius: inherit;
  animation: xprm-dismiss-drain 4s linear both;
}
@keyframes xprm-dismiss-drain {
  from { width: 100%; }
  to   { width: 0%; }
}
`;

const XPRewardModal = memo(({ reward, onDismiss, levelInfo }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!reward) return;
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 350);
    }, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reward, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 350);
  };

  if (!reward || !visible) return null;

  const li = levelInfo || { pct: 0, level: 1, xpNeeded: 100, xpCurrent: 0 };

  return createPortal(
    <div
      className={`xprm-backdrop${exiting ? ' xprm-exiting' : ''}`}
      style={exiting ? { opacity: 0, transition: 'opacity .35s' } : {}}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <style>{MODAL_CSS}</style>
      <div className="xprm-panel">
        <div className="xprm-orb" />
        <div className="xprm-shimmer" />
        <div className="xprm-dismiss-rail">
          <div className="xprm-dismiss-fill" />
        </div>

        <button className="xprm-close" onClick={handleDismiss}>
          <X size={12} />
        </button>

        <div className="xprm-tag">Session Complete</div>

        <div className="xprm-xp">+{reward.xp}</div>
        <div className="xprm-xp-label">Focus Points</div>

        {reward.sessionTitle && (
          <div className="xprm-session-title">"{reward.sessionTitle}"</div>
        )}

        <div className="xprm-pills">
          {reward.streak > 1 && (
            <span className="xprm-pill xprm-pill-streak">
              <Flame size={10} /> {reward.streak} day streak
            </span>
          )}
          {reward.difficulty && (
            <span className="xprm-pill xprm-pill-diff">
              ⚡ {reward.difficulty}
            </span>
          )}
          <span className="xprm-pill xprm-pill-done">
            <Star size={9} /> Completed
          </span>
        </div>

        {reward.achievement && (
          <div className="xprm-achievement">
            <div className="xprm-ach-icon">{reward.achievement.icon}</div>
            <div>
              <div className="xprm-ach-tag">
                Achievement Unlocked · {reward.achievement.rarity}
              </div>
              <div className="xprm-ach-label">{reward.achievement.label}</div>
            </div>
          </div>
        )}

        <div className="xprm-level-section">
          <div className="xprm-level-row">
            <span className="xprm-level-label">
              Level {li.level} · {li.title || 'Scholar'}
            </span>
            <span className="xprm-level-val">
              {li.xpCurrent} / {li.xpNeeded} XP
            </span>
          </div>
          <div className="xprm-level-track">
            <div className="xprm-level-fill" style={{ width: `${li.pct}%` }} />
          </div>
        </div>

        <button className="xprm-cta" onClick={handleDismiss}>
          Keep going <ArrowRight size={13} />
        </button>
      </div>
    </div>,
    document.body,
  );
});

export default XPRewardModal;
