/**
 * BadgeStore.jsx
 *
 * FocusGem-powered badge shop. Badges persist to Supabase (user_badges table).
 * Gem balance read from user_gems table.
 *
 * Props:
 *   supabase    – Supabase client
 *   userId      – Clerk user.id
 *   isDark      – boolean
 *   gems        – current gem balance (number) — pass from parent or DailyCommissions
 *   onGemsChange – callback(newTotal) when gems are spent
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Gem,
  ShoppingBag,
  CheckCircle2,
  Zap,
  Lock,
  Star,
  Crown,
  Shield,
  Sparkles,
  Award,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   BADGE CATALOGUE CONFIG
   To add a badge: push to BADGE_CATALOGUE.
   icon: emoji string OR future image URL.
   rarity: 'common' | 'rare' | 'epic' | 'legendary'
═══════════════════════════════════════════════════════════════ */
export const BADGE_CATALOGUE = [
  // ── Common ──
  {
    id: 'b_spark',
    name: 'The Spark',
    description: 'A humble beginning. Every legend starts here.',
    rarity: 'common',
    cost: 30,
    icon: '✦',
    category: 'Origin',
  },
  {
    id: 'b_scroll',
    name: 'The Scholar',
    description: 'Knowledge is the sharpest weapon.',
    rarity: 'common',
    cost: 40,
    icon: '📜',
    category: 'Academic',
  },
  {
    id: 'b_quill',
    name: 'Scribe',
    description: 'Words outlast the writer.',
    rarity: 'common',
    cost: 35,
    icon: '🪶',
    category: 'Academic',
  },
  {
    id: 'b_seed',
    name: 'Seedling',
    description: 'Growth begins in silence.',
    rarity: 'common',
    cost: 25,
    icon: '🌱',
    category: 'Nature',
  },
  {
    id: 'b_compass',
    name: 'Wayfinder',
    description: 'Direction matters more than speed.',
    rarity: 'common',
    cost: 45,
    icon: '🧭',
    category: 'Journey',
  },
  // ── Rare ──
  {
    id: 'b_flame',
    name: 'Eternal Flame',
    description: 'Your focus burns unbroken.',
    rarity: 'rare',
    cost: 100,
    icon: '🔥',
    category: 'Power',
  },
  {
    id: 'b_crystal',
    name: 'Crystal Mind',
    description: 'Clarity through discipline.',
    rarity: 'rare',
    cost: 120,
    icon: '💎',
    category: 'Mastery',
  },
  {
    id: 'b_lightning',
    name: 'Thunderstrike',
    description: 'Swift. Decisive. Relentless.',
    rarity: 'rare',
    cost: 110,
    icon: '⚡',
    category: 'Power',
  },
  {
    id: 'b_moon',
    name: 'Night Owl',
    description: 'The quiet hours belong to you.',
    rarity: 'rare',
    cost: 130,
    icon: '🌙',
    category: 'Time',
  },
  {
    id: 'b_anchor',
    name: 'Groundwork',
    description: 'Deeply rooted. Immovable.',
    rarity: 'rare',
    cost: 95,
    icon: '⚓',
    category: 'Mastery',
  },
  // ── Epic ──
  {
    id: 'b_nebula',
    name: 'Nebula Mind',
    description: 'Your thoughts expand like galaxies.',
    rarity: 'epic',
    cost: 280,
    icon: '🌌',
    category: 'Cosmic',
  },
  {
    id: 'b_phoenix',
    name: 'Phoenix Risen',
    description: 'Returned from the ashes, sharper than before.',
    rarity: 'epic',
    cost: 320,
    icon: '🦅',
    category: 'Power',
  },
  {
    id: 'b_prism',
    name: 'Prism',
    description: 'Light split into infinite potential.',
    rarity: 'epic',
    cost: 250,
    icon: '🔮',
    category: 'Mastery',
  },
  {
    id: 'b_hourglass',
    name: 'Time Architect',
    description: 'You do not manage time. You sculpt it.',
    rarity: 'epic',
    cost: 300,
    icon: '⌛',
    category: 'Time',
  },
  {
    id: 'b_summit',
    name: 'Summiteer',
    description: 'The view from the top is worth every step.',
    rarity: 'epic',
    cost: 260,
    icon: '🏔️',
    category: 'Journey',
  },
  // ── Legendary ──
  {
    id: 'b_crown',
    name: 'Sovereign Mind',
    description: 'Absolute dominion over distraction.',
    rarity: 'legendary',
    cost: 666,
    icon: '👑',
    category: 'Apex',
  },
  {
    id: 'b_ouroboros',
    name: 'Ouroboros',
    description: 'The cycle never ends. Neither do you.',
    rarity: 'legendary',
    cost: 777,
    icon: '🐉',
    category: 'Apex',
  },
  {
    id: 'b_infinity',
    name: 'Infinite Focus',
    description: 'Beyond levels. Beyond limits. Beyond time.',
    rarity: 'legendary',
    cost: 999,
    icon: '♾️',
    category: 'Apex',
  },
  {
    id: 'b_cosmos',
    name: 'Cosmic Architect',
    description: 'You did not find your purpose. You built it.',
    rarity: 'legendary',
    cost: 888,
    icon: '🌠',
    category: 'Cosmic',
  },
];

/* ═══════════════════════════════════════════════════════════════
   RARITY CONFIG
═══════════════════════════════════════════════════════════════ */
const RARITY = {
  common: {
    label: 'Common',
    color: '#9c9283',
    glow: 'rgba(156,146,131,.18)',
    border: 'rgba(156,146,131,.35)',
    bg: 'rgba(156,146,131,.06)',
    shimmer: false,
  },
  rare: {
    label: 'Rare',
    color: '#5b8fa8',
    glow: 'rgba(91,143,168,.28)',
    border: 'rgba(91,143,168,.45)',
    bg: 'rgba(91,143,168,.07)',
    shimmer: false,
  },
  epic: {
    label: 'Epic',
    color: '#9b6bae',
    glow: 'rgba(155,107,174,.32)',
    border: 'rgba(155,107,174,.5)',
    bg: 'rgba(155,107,174,.08)',
    shimmer: false,
  },
  legendary: {
    label: 'Legendary',
    color: '#c9a84c',
    glow: 'rgba(201,168,76,.4)',
    border: 'rgba(201,168,76,.55)',
    bg: 'rgba(201,168,76,.08)',
    shimmer: true,
  },
};

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'];

/* ═══════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,600&family=JetBrains+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800&display=swap');

.bs-wrap { font-family:'Cabinet Grotesk',sans-serif; margin-bottom:32px; }

/* ── Section header ── */
.bs-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; gap:12px; flex-wrap:wrap; }
.bs-eyebrow { font-family:'JetBrains Mono',monospace; font-size:.56rem; letter-spacing:.18em; text-transform:uppercase; color:var(--gold); display:flex; align-items:center; gap:7px; }
.bs-eyebrow::before { content:''; display:block; width:18px; height:1px; background:currentColor; opacity:.5; }
.bs-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:1.7rem; font-weight:300; letter-spacing:-.02em; color:var(--ink); }
.bs-title em { font-style:italic; color:var(--gold); }

/* ── Gem balance bar ── */
.bs-balance-bar {
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  background:linear-gradient(135deg,color-mix(in srgb,#9b6bae 8%,var(--surface)),var(--surface));
  border:1px solid rgba(155,107,174,.28); border-radius:12px;
  padding:16px 22px; margin-bottom:22px;
}
.bs-balance-left { display:flex; align-items:center; gap:12px; }
.bs-balance-orb {
  width:42px; height:42px; border-radius:50%;
  background:linear-gradient(135deg,rgba(155,107,174,.25),rgba(201,168,76,.15));
  border:1px solid rgba(155,107,174,.4);
  display:grid; place-items:center; color:#9b6bae;
  box-shadow:0 0 18px rgba(155,107,174,.2);
}
.bs-balance-num { font-family:'Cormorant Garamond',serif; font-size:1.9rem; font-weight:300; color:var(--ink); line-height:1; }
.bs-balance-label { font-family:'JetBrains Mono',monospace; font-size:.52rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink3); }
.bs-balance-hint { font-family:'JetBrains Mono',monospace; font-size:.52rem; color:var(--ink3); letter-spacing:.04em; }

/* ── Filter controls ── */
.bs-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
.bs-filter-btn {
  font-family:'JetBrains Mono',monospace; font-size:.54rem; letter-spacing:.07em; text-transform:uppercase;
  padding:5px 14px; border-radius:20px; border:1px solid var(--border2);
  background:transparent; color:var(--ink3); cursor:pointer; transition:all .15s;
}
.bs-filter-btn:hover { border-color:var(--gold); color:var(--gold); }
.bs-filter-btn.on { background:var(--gold3); border-color:rgba(196,145,58,.5); color:var(--gold); }
.bs-filter-rarity {
  padding:5px 12px; border-radius:20px; border:1px solid var(--border2);
  background:var(--surface2); color:var(--ink3); cursor:pointer; outline:none;
  font-family:'JetBrains Mono',monospace; font-size:.54rem; letter-spacing:.05em;
  appearance:none; padding-right:24px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239c9283' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 8px center;
}
.bs-results-label { font-family:'JetBrains Mono',monospace; font-size:.52rem; color:var(--ink3); margin-left:auto; letter-spacing:.05em; }

/* ── Badge grid ── */
.bs-grid {
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
  gap:12px;
}
@media(max-width:640px) { .bs-grid { grid-template-columns:repeat(2,1fr); } }
@media(max-width:380px) { .bs-grid { grid-template-columns:1fr; } }

/* ── Badge card ── */
.bs-badge-card {
  border-radius:16px; border:1px solid var(--bs-border,var(--border));
  background:var(--surface); position:relative; overflow:hidden;
  transition:all .3s cubic-bezier(.16,1,.3,1); cursor:default;
}
.bs-badge-card:hover {
  transform:translateY(-5px) scale(1.02);
  border-color:var(--bs-color,var(--gold));
  box-shadow:0 16px 40px var(--bs-glow,rgba(196,145,58,.2));
}
.bs-badge-card.bs-owned { background:color-mix(in srgb,var(--bs-color) 5%,var(--surface)); }
.bs-badge-card.bs-equipped {
  border-color:var(--bs-color,var(--gold));
  background:color-mix(in srgb,var(--bs-color) 9%,var(--surface));
  box-shadow:0 0 28px var(--bs-glow,rgba(196,145,58,.25));
}

/* Legendary shimmer border */
@keyframes bs-border-spin {
  0% { background-position:0% 50%; }
  50% { background-position:100% 50%; }
  100% { background-position:0% 50%; }
}
.bs-badge-card.bs-legendary-card::before {
  content:''; position:absolute; inset:-1px; border-radius:16px; z-index:0;
  background:linear-gradient(135deg,#c9a84c,#e8c06a,#9b6bae,#c9a84c);
  background-size:300% 300%;
  animation:bs-border-spin 3.5s ease infinite;
  opacity:.65;
}
.bs-badge-card.bs-legendary-card .bs-card-inner { position:relative; z-index:1; background:var(--surface); border-radius:15px; }
.bs-badge-card.bs-equipped.bs-legendary-card::before { opacity:1; }

.bs-card-inner { padding:18px 16px 14px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; }

/* Icon display */
.bs-icon-frame {
  width:60px; height:60px; border-radius:14px;
  background:var(--bs-bg,rgba(196,145,58,.08));
  border:1px solid var(--bs-border,rgba(196,145,58,.25));
  display:grid; place-items:center;
  font-size:26px; line-height:1;
  transition:transform .25s cubic-bezier(.34,1.56,.64,1);
  position:relative;
}
.bs-badge-card:hover .bs-icon-frame { transform:scale(1.12) rotate(-6deg); }
.bs-badge-card.bs-equipped .bs-icon-frame {
  box-shadow:0 0 20px var(--bs-glow);
  animation:bs-icon-pulse 2.5s ease-in-out infinite;
}
@keyframes bs-icon-pulse {
  0%,100% { box-shadow:0 0 14px var(--bs-glow); }
  50% { box-shadow:0 0 28px var(--bs-glow), 0 0 48px color-mix(in srgb,var(--bs-color) 15%,transparent); }
}

/* Support for future image URLs */
.bs-icon-img { width:36px; height:36px; object-fit:contain; border-radius:6px; }

/* Rarity tag */
.bs-rarity-tag {
  font-family:'JetBrains Mono',monospace; font-size:.44rem; letter-spacing:.1em; text-transform:uppercase;
  padding:2px 9px; border-radius:20px;
  border:1px solid var(--bs-border,var(--border));
  color:var(--bs-color,var(--gold));
  background:color-mix(in srgb,var(--bs-color,var(--gold)) 10%,transparent);
}

/* Badge name & desc */
.bs-badge-name { font-size:.9rem; font-weight:700; color:var(--ink); line-height:1.2; }
.bs-badge-desc {
  font-family:'JetBrains Mono',monospace; font-size:.5rem; letter-spacing:.03em;
  color:var(--ink3); line-height:1.6; max-width:160px;
}

/* Cost / action area */
.bs-cost-row { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; }
.bs-cost {
  display:inline-flex; align-items:center; gap:4px;
  font-family:'JetBrains Mono',monospace; font-size:.55rem; letter-spacing:.05em;
  color:#9b6bae; font-weight:500;
}
.bs-cant-afford { opacity:.5; }

/* Buttons */
.bs-buy-btn, .bs-equip-btn, .bs-unequip-btn {
  width:100%; padding:8px 0; border-radius:8px; border:none; cursor:pointer;
  font-family:'JetBrains Mono',monospace; font-size:.54rem; letter-spacing:.08em; text-transform:uppercase;
  transition:all .22s cubic-bezier(.34,1.56,.64,1); display:flex; align-items:center; justify-content:center; gap:6px;
}
.bs-buy-btn {
  background:var(--bs-color,var(--gold));
  color:#fff;
}
.dark .bs-buy-btn { color:#0c0b09; }
.bs-buy-btn:hover:not(:disabled) { filter:brightness(1.1); transform:scale(1.03); }
.bs-buy-btn:disabled { opacity:.38; cursor:not-allowed; transform:none; filter:none; }
.bs-equip-btn {
  background:transparent; border:1px solid var(--bs-color,var(--gold));
  color:var(--bs-color,var(--gold));
}
.bs-equip-btn:hover { background:color-mix(in srgb,var(--bs-color,var(--gold)) 12%,transparent); transform:scale(1.02); }
.bs-unequip-btn { background:var(--surface2); border:1px solid var(--border2); color:var(--ink3); }
.bs-unequip-btn:hover { border-color:var(--red); color:var(--red); }

/* Equipped badge indicator top-right */
.bs-equipped-stamp {
  position:absolute; top:8px; right:8px;
  background:var(--bs-color,var(--gold)); color:#fff; border-radius:20px;
  padding:2px 8px; font-family:'JetBrains Mono',monospace; font-size:.44rem; letter-spacing:.08em; text-transform:uppercase;
  display:flex; align-items:center; gap:3px;
}
.dark .bs-equipped-stamp { color:#0c0b09; }

/* Lock overlay for unowned */
.bs-lock-overlay {
  position:absolute; inset:0; border-radius:16px; z-index:5;
  background:color-mix(in srgb,var(--bg) 55%,transparent);
  backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center;
  opacity:0; transition:opacity .2s;
  pointer-events:none;
}

/* Loading state */
.bs-skeleton { border-radius:16px; background:var(--surface2); animation:bs-pulse 1.5s ease-in-out infinite; }
@keyframes bs-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }

/* Category label */
.bs-section-label {
  font-family:'JetBrains Mono',monospace; font-size:.56rem; letter-spacing:.18em; text-transform:uppercase;
  color:var(--gold); display:flex; align-items:center; gap:8px; margin-bottom:12px; margin-top:24px;
}
.bs-section-label::before { content:''; display:block; width:14px; height:1px; background:currentColor; opacity:.5; }
`;

/* ═══════════════════════════════════════════════════════════════
   SINGLE BADGE CARD
═══════════════════════════════════════════════════════════════ */
function BadgeCard({
  badge,
  owned,
  equipped,
  canAfford,
  onBuy,
  onEquip,
  onUnequip,
  buying,
}) {
  const r = RARITY[badge.rarity];
  const isLegendary = badge.rarity === 'legendary';

  const isImageUrl =
    badge.icon.startsWith('http') || badge.icon.startsWith('/');

  return (
    <div
      className={[
        'bs-badge-card',
        owned ? 'bs-owned' : '',
        equipped ? 'bs-equipped' : '',
        isLegendary ? 'bs-legendary-card' : '',
      ].join(' ')}
      style={{
        '--bs-color': r.color,
        '--bs-glow': r.glow,
        '--bs-border': r.border,
        '--bs-bg': r.bg,
      }}
    >
      <div className="bs-card-inner">
        {equipped && (
          <div className="bs-equipped-stamp">
            <CheckCircle2 size={9} /> Equipped
          </div>
        )}

        {/* Icon */}
        <div className="bs-icon-frame">
          {isImageUrl ? (
            <img src={badge.icon} alt={badge.name} className="bs-icon-img" />
          ) : (
            <span style={{ fontSize: 28, lineHeight: 1 }}>{badge.icon}</span>
          )}
        </div>

        {/* Rarity */}
        <span className="bs-rarity-tag">{r.label}</span>

        {/* Name & desc */}
        <div className="bs-badge-name">{badge.name}</div>
        <div className="bs-badge-desc">{badge.description}</div>

        {/* Cost / CTA */}
        {owned ? (
          equipped ? (
            <button
              className="bs-unequip-btn"
              onClick={() => onUnequip(badge.id)}
            >
              <X size={11} /> Unequip
            </button>
          ) : (
            <button className="bs-equip-btn" onClick={() => onEquip(badge.id)}>
              <Sparkles size={11} /> Equip
            </button>
          )
        ) : (
          <>
            <div className={`bs-cost-row${canAfford ? '' : ' bs-cant-afford'}`}>
              <span className="bs-cost">
                <Gem size={12} />
                {badge.cost.toLocaleString()} Gems
              </span>
              {!canAfford && (
                <span
                  style={{
                    fontFamily: 'JetBrains Mono,monospace',
                    fontSize: '.44rem',
                    color: 'var(--red)',
                    letterSpacing: '.06em',
                  }}
                >
                  Need {(badge.cost - (canAfford || 0)).toLocaleString()} more
                </span>
              )}
            </div>
            <button
              className="bs-buy-btn"
              onClick={() => onBuy(badge)}
              disabled={!canAfford || buying}
            >
              {buying ? (
                <>
                  <Sparkles size={11} /> Purchasing…
                </>
              ) : canAfford ? (
                <>
                  <ShoppingBag size={11} /> Purchase
                </>
              ) : (
                <>
                  <Lock size={11} /> Locked
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════════════════════════ */
function ConfirmModal({ badge, gems, onConfirm, onCancel }) {
  if (!badge) return null;
  const r = RARITY[badge.rarity];
  const afterGems = gems - badge.cost;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(20,17,12,.72)',
        backdropFilter: 'blur(18px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: `1px solid ${r.border}`,
          borderRadius: 20,
          padding: '32px 28px',
          maxWidth: 360,
          width: '100%',
          boxShadow: `0 40px 100px ${r.glow}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: r.bg,
            border: `1px solid ${r.border}`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 34,
            boxShadow: `0 0 28px ${r.glow}`,
          }}
        >
          {badge.icon}
        </div>
        <div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: '1.4rem',
              fontWeight: 300,
              color: 'var(--ink)',
              marginBottom: 4,
            }}
          >
            Purchase{' '}
            <em style={{ fontStyle: 'italic', color: r.color }}>
              {badge.name}
            </em>
            ?
          </div>
          <div
            style={{
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: '.54rem',
              color: 'var(--ink3)',
              letterSpacing: '.04em',
              lineHeight: 1.6,
            }}
          >
            {badge.description}
          </div>
        </div>
        <div
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 20px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: '.54rem',
              color: 'var(--ink3)',
              marginBottom: 6,
            }}
          >
            <span>Current balance</span>
            <span
              style={{
                color: '#9b6bae',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Gem size={12} /> {gems.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: '.54rem',
              color: 'var(--ink3)',
              marginBottom: 6,
            }}
          >
            <span>Cost</span>
            <span
              style={{
                color: 'var(--red)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              − {badge.cost.toLocaleString()}
            </span>
          </div>
          <div
            style={{ height: 1, background: 'var(--border)', margin: '8px 0' }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: '.58rem',
              fontWeight: 500,
            }}
          >
            <span style={{ color: 'var(--ink)' }}>After purchase</span>
            <span
              style={{
                color: '#9b6bae',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Gem size={12} /> {afterGems.toLocaleString()}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              border: '1px solid var(--border2)',
              background: 'transparent',
              color: 'var(--ink3)',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: '.56rem',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 2,
              padding: '10px',
              borderRadius: 8,
              border: 'none',
              background: r.color,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: '.56rem',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <Gem size={13} /> Confirm Purchase
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function BadgeStore({
  supabase,
  userId,
  isDark = false,
  gems: gemsProp = 0,
  onGemsChange,
  onEquip,
}) {
  const [ownedBadgeIds, setOwnedBadgeIds] = useState(new Set());
  const [equippedBadgeId, setEquippedBadgeId] = useState(null);
  const [gems, setGems] = useState(gemsProp);
  const [filterRarity, setFilterRarity] = useState('all');
  const [filterOwned, setFilterOwned] = useState('all'); // 'all' | 'owned' | 'locked'
  const [confirmBadge, setConfirmBadge] = useState(null);
  const [buying, setBuying] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync gems prop
  useEffect(() => {
    setGems(gemsProp);
  }, [gemsProp]);

  // Load from Supabase
  useEffect(() => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const [{ data: badges }, { data: gemsRow }] = await Promise.all([
        supabase
          .from('user_badges')
          .select('badge_id, is_equipped')
          .eq('user_id', userId),
        supabase
          .from('user_gems')
          .select('gems')
          .eq('user_id', userId)
          .single(),
      ]);
      if (badges) {
        setOwnedBadgeIds(new Set(badges.map((b) => b.badge_id)));
        const equipped = badges.find((b) => b.is_equipped);
        if (equipped) setEquippedBadgeId(equipped.badge_id);
      }
      if (gemsRow) setGems(gemsRow.gems);
      setLoading(false);
    };
    load();
  }, [supabase, userId]);

  const handleBuyConfirm = useCallback(async () => {
    const badge = confirmBadge;
    if (!badge || !supabase || !userId) return;
    setConfirmBadge(null);
    setBuying(badge.id);

    const newGems = gems - badge.cost;
    await Promise.all([
      supabase
        .from('user_badges')
        .insert({ user_id: userId, badge_id: badge.id, is_equipped: false }),
      supabase.from('user_gems').upsert(
        {
          user_id: userId,
          gems: newGems,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      ),
    ]);

    setOwnedBadgeIds((prev) => new Set([...prev, badge.id]));
    setGems(newGems);
    onGemsChange?.(newGems);
    setBuying(null);
  }, [confirmBadge, supabase, userId, gems, onGemsChange]);

  const handleEquip = useCallback(
    async (badgeId) => {
      if (!supabase || !userId) return;
      await supabase
        .from('user_badges')
        .update({ is_equipped: false })
        .eq('user_id', userId);
      await supabase
        .from('user_badges')
        .update({ is_equipped: true })
        .eq('user_id', userId)
        .eq('badge_id', badgeId);
      setEquippedBadgeId(badgeId);
      onEquip?.(badgeId); // ← notify parent
    },
    [supabase, userId, onEquip],
  );

  const handleUnequip = useCallback(
    async (badgeId) => {
      if (!supabase || !userId) return;
      await supabase
        .from('user_badges')
        .update({ is_equipped: false })
        .eq('user_id', userId)
        .eq('badge_id', badgeId);
      setEquippedBadgeId(null);
      onEquip?.(null); // ← notify parent that nothing is equipped
    },
    [supabase, userId, onEquip],
  );

  const filteredBadges = useMemo(() => {
    let list = [...BADGE_CATALOGUE];
    if (filterRarity !== 'all')
      list = list.filter((b) => b.rarity === filterRarity);
    if (filterOwned === 'owned')
      list = list.filter((b) => ownedBadgeIds.has(b.id));
    if (filterOwned === 'locked')
      list = list.filter((b) => !ownedBadgeIds.has(b.id));
    // Sort: equipped first, owned next, then by rarity
    list.sort((a, b) => {
      if (a.id === equippedBadgeId) return -1;
      if (b.id === equippedBadgeId) return 1;
      if (ownedBadgeIds.has(a.id) !== ownedBadgeIds.has(b.id))
        return ownedBadgeIds.has(a.id) ? -1 : 1;
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    });
    return list;
  }, [filterRarity, filterOwned, ownedBadgeIds, equippedBadgeId]);

  const ownedCount = ownedBadgeIds.size;
  const totalCount = BADGE_CATALOGUE.length;

  if (loading) {
    return (
      <div className={`bs-wrap${isDark ? ' dark' : ''}`}>
        <style>{CSS}</style>
        <div className="bs-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bs-skeleton" style={{ height: 260 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className={`bs-wrap${isDark ? ' dark' : ''}`}>
        {/* Header */}
        <div className="bs-head">
          <div>
            <div className="bs-eyebrow">
              <ShoppingBag size={10} /> Badge Store
            </div>
            <div className="bs-title">
              The <em>Sanctum</em> of Badges
            </div>
          </div>
          <div
            style={{
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: '.54rem',
              color: 'var(--ink3)',
              letterSpacing: '.06em',
            }}
          >
            {ownedCount} / {totalCount} collected
          </div>
        </div>

        {/* Gem balance */}
        <div className="bs-balance-bar">
          <div className="bs-balance-left">
            <div className="bs-balance-orb">
              <Gem size={18} strokeWidth={1.7} />
            </div>
            <div>
              <div className="bs-balance-num">{gems.toLocaleString()}</div>
              <div className="bs-balance-label">FocusGems Available</div>
            </div>
          </div>
          <div className="bs-balance-hint">
            Earn gems by completing
            <br />
            Daily Commissions
          </div>
        </div>

        {/* Filters */}
        <div className="bs-controls">
          {[
            { k: 'all', l: 'All' },
            { k: 'owned', l: 'Owned' },
            { k: 'locked', l: 'Locked' },
          ].map(({ k, l }) => (
            <button
              key={k}
              className={`bs-filter-btn${filterOwned === k ? ' on' : ''}`}
              onClick={() => setFilterOwned(k)}
            >
              {l}
            </button>
          ))}
          <select
            className="bs-filter-rarity"
            value={filterRarity}
            onChange={(e) => setFilterRarity(e.target.value)}
          >
            <option value="all">All Rarities</option>
            <option value="legendary">Legendary</option>
            <option value="epic">Epic</option>
            <option value="rare">Rare</option>
            <option value="common">Common</option>
          </select>
          <span className="bs-results-label">
            {filteredBadges.length} badges
          </span>
        </div>

        {/* Badge grid */}
        <div className="bs-grid">
          {filteredBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              owned={ownedBadgeIds.has(badge.id)}
              equipped={equippedBadgeId === badge.id}
              canAfford={gems >= badge.cost}
              onBuy={(b) => setConfirmBadge(b)}
              onEquip={handleEquip}
              onUnequip={handleUnequip}
              buying={buying === badge.id}
            />
          ))}
        </div>

        {filteredBadges.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 20px',
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: '.62rem',
              color: 'var(--ink3)',
              letterSpacing: '.1em',
            }}
          >
            No badges match this filter.
          </div>
        )}

        {/* Purchase confirmation modal */}
        {confirmBadge && (
          <ConfirmModal
            badge={confirmBadge}
            gems={gems}
            onConfirm={handleBuyConfirm}
            onCancel={() => setConfirmBadge(null)}
          />
        )}
      </div>
    </>
  );
}
