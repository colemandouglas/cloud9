import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Logo } from "./ui";
import { api, type Me } from "../lib/api";

export default function AppShell() {
  const [me, setMe] = useState<Me | null>(null);
  const loc = useLocation();
  useEffect(() => { api.me().then(setMe, () => setMe(null)); }, [loc.pathname]);
  return (
    <div className="wrap">
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
      {me && (
        <footer className="app-foot">
          Signed in as {me.email} ·{" "}
          <button className="linkbtn" onClick={() => api.signOut().then(() => (location.href = "/"))}>Sign out</button>
        </footer>
      )}
    </div>
  );
}
