import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Journey } from "../lib/api";
import { AGG, READINESS, RED_FLAGS, spinePattern } from "../lib/catalog";
import { PlanView, ProgressView } from "../components/program";
import { Back } from "../components/ui";
import { STATUS_LABEL } from "./Home";

const label = (list: string[][], v: string) => list.find((x) => x[0] === v)?.[1] ?? v;
const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

export default function CoachJourney() {
  const { id = "" } = useParams();
  const [j, setJ] = useState<Journey | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api.admin.journey(id).then((x) => { setJ(x); setNote(x.coachNote); }, (e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (err) return <p className="err">{err}</p>;
  if (!j) return <p className="loading">Loading…</p>;

  const [st, cls] = STATUS_LABEL[j.status] || ["", ""];
  const d = j.details;
  const rows = Object.entries(d).filter(([, v]) => v !== "" && v != null && !(Array.isArray(v) && !v.length));
  const act = (p: Promise<unknown>, done: string) => p.then(() => { setMsg(done); load(); }, (e) => setMsg(e.message));

  return (
    <>
      <Back to="/coach">All journeys</Back>
      <div className="headrow">
        <div><h2>{j.user?.name || j.user?.email}</h2><p className="sub">{j.user?.email} · {j.goalTitle} · started {j.startDate}</p></div>
        <span className={`pill ${cls}`}>{st}</span>
      </div>

      {j.screening.redFlags.length > 0 && (
        <div className="alert"><b>Red flags reported</b>{j.screening.redFlags.map((f) => <div key={f}>{label(RED_FLAGS, f)}</div>)}</div>
      )}
      {j.screening.readiness.length > 0 && (
        <div className="hint" style={{ marginBottom: 14 }}>
          <strong>Readiness answers:</strong> {j.screening.readiness.map((f) => label(READINESS, f)).join("; ")}. {j.screening.cleared ? "Says a doctor cleared them." : "Not yet cleared."}
        </div>
      )}
      {["flagged", "needs_clearance"].includes(j.status) && (
        <button className="btn" style={{ marginBottom: 14 }} onClick={() => act(api.admin.clear(j.id), "Cleared. Building the program.")}>Cleared by a doctor: build program</button>
      )}

      <section className="card">
        <h3>Intake</h3>
        <dl>
          {rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{["worse", "eases"].includes(k) ? (v as string[]).map((x) => label(AGG, x)).join(", ") : show(v)}</dd></Fragment>)}
          {Object.entries(j.profile).filter(([, v]) => v !== "" && v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{show(v)}</dd></Fragment>)}
        </dl>
        {d.area === "Lower back or spine" && <div className="hint"><strong>Pattern note:</strong> {spinePattern(d.worse, d.eases, d.surgery, !!d.legSide)}</div>}
        {j.uploads.length > 0 && (
          <><h3 style={{ marginTop: 16 }}>Uploads</h3><ul className="bullets">{j.uploads.map((u) => <li key={u.id}><a href={api.uploadUrl(u.id)} target="_blank" rel="noopener">{u.name}</a></li>)}</ul></>
        )}
      </section>

      <section className="card">
        <h3>Coach note</h3>
        <p className="sub">Shown to the client and followed by the AI when it builds the next block.</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hold off on rotation until week 6." />
        <div className="row">
          <button className="btn small" onClick={() => act(api.admin.note(j.id, note), "Note saved.")}>Save note</button>
          {j.blocks.length > 0 && <button className="btn ghost small" onClick={() => act(api.admin.regenerate(j.id), "Rebuilding the latest block.")}>Rebuild latest block</button>}
        </div>
        {msg && <p className="sub ok" role="status" style={{ marginTop: 10 }}>{msg}</p>}
      </section>

      {j.blocks.some((b) => b.program) && (<><ProgressView j={j} /><PlanView j={j} /></>)}
      {j.blocks.filter((b) => b.error).map((b) => <p key={b.idx} className="err">Block {b.idx + 1}: {b.error}</p>)}
    </>
  );
}
