/**
 * Landing.jsx — FocusFlow AI
 * Awwwards-level SaaS landing page
 * Theme: Editorial parchment/amber (matches app aesthetic)
 * Sections: Hero → Trust → Features → Product Preview → Analytics → CTA → Footer
 * No external animation libraries — pure CSS + Intersection Observer
 */

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/landing/Navbar";
import {
    Brain, Clock, BarChart2, Zap, Target, BookOpen,
    ArrowRight, CheckCircle2, Sparkles, Flame, TrendingUp,
    Play, ChevronRight, Star, Users, Award, Shield,
    Pause, Save
} from "lucide-react";

/* ─────────────────────────────────────────────
   INTERSECTION OBSERVER HOOK
   Triggers "visible" class when element enters viewport
───────────────────────────────────────────── */
function useInView(threshold = 0.12) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return [ref, visible];
}

/* ─────────────────────────────────────────────
   COUNT-UP HOOK  (for social proof numbers)
───────────────────────────────────────────── */
function useCountUp(target, duration = 1800, start = false) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!start) return;
        let frame;
        let startTime = null;
        const step = (ts) => {
            if (!startTime) startTime = ts;
            const p = Math.min((ts - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(ease * target));
            if (p < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [target, duration, start]);
    return val;
}

/* ─────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=IBM+Plex+Mono:wght@300;400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');

:root {
  --cream: #f5f0e8;
  --parchment: #ede7d9;
  --parchment2: #e4dccb;
  --card: #faf7f2;
  --ink: #1e1a14;
  --ink-muted: #5c5445;
  --ink-faint: #9c9283;
  --sepia: #7a6a54;
  --amber: #c4913a;
  --amber-deep: #a87830;
  --amber-light: #e8b96a;
  --amber-pale: rgba(196,145,58,.08);
  --amber-glow: rgba(196,145,58,.18);
  --terra: #b85c4a;
  --sage: #6b8c6b;
  --border: #ddd5c4;
  --border-h: #c8bc9e;
  --f-serif: 'Playfair Display', Georgia, serif;
  --f-mono: 'IBM Plex Mono', monospace;
  --f-body: 'Lora', Georgia, serif;
  --ease: cubic-bezier(.16,1,.3,1);
  --spring: cubic-bezier(.34,1.56,.64,1);
}
.dark {
  --cream: #15120c;
  --parchment: #1c1912;
  --parchment2: #221f17;
  --card: #1c1912;
  --ink: #f0ead8;
  --ink-muted: #b8aa94;
  --ink-faint: #7a6e5e;
  --sepia: #a0906c;
  --border: #2e2a20;
  --border-h: #3e3828;
  --amber-pale: rgba(196,145,58,.06);
  --amber-glow: rgba(196,145,58,.12);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* GRAIN */
.lp-grain {
  pointer-events: none; position: fixed; inset: 0;
  width: 100%; height: 100%; opacity: .032; z-index: 0;
  mix-blend-mode: multiply;
}
.dark .lp-grain { opacity: .06; mix-blend-mode: screen; }

/* PAGE */
.lp { min-height: 100vh; background: var(--cream); color: var(--ink); font-family: var(--f-body); overflow-x: hidden; }

/* ── SCROLL REVEAL ── */
.reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s var(--ease), transform .7s var(--ease); }
.reveal.vis { opacity: 1; transform: translateY(0); }
.reveal-l { opacity: 0; transform: translateX(-28px); transition: opacity .7s var(--ease), transform .7s var(--ease); }
.reveal-l.vis { opacity: 1; transform: translateX(0); }
.reveal-r { opacity: 0; transform: translateX(28px); transition: opacity .7s var(--ease), transform .7s var(--ease); }
.reveal-r.vis { opacity: 1; transform: translateX(0); }

/* ── HERO ── */
.hero {
  position: relative;
  min-height: 96vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 140px 24px 80px;
  overflow: hidden;
}
.hero-bg-blob {
  position: absolute;
  width: 900px; height: 900px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(196,145,58,.13) 0%, transparent 70%);
  top: -200px; left: 50%; transform: translateX(-50%);
  pointer-events: none;
  animation: blobFloat 8s ease-in-out infinite;
}
.hero-bg-blob2 {
  position: absolute;
  width: 600px; height: 600px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(107,140,107,.08) 0%, transparent 70%);
  bottom: -100px; right: -100px;
  pointer-events: none;
  animation: blobFloat 10s ease-in-out infinite reverse;
}
@keyframes blobFloat { 0%,100%{transform:translateX(-50%) scale(1)} 50%{transform:translateX(-50%) scale(1.08)} }
.hero-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-mono); font-size: .62rem; letter-spacing: .2em; text-transform: uppercase;
  color: var(--amber); padding: 6px 14px; border-radius: 20px;
  border: 1px solid rgba(196,145,58,.3);
  background: var(--amber-pale);
  margin-bottom: 28px;
  animation: fadeUp .6s var(--ease) .1s both;
}
.hero-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--amber); animation: pulse 2.5s ease-in-out infinite; }
.hero-h1 {
  font-family: var(--f-serif);
  font-size: clamp(3rem, 8vw, 7rem);
  font-weight: 900;
  line-height: .92;
  letter-spacing: -.04em;
  color: var(--ink);
  max-width: 900px;
  animation: fadeUp .8s var(--ease) .2s both;
}
.hero-h1 em { font-style: italic; color: var(--amber); }
.hero-h1 span.outline {
  -webkit-text-stroke: 2px var(--ink);
  color: transparent;
}
.dark .hero-h1 span.outline { -webkit-text-stroke: 2px var(--ink); }
.hero-sub {
  font-family: var(--f-mono);
  font-size: clamp(.72rem, 1.5vw, .88rem);
  color: var(--ink-faint);
  letter-spacing: .04em;
  line-height: 1.9;
  max-width: 540px;
  margin: 24px auto 0;
  animation: fadeUp .7s var(--ease) .35s both;
}
.hero-actions {
  display: flex; align-items: center; justify-content: center; gap: 14px;
  margin-top: 44px; flex-wrap: wrap;
  animation: fadeUp .7s var(--ease) .5s both;
}
.btn-hero-primary {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--ink); color: var(--cream);
  font-family: var(--f-mono); font-size: .76rem; letter-spacing: .08em; text-transform: uppercase;
  padding: 14px 32px; border-radius: 4px; border: none; cursor: pointer;
  text-decoration: none;
  transition: background .2s, transform .2s var(--spring), box-shadow .2s;
}
.btn-hero-primary:hover { background: var(--amber); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(196,145,58,.3); }
.btn-hero-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  background: transparent; color: var(--ink-muted);
  font-family: var(--f-mono); font-size: .76rem; letter-spacing: .08em; text-transform: uppercase;
  padding: 13px 28px; border-radius: 4px; border: 1px solid var(--border);
  text-decoration: none;
  transition: all .2s;
}
.btn-hero-ghost:hover { border-color: var(--amber); color: var(--amber); transform: translateY(-1px); }
.hero-scroll-hint {
  position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  animation: fadeUp .6s var(--ease) 1.2s both;
}
.hero-scroll-line { width: 1px; height: 48px; background: linear-gradient(180deg, var(--amber), transparent); animation: scrollDrop 1.8s ease-in-out infinite; }
.hero-scroll-label { font-family: var(--f-mono); font-size: .56rem; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-faint); }
@keyframes scrollDrop { 0%{opacity:0;transform:scaleY(0);transform-origin:top} 50%{opacity:1;transform:scaleY(1)} 100%{opacity:0;transform:scaleY(0);transform-origin:bottom} }

/* ── HERO DASHBOARD PREVIEW ── */
.hero-preview {
  position: relative;
  width: 100%;
  max-width: 1000px;
  margin: 60px auto 0;
  animation: fadeUp .8s var(--ease) .7s both;
}
.hero-preview-frame {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 40px 100px rgba(30,26,20,.15), 0 0 0 1px var(--border);
  position: relative;
  overflow: hidden;
}
.hero-preview-frame::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 60%, var(--cream) 100%);
  z-index: 2; pointer-events: none;
}
.dark .hero-preview-frame { box-shadow: 0 40px 100px rgba(0,0,0,.5), 0 0 0 1px var(--border); }
.dark .hero-preview-frame::before { background: linear-gradient(180deg, transparent 60%, var(--cream) 100%); }

/* Mini dashboard header */
.pv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.pv-title { font-family: var(--f-serif); font-size: 1rem; font-weight: 600; color: var(--ink); }
.pv-badge { font-family: var(--f-mono); font-size: .58rem; letter-spacing: .12em; text-transform: uppercase; background: var(--amber-pale); color: var(--amber); border: 1px solid rgba(196,145,58,.3); padding: 3px 10px; border-radius: 20px; }
/* Stat row */
.pv-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 14px; }
.pv-stat { background: var(--parchment); border: 1px solid var(--border); border-radius: 8px; padding: 14px 12px; }
.pv-stat-val { font-family: var(--f-serif); font-size: 1.5rem; font-weight: 700; color: var(--ink); letter-spacing: -.02em; line-height: 1; }
.pv-stat-label { font-family: var(--f-mono); font-size: .55rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-faint); margin-top: 4px; }
/* Bar chart preview */
.pv-chart-area { display: flex; align-items: flex-end; gap: 6px; height: 70px; margin-bottom: 10px; }
.pv-bar { border-radius: 3px 3px 0 0; background: var(--amber); opacity: .8; flex: 1; transition: opacity .2s; }
.pv-bar:hover { opacity: 1; }
/* Session cards row */
.pv-sessions { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
.pv-session { background: var(--parchment); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.pv-session-type { font-family: var(--f-mono); font-size: .56rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-faint); }
.pv-session-title { font-family: var(--f-serif); font-size: .82rem; font-weight: 600; color: var(--ink); margin-top: 4px; }
.pv-session-meta { font-family: var(--f-mono); font-size: .56rem; color: var(--ink-faint); margin-top: 6px; }

/* ── TRUST STRIP ── */
.trust-strip {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--parchment);
  padding: 40px 48px;
}
.trust-inner { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(4,1fr); gap: 40px; }
@media(max-width:768px){ .trust-inner { grid-template-columns: repeat(2,1fr); gap: 28px; } }
.trust-stat { text-align: center; }
.trust-val { font-family: var(--f-serif); font-size: clamp(2rem,4vw,3rem); font-weight: 900; color: var(--ink); letter-spacing: -.04em; line-height: 1; }
.trust-label { font-family: var(--f-mono); font-size: .62rem; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-faint); margin-top: 6px; }

/* ── SECTION WRAPPER ── */
.section { padding: 100px 48px; max-width: 1200px; margin: 0 auto; }
@media(max-width:768px){ .section { padding: 72px 20px; } }
.section-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--f-mono); font-size: .6rem; letter-spacing: .2em; text-transform: uppercase;
  color: var(--amber); margin-bottom: 16px;
}
.section-eyebrow::before { content: ''; display: block; width: 20px; height: 1px; background: var(--amber); opacity: .6; }
.section-h2 {
  font-family: var(--f-serif);
  font-size: clamp(2rem, 4vw, 3.6rem);
  font-weight: 900;
  letter-spacing: -.04em;
  line-height: 1.0;
  color: var(--ink);
}
.section-h2 em { font-style: italic; color: var(--amber); }
.section-sub {
  font-family: var(--f-body);
  font-size: .95rem;
  color: var(--ink-muted);
  line-height: 1.75;
  max-width: 520px;
  margin-top: 16px;
}

/* ── SECTION RULE ── */
.s-rule { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.s-rule-line { flex: 1; height: 1px; background: var(--border); }
.s-rule-glyph { font-family: var(--f-serif); font-size: .8rem; color: var(--amber); opacity: .6; }
.s-rule-label { font-family: var(--f-mono); font-size: .6rem; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-faint); }

/* ── FEATURES ── */
.features-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-top: 56px; }
@media(max-width:900px){ .features-grid { grid-template-columns: repeat(2,1fr); } }
@media(max-width:560px){ .features-grid { grid-template-columns: 1fr; } }
.feature-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px 24px;
  transition: transform .25s var(--spring), box-shadow .25s, border-color .25s;
  cursor: default;
  position: relative;
  overflow: hidden;
}
.feature-card::before {
  content: '';
  position: absolute; top: 0; left: 0;
  width: 100%; height: 2px;
  background: var(--accent, var(--amber));
  transform: scaleX(0); transform-origin: left;
  transition: transform .4s var(--ease);
}
.feature-card:hover::before { transform: scaleX(1); }
.feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(30,26,20,.12); border-color: var(--border-h); }
.feature-card-icon {
  width: 44px; height: 44px; border-radius: 10px;
  display: grid; place-items: center;
  background: var(--amber-pale);
  border: 1px solid rgba(196,145,58,.2);
  color: var(--amber);
  margin-bottom: 18px;
  transition: background .2s, transform .2s var(--spring);
}
.feature-card:hover .feature-card-icon { background: var(--amber-glow); transform: scale(1.1); }
.feature-card-title { font-family: var(--f-serif); font-size: 1.1rem; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.feature-card-desc { font-family: var(--f-body); font-size: .82rem; color: var(--ink-muted); line-height: 1.7; }

/* ── LARGE FEATURE (bento-style) ── */
.feature-large { grid-column: span 2; }
@media(max-width:560px){ .feature-large { grid-column: span 1; } }

/* ── PRODUCT PREVIEW (full bento) ── */
.preview-section { background: var(--parchment); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 80px 48px; }
@media(max-width:768px){ .preview-section { padding: 60px 20px; } }
.preview-inner { max-width: 1200px; margin: 0 auto; }
.preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 52px; }
@media(max-width:900px){ .preview-grid { grid-template-columns: 1fr; } }

/* Focus mode preview card */
.pv-focus-card {
  background: var(--ink);
  border-radius: 16px;
  padding: 36px 32px;
  position: relative;
  overflow: hidden;
  display: flex; flex-direction: column; gap: 24px;
}
.pv-focus-card::after { content: '◈'; position: absolute; bottom: -10px; right: 16px; font-size: 6rem; color: rgba(255,255,255,.03); line-height: 1; font-family: var(--f-serif); pointer-events: none; }
.pv-timer-display { font-family: var(--f-serif); font-size: 3.5rem; font-weight: 900; color: var(--cream); letter-spacing: -.04em; line-height: 1; }
.pv-timer-label { font-family: var(--f-mono); font-size: .62rem; text-transform: uppercase; letter-spacing: .14em; color: rgba(240,234,216,.4); margin-top: 4px; }
.pv-timer-bar { height: 4px; background: rgba(255,255,255,.1); border-radius: 2px; overflow: hidden; margin-top: 16px; }
.pv-timer-fill { height: 100%; width: 65%; background: var(--amber); border-radius: 2px; }
.pv-controls { display: flex; gap: 10px; }
.pv-ctrl-btn { display: flex; align-items: center; gap: 6px; font-family: var(--f-mono); font-size: .65rem; letter-spacing: .06em; padding: 8px 16px; border-radius: 4px; border: 1px solid rgba(255,255,255,.12); background: transparent; color: rgba(240,234,216,.7); cursor: default; }
.pv-ctrl-primary { background: var(--amber); color: #fff; border-color: transparent; }

/* Analytics preview card */
.pv-analytics-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px 24px;
  display: flex; flex-direction: column; gap: 20px;
}
.pv-mini-bars { display: flex; align-items: flex-end; gap: 5px; height: 80px; }
.pv-mini-bar { border-radius: 3px 3px 0 0; background: var(--amber); opacity: .7; flex: 1; }
.pv-mini-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.pv-mini-stat { text-align: center; background: var(--parchment); border-radius: 8px; padding: 12px 8px; border: 1px solid var(--border); }
.pv-mini-stat-val { font-family: var(--f-serif); font-size: 1.4rem; font-weight: 700; color: var(--ink); letter-spacing: -.02em; }
.pv-mini-stat-label { font-family: var(--f-mono); font-size: .55rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-faint); margin-top: 2px; }

/* Sessions list preview */
.pv-sessions-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
}
.pv-session-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.pv-session-row:last-child { border-bottom: none; }
.pv-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--amber); flex-shrink: 0; }
.pv-dot.done { background: var(--sage); }
.pv-session-info { flex: 1; }
.pv-session-name { font-family: var(--f-serif); font-size: .88rem; font-weight: 600; color: var(--ink); }
.pv-session-meta2 { font-family: var(--f-mono); font-size: .58rem; color: var(--ink-faint); margin-top: 2px; }
.pv-session-badge { font-family: var(--f-mono); font-size: .58rem; padding: 2px 8px; border-radius: 20px; background: var(--amber-pale); color: var(--amber); border: 1px solid rgba(196,145,58,.2); }

/* ── ANALYTICS SHOWCASE ── */
.analytics-section { padding: 100px 48px; }
@media(max-width:768px){ .analytics-section { padding: 72px 20px; } }
.analytics-inner { max-width: 1200px; margin: 0 auto; }
.analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 52px; align-items: start; }
@media(max-width:900px){ .analytics-grid { grid-template-columns: 1fr; } }
.analytics-text { display: flex; flex-direction: column; gap: 28px; }
.analytics-point { display: flex; align-items: flex-start; gap: 16px; }
.analytics-point-icon {
  width: 36px; height: 36px; border-radius: 8px;
  display: grid; place-items: center; flex-shrink: 0;
  background: var(--amber-pale); border: 1px solid rgba(196,145,58,.2); color: var(--amber);
}
.analytics-point-title { font-family: var(--f-serif); font-size: 1rem; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.analytics-point-desc { font-family: var(--f-body); font-size: .82rem; color: var(--ink-muted); line-height: 1.65; }
.analytics-chart-card {
  background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px;
  position: sticky; top: 100px;
}
.analytics-chart-title { font-family: var(--f-serif); font-size: 1rem; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.analytics-chart-sub { font-family: var(--f-mono); font-size: .6rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-faint); margin-bottom: 20px; }

/* Fake area chart */
.fake-area { position: relative; height: 140px; overflow: hidden; margin-bottom: 20px; }
.fake-area svg { width: 100%; height: 100%; }
.heatmap-mini { display: grid; grid-template-columns: repeat(12,1fr); gap: 2px; margin-top: 16px; }
.heatmap-mini-week { display: flex; flex-direction: column; gap: 2px; }
.hm-mini-cell { aspect-ratio: 1; border-radius: 2px; }
.hm-l0 { background: var(--parchment); }
.hm-l1 { background: rgba(196,145,58,.2); }
.hm-l2 { background: rgba(196,145,58,.45); }
.hm-l3 { background: rgba(196,145,58,.72); }
.hm-l4 { background: var(--amber); }

/* Streak card */
.streak-card { background: var(--ink); border-radius: 10px; padding: 16px 18px; display: flex; align-items: center; gap: 14px; margin-top: 14px; }
.streak-icon { width: 38px; height: 38px; border-radius: 8px; background: var(--amber); display: grid; place-items: center; color: #fff; flex-shrink: 0; }
.streak-val { font-family: var(--f-serif); font-size: 1.6rem; font-weight: 700; color: var(--cream); letter-spacing: -.02em; }
.streak-label { font-family: var(--f-mono); font-size: .58rem; text-transform: uppercase; letter-spacing: .12em; color: rgba(240,234,216,.45); }

/* ── CTA SECTION ── */
.cta-section {
  background: var(--ink);
  padding: 120px 48px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.cta-section::before {
  content: '✦';
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  font-size: 40rem; line-height: 1;
  color: rgba(255,255,255,.015);
  font-family: var(--f-serif);
  pointer-events: none;
}
.cta-inner { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; }
.cta-eyebrow { font-family: var(--f-mono); font-size: .62rem; letter-spacing: .2em; text-transform: uppercase; color: var(--amber-light); margin-bottom: 24px; display: flex; align-items: center; justify-content: center; gap: 10px; }
.cta-h2 { font-family: var(--f-serif); font-size: clamp(2.4rem,5vw,4.5rem); font-weight: 900; letter-spacing: -.04em; line-height: .95; color: var(--cream); margin-bottom: 20px; }
.cta-h2 em { font-style: italic; color: var(--amber); }
.cta-sub { font-family: var(--f-body); font-size: .92rem; color: rgba(240,234,216,.5); line-height: 1.75; margin-bottom: 40px; }
.btn-cta { display: inline-flex; align-items: center; gap: 10px; background: var(--amber); color: #fff; font-family: var(--f-mono); font-size: .78rem; letter-spacing: .1em; text-transform: uppercase; padding: 16px 40px; border-radius: 4px; border: none; cursor: pointer; text-decoration: none; transition: all .2s var(--spring); }
.btn-cta:hover { opacity: .88; transform: translateY(-3px) scale(1.02); box-shadow: 0 12px 40px rgba(196,145,58,.4); }
.cta-note { font-family: var(--f-mono); font-size: .6rem; letter-spacing: .1em; color: rgba(240,234,216,.3); margin-top: 20px; text-transform: uppercase; }

/* ── TESTIMONIALS ── */
.testimonials-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-top: 52px; }
@media(max-width:900px){ .testimonials-grid { grid-template-columns: 1fr; } }
.testimonial-card {
  background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 24px;
  transition: transform .22s var(--spring), box-shadow .22s, border-color .22s;
}
.testimonial-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(30,26,20,.1); border-color: var(--border-h); }
.testimonial-stars { display: flex; gap: 3px; color: var(--amber); margin-bottom: 14px; }
.testimonial-quote { font-family: var(--f-body); font-size: .85rem; font-style: italic; color: var(--ink-muted); line-height: 1.7; margin-bottom: 16px; }
.testimonial-author { font-family: var(--f-mono); font-size: .62rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-faint); }
.testimonial-role { font-family: var(--f-mono); font-size: .58rem; color: var(--amber); margin-top: 2px; }

/* ── FOOTER ── */
.footer {
  border-top: 1px solid var(--border);
  background: var(--parchment);
  padding: 48px;
}
@media(max-width:768px){ .footer { padding: 36px 20px; } }
.footer-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.footer-logo { font-family: var(--f-serif); font-size: 1.1rem; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 6px; }
.footer-logo em { font-style: italic; color: var(--amber); }
.footer-links { display: flex; gap: 28px; font-family: var(--f-mono); font-size: .65rem; text-transform: uppercase; letter-spacing: .1em; }
.footer-link { color: var(--ink-faint); text-decoration: none; transition: color .2s; }
.footer-link:hover { color: var(--amber); }
.footer-copy { font-family: var(--f-mono); font-size: .6rem; letter-spacing: .08em; color: var(--ink-faint); }

/* ── ANIMATIONS ── */
@keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.82)} }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ── RESPONSIVE HELPERS ── */
@media(max-width:768px) {
  .pv-stats { grid-template-columns: repeat(2,1fr); }
  .pv-sessions { grid-template-columns: 1fr; }
  .hero-h1 { letter-spacing: -.03em; }
  .trust-strip { padding: 40px 20px; }
  .cta-section { padding: 80px 24px; }
}
`;

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const FEATURES = [
    {
        icon: Brain,
        title: "AI Study Plan Generator",
        desc: "Describe your goal and Claude builds a step-by-step structured study plan with time allocation, key concepts, and practice suggestions.",
        accent: "var(--amber)",
        large: true,
    },
    {
        icon: Clock,
        title: "Focus Mode Timer",
        desc: "Distraction-free Pomodoro timer that tracks every minute of deep work and logs it automatically to your dashboard.",
        accent: "var(--terra)",
    },
    {
        icon: BarChart2,
        title: "Personalised Analytics",
        desc: "Streak heatmaps, weekly trends, and performance scores that reveal exactly when and how you study best.",
        accent: "var(--sage)",
    },
    {
        icon: Target,
        title: "Session Goal Tracking",
        desc: "Define a clear goal before each session and mark tasks complete as you go — every session has a purpose.",
        accent: "var(--sepia)",
    },
    {
        icon: Zap,
        title: "Smart Insights",
        desc: "AI-powered insights surface patterns from your data — your best study day, optimal session length, and more.",
        accent: "var(--amber)",
    },
];

const TESTIMONIALS = [
    {
        quote: "FocusFlow transformed how I study for my CS degree. The AI plans are eerily accurate at breaking down complex topics.",
        author: "Aarav S.",
        role: "CS Student, Delhi University",
    },
    {
        quote: "I used to waste hours planning. Now I click Generate and have a structured 2-hour session ready in seconds. Game changer.",
        author: "Priya M.",
        role: "UPSC Aspirant",
    },
    {
        quote: "The analytics page alone is worth it. Seeing my streak heatmap filling up is the best motivation to study every day.",
        author: "James K.",
        role: "Self-learner, London",
    },
];

const BAR_HEIGHTS = [22, 38, 28, 55, 45, 68, 80];
const MINI_BAR_HEIGHTS = [30, 50, 40, 70, 60, 85, 75];

/* ─────────────────────────────────────────────
   HEATMAP GENERATOR
───────────────────────────────────────────── */
function miniHeatmap() {
    const levels = [0,0,0,1,1,2,3,4,2,3,1,0];
    return levels.map((l, wi) => ({
        week: wi,
        days: [0,1,2,3,4,5,6].map((d) => {
            const base = l;
            const v = Math.max(0, Math.min(4, base + Math.round((Math.random() - 0.5) * 2)));
            return v;
        }),
    }));
}
const HEATMAP_DATA = miniHeatmap();

/* ─────────────────────────────────────────────
   STAT COUNTER COMPONENT
───────────────────────────────────────────── */
function StatCounter({ value, suffix = "", label, start }) {
    const val = useCountUp(value, 1800, start);
    return (
        <div className="trust-stat">
            <div className="trust-val">{val.toLocaleString()}{suffix}</div>
            <div className="trust-label">{label}</div>
        </div>
    );
}

/* ─────────────────────────────────────────────
   FAKE AREA CHART (SVG)
───────────────────────────────────────────── */
function FakeAreaChart() {
    const pts = [
        [0,110],[60,90],[120,100],[180,65],[240,75],[300,45],[360,20],
    ];
    const pathD = pts.map(([x,y], i) => `${i===0?"M":"L"}${x},${y}`).join(" ");
    const areaD = pathD + ` L360,140 L0,140 Z`;
    return (
        <div className="fake-area">
            <svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c4913a" stopOpacity=".35"/>
                        <stop offset="100%" stopColor="#c4913a" stopOpacity="0"/>
                    </linearGradient>
                </defs>
                {/* Grid */}
                {[30,60,90,120].map(y => (
                    <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="var(--border)" strokeWidth="0.5"/>
                ))}
                <path d={areaD} fill="url(#areaG)"/>
                <path d={pathD} fill="none" stroke="#c4913a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                {pts.map(([x,y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#c4913a"/>)}
                {/* Labels */}
                {["Oct","Nov","Dec","Jan","Feb","Mar","Apr"].map((m, i) => (
                    <text key={m} x={i * 60} y="138" fontFamily="'IBM Plex Mono'" fontSize="8" fill="var(--ink-faint)" textAnchor="middle">{m}</text>
                ))}
            </svg>
        </div>
    );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function Landing() {
    const [trustRef, trustVis] = useInView(0.3);
    const [featRef, featVis] = useInView();
    const [prevRef, prevVis] = useInView();
    const [analyticsRef, analyticsVis] = useInView();
    const [ctaRef, ctaVis] = useInView(0.3);
    const [testRef, testVis] = useInView();

    return (
        <>
            <style>{CSS}</style>
            <div className="lp">
                {/* Grain overlay */}
                <svg className="lp-grain" xmlns="http://www.w3.org/2000/svg">
                    <filter id="lg"><feTurbulence type="fractalNoise" baseFrequency=".66" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
                    <rect width="100%" height="100%" filter="url(#lg)"/>
                </svg>

                {/* NAVBAR */}
                <Navbar/>

                {/* ═══════════════════════════════════
                    HERO SECTION
                ═══════════════════════════════════ */}
                <section className="hero" id="hero">
                    <div className="hero-bg-blob"/>
                    <div className="hero-bg-blob2"/>

                    <div className="hero-eyebrow">
                        <div className="hero-eyebrow-dot"/>
                        AI-Powered Focus & Study
                    </div>

                    <h1 className="hero-h1">
                        Study <em>Smarter.</em><br/>
                        Focus <span className="outline">Deeper.</span>
                    </h1>

                    <p className="hero-sub">
                        FocusFlow AI combines AI study planning, distraction-free focus sessions, and intelligent analytics — in one beautiful tool built for serious learners.
                    </p>

                    <div className="hero-actions">
                        <Link to="/signup" className="btn-hero-primary">
                            Start for Free <ArrowRight size={15}/>
                        </Link>
                        <Link to="/login" className="btn-hero-ghost">
                            <Play size={13}/> See it in action
                        </Link>
                    </div>

                    {/* Dashboard preview */}
                    <div className="hero-preview">
                        <div className="hero-preview-frame">
                            <div className="pv-header">
                                <div className="pv-title">Good morning, Scholar</div>
                                <div className="pv-badge">✦ AI Insight Active</div>
                            </div>
                            <div className="pv-stats">
                                {[
                                    { val:"24", label:"Sessions" },
                                    { val:"18h 20m", label:"Focus Time" },
                                    { val:"5d", label:"Streak" },
                                    { val:"78", label:"Score" },
                                ].map((s) => (
                                    <div key={s.label} className="pv-stat">
                                        <div className="pv-stat-val">{s.val}</div>
                                        <div className="pv-stat-label">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="pv-chart-area">
                                {BAR_HEIGHTS.map((h, i) => (
                                    <div key={i} className="pv-bar" style={{ height:`${h}%`, opacity: i === 6 ? 1 : 0.6 + i * 0.04 }}/>
                                ))}
                            </div>
                            <div className="pv-sessions">
                                {[
                                    { type:"Deep Work", title:"Calculus — Integration", meta:"45m · Today" },
                                    { type:"Revision", title:"Quantum Mechanics", meta:"30m · Yesterday" },
                                    { type:"Reading", title:"Modernist Poetry", meta:"35m · Mar 24" },
                                ].map((s) => (
                                    <div key={s.title} className="pv-session">
                                        <div className="pv-session-type">{s.type}</div>
                                        <div className="pv-session-title">{s.title}</div>
                                        <div className="pv-session-meta">{s.meta}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="hero-scroll-hint">
                        <div className="hero-scroll-line"/>
                        <div className="hero-scroll-label">Scroll</div>
                    </div>
                </section>

                {/* ═══════════════════════════════════
                    TRUST STRIP
                ═══════════════════════════════════ */}
                <div className="trust-strip" ref={trustRef}>
                    <div className="trust-inner">
                        <StatCounter value={12400} suffix="+" label="Sessions Logged" start={trustVis}/>
                        <StatCounter value={3200} suffix="+" label="Active Learners" start={trustVis}/>
                        <StatCounter value={98400} suffix="h" label="Focus Hours Tracked" start={trustVis}/>
                        <StatCounter value={94} suffix="%" label="User Satisfaction" start={trustVis}/>
                    </div>
                </div>

                {/* ═══════════════════════════════════
                    FEATURES SECTION
                ═══════════════════════════════════ */}
                <section className="section" id="features" ref={featRef}>
                    <div className={`reveal${featVis ? " vis" : ""}`}>
                        <div className="section-eyebrow">Features</div>
                        <h2 className="section-h2">
                            Everything a serious<br/>learner <em>needs.</em>
                        </h2>
                        <p className="section-sub">
                            From AI-generated plans to real-time focus tracking — FocusFlow gives you the tools to build genuine, lasting study habits.
                        </p>
                    </div>

                    <div className="features-grid" style={{ marginTop: 56 }}>
                        {FEATURES.map(({ icon: Icon, title, desc, accent, large }, i) => (
                            <div
                                key={title}
                                className={`feature-card${large ? " feature-large" : ""} reveal${featVis ? " vis" : ""}`}
                                style={{ "--accent": accent, transitionDelay:`${i * 80}ms` }}
                            >
                                <div className="feature-card-icon" style={{ background:`rgba(${accent.includes("amber") ? "196,145,58" : accent.includes("terra") ? "184,92,74" : accent.includes("sage") ? "107,140,107" : "122,106,84"},.1)`, borderColor:`rgba(${accent.includes("amber") ? "196,145,58" : "107,140,107"},.2)`, color:accent }}>
                                    <Icon size={18} strokeWidth={1.6}/>
                                </div>
                                <div className="feature-card-title">{title}</div>
                                <div className="feature-card-desc">{desc}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════════════════════════════════
                    PRODUCT PREVIEW
                ═══════════════════════════════════ */}
                <div className="preview-section" id="product" ref={prevRef}>
                    <div className="preview-inner">
                        <div className={`s-rule reveal${prevVis ? " vis" : ""}`}>
                            <div className="s-rule-line"/>
                            <span className="s-rule-glyph">✦</span>
                            <span className="s-rule-label">Product Preview</span>
                            <span className="s-rule-glyph">✦</span>
                            <div className="s-rule-line"/>
                        </div>

                        <div className={`reveal${prevVis ? " vis" : ""}`} style={{ textAlign:"center", transitionDelay:"80ms" }}>
                            <h2 className="section-h2" style={{ display:"inline-block" }}>
                                The complete<br/><em>focus toolkit.</em>
                            </h2>
                            <p className="section-sub" style={{ margin:"16px auto 0" }}>
                                Three powerful tools working together — so you spend time learning, not managing.
                            </p>
                        </div>

                        <div className="preview-grid" style={{ marginTop:52 }}>
                            {/* Focus Mode card */}
                            <div className={`pv-focus-card reveal-l${prevVis ? " vis" : ""}`} style={{ transitionDelay:"160ms" }}>
                                <div>
                                    <div style={{ fontFamily:"var(--f-mono)", fontSize:".6rem", textTransform:"uppercase", letterSpacing:".14em", color:"rgba(240,234,216,.4)", marginBottom:8 }}>Focus Mode · Active</div>
                                    <div className="pv-timer-display">01:23:47</div>
                                    <div className="pv-timer-label">Deep Work · Calculus</div>
                                    <div className="pv-timer-bar"><div className="pv-timer-fill"/></div>
                                </div>
                                <div>
                                    <div style={{ fontFamily:"var(--f-mono)", fontSize:".58rem", textTransform:"uppercase", letterSpacing:".1em", color:"rgba(240,234,216,.35)", marginBottom:10 }}>Study Tip</div>
                                    <div style={{ fontFamily:"var(--f-body)", fontSize:".8rem", fontStyle:"italic", color:"rgba(240,234,216,.55)", lineHeight:1.6 }}>
                                        "Clarity of goal = speed of execution. Know what done looks like."
                                    </div>
                                </div>
                                <div className="pv-controls">
                                    <div className="pv-ctrl-btn pv-ctrl-primary"><Pause size={12}/> Pause</div>
                                    <div className="pv-ctrl-btn">Reset</div>
                                    <div className="pv-ctrl-btn"><Save size={12}/> Save</div>
                                </div>
                            </div>

                            {/* Right column */}
                            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                                {/* Analytics preview */}
                                <div className={`pv-analytics-card reveal-r${prevVis ? " vis" : ""}`} style={{ transitionDelay:"220ms" }}>
                                    <div>
                                        <div style={{ fontFamily:"var(--f-serif)", fontSize:"1rem", fontWeight:600, color:"var(--ink)", marginBottom:2 }}>Weekly Focus</div>
                                        <div style={{ fontFamily:"var(--f-mono)", fontSize:".58rem", textTransform:"uppercase", letterSpacing:".1em", color:"var(--ink-faint)", marginBottom:14 }}>Minutes · last 7 days</div>
                                        <div className="pv-mini-bars">
                                            {MINI_BAR_HEIGHTS.map((h, i) => (
                                                <div key={i} className="pv-mini-bar" style={{ height:`${h}%` }}/>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pv-mini-stats">
                                        {[
                                            { val:"2h 40m", label:"This week" },
                                            { val:"42m", label:"Avg session" },
                                            { val:"75%", label:"Completed" },
                                        ].map((s) => (
                                            <div key={s.label} className="pv-mini-stat">
                                                <div className="pv-mini-stat-val">{s.val}</div>
                                                <div className="pv-mini-stat-label">{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sessions list */}
                                <div className={`pv-sessions-card reveal-r${prevVis ? " vis" : ""}`} style={{ transitionDelay:"300ms" }}>
                                    <div style={{ fontFamily:"var(--f-serif)", fontSize:".95rem", fontWeight:600, color:"var(--ink)", marginBottom:14 }}>Recent Sessions</div>
                                    {[
                                        { name:"Calculus Integration", meta:"45m · Deep Work", done:true },
                                        { name:"Quantum Mechanics", meta:"30m · Reading", done:true },
                                        { name:"Modernist Poetry", meta:"35m · Revision", done:false },
                                    ].map((s) => (
                                        <div key={s.name} className="pv-session-row">
                                            <div className={`pv-dot${s.done ? " done" : ""}`}/>
                                            <div className="pv-session-info">
                                                <div className="pv-session-name">{s.name}</div>
                                                <div className="pv-session-meta2">{s.meta}</div>
                                            </div>
                                            <div className="pv-session-badge">{s.done ? "✓ Done" : "Active"}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════
                    ANALYTICS SECTION
                ═══════════════════════════════════ */}
                <div className="analytics-section" id="analytics" ref={analyticsRef}>
                    <div className="analytics-inner">
                        <div className="analytics-grid">
                            {/* Left: text */}
                            <div className="analytics-text">
                                <div className={`reveal-l${analyticsVis ? " vis" : ""}`}>
                                    <div className="section-eyebrow">Analytics</div>
                                    <h2 className="section-h2">
                                        Your data tells<br/>the <em>whole story.</em>
                                    </h2>
                                    <p className="section-sub">
                                        Don't just study — understand how you study. FocusFlow surfaces patterns you'd never notice on your own.
                                    </p>
                                </div>

                                {[
                                    { icon:TrendingUp, title:"Focus Time Trends", desc:"See how your study hours grow week over week. Visual proof that your habits are compounding." },
                                    { icon:Flame, title:"Streak & Consistency", desc:"A GitHub-style activity heatmap that makes missing a day feel genuinely costly — in the best way." },
                                    { icon:Sparkles, title:"AI-Powered Insights", desc:"\"You study best on Tuesdays\" — FocusFlow tells you things your own intuition misses." },
                                ].map(({ icon:Icon, title, desc }, i) => (
                                    <div
                                        key={title}
                                        className={`analytics-point reveal-l${analyticsVis ? " vis" : ""}`}
                                        style={{ transitionDelay:`${(i+1)*100}ms` }}
                                    >
                                        <div className="analytics-point-icon"><Icon size={16} strokeWidth={1.6}/></div>
                                        <div>
                                            <div className="analytics-point-title">{title}</div>
                                            <div className="analytics-point-desc">{desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Right: chart card */}
                            <div className={`analytics-chart-card reveal-r${analyticsVis ? " vis" : ""}`} style={{ transitionDelay:"200ms" }}>
                                <div className="analytics-chart-title">Focus Trend</div>
                                <div className="analytics-chart-sub">Monthly focus minutes · last 7 months</div>
                                <FakeAreaChart/>

                                {/* Heatmap */}
                                <div style={{ fontFamily:"var(--f-mono)", fontSize:".58rem", textTransform:"uppercase", letterSpacing:".12em", color:"var(--ink-faint)", marginBottom:8 }}>Activity · 12 Weeks</div>
                                <div className="heatmap-mini">
                                    {HEATMAP_DATA.map((week) => (
                                        <div key={week.week} className="heatmap-mini-week">
                                            {week.days.map((l, d) => (
                                                <div key={d} className={`hm-mini-cell hm-l${l}`} style={{ width:"100%", aspectRatio:"1", borderRadius:2 }}/>
                                            ))}
                                        </div>
                                    ))}
                                </div>

                                {/* Streak card */}
                                <div className="streak-card">
                                    <div className="streak-icon"><Flame size={17}/></div>
                                    <div>
                                        <div className="streak-val">12d</div>
                                        <div className="streak-label">Current Streak</div>
                                    </div>
                                    <div style={{ marginLeft:"auto", fontFamily:"var(--f-mono)", fontSize:".6rem", color:"rgba(240,234,216,.35)", textAlign:"right", lineHeight:1.6 }}>
                                        Keep going —<br/>don't break the chain.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════
                    TESTIMONIALS
                ═══════════════════════════════════ */}
                <section className="section" ref={testRef}>
                    <div className={`s-rule reveal${testVis ? " vis" : ""}`}>
                        <div className="s-rule-line"/>
                        <span className="s-rule-glyph">✦</span>
                        <span className="s-rule-label">Testimonials</span>
                        <span className="s-rule-glyph">✦</span>
                        <div className="s-rule-line"/>
                    </div>
                    <div className={`reveal${testVis ? " vis" : ""}`} style={{ textAlign:"center", transitionDelay:"80ms" }}>
                        <h2 className="section-h2" style={{ display:"inline-block" }}>
                            Learners who made the<br/><em>switch.</em>
                        </h2>
                    </div>
                    <div className="testimonials-grid">
                        {TESTIMONIALS.map((t, i) => (
                            <div
                                key={t.author}
                                className={`testimonial-card reveal${testVis ? " vis" : ""}`}
                                style={{ transitionDelay:`${(i+1)*100}ms` }}
                            >
                                <div className="testimonial-stars">
                                    {[1,2,3,4,5].map(s => <Star key={s} size={13} fill="currentColor"/>)}
                                </div>
                                <div className="testimonial-quote">"{t.quote}"</div>
                                <div className="testimonial-author">{t.author}</div>
                                <div className="testimonial-role">{t.role}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════════════════════════════════
                    CTA SECTION
                ═══════════════════════════════════ */}
                <section className="cta-section" ref={ctaRef}>
                    <div className={`cta-inner reveal${ctaVis ? " vis" : ""}`}>
                        <div className="cta-eyebrow">
                            <Sparkles size={13}/>
                            Start your journey
                        </div>
                        <h2 className="cta-h2">
                            Focus <em>smarter.</em><br/>Learn faster.
                        </h2>
                        <p className="cta-sub">
                            Join thousands of students and self-learners who've replaced chaos with clarity. Free to start. No credit card required.
                        </p>
                        <Link to="/signup" className="btn-cta">
                            Get started free <ArrowRight size={16}/>
                        </Link>
                        <div className="cta-note">
                            Free forever plan · No credit card · Works on any device
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════
                    FOOTER
                ═══════════════════════════════════ */}
                <footer className="footer">
                    <div className="footer-inner">
                        <div className="footer-logo">
                            FocusFlow <em>AI</em>
                        </div>
                        <div className="footer-links">
                            <a href="#features" className="footer-link">Features</a>
                            <a href="#product" className="footer-link">Product</a>
                            <a href="#analytics" className="footer-link">Analytics</a>
                            <Link to="/signup" className="footer-link">Sign Up</Link>
                        </div>
                        <div className="footer-copy">
                            © {new Date().getFullYear()} FocusFlow AI · Built for serious learners.
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}