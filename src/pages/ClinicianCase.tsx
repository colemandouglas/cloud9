import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { clinician } from "../lib/api";
import { PHASES, TEMPLATES, aggLabel, flagLabel, pattern, type Case, type TemplateKey } from "../lib/protocol";
import { Back, Pill } from "../components/ui";

export default function ClinicianCase() {
  const { id = "" } = useParams();
  const [c, setC] = useState<Case | null | undefined>();
  const [tpl, setTpl] = useState<TemplateKey>("general");
  const [phase, setPhase] = useState(PHASES[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    clinician.get(id).then(
      (x) => {
        setC(x);
        const [sug] = pattern(x);
        setTpl(x.program?.template ?? sug ?? "general");
        setPhase(x.program?.phase ?? PHASES[0]);
        setNotes(x.program?.notes ?? "");
      },
      () => setC(null)
    );
  }, [id]);

  if (c === undefined) return <p className="loading">Loading…</p>;
  if (c === null)
    return (
      <>
        <Back to="/clinician" />
        <p className="sub">This case isn't available.</p>
      </>
    );

  const [, why] = pattern(c);
  const list = (l: string[]) => l.map(aggLabel).join(", ") || "None selected";

  async function save(patch: Parameters<typeof clinician.update>[1], done: string) {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      setC(await clinician.update(id, patch));
      setMsg(done);
    } catch {
      setErr("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Back to="/clinician">Queue</Back>
      <div className="headrow">
        <div>
          <h2>{c.name}</h2>
          <p className="sub">{[c.age && `${c.age} years`, c.email].filter(Boolean).join(", ") || "No contact details"}</p>
        </div>
        <Pill status={c.status} />
      </div>

      {c.flags.length > 0 && (
        <div className="alert">
          <b>Red flags reported</b>
          {c.flags.map((f) => <div key={f}>{flagLabel(f)}</div>)}
          Contact the client and direct them to urgent care before any program.
          {c.status === "flag" && (
            <div className="row">
              <button className="btn ghost small" disabled={saving} onClick={() => save({ status: c.program ? "assigned" : "review" }, "Red flag cleared.")}>
                Cleared by a doctor
              </button>
            </div>
          )}
        </div>
      )}

      <section className="card">
        <h3>Symptoms</h3>
        <dl>
          <dt>Main problem</dt><dd>{c.complaint || "Not given"}</dd>
          <dt>Leg symptoms</dt><dd>{c.legSide ? `${c.legSide}, ${c.legPain} of 10` : "None"}</dd>
          <dt>Back pain</dt><dd>{c.backPain} of 10</dd>
          <dt>Duration</dt><dd>{c.duration}</dd>
          <dt>Worse with</dt><dd>{list(c.worse)}</dd>
          <dt>Eased by</dt><dd>{list(c.eases)}</dd>
          <dt>Recent surgery</dt><dd>{c.surgery ? "Yes" : "No"}</dd>
          <dt>Treatments</dt><dd>{c.treatments || "Not given"}</dd>
          <dt>Goals</dt><dd>{c.goals || "Not given"}</dd>
        </dl>
        <div className="hint"><strong>Pattern note for the clinician:</strong> {why}</div>
      </section>

      <section className="card">
        <h3>Imaging</h3>
        {c.imaging &&
          (/^image\//.test(c.imaging.type) ? (
            <img className="img" src={clinician.imagingUrl(c.id)} alt="Uploaded imaging report" />
          ) : (
            <p><a href={clinician.imagingUrl(c.id)} target="_blank" rel="noopener">Open {c.imaging.name}</a></p>
          ))}
        {c.report ? <div className="report">{c.report}</div> : !c.imaging && <p className="sub" style={{ margin: 0 }}>No imaging provided.</p>}
      </section>

      <section className="card">
        <h3>Assign a program</h3>
        <div className="fld">
          <label className="f" htmlFor="tpl">Template</label>
          <select id="tpl" value={tpl} onChange={(e) => setTpl(e.target.value as TemplateKey)}>
            {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
          </select>
          <p className="sub" style={{ margin: "6px 0 0", fontSize: 14 }}>{TEMPLATES[tpl].fit}</p>
        </div>
        <div className="fld">
          <label className="f" htmlFor="phase">Starting phase</label>
          <select id="phase" value={phase} onChange={(e) => setPhase(e.target.value)}>
            {PHASES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="fld">
          <label className="f" htmlFor="cnotes">Notes for the client</label>
          <textarea id="cnotes" placeholder="Start with Level I cardio only. Message me if leg symptoms spread." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="err" role="alert">{err}</p>
        {msg && <p className="sub" role="status" style={{ color: "var(--ok)" }}>{msg}</p>}
        <button className="btn" disabled={saving} onClick={() => save({ program: { template: tpl, phase, notes } }, c.status === "flag" ? "Program saved. The client sees it once the red flag is cleared." : "Program saved.")}>
          {saving ? "Saving…" : c.program ? "Update program" : "Assign program"}
        </button>
        {c.status === "new" && (
          <div className="row">
            <button className="btn ghost small" disabled={saving} onClick={() => save({ status: "review" }, "Marked in review.")}>Mark in review</button>
          </div>
        )}
      </section>
    </>
  );
}
