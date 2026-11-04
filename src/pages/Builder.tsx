import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api, todayStr, type Me } from "../lib/api";
import {
  GOALS, HEALTH_FOCUS, EVENTS, EVENT_GOALS, EXPERIENCE, BODY_AREAS, OCCASIONS, TONE_FOCUS, ADVENTURES,
  ACTIVITY, DAYS, MINUTES, PLACES, READINESS, RED_FLAGS, AGG,
} from "../lib/catalog";
import { Back, GoalIcon, Spinner } from "../components/ui";

type Goal = keyof typeof GOALS;
type Dict = Record<string, any>;

// ---------- small inputs ----------
function Chips({ options, value, onChange, multi = false }: { options: readonly (string | number | readonly (string | number)[])[]; value: any; onChange: (v: any) => void; multi?: boolean }) {
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, String(o)])) as [any, string][];
  const on = (v: any) => (multi ? (value || []).includes(v) : value === v);
  const toggle = (v: any) => onChange(multi ? (on(v) ? value.filter((x: any) => x !== v) : [...(value || []), v]) : on(v) ? "" : v);
  return (
    <div className="chips" role={multi ? "group" : "radiogroup"}>
      {opts.map(([v, l]) => (
        <button type="button" key={String(v)} className="chip" role={multi ? "checkbox" : "radio"} aria-checked={on(v)} onClick={() => toggle(v)}>{l}</button>
      ))}
    </div>
  );
}
const Field = ({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) => (
  <div className="fld">
    {id ? <label className="f" htmlFor={id}>{label}</label> : <span className="f">{label}</span>}
    {children}
    {hint && <p className="hintline">{hint}</p>}
  </div>
);
const Check = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) => (
  <label className="opt"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{children}</label>
);
const Slider = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="fld">
    <label className="f">{label}: <strong>{value}</strong> of 10</label>
    <input type="range" min={0} max={10} value={value} onChange={(e) => onChange(+e.target.value)} />
  </div>
);

const DRAFT_KEY = "blw.draft";
const loadDraft = (goal: string) => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    return d?.goal === goal ? d : null;
  } catch { return null; }
};

export default function Builder() {
  const { goal = "" } = useParams();
  const nav = useNavigate();
  const g = GOALS[goal as Goal];
  const draft = useMemo(() => loadDraft(goal), [goal]);

  const [me, setMe] = useState<Me | null | undefined>();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Dict>(draft?.details ?? { backPain: 3, legPain: 3, pain: 3, worse: [], eases: [], focus: goal === "health" ? [] : "" });
  const [profile, setProfile] = useState<Dict>(draft?.profile ?? { days: 3, minutes: 45, places: [] });
  const [screening, setScreening] = useState<Dict>(draft?.screening ?? { readiness: [], redFlags: [], cleared: false, none: false, noneFlags: false });
  const [extra, setExtra] = useState<Dict>({ startDate: todayStr(), email: "", consent: false });
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);

  useEffect(() => { api.me().then(setMe, () => setMe(null)); }, []);
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ goal, details, profile, screening })); } catch {}
  }, [goal, details, profile, screening]);

  if (!g) return <Navigate to="/" replace />;

  const d = (k: string) => (v: any) => setDetails((p) => ({ ...p, [k]: v }));
  const p = (k: string) => (v: any) => setProfile((x) => ({ ...x, [k]: v }));
  const s = (k: string) => (v: any) => setScreening((x) => ({ ...x, [k]: v }));
  const isBack = details.area === "Lower back or spine";

  // ---------- steps ----------
  const goalStep = {
    title: goal === "medical" ? "Your records" : "Your goal",
    valid: () => {
      if (goal === "event" && !details.event) return "Pick your event.";
      if (goal === "tone" && !details.occasion) return "Pick what you're getting ready for.";
      if (goal === "adventure" && !details.adventure) return "Pick your adventure.";
      if (goal === "medical" && !details.area) return "Pick the area you're working on.";
      return "";
    },
    body: (
      <>
        {goal === "health" && (
          <>
            <Field label="What matters most to you?"><Chips multi options={HEALTH_FOCUS} value={details.focus} onChange={d("focus")} /></Field>
            <Field label="Anything else we should know?" id="notes"><textarea id="notes" value={details.notes || ""} onChange={(e) => d("notes")(e.target.value)} placeholder="I want to play with my kids without my back aching" /></Field>
          </>
        )}
        {goal === "event" && (
          <>
            <Field label="Which event?"><Chips options={EVENTS} value={details.event} onChange={d("event")} /></Field>
            {details.event === "Other" && <Field label="Tell us the event" id="eo"><input id="eo" type="text" value={details.eventOther || ""} onChange={(e) => d("eventOther")(e.target.value)} /></Field>}
            <Field label="Event date" id="date" hint="We'll build up to it and taper before the day."><input id="date" type="date" min={todayStr()} value={details.date || ""} onChange={(e) => d("date")(e.target.value)} /></Field>
            <Field label="What's the goal?"><Chips options={EVENT_GOALS} value={details.eventGoal} onChange={d("eventGoal")} /></Field>
            {details.eventGoal === "Hit a time goal" && <Field label="Target time" id="tt"><input id="tt" type="text" placeholder="1:45:00" value={details.targetTime || ""} onChange={(e) => d("targetTime")(e.target.value)} /></Field>}
            <Field label="Have you done one before?"><Chips options={EXPERIENCE} value={details.experience} onChange={d("experience")} /></Field>
          </>
        )}
        {goal === "tone" && (
          <>
            <Field label="What are you getting ready for?"><Chips options={OCCASIONS} value={details.occasion} onChange={d("occasion")} /></Field>
            {details.occasion === "Other" && <Field label="Tell us more" id="oo"><input id="oo" type="text" value={details.occasionOther || ""} onChange={(e) => d("occasionOther")(e.target.value)} /></Field>}
            <Field label="When is it?" id="date"><input id="date" type="date" min={todayStr()} value={details.date || ""} onChange={(e) => d("date")(e.target.value)} /></Field>
            <Field label="Main focus"><Chips options={TONE_FOCUS} value={details.focus} onChange={d("focus")} /></Field>
          </>
        )}
        {goal === "adventure" && (
          <>
            <Field label="What's the adventure?"><Chips options={ADVENTURES} value={details.adventure} onChange={d("adventure")} /></Field>
            {details.adventure === "Other" && <Field label="Tell us the adventure" id="ao"><input id="ao" type="text" value={details.adventureOther || ""} onChange={(e) => d("adventureOther")(e.target.value)} /></Field>}
            <Field label="When do you leave?" id="date"><input id="date" type="date" min={todayStr()} value={details.date || ""} onChange={(e) => d("date")(e.target.value)} /></Field>
            <Field label="Tell us about it" id="notes" hint="Distance, elevation, pack weight, days on the move."><textarea id="notes" value={details.notes || ""} onChange={(e) => d("notes")(e.target.value)} placeholder="Kilimanjaro, Lemosho route, 8 days, 25 lb pack" /></Field>
          </>
        )}
        {goal === "medical" && (
          <>
            <Field label="What are you working on?"><Chips options={BODY_AREAS} value={details.area} onChange={d("area")} /></Field>
            <Field label="Upload your records" hint="MRI or X-ray reports, diagnosis, treatment plan, or your surgeon's protocol. Photos (JPG, PNG) or PDFs, up to 5 files, 10 MB each. Written reports help more than scan images.">
              <label className="upload">
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])].slice(0, 5))} />
                <span>＋ Add files</span>
              </label>
              {files.length > 0 && (
                <ul className="files">
                  {files.map((f, i) => (
                    <li key={i}>{f.name} <span className="muted">({Math.ceil(f.size / 1024)} KB)</span>
                      <button type="button" className="linkbtn" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button></li>
                  ))}
                </ul>
              )}
            </Field>
            <Field label="Or paste report text" id="rt"><textarea id="rt" value={details.reportText || ""} onChange={(e) => d("reportText")(e.target.value)} placeholder="Impression: …" /></Field>
            <Field label="Diagnosis, in your words" id="dx"><textarea id="dx" value={details.diagnosis || ""} onChange={(e) => d("diagnosis")(e.target.value)} placeholder="L4-5 stenosis with right leg sciatica" /></Field>
            <Field label="Your doctor's treatment plan" id="tp"><textarea id="tp" value={details.treatmentPlan || ""} onChange={(e) => d("treatmentPlan")(e.target.value)} placeholder="PT twice a week for 8 weeks, then home program" /></Field>
            <Field label="Restrictions you've been given" id="rs"><textarea id="rs" value={details.restrictions || ""} onChange={(e) => d("restrictions")(e.target.value)} placeholder="No lifting over 20 lb for 6 weeks" /></Field>
            {isBack ? (
              <>
                <Slider label="Back pain right now" value={details.backPain} onChange={d("backPain")} />
                <Field label="Leg symptoms"><Chips options={[["", "None"], ["Right", "Right"], ["Left", "Left"], ["Both", "Both"]]} value={details.legSide ?? ""} onChange={(v: string) => d("legSide")(v ?? "")} /></Field>
                {details.legSide && <Slider label="Leg symptoms right now" value={details.legPain} onChange={d("legPain")} />}
                <Field label="What makes it worse?"><Chips multi options={AGG} value={details.worse} onChange={d("worse")} /></Field>
                <Field label="What eases it?"><Chips multi options={AGG} value={details.eases} onChange={d("eases")} /></Field>
                <Check checked={!!details.surgery} onChange={d("surgery")}>I've had spine surgery in the past year</Check>
              </>
            ) : (
              details.area && <Slider label="Pain right now" value={details.pain} onChange={d("pain")} />
            )}
            <Field label="How long has this been going on?"><Chips options={["Under 6 weeks", "6 to 12 weeks", "3 to 12 months", "Over a year"]} value={details.duration} onChange={d("duration")} /></Field>
            <Field label="Treatments so far" id="tx"><textarea id="tx" value={details.treatments || ""} onChange={(e) => d("treatments")(e.target.value)} placeholder="Physical therapy, injections, chiropractic…" /></Field>
          </>
        )}
      </>
    ),
  };

  const youStep = {
    title: "About you",
    valid: () => (!profile.name?.trim() ? "Tell us your name." : !profile.places?.length ? "Pick where you'll train." : ""),
    body: (
      <>
        <Field label="Your name" id="name"><input id="name" type="text" autoComplete="name" value={profile.name || ""} onChange={(e) => p("name")(e.target.value)} /></Field>
        <div className="grid2">
          <Field label="Age" id="age"><input id="age" type="number" inputMode="numeric" value={profile.age || ""} onChange={(e) => p("age")(e.target.value)} /></Field>
          <Field label="Sex" id="sex"><select id="sex" value={profile.sex || ""} onChange={(e) => p("sex")(e.target.value)}><option value="">Skip</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></Field>
          <Field label="Height" id="ht"><input id="ht" type="text" placeholder={`5'10"`} value={profile.height || ""} onChange={(e) => p("height")(e.target.value)} /></Field>
          <Field label="Weight" id="wt"><input id="wt" type="text" placeholder="180 lb" value={profile.weight || ""} onChange={(e) => p("weight")(e.target.value)} /></Field>
        </div>
        <Field label="How active are you now?"><Chips options={ACTIVITY} value={profile.activity} onChange={p("activity")} /></Field>
        <Field label="Days a week you can train"><Chips options={DAYS} value={profile.days} onChange={p("days")} /></Field>
        <Field label="Minutes per session"><Chips options={MINUTES.map((m) => [m, m === 75 ? "75+" : String(m)])} value={profile.minutes} onChange={p("minutes")} /></Field>
        <Field label="Where will you train?"><Chips multi options={PLACES} value={profile.places} onChange={p("places")} /></Field>
        <Field label="Equipment you have" id="eq"><input id="eq" type="text" placeholder="Dumbbells, bands, a bike, pool access" value={profile.equipment || ""} onChange={(e) => p("equipment")(e.target.value)} /></Field>
        {goal !== "medical" && <Field label="Old injuries or limitations" id="lim"><textarea id="lim" value={profile.limitations || ""} onChange={(e) => p("limitations")(e.target.value)} placeholder="Cranky left knee on stairs" /></Field>}
      </>
    ),
  };

  const anyReady = screening.readiness.length > 0;
  const safetyStep = {
    title: "Safety check",
    valid: () => {
      if (goal === "medical" && !screening.redFlags.length && !screening.noneFlags) return "Answer the warning-sign questions first.";
      if (!anyReady && !screening.none) return "Answer the health questions, or tick “None of these”.";
      return "";
    },
    body: (
      <>
        {goal === "medical" && (
          <fieldset>
            <legend>Warning signs</legend>
            <p className="sub">Tick anything that applies right now.</p>
            {RED_FLAGS.map(([v, l]) => (
              <Check key={v} checked={screening.redFlags.includes(v)} onChange={(c) => setScreening((x) => ({ ...x, noneFlags: false, redFlags: c ? [...x.redFlags, v] : x.redFlags.filter((y: string) => y !== v) }))}>{l}</Check>
            ))}
            <Check checked={screening.noneFlags} onChange={(c) => setScreening((x) => ({ ...x, noneFlags: c, redFlags: c ? [] : x.redFlags }))}>None of these</Check>
            {screening.redFlags.length > 0 && (
              <div className="alert" role="alert" style={{ marginTop: 10 }}>
                <b>See your doctor first</b>
                These can be signs of something that needs medical care. Please see your doctor as soon as you can. If you have numbness in the groin or trouble controlling your bladder or bowels, go to the emergency room now. You can still save your journey and we'll start once you're cleared.
              </div>
            )}
          </fieldset>
        )}
        <fieldset>
          <legend>{goal === "medical" ? "General health" : "Quick health check"}</legend>
          <p className="sub">So we know it's safe to start.</p>
          {READINESS.map(([v, l]) => (
            <Check key={v} checked={screening.readiness.includes(v)} onChange={(c) => setScreening((x) => ({ ...x, none: false, readiness: c ? [...x.readiness, v] : x.readiness.filter((y: string) => y !== v) }))}>{l}</Check>
          ))}
          <Check checked={screening.none} onChange={(c) => setScreening((x) => ({ ...x, none: c, readiness: c ? [] : x.readiness, cleared: false }))}>None of these</Check>
          {anyReady && (
            <div className="hint" style={{ marginTop: 10 }}>
              <p style={{ margin: "0 0 8px" }}>Please check with your doctor before starting a new program.</p>
              <Check checked={screening.cleared} onChange={s("cleared")}>My doctor has cleared me to exercise</Check>
            </div>
          )}
        </fieldset>
      </>
    ),
  };

  const yoursStep = {
    title: "Make it yours",
    valid: () => (!me && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra.email) ? "Enter your email so we can save your journey." : !extra.consent ? "Tick the box to continue." : ""),
    body: (
      <>
        <Field label="In your own words, what does success look like?" id="own"><textarea id="own" value={profile.ownWords || ""} onChange={(e) => p("ownWords")(e.target.value)} placeholder="Skiing all day in February without my back flaring up" /></Field>
        <Field label="Workouts you love" id="likes"><input id="likes" type="text" placeholder="Rowing, hiking, kettlebells" value={profile.likes || ""} onChange={(e) => p("likes")(e.target.value)} /></Field>
        <Field label="Workouts you'd rather skip" id="dis"><input id="dis" type="text" placeholder="Burpees, treadmill" value={profile.dislikes || ""} onChange={(e) => p("dislikes")(e.target.value)} /></Field>
        <Field label="Start date" id="sd"><input id="sd" type="date" min={todayStr()} value={extra.startDate} onChange={(e) => setExtra({ ...extra, startDate: e.target.value })} /></Field>
        {me === null && (
          <Field label="Your email" id="em" hint="We'll save your journey here and send you a link to sign in on any device.">
            <input id="em" type="email" autoComplete="email" value={extra.email} onChange={(e) => setExtra({ ...extra, email: e.target.value })} />
          </Field>
        )}
        <Check checked={extra.consent} onChange={(c) => setExtra({ ...extra, consent: c })}>
          I agree to the <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>. I understand this is a beta, my program is AI-generated general guidance and not medical advice, and I'll stop and check with a professional if something doesn't feel right.
        </Check>
      </>
    ),
  };

  const steps = goal === "medical" ? [safetyStep, goalStep, youStep, yoursStep] : [goalStep, youStep, safetyStep, yoursStep];
  const cur = steps[step];
  const last = step === steps.length - 1;

  async function next() {
    const problem = cur.valid();
    setErr(problem);
    if (problem) return;
    if (!last) {
      setStep(step + 1);
      window.scrollTo(0, 0);
      return;
    }
    setBusy(true);
    try {
      const { none, noneFlags, ...scr } = screening;
      const r = await api.createJourney({ goal, details, profile, screening: scr, startDate: extra.startDate, email: extra.email, consent: true }, files);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      if (r.needsVerify) setSent({ devLink: r.devLink });
      else nav(`/app/j/${r.journey.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (sent)
    return (
      <section className="card center">
        <h2>Check your email</h2>
        <p className="sub">You've been here before, so we sent a sign-in link to <strong>{extra.email}</strong>. Tap it and we'll start building your program.</p>
        {sent.devLink && <p className="hintline">Dev mode: <a href={sent.devLink}>open the sign-in link</a></p>}
      </section>
    );

  return (
    <>
      {step === 0 ? <Back to="/">All goals</Back> : <button className="back" onClick={() => { setStep(step - 1); setErr(""); }}>‹ Back</button>}
      <div className="builder-head">
        <span className="goal-ic sm"><GoalIcon name={g.icon} size={22} /></span>
        <div><p className="eyebrow dark">{g.title}</p><h2>{cur.title}</h2></div>
      </div>
      <div className="progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((x, i) => <div key={x.title} className={i <= step ? "on" : ""} />)}
      </div>
      <form className="card" noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
        {cur.body}
        <p className="err" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy || me === undefined} style={{ marginTop: 10 }}>
          {busy ? <><Spinner /> Saving…</> : last ? "Build my program" : "Continue"}
        </button>
      </form>
    </>
  );
}
