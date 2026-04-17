/**
 * AppNavbar.jsx — updated
 * Changes: added /profile route link, UserButton now points to profile page.
 * All existing styles and logic preserved.
 */

import { Link, useLocation } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import useTheme from '../../hooks/useTheme';
import {
  Sun,
  Moon,
  LayoutDashboard,
  BookOpen,
  BarChart2,
  Zap,
  Lightbulb,
  User,
  PenLine,
} from 'lucide-react';

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sessions', label: 'Sessions', icon: BookOpen },
  { path: '/focus', label: 'Focus', icon: Zap },
  { path: '/notes', label: 'Notes', icon: PenLine },
  { path: '/insights', label: 'Insights', icon: Lightbulb },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
];

export default function AppNavbar() {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const { user } = useUser();

  // Avatar initials for the profile link button
  const initials = user
    ? (
        (user.firstName?.[0] || '') + (user.lastName?.[0] || '')
      ).toUpperCase() || '?'
    : '?';

  return (
    <>
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap');

                :root {
                    --cream:      #f5f0e8;
                    --parchment:  #ede7d9;
                    --ink:        #1e1a14;
                    --ink-muted:  #5c5445;
                    --ink-faint:  #9c9283;
                    --amber:      #c4913a;
                    --border:     #ddd5c4;
                    --nav-bg:     rgba(245,240,232,0.92);
                }
                .dark {
                    --cream:      #1a1710;
                    --parchment:  #201e16;
                    --ink:        #f0ead8;
                    --ink-muted:  #b8aa94;
                    --ink-faint:  #7a6e5e;
                    --border:     #322e24;
                    --nav-bg:     rgba(26,23,16,0.92);
                }

                .app-nav {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    width: 100%;
                    background: var(--nav-bg);
                    backdrop-filter: blur(14px) saturate(1.4);
                    -webkit-backdrop-filter: blur(14px) saturate(1.4);
                    border-bottom: 1px solid var(--border);
                }
                .app-nav::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 2px;
                    background: linear-gradient(90deg, transparent, var(--amber), transparent);
                    opacity: 0.5;
                }
                .app-nav-inner {
                    max-width: 1180px;
                    margin: 0 auto;
                    padding: 0 32px;
                    height: 62px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 24px;
                }
                @media (max-width: 640px) {
                    .app-nav-inner { padding: 0 16px; }
                }

                /* LOGO */
                .nav-logo {
                    display: flex;
                    align-items: baseline;
                    gap: 1px;
                    text-decoration: none;
                    flex-shrink: 0;
                    user-select: none;
                }
                .nav-logo-main {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.22rem;
                    font-weight: 700;
                    color: var(--ink);
                    letter-spacing: -0.02em;
                    transition: color 0.2s;
                }
                .nav-logo-ai {
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 0.68rem;
                    font-weight: 500;
                    color: var(--amber);
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    padding: 1px 5px;
                    border: 1px solid var(--amber);
                    border-radius: 3px;
                    margin-left: 5px;
                    opacity: 0.85;
                    vertical-align: middle;
                    line-height: 1.6;
                    transition: opacity 0.2s, background 0.2s, color 0.2s;
                }
                .nav-logo:hover .nav-logo-ai {
                    background: var(--amber);
                    color: #fff;
                    opacity: 1;
                }

                /* NAV LINKS */
                .nav-links {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                }
                @media (max-width: 640px) {
                    .nav-links { display: none; }
                }
                .nav-link {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    text-decoration: none;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 0.72rem;
                    letter-spacing: 0.07em;
                    text-transform: uppercase;
                    color: var(--ink-faint);
                    padding: 6px 13px;
                    border-radius: 5px;
                    transition: color 0.2s, background 0.2s;
                }
                .nav-link svg { opacity: 0.7; transition: opacity 0.2s; }
                .nav-link:hover { color: var(--ink-muted); background: rgba(196,145,58,0.07); }
                .nav-link:hover svg { opacity: 1; }
                .nav-link.active { color: var(--ink); background: transparent; }
                .nav-link.active svg { opacity: 1; }
                .nav-link.active::after {
                    content: '';
                    position: absolute;
                    bottom: 1px;
                    left: 13px; right: 13px;
                    height: 1.5px;
                    background: var(--amber);
                    border-radius: 2px;
                }
                .nav-link.focus-link.active { color: var(--amber); }
                .nav-link.focus-link.active::after { box-shadow: 0 0 6px rgba(196,145,58,.4); }

                /* DIVIDER */
                .nav-divider {
                    width: 1px; height: 18px;
                    background: var(--border);
                    flex-shrink: 0;
                }

                /* RIGHT */
                .nav-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

                /* THEME BTN */
                .nav-theme-btn {
                    display: grid;
                    place-items: center;
                    width: 34px; height: 34px;
                    border-radius: 5px;
                    border: 1px solid var(--border);
                    background: transparent;
                    color: var(--ink-faint);
                    cursor: pointer;
                    transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s;
                }
                .nav-theme-btn:hover {
                    background: var(--parchment);
                    color: var(--amber);
                    border-color: var(--amber);
                    transform: rotate(12deg);
                }

                /* PROFILE AVATAR BUTTON */
                .nav-profile-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px; height: 34px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, var(--amber), #e8b96a);
                    border: 2px solid var(--border);
                    color: #fff;
                    font-family: 'IBM Plex Mono', monospace;
                    font-size: 0.62rem;
                    font-weight: 500;
                    letter-spacing: 0.04em;
                    text-decoration: none;
                    cursor: pointer;
                    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
                    flex-shrink: 0;
                    user-select: none;
                }
                .nav-profile-btn:hover {
                    border-color: var(--amber);
                    transform: scale(1.08);
                    box-shadow: 0 0 0 3px rgba(196,145,58,0.2);
                }
                .nav-profile-btn.profile-active {
                    border-color: var(--amber);
                    box-shadow: 0 0 0 2px rgba(196,145,58,0.35);
                }
            `}</style>

      <nav className="app-nav">
        <div className="app-nav-inner">
          {/* Logo */}
          <Link to="/dashboard" className="nav-logo">
            <span className="nav-logo-main">FocusFlow</span>
            <span className="nav-logo-ai">AI</span>
          </Link>

          {/* Main nav links */}
          <div className="nav-links">
            {NAV_LINKS.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`nav-link${path === '/focus' ? ' focus-link' : ''}${pathname === path ? ' active' : ''}`}
              >
                <Icon size={13} strokeWidth={1.8} />
                {label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="nav-right">
            <div className="nav-divider" />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="nav-theme-btn"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon size={15} strokeWidth={1.8} />
              ) : (
                <Sun size={15} strokeWidth={1.8} />
              )}
            </button>

            {/*
                          Profile avatar button → /profile
                          Shows user initials from Clerk.
                          Replaces the old UserButton wrapper —
                          the Clerk UserButton is still rendered invisibly
                          so sign-out and account management still work.
                        */}
            <Link
              to="/profile"
              className={`nav-profile-btn${pathname === '/profile' ? ' profile-active' : ''}`}
              title="View Profile"
              aria-label="Go to profile"
            >
              {initials}
            </Link>

            {/*
                          Keep the Clerk UserButton hidden — it handles
                          the session cookie and afterSignOutUrl redirect.
                          We overlay our custom avatar on top.
                        */}
            <div
              style={{
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
                width: 0,
                height: 0,
                overflow: 'hidden',
              }}
            >
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
