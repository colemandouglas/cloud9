import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "./ui";

export default function AppShell() {
  return (
    <div className="wrap">
      <header className="app-header">
        <Link to="/" className="brand">
          <Logo />
          <div>
            <h1>Be Like Water</h1>
            <p>Spine recovery that adapts to you</p>
          </div>
        </Link>
        <nav className="roles" aria-label="View as">
          <NavLink to="/app">Client view</NavLink>
          <NavLink to="/clinician">Clinician view</NavLink>
        </nav>
      </header>
      <div className="proto">
        Prototype for testing. Programs here are not medical advice, and only your own data should be entered until a
        clinical partner and privacy setup are in place.
      </div>
      <main className="app">
        <Outlet />
      </main>
    </div>
  );
}
