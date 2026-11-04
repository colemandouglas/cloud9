import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, ApiError, addDays, daysBetween, fmtDate, locate, todayStr, type Block, type Day, type Journey, type Log, type Me } from "../lib/api";
import { BLOCK_WEEKS_UI, SessionCard, PlanView, ProgressView } from "../components/program";
import { Spinner } from "../components/ui";
import { ReadinessTip, StepsPanel, usePoints } from "../components/steps";

export default function JourneyPage() {
  const { id = "" } = useParams();
  const [j, setJ] = useState<Journey | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<{ msg: string; status: number } | null>(null);
  const [tab, setTab] = useState<"today" | "plan" | "progress">("today");

  const load = useCallback(() => api.journey(id).then(setJ, (e: ApiError) => setErr({ msg: e.message, status: e.status })), [id]);
  useEffect(() => { load(); api.me().then(setMe, () => {}); }, [load]);

  // Poll while anything is being built.
  const building = j && (j.status === "generating" || j.blocks.some((b) => b.status === "generating"));
  useEffect(() => {
    if (!building) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [building, load]);

  if (err?.status === 401) return <Navigate to="/signin" replace />;
  if (err) return <p className="err">{err.msg}</p>;
  if (!j) return <p className="loading">Loading…</p>;

  const first = j.blocks[0];
  return (
    <>
      <p className="eyebrow dark">{j.goalTitle}</p>
      <h2>{j.title || "Your journey"}</h2>

      {j.status === "flagged" && (
        <div className="alert">
          <b>See your doctor first</b>
          You reported warning signs that need a doctor's attention before you start training. If you have numbness in the groin or trouble
          controlling your bladder or bowels, go to the emergency room now. Your coach has been notified and will start your program once you're cleared.
        </div>
      )}
      {j.status === "needs_clearance" && <Clearance j={j} onDone={setJ} />}
      {j.status === "unverified" && <section className="card"><h3>Confirm your email</h3><p className="sub" style={{ margin: 0 }}>Tap the link we emailed you and we'll start building.</p></section>}
      {(j.status === "generating" || first?.status === "generating") && !first?.program && <Building />}
      {j.status === "error" && first?.status !== "generating" && <Retry j={j} msg={first?.error || j.statusNote} onDone={setJ} />}

      {first?.program && (
        <>
          <div className="tabs" role="tablist">
            {(["today", "plan", "progress"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
          {j.coachNote && <div className="note"><strong>From your coach:</strong> {j.coachNote}</div>}
          {tab === "today" && <Today j={j} setJ={setJ} reload={load} />}
          {tab === "plan" && <PlanView j={j} />}
          {tab === "progress" && <ProgressView j={j} />}
          <Waitlist me={me} onJoin={() => setMe(me && { ...me, coachWaitlist: true })} />
        </>
      )}
      <p className="sub" style={{ textAlign: "center", marginTop: 20 }}><Link to="/">Start another journey</Link></p>
    </>
  );
}

function Building() {
  return (
    <section className="card center">
      <div className="pulse-dot" aria-hidden="true" />
      <h3>Building your program</h3>
      <p className="sub" style={{ margin: 0 }}>Your coach is reading everything you shared and writing your first 4 weeks. This usually takes a minute or two. We'll email you when it's ready.</p>
    </section>
  );
}

function Clearance({ j, onDone }: { j: Journey; onDone: (j: Journey) => void }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <section className="card">
      <h3>Check with your doctor first</h3>
      <p className="sub">Your health answers mean you should get a doctor's OK before starting a new program. Once you have it, confirm below and we'll build your plan.</p>
      <label className="opt"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />My doctor has cleared me to exercise</label>
      <p className="err">{err}</p>
      <button className="btn" style={{ marginTop: 10 }} disabled={!ok || busy} onClick={() => { setBusy(true); api.clearance(j.id).then(onDone, (e) => { setErr(e.message); setBusy(false); }); }}>
        {busy ? <Spinner /> : "Build my program"}
      </button>
    </section>
  );
}

function Retry({ j, msg, onDone }: { j: Journey; msg: string; onDone: (j: Journey) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="card">
      <h3>We hit a snag</h3>
      <p className="sub">{msg || "Something went wrong building your program."}</p>
      <button className="btn" disabled={busy} onClick={() => { setBusy(true); api.retry(j.id).then(onDone, () => setBusy(false)); }}>Try again</button>
    </section>
  );
}

function Today({ j, setJ, reload }: { j: Journey; setJ: (j: Journey) => void; reload: () => void }) {
  const today = todayStr();
  const ready = j.blocks.filter((b) => b.program);
  const lastReady = ready[ready.length - 1];
  const here = locate(j.blocks, today);
  const [sel, setSel] = useState<{ block: Block; week: number; day: number }>(() =>
    here ? { block: here.block, week: here.week, day: here.day } : { block: lastReady, week: 1, day: 1 }
  );
  useEffect(() => {
    // Keep the selected block object fresh after reloads.
    const b = j.blocks.find((x) => x.idx === sel.block.idx);
    if (b && b !== sel.block && b.program) setSel((s) => ({ ...s, block: b }));
  }, [j.blocks, sel.block]);

  const before = !here && daysBetween(today, j.blocks[0].startDate) > 0;
  const blockEnd = addDays(lastReady.startDate, BLOCK_WEEKS_UI * 7);
  const pastEnd = !here && !before;
  const program = sel.block.program!;
  const weekDays = program.weeks[sel.week - 1]?.days || [];
  const dayData: Day | undefined = weekDays[sel.day - 1];
  const date = addDays(sel.block.startDate, (sel.week - 1) * 7 + sel.day - 1);
  const log = j.logs.find((l) => l.blockIdx === sel.block.idx && l.week === sel.week && l.day === sel.day);
  const nextBuilding = j.blocks.some((b) => b.status === "generating");
  const nextError = j.blocks.find((b) => b.idx > 0 && b.status === "error");
  const canNext = !nextBuilding && (pastEnd || (here && here.block.idx === lastReady.idx && here.week >= BLOCK_WEEKS_UI));

  return (
    <>
      <TodaySteps />
      {before && <div className="hint" style={{ marginBottom: 14 }}>Your program starts {fmtDate(j.blocks[0].startDate)}. Here's a preview.</div>}
      {pastEnd && !nextBuilding && <div className="hint" style={{ marginBottom: 14 }}>You've finished block {lastReady.idx + 1} (ended {fmtDate(addDays(blockEnd, -1))}). Build your next 4 weeks below.</div>}

      <div className="weekbar">
        <div className="weekbar-head">
          <button className="iconbtn" aria-label="Previous week" disabled={sel.week === 1 && sel.block.idx === 0}
            onClick={() => {
              if (sel.week > 1) setSel({ ...sel, week: sel.week - 1, day: 1 });
              else { const pb = ready.find((b) => b.idx === sel.block.idx - 1); if (pb) setSel({ block: pb, week: BLOCK_WEEKS_UI, day: 1 }); }
            }}>‹</button>
          <div><b>Block {sel.block.idx + 1} · Week {sel.week}</b><span>{program.weeks[sel.week - 1]?.focus}</span></div>
          <button className="iconbtn" aria-label="Next week" disabled={sel.week === program.weeks.length && sel.block.idx === lastReady.idx}
            onClick={() => {
              if (sel.week < program.weeks.length) setSel({ ...sel, week: sel.week + 1, day: 1 });
              else { const nb = ready.find((b) => b.idx === sel.block.idx + 1); if (nb) setSel({ block: nb, week: 1, day: 1 }); }
            }}>›</button>
        </div>
        <div className="days">
          {weekDays.map((d) => {
            const dt = addDays(sel.block.startDate, (sel.week - 1) * 7 + d.day - 1);
            const l = j.logs.find((x) => x.blockIdx === sel.block.idx && x.week === sel.week && x.day === d.day);
            return (
              <button key={d.day} className={`day ${d.type} ${sel.day === d.day ? "sel" : ""} ${dt === today ? "today" : ""}`} onClick={() => setSel({ ...sel, day: d.day })}
                aria-label={`${fmtDate(dt)}: ${d.title}${l?.done ? ", done" : ""}`}>
                <span className="dow">{fmtDate(dt, { weekday: "narrow" })}</span>
                <span className="dnum">{fmtDate(dt, { day: "numeric" })}</span>
                <span className={`dot ${l?.done ? "done" : d.type === "rest" ? "rest" : ""}`} />
              </button>
            );
          })}
        </div>
      </div>

      {dayData && (
        <SessionCard key={`${sel.block.idx}-${sel.week}-${sel.day}`} day={dayData} date={date} isToday={date === today} log={log} medical={j.goal === "medical"}
          onSave={async (entry) => {
            const logs: Log[] = await api.log(j.id, { blockIdx: sel.block.idx, week: sel.week, day: sel.day, ...entry });
            setJ({ ...j, logs });
          }} />
      )}

      {nextBuilding && j.blocks[0].program && <section className="card center"><div className="pulse-dot" aria-hidden="true" /><h3>Building your next block</h3><p className="sub" style={{ margin: 0 }}>Adjusting to how the last 4 weeks went. Usually a minute or two.</p></section>}
      {nextError && !nextBuilding && <Retry j={j} msg={nextError.error || ""} onDone={setJ} />}
      {canNext && !nextError && <NextBlock j={j} onDone={(nj) => { setJ(nj); reload(); }} />}
    </>
  );
}

function TodaySteps() {
  const { pts, setPts } = usePoints();
  return pts ? <><ReadinessTip pts={pts} /><StepsPanel pts={pts} setPts={setPts} compact /></> : null;
}

function NextBlock({ j, onDone }: { j: Journey; onDone: (j: Journey) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <section className="card">
      <h3>Ready for your next 4 weeks?</h3>
      <p className="sub">Tell us how it's going. We'll use this with your workout log to adjust the next block.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Back feels better. Side planks are getting easy. Walking more than 30 min still bothers my leg." />
      <p className="err">{err}</p>
      <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={() => { setBusy(true); api.nextBlock(j.id, text).then(onDone, (e) => { setErr(e.message); setBusy(false); }); }}>
        {busy ? <Spinner /> : "Build my next block"}
      </button>
    </section>
  );
}

function Waitlist({ me, onJoin }: { me: Me | null; onJoin: () => void }) {
  if (!me) return null;
  return (
    <section className="card soon-card">
      <span className="pill p-review">Coming soon</span>
      <h3 style={{ marginTop: 8 }}>Work 1:1 with a coach</h3>
      <p className="sub">Add a personal trainer or physical therapist on top of your plan.</p>
      {me.coachWaitlist ? <p className="sub" style={{ margin: 0, color: "var(--ok)" }}>You're on the list. We'll reach out.</p>
        : <button className="btn ghost small" onClick={() => api.joinWaitlist().then(onJoin)}>Join the waitlist</button>}
    </section>
  );
}
