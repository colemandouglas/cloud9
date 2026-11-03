import { useEffect, useState, type FormEvent } from "react";
import { Outlet } from "react-router-dom";
import { clinician } from "../lib/api";

export default function ClinicianGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clinician.me().then(() => setAuthed(true), () => setAuthed(false));
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await clinician.login(pw);
      setPw("");
      setAuthed(true);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (authed === null) return <p className="loading">Checking sign-in…</p>;
  if (!authed)
    return (
      <form className="card" onSubmit={login}>
        <h2>Clinician sign-in</h2>
        <p className="sub">The review queue holds client health information. Sign in to continue.</p>
        <div className="fld">
          <label className="f" htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <p className="err" role="alert">{err}</p>
        </div>
        <button className="btn" disabled={busy || !pw}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    );
  return (
    <>
      <Outlet />
      <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
        <button className="btn ghost small" onClick={() => clinician.logout().finally(() => setAuthed(false))}>Sign out</button>
      </div>
    </>
  );
}
