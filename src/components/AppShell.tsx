import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Logo } from "./ui";
import { api, type Me } from "../lib/api";

export default function AppShell() {
  const [me, setMe] = useState<Me | null>(null);
  const loc = useLocation();
  useEffect(() => { api.me().then(setMe, () => setMe(null)); }, [loc.pathname]);
  // One check-in per day the app is opened, for streaks.
  useEffect(() => {
    if (!me) return;
    const key = "blw.checkin";
    const today = new Date().toDateString();
    try { if (localStorage.getItem(key) === today) return; } catch {}
    api.checkin().then(() => { try { localStorage.setItem(key, today); } catch {} }, () => {});
  }, [me]);
  const tabs = me && (loc.pathname.startsWith("/app"));
  return (
    <div className={`wrap ${tabs ? "has-tabs" : ""}`}>
      <header className="app-header">
        <Link to={me ? "/app" : "/"} className="brand">
          <Logo size={30} />
          <h1>Be Like Water</h1>
        </Link>
        <nav className="hnav" aria-label="Account">
          {me?.isAdmin && <Link to="/coach">Coach</Link>}
          {me ? <Link to="/app">My journeys</Link> : <Link to="/signin">Sign in</Link>}
        </nav>
      </header>
      <div className="proto">Beta. Programs are general guidance, not medical advice. In an emergency, call 911.</div>
      <main className="app">
        <Outlet />
      </main>
      {tabs && (
        <nav className="tabbar" aria-label="App">
          <NavLink to="/app" end={false} className={({ isActive }) => (isActive && /^\/app(\/j\/|$)/.test(loc.pathname) ? "active" : "")}><span aria-hidden="true">◎</span>Program</NavLink>
          <NavLink to="/app/points"><span aria-hidden="true">★</span>Points</NavLink>
          <NavLink to="/app/community"><span aria-hidden="true">≈</span>Community</NavLink>
          <NavLink to="/app/friends"><span aria-hidden="true">☺</span>Friends</NavLink>
        </nav>
      )}
      {me && (
        <footer className="app-foot">
          Signed in as {me.email} ·{" "}
          <button className="linkbtn" onClick={() => api.signOut().then(() => (location.href = "/"))}>Sign out</button>
          <br /><Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
        </footer>
      )}
    </div>
  );
}
