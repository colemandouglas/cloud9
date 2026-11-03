import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { submitIntake } from "../lib/api";
import { AGG, DURATIONS, FLAGS } from "../lib/protocol";
import { Back, RED_FLAG_COPY } from "../components/ui";

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

function Checks({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid2">
      {AGG.map(([v, l]) => (
        <label key={v} className="opt">
          <input type="checkbox" checked={value.includes(v)} onChange={(e) => onChange(toggle(value, v, e.target.checked))} />
          {l}
        </label>
      ))}
    </div>
  );
}

export default function Intake() {
  const nav = useNavigate();
  const [f, setF] = useState({
    name: "", age: "", email: "", complaint: "", legSide: "", duration: DURATIONS[0],
    backPain: 3, legPain: 3, surgery: false, report: "", goals: "", treatments: "", consent: false,
  });
  const [worse, setWorse] = useState<string[]>([]);
  const [eases, setEases] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [noFlags, setNoFlags] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = "Enter your name";
    if (!f.consent) errs.consent = "Tick the box to continue";
    if (!noFlags && !flags.length) errs.flag = "Answer the emergency safety checks first";
    if (file && file.size > 10 * 1024 * 1024) errs.file = "That file is over 10 MB. Paste the report text instead.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const c = await submitIntake({ ...f, worse, eases, flags, noFlags, legPain: f.legSide ? f.legPain : 0 }, file);
      nav(c.status === "flag" ? "/app/flagged" : `/app/case/${c.id}`);
      window.scrollTo(0, 0);
    } catch (err) {
      setBusy(false);
      setErrors({ save: (err as Error).message || "Couldn't save your intake. Check your connection and submit again." });
    }
  }

  return (
    <>
      <Back to="/app" />
      <h2>Intake</h2>
      <p className="sub">About 5 minutes. Your physical therapist sees everything here.</p>
      <form className="card" noValidate onSubmit={submit}>
        <fieldset>
          <legend>Emergency safety checks</legend>
          <p className="sub">Tick anything that applies right now.</p>
          {FLAGS.map(([v, l]) => (
            <label key={v} className="opt">
              <input
                type="checkbox"
                checked={flags.includes(v)}
                onChange={(e) => {
                  setFlags(toggle(flags, v, e.target.checked));
                  if (e.target.checked) setNoFlags(false);
                  setErrors((x) => ({ ...x, flag: "" }));
                }}
              />
              {l}
            </label>
          ))}
          <label className="opt">
            <input
              type="checkbox"
              checked={noFlags}
              onChange={(e) => {
                setNoFlags(e.target.checked);
                if (e.target.checked) setFlags([]);
                setErrors((x) => ({ ...x, flag: "" }));
              }}
            />
            None of these apply right now
          </label>
          {flags.length > 0 && (
            <div className="alert" role="alert" style={{ marginTop: 10 }}>
              <b>See your doctor first</b>
              {RED_FLAG_COPY}
            </div>
          )}
          <p className="err">{errors.flag}</p>
        </fieldset>

        <fieldset>
          <legend>About you</legend>
          <div className="fld">
            <label className="f" htmlFor="name">Full name</label>
            <input id="name" type="text" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
            <p className="err">{errors.name}</p>
          </div>
          <div className="grid2">
            <div className="fld">
              <label className="f" htmlFor="age">Age</label>
              <input id="age" type="number" inputMode="numeric" min={18} max={100} value={f.age} onChange={(e) => set("age", e.target.value)} />
            </div>
            <div className="fld">
              <label className="f" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Your symptoms</legend>
          <div className="fld">
            <label className="f" htmlFor="complaint">Main problem</label>
            <input id="complaint" type="text" placeholder="Right leg sciatica after sitting" value={f.complaint} onChange={(e) => set("complaint", e.target.value)} />
          </div>
          <div className="grid2">
            <div className="fld">
              <label className="f" htmlFor="side">Which leg</label>
              <select id="side" value={f.legSide} onChange={(e) => set("legSide", e.target.value)}>
                <option value="">No leg symptoms</option>
                <option>Right</option>
                <option>Left</option>
                <option>Both</option>
              </select>
            </div>
            <div className="fld">
              <label className="f" htmlFor="dur">How long</label>
              <select id="dur" value={f.duration} onChange={(e) => set("duration", e.target.value)}>
                {DURATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="fld">
            <label className="f" htmlFor="back">Back pain right now: {f.backPain} of 10</label>
            <input id="back" type="range" min={0} max={10} step={1} value={f.backPain} onChange={(e) => set("backPain", +e.target.value)} />
          </div>
          {f.legSide && (
            <div className="fld">
              <label className="f" htmlFor="leg">Leg symptoms right now: {f.legPain} of 10</label>
              <input id="leg" type="range" min={0} max={10} step={1} value={f.legPain} onChange={(e) => set("legPain", +e.target.value)} />
            </div>
          )}
          <div className="fld">
            <span className="f">What makes it worse</span>
            <Checks value={worse} onChange={setWorse} />
          </div>
          <div className="fld">
            <span className="f">What eases it</span>
            <Checks value={eases} onChange={setEases} />
          </div>
          <label className="opt">
            <input type="checkbox" checked={f.surgery} onChange={(e) => set("surgery", e.target.checked)} />
            I've had spine surgery in the past year
          </label>
        </fieldset>

        <fieldset>
          <legend>Imaging</legend>
          <div className="fld">
            <label className="f" htmlFor="file">MRI or X-ray report (photo or PDF)</label>
            <input id="file" type="file" accept="image/*,application/pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors((x) => ({ ...x, file: "" })); }} />
            <p className="sub" style={{ margin: "6px 0 0", fontSize: 14 }}>The written report is more useful than the scan images.</p>
            <p className="err">{errors.file}</p>
          </div>
          <div className="fld">
            <label className="f" htmlFor="report">Or paste the report text</label>
            <textarea id="report" placeholder="Impression: …" value={f.report} onChange={(e) => set("report", e.target.value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Goals</legend>
          <div className="fld">
            <label className="f" htmlFor="goals">What do you want to get back to, and by when?</label>
            <textarea id="goals" placeholder="Skiing by February, golf by December" value={f.goals} onChange={(e) => set("goals", e.target.value)} />
          </div>
          <div className="fld">
            <label className="f" htmlFor="tx">Treatments so far</label>
            <textarea id="tx" placeholder="Physical therapy, injections, chiropractic…" value={f.treatments} onChange={(e) => set("treatments", e.target.value)} />
          </div>
        </fieldset>

        <label className="opt">
          <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
          I understand this is a prototype, a clinician reviews my answers, and it isn't emergency care.
        </label>
        <p className="err">{errors.consent}</p>
        <p className="err" role="alert">{errors.save}</p>
        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 14 }}>
          {busy ? "Submitting…" : "Submit for review"}
        </button>
      </form>
    </>
  );
}
