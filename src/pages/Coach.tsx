import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { STATUS_LABEL } from "./Home";

type Data = Awaited<ReturnType<typeof api.admin.journeys>>;
const ORDER: Record<string, number> = { flagged: 0, error: 1, needs_clearance: 2, generating: 3, unverified: 4, active: 5 };

export default function Coach() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const load = () => api.admin.journeys().then(setData, (e) => setErr(e.message));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  if (err) return <section className="card"><h2>Coach view</h2><p className="sub" style={{ margin: 0 }}>{err} Coaches are set with ADMIN_EMAILS on the server.</p></section>;
  if (!data) return <p className="loading">Loading…</p>;
  const list = [...data.journeys].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || b.maxPain - a.maxPain || b.createdAt - a.createdAt);
  return (
    <>
      <h2>Coach view</h2>
      <p className="sub">Red flags and problems first.</p>
      {list.length === 0 && <section className="card"><p className="sub" style={{ margin: 0 }}>No journeys yet.</p></section>}
      {list.map((j) => {
        const [label, cls] = STATUS_LABEL[j.status] || ["", ""];
        return (
          <Link key={j.id} className="case" to={`/coach/${j.id}`}>
            <span className="who">
              <b>{j.user.name || j.user.email}</b>
              <span>{j.goalTitle} · {j.sessionsDone} sessions{j.maxPain ? ` · max pain ${j.maxPain}/10` : ""}</span>
            </span>
            {j.maxPain >= 7 && <span className="pill p-flag">High pain</span>}
            <span className={`pill ${cls}`}>{label}</span>
          </Link>
        );
      })}
      {data.waitlist.length > 0 && (
        <section className="card" style={{ marginTop: 20 }}>
          <h3>1:1 coaching waitlist ({data.waitlist.length})</h3>
          <ul className="week">{data.waitlist.map((w) => <li key={w.email}><span>{w.name || "–"}</span><span className="muted">{w.email}</span></li>)}</ul>
        </section>
      )}
    </>
  );
}
