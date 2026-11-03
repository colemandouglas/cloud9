import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Spinner } from "../components/ui";

export default function SignIn() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      setSent(await api.signIn(email));
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <section className="card center">
        <h2>Check your email</h2>
        <p className="sub">We sent a sign-in link to <strong>{email}</strong>. It works once and expires in 30 minutes.</p>
        {sent.devLink && <p className="hintline">Dev mode: <a href={sent.devLink}>open the sign-in link</a></p>}
        <button className="btn ghost small" onClick={() => setSent(null)}>Use a different email</button>
      </section>
    );

  return (
    <form className="card" onSubmit={submit}>
      <h2>Sign in</h2>
      {params.get("expired") && <p className="err">That link has expired or was already used. Send yourself a new one.</p>}
      <p className="sub">No password needed. We'll email you a link.</p>
      <div className="fld">
        <label className="f" htmlFor="em">Email</label>
        <input id="em" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <p className="err" role="alert">{err}</p>
      </div>
      <button className="btn" disabled={busy || !email}>{busy ? <><Spinner /> Sending…</> : "Email me a link"}</button>
      <p className="sub" style={{ margin: "14px 0 0", textAlign: "center" }}>New here? <Link to="/">Pick a goal to start</Link></p>
    </form>
  );
}
