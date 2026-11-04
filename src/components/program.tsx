import { useState } from "react";
import { addDays, fmtDate, todayStr, type Day, type Journey, type Log } from "../lib/api";
import { Spinner } from "./ui";
import { VideoDemo } from "./VideoDemo";

export const BLOCK_WEEKS_UI = 4;

const TYPE_LABEL: Record<string, string> = {
  strength: "Strength", cardio: "Cardio", mobility: "Mobility", rehab: "Rehab", skill: "Skill", recovery: "Recovery", rest: "Rest",
};

function Scale({ value, onChange, from, to, label }: { value: number | null; onChange: (v: number | null) => void; from: number; to: number; label: string }) {
  const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <div className="scale" role="radiogroup" aria-label={label}>
      {nums.map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} onClick={() => onChange(value === n ? null : n)}>{n}</button>
      ))}
    </div>
  );
}

export function SessionCard({ day, date, isToday, log, medical, onSave }: {
  day: Day; date: string; isToday: boolean; log?: Log; medical: boolean;
  onSave: (entry: { done: boolean; effort: number | null; pain: number | null; note: string }) => Promise<void>;
}) {
  const [done, setDone] = useState(log?.done ?? false);
  const [effort, setEffort] = useState<number | null>(log?.effort ?? null);
  const [pain, setPain] = useState<number | null>(log?.pain ?? null);
  const [note, setNote] = useState(log?.note ?? "");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [demo, setDemo] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const future = date > todayStr();
  const rest = day.type === "rest";

  async function save(nextDone = done) {
    setState("saving");
    try {
      await onSave({ done: nextDone, effort, pain, note });
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <section className={`card session ${day.type}`}>
      <div className="session-head">
        <div>
          <p className="eyebrow dark">{isToday ? "Today" : fmtDate(date)} · {TYPE_LABEL[day.type] || day.type}</p>
          <h3>{day.title}</h3>
          {(day.duration_min > 0 || day.intensity) && (
            <p className="sub" style={{ margin: 0 }}>{[day.duration_min > 0 && `${day.duration_min} min`, day.intensity].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {log?.done && <span className="pill p-assigned">Done</span>}
      </div>

      {day.exercises.length > 0 && (
        <ol className="exercises">
          {day.exercises.map((x, i) => (
            <li key={i} className={checked.has(i) ? "ticked" : ""}>
              <button type="button" className="tick" aria-pressed={checked.has(i)} aria-label={`Mark ${x.name} done`}
                onClick={() => setChecked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} />
              <div>
                <b>{x.name}</b>
                <span className="rx">{x.prescription}</span>
                {x.cue && <span className="cue">{x.cue}</span>}
                <button type="button" className="demo-btn" aria-expanded={demo === i} onClick={() => setDemo(demo === i ? null : i)}>
                  {demo === i ? "Hide demo" : "▶ Watch demo"}
                </button>
                {demo === i && <VideoDemo name={x.name} medical={medical} />}
              </div>
            </li>
          ))}
        </ol>
      )}

      {!rest && !future && (
        <div className="logbox">
          <h4>How did it go?</h4>
          <div className="fld">
            <span className="f">Effort <span className="muted">(1 easy, 10 all-out)</span></span>
            <Scale label="Effort" from={1} to={10} value={effort} onChange={setEffort} />
          </div>
          <div className="fld">
            <span className="f">{medical ? "Pain during or after" : "Any pain?"} <span className="muted">(0 none, 10 worst)</span></span>
            <Scale label="Pain" from={0} to={10} value={pain} onChange={setPain} />
            {pain != null && pain >= 6 && <p className="err">Ease off. If pain spreads down a limb or you feel new numbness or weakness, stop and contact your doctor.</p>}
          </div>
          <div className="fld">
            <label className="f" htmlFor="note">Notes</label>
            <input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Swapped lunges for step-ups, left hip tight" />
          </div>
          <div className="row" style={{ marginTop: 0 }}>
            {!done ? (
              <button className="btn" onClick={() => { setDone(true); save(true); }} disabled={state === "saving"}>
                {state === "saving" ? <Spinner /> : "Mark session done"}
              </button>
            ) : (
              <>
                <button className="btn" onClick={() => save(true)} disabled={state === "saving"}>{state === "saving" ? <Spinner /> : "Save changes"}</button>
                <button className="btn ghost small" onClick={() => { setDone(false); save(false); }}>Not done</button>
              </>
            )}
          </div>
          {state === "saved" && <p className="sub ok" role="status">Saved.</p>}
          {state === "error" && <p className="err" role="alert">Couldn't save. Check your connection and try again.</p>}
        </div>
      )}
      {rest && <p className="sub" style={{ margin: "10px 0 0" }}>Recovery is part of the plan. An easy walk is always fine.</p>}
    </section>
  );
}

export function PlanView({ j }: { j: Journey }) {
  const blocks = j.blocks.filter((b) => b.program);
  const latest = blocks[blocks.length - 1].program!;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <section className="card">
        <h3>Your roadmap</h3>
        <p className="sub">{latest.overview}</p>
        <ol className="phases">
          {latest.phases.map((p) => (
            <li key={p.name}><b>{p.name}</b><span className="muted"> · Weeks {p.weeks}</span><br /><span>{p.goal}</span></li>
          ))}
        </ol>
      </section>
      {blocks.map((b) => (
        <section className="card" key={b.idx}>
          <h3>Block {b.idx + 1}: {b.program!.title}</h3>
          <p className="sub">Starts {fmtDate(b.startDate)}</p>
          {b.program!.weeks.map((w) => {
            const key = `${b.idx}-${w.week}`;
            return (
              <div key={key} className="planweek">
                <button className="planweek-head" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
                  <span><b>Week {w.week}</b> · {w.focus}</span><span aria-hidden="true">{open === key ? "−" : "+"}</span>
                </button>
                {open === key && (
                  <ul className="week">
                    {w.days.map((d) => (
                      <li key={d.day}>
                        <b>{fmtDate(addDays(b.startDate, (w.week - 1) * 7 + d.day - 1), { weekday: "short" })}</b>
                        <span>{d.title}{d.duration_min > 0 && <span className="muted"> · {d.duration_min} min</span>}
                          {d.exercises.length > 0 && <span className="muted small"><br />{d.exercises.map((x) => x.name).join(", ")}</span>}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      ))}
      <section className="card">
        <h3>Stop and check in if</h3>
        <ul className="bullets">{latest.stop_rules.map((r) => <li key={r}>{r}</li>)}</ul>
        {latest.guidelines.length > 0 && (<><h3 style={{ marginTop: 16 }}>Guidelines</h3><ul className="bullets">{latest.guidelines.map((r) => <li key={r}>{r}</li>)}</ul></>)}
        {latest.nutrition_tips.length > 0 && (<><h3 style={{ marginTop: 16 }}>Fuel</h3><ul className="bullets">{latest.nutrition_tips.map((r) => <li key={r}>{r}</li>)}</ul></>)}
        {latest.next_block_preview && <p className="sub" style={{ margin: "16px 0 0" }}><strong>Coming next:</strong> {latest.next_block_preview}</p>}
      </section>
    </>
  );
}

export function ProgressView({ j }: { j: Journey }) {
  const today = todayStr();
  const sessions = j.blocks.flatMap((b) =>
    (b.program?.weeks || []).flatMap((w) =>
      w.days.filter((d) => d.type !== "rest").map((d) => ({ b: b.idx, w: w.week, d: d.day, date: addDays(b.startDate, (w.week - 1) * 7 + d.day - 1) }))
    )
  );
  const due = sessions.filter((s) => s.date <= today);
  const isDone = (s: { b: number; w: number; d: number }) => j.logs.some((l) => l.blockIdx === s.b && l.week === s.w && l.day === s.d && l.done);
  const doneCount = due.filter(isDone).length;
  const withDate = j.logs
    .map((l) => ({ ...l, date: addDays(j.blocks.find((b) => b.idx === l.blockIdx)!.startDate, (l.week - 1) * 7 + l.day - 1) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const painLogs = withDate.filter((l) => l.pain != null).slice(-20);
  const efforts = withDate.filter((l) => l.effort != null);
  const avgEffort = efforts.length ? (efforts.reduce((s, l) => s + l.effort!, 0) / efforts.length).toFixed(1) : "–";
  const notes = withDate.filter((l) => l.note).slice(-5).reverse();

  return (
    <>
      <div className="stats">
        <div className="card stat"><b>{doneCount}<span>/{due.length}</span></b><span>sessions done so far</span></div>
        <div className="card stat"><b>{due.length ? Math.round((doneCount / due.length) * 100) : 0}%</b><span>consistency</span></div>
        <div className="card stat"><b>{avgEffort}</b><span>average effort</span></div>
      </div>
      <section className="card">
        <h3>Pain over time</h3>
        {painLogs.length < 2 ? (
          <p className="sub" style={{ margin: 0 }}>Log pain after a few sessions and your trend shows up here.</p>
        ) : (
          <div className="bars" role="img" aria-label={`Pain scores: ${painLogs.map((l) => l.pain).join(", ")}`}>
            {painLogs.map((l, i) => (
              <div key={i} className="bar-wrap" title={`${fmtDate(l.date)}: ${l.pain}/10`}>
                <div className={`bar ${l.pain! >= 6 ? "hi" : l.pain! >= 3 ? "mid" : ""}`} style={{ height: `${Math.max(4, l.pain! * 10)}%` }} />
                <span>{l.pain}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      {notes.length > 0 && (
        <section className="card">
          <h3>Recent notes</h3>
          <ul className="week">{notes.map((l, i) => <li key={i}><b>{fmtDate(l.date, { month: "short", day: "numeric" })}</b><span>{l.note}</span></li>)}</ul>
        </section>
      )}
    </>
  );
}
