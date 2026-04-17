/**
 * Navbar.jsx — FocusFlow AI
 * Upgraded to match the editorial parchment/amber landing page aesthetic.
 * Features: sticky blur, scroll-aware opacity, smooth section scroll, theme toggle, Clerk auth.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useUser, UserButton } from "@clerk/clerk-react";
import useTheme from "../../hooks/useTheme";
import { Sun, Moon, Menu, X, Sparkles } from "lucide-react";

/* ── CSS ── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap');

.nav-root {
  position: fixed; top: 0; left: 0; right: 0;
  z-index: 100;
  transition: background .3s, border-color .3s, box-shadow .3s, padding .3s;
  font-family: 'IBM Plex Mono', monospace;
}

/* Transparent on top */
.nav-root.at-top {
  background: transparent;
  border-bottom: 1px solid transparent;
  padding: 18px 0;
}
/* Frosted when scrolled */
.nav-root.scrolled {
  background: rgba(245,240,232,.9);
  border-bottom: 1px solid #ddd5c4;
  box-shadow: 0 4px 24px rgba(30,26,20,.06);
  padding: 12px 0;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.dark .nav-root.at-top { background: transparent; border-bottom: 1px solid transparent; }
.dark .nav-root.scrolled {
  background: rgba(21,18,12,.88);
  border-bottom: 1px solid #2e2a20;
  box-shadow: 0 4px 24px rgba(0,0,0,.3);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
@media(max-width:768px){ .nav-inner { padding: 0 20px; } }

/* LOGO */
.nav-logo {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e1a14;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 2px;
  letter-spacing: -.01em;
  transition: color .2s;
}
.dark .nav-logo { color: #f0ead8; }
.nav-logo em { font-style: italic; color: #c4913a; }

/* LINKS */
.nav-links {
  display: flex;
  align-items: center;
  gap: 36px;
}
@media(max-width:768px){ .nav-links { display: none; } }

.nav-link {
  font-size: .68rem;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #5c5445;
  text-decoration: none;
  transition: color .2s;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}
.nav-link:hover { color: #c4913a; }
.dark .nav-link { color: #b8aa94; }
.dark .nav-link:hover { color: #e8b96a; }

/* ACTIONS */
.nav-actions { display: flex; align-items: center; gap: 12px; }

/* Theme toggle */
.nav-theme-btn {
  width: 34px; height: 34px;
  border-radius: 6px;
  border: 1px solid #ddd5c4;
  background: transparent;
  display: grid; place-items: center;
  color: #5c5445;
  cursor: pointer;
  transition: border-color .2s, color .2s, background .2s;
}
.nav-theme-btn:hover { border-color: #c4913a; color: #c4913a; }
.dark .nav-theme-btn { border-color: #2e2a20; color: #b8aa94; }
.dark .nav-theme-btn:hover { border-color: #c4913a; color: #e8b96a; }

/* Sign in link */
.nav-signin {
  font-size: .68rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: #5c5445;
  text-decoration: none;
  transition: color .2s;
}
.nav-signin:hover { color: #c4913a; }
.dark .nav-signin { color: #b8aa94; }
.dark .nav-signin:hover { color: #e8b96a; }

/* CTA button */
.nav-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #1e1a14;
  color: #f5f0e8;
  font-family: 'IBM Plex Mono', monospace;
  font-size: .68rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  padding: 9px 18px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background .2s, transform .15s;
  white-space: nowrap;
}
.nav-cta:hover { background: #c4913a; transform: translateY(-1px); }
.dark .nav-cta { background: #f0ead8; color: #1e1a14; }
.dark .nav-cta:hover { background: #c4913a; color: #fff; }

/* Dashboard link */
.nav-dashboard {
  font-size: .68rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: #5c5445;
  text-decoration: none;
  transition: color .2s;
}
.nav-dashboard:hover { color: #c4913a; }
.dark .nav-dashboard { color: #b8aa94; }
.dark .nav-dashboard:hover { color: #e8b96a; }

/* Mobile menu button */
.nav-mobile-btn {
  display: none;
  background: none;
  border: 1px solid #ddd5c4;
  border-radius: 6px;
  width: 34px; height: 34px;
  place-items: center;
  color: #5c5445;
  cursor: pointer;
  transition: border-color .2s, color .2s;
}
@media(max-width:768px){ .nav-mobile-btn { display: grid; } }
.dark .nav-mobile-btn { border-color: #2e2a20; color: #b8aa94; }
.nav-mobile-btn:hover { border-color: #c4913a; color: #c4913a; }

/* MOBILE DRAWER */
.nav-drawer {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: rgba(245,240,232,.97);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 40px 24px;
  transform: translateX(100%);
  transition: transform .35s cubic-bezier(.16,1,.3,1);
}
.dark .nav-drawer { background: rgba(21,18,12,.97); }
.nav-drawer.open { transform: translateX(0); }
.nav-drawer-close {
  position: absolute; top: 20px; right: 20px;
  width: 36px; height: 36px;
  border-radius: 6px;
  border: 1px solid #ddd5c4;
  background: none;
  display: grid; place-items: center;
  color: #5c5445;
  cursor: pointer;
}
.dark .nav-drawer-close { border-color: #2e2a20; color: #b8aa94; }
.nav-drawer-link {
  font-family: 'Playfair Display', serif;
  font-size: 2rem;
  font-weight: 600;
  color: #1e1a14;
  text-decoration: none;
  cursor: pointer;
  background: none; border: none;
  transition: color .2s;
}
.nav-drawer-link:hover { color: #c4913a; }
.dark .nav-drawer-link { color: #f0ead8; }
`;

/* ── SMOOTH SCROLL ── */
function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
}

export default function Navbar() {
    const { theme, toggleTheme } = useTheme();
    const { isSignedIn } = useUser();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // Track scroll position for transparent → frosted transition
    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 48);
        handler();
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, []);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        document.body.style.overflow = menuOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [menuOpen]);

    const NAV_LINKS = [
        { label: "Features",  id: "features"  },
        { label: "Product",   id: "product"   },
        { label: "Analytics", id: "analytics" },
    ];

    return (
        <>
            <style>{CSS}</style>

            {/* MAIN NAV */}
            <nav className={`nav-root ${scrolled ? "scrolled" : "at-top"}`}>
                <div className="nav-inner">
                    {/* Logo */}
                    <Link to="/" className="nav-logo">
                        FocusFlow <em>AI</em>
                    </Link>

                    {/* Desktop links */}
                    <div className="nav-links">
                        {NAV_LINKS.map(({ label, id }) => (
                            <button key={id} className="nav-link" onClick={() => scrollTo(id)}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="nav-actions">
                        {/* Theme toggle */}
                        <button className="nav-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
                            {theme === "light" ? <Moon size={15}/> : <Sun size={15}/>}
                        </button>

                        {!isSignedIn ? (
                            <>
                                <Link to="/login" className="nav-signin">
                                    Sign in
                                </Link>
                                <Link to="/signup" className="nav-cta">
                                    <Sparkles size={12}/> Get Started
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/dashboard" className="nav-dashboard">
                                    Dashboard
                                </Link>
                                <UserButton
                                    afterSignOutUrl="/"
                                    appearance={{ elements: { avatarBox: "w-8 h-8" } }}
                                />
                            </>
                        )}

                        {/* Mobile hamburger */}
                        <button className="nav-mobile-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
                            <Menu size={16}/>
                        </button>
                    </div>
                </div>
            </nav>

            {/* MOBILE DRAWER */}
            <div className={`nav-drawer${menuOpen ? " open" : ""}`} role="dialog" aria-modal="true">
                <button className="nav-drawer-close" onClick={() => setMenuOpen(false)}>
                    <X size={16}/>
                </button>

                {NAV_LINKS.map(({ label, id }) => (
                    <button
                        key={id}
                        className="nav-drawer-link"
                        onClick={() => { scrollTo(id); setMenuOpen(false); }}
                    >
                        {label}
                    </button>
                ))}

                {!isSignedIn ? (
                    <>
                        <Link to="/login" className="nav-drawer-link" onClick={() => setMenuOpen(false)}>
                            Sign in
                        </Link>
                        <Link to="/signup" className="nav-cta" onClick={() => setMenuOpen(false)}>
                            <Sparkles size={13}/> Get Started Free
                        </Link>
                    </>
                ) : (
                    <Link to="/dashboard" className="nav-cta" onClick={() => setMenuOpen(false)}>
                        Go to Dashboard
                    </Link>
                )}
            </div>
        </>
    );
}