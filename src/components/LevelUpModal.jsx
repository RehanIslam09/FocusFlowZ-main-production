/**
 * LevelUpModal.jsx
 *
 * Cinematic level-up celebration modal.
 * Rendered via createPortal so it sits above everything.
 *
 * Props:
 *   newLevel    – number
 *   gemsAwarded – number
 *   onClose     – () => void
 *   isDark      – boolean
 */

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Gem, X, Zap, Star } from 'lucide-react';

/* ── Level title helper (matches FocusInsights) ── */
function levelTitle(l) {
  if (l < 3) return 'Newcomer';
  if (l < 6) return 'Apprentice';
  if (l < 10) return 'Scholar';
  if (l < 15) return 'Focused';
  if (l < 20) return 'Adept';
  if (l < 30) return 'Expert';
  if (l < 40) return 'Master';
  return 'Grandmaster';
}

/* ── Is this a milestone level? ── */
function milestoneType(level) {
  if (level % 10 === 0) return 'major'; // 10, 20, 30…
  if (level % 5 === 0) return 'minor'; // 5, 15, 25…
  return null;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,600&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

/* ── Backdrop ── */
.lum-backdrop {
  position:fixed;inset:0;z-index:99999;
  background:rgba(12,11,9,.82);
  backdrop-filter:blur(20px) saturate(1.4);
  -webkit-backdrop-filter:blur(20px) saturate(1.4);
  display:flex;align-items:center;justify-content:center;
  padding:20px;
  animation:lum-fade-in .3s cubic-bezier(.16,1,.3,1) both;
}
@keyframes lum-fade-in { from{opacity:0} to{opacity:1} }

/* ── Panel ── */
.lum-panel {
  width:100%;max-width:420px;
  background:linear-gradient(145deg,#131210,#1a1508);
  border-radius:24px;
  border:1px solid rgba(196,145,58,.3);
  overflow:hidden;position:relative;
  animation:lum-rise .5s .06s cubic-bezier(.34,1.56,.64,1) both;
  box-shadow:0 0 80px rgba(196,145,58,.12), 0 40px 100px rgba(0,0,0,.6);
}
.lum-panel.major {
  border-color:rgba(196,145,58,.55);
  box-shadow:0 0 120px rgba(196,145,58,.2), 0 40px 100px rgba(0,0,0,.65);
}
.lum-panel.minor {
  border-color:rgba(155,107,174,.5);
  box-shadow:0 0 100px rgba(155,107,174,.18), 0 40px 100px rgba(0,0,0,.62);
}
@keyframes lum-rise {
  from{opacity:0;transform:translateY(32px) scale(.94)}
  to{opacity:1;transform:none}
}

/* Top accent line */
.lum-panel::before {
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--lum-accent,#c4913a),transparent);
}

/* ── Close button ── */
.lum-close {
  position:absolute;top:14px;right:14px;
  width:30px;height:30px;border-radius:8px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  color:rgba(240,234,216,.4);cursor:pointer;
  display:grid;place-items:center;
  transition:all .2s;z-index:10;
}
.lum-close:hover { color:#f0ead8;border-color:rgba(255,255,255,.2); }

/* ── Stars / particles decoration ── */
.lum-stars {
  position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;
}
.lum-star {
  position:absolute;border-radius:50%;
  background:var(--lum-accent,#c4913a);
  animation:lum-twinkle var(--d,2s) var(--delay,0s) ease-in-out infinite;
}
@keyframes lum-twinkle {
  0%,100%{opacity:.08;transform:scale(.8)}
  50%{opacity:.55;transform:scale(1.2)}
}

/* ── Header area ── */
.lum-header {
  padding:44px 32px 28px;
  display:flex;flex-direction:column;align-items:center;gap:16px;
  position:relative;z-index:1;text-align:center;
}

/* Level orb */
.lum-orb {
  width:96px;height:96px;border-radius:50%;
  border:2px solid var(--lum-accent,#c4913a);
  background:rgba(196,145,58,.08);
  display:grid;place-items:center;
  position:relative;flex-shrink:0;
  animation:lum-orb-pulse 3s ease-in-out infinite;
}
.lum-orb::before {
  content:'';position:absolute;inset:-10px;border-radius:50%;
  border:1px dashed var(--lum-accent,#c4913a);opacity:.3;
  animation:lum-spin 10s linear infinite;
}
.lum-orb::after {
  content:'';position:absolute;inset:-20px;border-radius:50%;
  border:1px dashed var(--lum-accent,#c4913a);opacity:.12;
  animation:lum-spin 16s linear infinite reverse;
}
@keyframes lum-orb-pulse {
  0%,100%{box-shadow:0 0 20px rgba(196,145,58,.15)}
  50%{box-shadow:0 0 44px rgba(196,145,58,.35)}
}
@keyframes lum-spin { to{transform:rotate(360deg)} }
.lum-orb-num {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:2.6rem;font-weight:300;
  color:var(--lum-accent,#c4913a);
  line-height:1;
}

/* Eyebrow */
.lum-eyebrow {
  font-family:'JetBrains Mono',monospace;
  font-size:.56rem;letter-spacing:.22em;text-transform:uppercase;
  color:var(--lum-accent,#c4913a);opacity:.75;
}

/* Title */
.lum-title {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:2.4rem;font-weight:300;letter-spacing:-.02em;
  color:#f0ead8;line-height:1.1;
}
.lum-title em { font-style:italic;color:var(--lum-accent,#c4913a); }

/* Subtitle */
.lum-subtitle {
  font-family:'JetBrains Mono',monospace;
  font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;
  color:#6b5f4e;
}

/* ── Gem reward band ── */
.lum-gem-band {
  margin:0 20px 24px;
  padding:18px 24px;
  background:rgba(155,107,174,.09);
  border:1px solid rgba(155,107,174,.3);
  border-radius:14px;
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  position:relative;z-index:1;
  animation:lum-gem-in .5s .3s cubic-bezier(.34,1.56,.64,1) both;
}
.lum-panel.major .lum-gem-band {
  background:rgba(196,145,58,.1);
  border-color:rgba(196,145,58,.35);
}
@keyframes lum-gem-in {
  from{opacity:0;transform:translateY(12px) scale(.96)}
  to{opacity:1;transform:none}
}
.lum-gem-left { display:flex;align-items:center;gap:12px; }
.lum-gem-icon-wrap {
  width:44px;height:44px;border-radius:12px;
  background:rgba(155,107,174,.15);
  border:1px solid rgba(155,107,174,.3);
  display:grid;place-items:center;
  color:#9b6bae;flex-shrink:0;
}
.lum-panel.major .lum-gem-icon-wrap {
  background:rgba(196,145,58,.15);
  border-color:rgba(196,145,58,.3);
  color:#c4913a;
}
.lum-gem-label {
  font-family:'JetBrains Mono',monospace;
  font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;
  color:#6b5f4e;margin-bottom:3px;
}
.lum-gem-text {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:1.1rem;font-weight:300;color:#f0ead8;
}
.lum-gem-amount {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:2.2rem;font-weight:300;
  color:#9b6bae;line-height:1;
  display:flex;align-items:baseline;gap:6px;
}
.lum-panel.major .lum-gem-amount { color:#c4913a; }
.lum-gem-amount-unit {
  font-family:'JetBrains Mono',monospace;
  font-size:.52rem;letter-spacing:.08em;text-transform:uppercase;
  color:#6b5f4e;
}

/* Milestone badge */
.lum-milestone-badge {
  margin:0 20px 20px;
  padding:12px 16px;
  background:linear-gradient(135deg,rgba(196,145,58,.12),rgba(155,107,174,.08));
  border:1px solid rgba(196,145,58,.25);
  border-radius:10px;
  display:flex;align-items:center;gap:10px;
  position:relative;z-index:1;
  animation:lum-gem-in .5s .45s cubic-bezier(.34,1.56,.64,1) both;
}
.lum-milestone-icon {
  width:32px;height:32px;border-radius:8px;
  background:rgba(196,145,58,.15);
  display:grid;place-items:center;color:#c4913a;flex-shrink:0;
}
.lum-milestone-text {
  font-family:'JetBrains Mono',monospace;
  font-size:.54rem;letter-spacing:.06em;color:#a89880;line-height:1.6;
}
.lum-milestone-text strong { color:#c4913a;font-weight:500; }

/* ── CTA button ── */
.lum-cta {
  margin:0 20px 28px;
  width:calc(100% - 40px);
  padding:12px;border-radius:10px;border:none;cursor:pointer;
  background:var(--lum-accent,#c4913a);color:#0c0b09;
  font-family:'JetBrains Mono',monospace;
  font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;
  font-weight:500;
  display:flex;align-items:center;justify-content:center;gap:8px;
  position:relative;z-index:1;
  transition:all .22s cubic-bezier(.34,1.56,.64,1);
  animation:lum-gem-in .5s .55s cubic-bezier(.34,1.56,.64,1) both;
}
.lum-cta:hover { filter:brightness(1.1);transform:scale(1.02); }
.lum-cta:active { transform:scale(.98); }
`;

/* ── Deterministic star positions ── */
const STARS = [
  { size: 3, top: 12, left: 18, d: '2.1s', delay: '0s' },
  { size: 2, top: 22, left: 75, d: '1.8s', delay: '.4s' },
  { size: 4, top: 8, left: 88, d: '2.4s', delay: '.2s' },
  { size: 2, top: 55, left: 6, d: '1.9s', delay: '.7s' },
  { size: 3, top: 72, left: 92, d: '2.2s', delay: '.1s' },
  { size: 2, top: 88, left: 35, d: '1.7s', delay: '.5s' },
  { size: 3, top: 40, left: 95, d: '2.5s', delay: '.3s' },
  { size: 2, top: 15, left: 50, d: '2.0s', delay: '.6s' },
];

/* ── Main component ── */
function LevelUpModalInner({ newLevel, gemsAwarded, onClose }) {
  const milestone = milestoneType(newLevel);
  const title = levelTitle(newLevel);
  const isMajor = milestone === 'major';
  const accentColor = isMajor
    ? '#c4913a'
    : milestone === 'minor'
      ? '#9b6bae'
      : '#c4913a';

  // Close on Escape
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Auto-close after 8s
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="lum-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{CSS}</style>
      <div
        className={`lum-panel ${isMajor ? 'major' : milestone === 'minor' ? 'minor' : ''}`}
        style={{ '--lum-accent': accentColor }}
      >
        {/* Decorative stars */}
        <div className="lum-stars" aria-hidden>
          {STARS.map((s, i) => (
            <div
              key={i}
              className="lum-star"
              style={{
                width: s.size,
                height: s.size,
                top: `${s.top}%`,
                left: `${s.left}%`,
                '--d': s.d,
                '--delay': s.delay,
              }}
            />
          ))}
        </div>

        {/* Close */}
        <button className="lum-close" onClick={onClose} aria-label="Close">
          <X size={14} strokeWidth={2} />
        </button>

        {/* Header */}
        <div className="lum-header">
          <div className="lum-eyebrow">Level up</div>
          <div className="lum-orb">
            <div className="lum-orb-num">{newLevel}</div>
          </div>
          <div className="lum-title">
            You reached <em>{title}</em>
          </div>
          <div className="lum-subtitle">Level {newLevel} unlocked</div>
        </div>

        {/* Gem reward */}
        <div className="lum-gem-band">
          <div className="lum-gem-left">
            <div className="lum-gem-icon-wrap">
              <Gem size={20} strokeWidth={1.8} />
            </div>
            <div>
              <div className="lum-gem-label">Reward</div>
              <div className="lum-gem-text">FocusGems earned</div>
            </div>
          </div>
          <div className="lum-gem-amount">
            +{gemsAwarded}
            <span className="lum-gem-amount-unit">gems</span>
          </div>
        </div>

        {/* Milestone callout */}
        {milestone && (
          <div className="lum-milestone-badge">
            <div className="lum-milestone-icon">
              {isMajor ? (
                <Star size={16} strokeWidth={1.8} />
              ) : (
                <Zap size={16} strokeWidth={1.8} />
              )}
            </div>
            <div className="lum-milestone-text">
              {isMajor ? (
                <>
                  <strong>Milestone level!</strong> You hit a major milestone —
                  bonus 100 gems awarded.
                </>
              ) : (
                <>
                  <strong>Half-milestone!</strong> Level {newLevel} earns you a
                  bonus 75 gems.
                </>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <button className="lum-cta" onClick={onClose}>
          <Zap size={13} strokeWidth={2} />
          Keep Focusing
        </button>
      </div>
    </div>
  );
}

export default function LevelUpModal({
  newLevel,
  gemsAwarded,
  onClose,
  isDark,
}) {
  if (!newLevel) return null;
  return createPortal(
    <LevelUpModalInner
      newLevel={newLevel}
      gemsAwarded={gemsAwarded}
      onClose={onClose}
    />,
    document.body,
  );
}
