// PremiumLoader.jsx
import { useEffect, useState, useRef } from 'react';

const LOADER_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@300;400&display=swap');

.pl-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #f5f0e8;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1);
}

.dark .pl-root {
  background: #141210;
}

.pl-root.pl-exiting {
  opacity: 0;
  transform: scale(1.015);
  pointer-events: none;
}

/* Grain */
.pl-grain {
  pointer-events: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: .038;
  z-index: 0;
  mix-blend-mode: multiply;
}
.dark .pl-grain { opacity: .06; mix-blend-mode: screen; }

/* Orbs */
.pl-orb {
  position: absolute;
  width: 560px;
  height: 560px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 42%,
    rgba(196,145,58,.18) 0%,
    rgba(196,145,58,.06) 45%,
    transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-55%, -52%);
  animation: plOrbDrift 8s cubic-bezier(.16,1,.3,1) infinite alternate;
  z-index: 1;
}
.pl-orb-2 {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(107,140,107,.1) 0%,
    transparent 70%);
  bottom: 18%;
  right: 22%;
  animation: plOrbDrift2 11s cubic-bezier(.16,1,.3,1) infinite alternate;
  z-index: 1;
}

/* Center stage */
.pl-center {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 32px;
  user-select: none;
}

/* Glyph */
.pl-glyph {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 2rem;
  color: rgba(196,145,58,.5);
  margin-bottom: 24px;
  animation: plGlyphPulse 3s ease-in-out infinite;
  line-height: 1;
}
.dark .pl-glyph { color: rgba(212,162,74,.5); }

/* Wordmark */
.pl-wordmark {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 600;
  color: #1e1a14;
  letter-spacing: -.04em;
  line-height: 1.05;
  margin-bottom: 12px;
  overflow: hidden;
}
.dark .pl-wordmark { color: #f0ead8; }

.pl-wordmark em {
  font-style: italic;
  color: #c4913a;
  font-weight: 400;
}
.dark .pl-wordmark em { color: #d4a24a; }

.pl-wordmark span {
  display: inline-block;
  opacity: 0;
  transform: translateY(9px);
  filter: blur(5px);
  animation: plCharIn .55s cubic-bezier(.16,1,.3,1) forwards;
}

/* Tagline */
.pl-tagline {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .58rem;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: #9c9283;
  margin-bottom: 40px;
  opacity: 0;
  animation: plFadeIn .6s cubic-bezier(.16,1,.3,1) forwards;
}
.dark .pl-tagline { color: #7a6e5e; }

/* Progress thread */
.pl-thread-wrap {
  width: 120px;
  height: 1px;
  background: rgba(30,26,20,.08);
  border-radius: 1px;
  overflow: visible;
  position: relative;
  margin-bottom: 20px;
}
.dark .pl-thread-wrap { background: rgba(240,234,216,.06); }

.pl-thread {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: linear-gradient(90deg, transparent, #c4913a 40%, #e8b96a);
  border-radius: 1px;
  width: 0%;
  animation: plThreadCrawl 2.6s cubic-bezier(.16,1,.3,1) .35s forwards;
}

.pl-thread-dot {
  position: absolute;
  top: 50%; right: 0;
  width: 4px; height: 4px;
  border-radius: 50%;
  background: #c4913a;
  transform: translate(50%, -50%);
  box-shadow: 0 0 10px rgba(196,145,58,.6);
  opacity: 0;
  animation: plFadeIn .25s ease .85s forwards;
}

/* Status hint */
.pl-hint {
  font-family: 'IBM Plex Mono', monospace;
  font-size: .52rem;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #bdb3a3;
  opacity: 0;
  animation: plFadeIn .5s cubic-bezier(.16,1,.3,1) 1.5s forwards;
  min-height: 1rem;
  transition: opacity .4s;
}
.dark .pl-hint { color: #5c5445; }

/* Keyframes */
@keyframes plOrbDrift {
  0%   { transform: translate(-55%, -52%) scale(1); }
  100% { transform: translate(-48%, -58%) scale(1.07); }
}
@keyframes plOrbDrift2 {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-28px, -36px) scale(1.1); }
}
@keyframes plGlyphPulse {
  0%,100% { opacity: .5; transform: scale(1); }
  50%     { opacity: .8; transform: scale(1.08); }
}
@keyframes plCharIn {
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes plFadeIn {
  to { opacity: 1; }
}
@keyframes plThreadCrawl {
  0%   { width: 0%; }
  55%  { width: 68%; }
  78%  { width: 80%; }
  100% { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .pl-root, .pl-root * {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
  .pl-wordmark span, .pl-tagline, .pl-hint { opacity: 1; transform: none; filter: none; }
  .pl-thread { width: 100%; }
}
`;

const HINTS = ['Preparing your workspace', 'Loading your sessions', 'Almost ready'];

// Stagger delays for each character in the wordmark
// You can change "Focus Study" to your actual app name
const WORDMARK_PARTS = [
  { text: 'Focus', italic: false },
  { text: '\u00a0', italic: false }, // non-breaking space
  { text: 'Study', italic: true },
];

function buildChars() {
  // Returns [{ char, italic }, ...]
  return WORDMARK_PARTS.flatMap(({ text, italic }) => [...text].map(char => ({ char, italic })));
}

export default function PremiumLoader({ isLoading }) {
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const hintRef = useRef(null);

  // Cycle through status hints
  useEffect(() => {
    const id = setInterval(() => {
      setHintIndex(i => (i + 1) % HINTS.length);
    }, 900);
    return () => clearInterval(id);
  }, []);

  // Trigger exit when Clerk finishes loading
  useEffect(() => {
    if (!isLoading) {
      // Small delay so loader is visible for at least ~400ms even on fast connections
      const t1 = setTimeout(() => setExiting(true), 400);
      const t2 = setTimeout(() => setHidden(true), 1100); // after transition completes
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isLoading]);

  if (hidden) return null;

  const chars = buildChars();

  // Stagger delay per char: 60ms apart, starting at 80ms
  const getCharDelay = i => `${80 + i * 55}ms`;

  return (
    <>
      <style>{LOADER_CSS}</style>
      <div className={`pl-root${exiting ? ' pl-exiting' : ''}`} aria-label="Loading" role="status">
        {/* Grain texture */}
        <svg className="pl-grain" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <filter id="pl-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#pl-noise)" />
        </svg>

        {/* Ambient orbs */}
        <div className="pl-orb" aria-hidden="true" />
        <div className="pl-orb-2" aria-hidden="true" />

        {/* Center content */}
        <div className="pl-center">
          {/* Decorative glyph */}
          <div className="pl-glyph" aria-hidden="true">
            ◈
          </div>

          {/* Wordmark with staggered char reveal */}
          <div className="pl-wordmark" aria-label="Focus Study">
            {chars.map(({ char, italic }, i) =>
              italic ? (
                <em key={i}>
                  <span style={{ animationDelay: getCharDelay(i) }}>{char}</span>
                </em>
              ) : (
                <span key={i} style={{ animationDelay: getCharDelay(i) }}>
                  {char}
                </span>
              )
            )}
          </div>

          {/* Tagline */}
          <div
            className="pl-tagline"
            style={{ animationDelay: `${80 + chars.length * 55 + 80}ms` }}
          >
            Your intelligent focus companion
          </div>

          {/* Progress thread */}
          <div className="pl-thread-wrap" aria-hidden="true">
            <div className="pl-thread" />
            <div className="pl-thread-dot" />
          </div>

          {/* Cycling hint */}
          <div className="pl-hint" ref={hintRef} aria-live="polite">
            {HINTS[hintIndex]}
          </div>
        </div>
      </div>
    </>
  );
}
