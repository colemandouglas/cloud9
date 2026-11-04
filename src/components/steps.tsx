import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, todayStr, type OuraStatus, type Points } from "../lib/api";
import { POINTS } from "../lib/catalog";
import { Spinner } from "./ui";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Loads points once and shares a setter so panels stay in sync after edits. */
export function usePoints() {
  const [pts, setPts] = useState<Points | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.points().then(setPts, (e) => setErr(e.message)); }, []);
  return { pts, setPts, err };
}

export function StepsPanel({ pts, setPts, compact = false }: { pts: Points; setPts: (p: Points) => void; compact?: boolean }) {
  const today = todayStr();
  const [date, setDate] = useState(today);
  const day = pts.week.find((d) => d.date === date);
  const current = day?.steps ?? (date === today ? pts.today.steps : null);
  const [value, setValue] = useState(current != null ? String(current) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setValue(current != null ? String(current) : ""); setMsg(""); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: FormEvent) {
    e.preventDefault();
    const n = Number(value.replace(/[^\d]/g, ""));
    if (!value.trim() || isNaN(n)) return setMsg("Enter your step count.");
    setBusy(true);
    setMsg("");
    try {
      setPts(await api.setSteps(date, n));
      setMsg("Saved.");
    } catch (x) {
      setMsg((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const goal = 10000;
  const max = Math.max(goal * 1.25, ...pts.week.map((d) => d.steps || 0));
  const todaySteps = pts.today.steps ?? 0;
  return (
    <section className="card stepcard">
      <div className="steps-head">
        <div>
          <p className="eyebrow dark">Steps {date === today ? "today" : fmtDate(date, { weekday: "long" })}</p>
          <b className="big">{current != null ? fmt(current) : "–"}</b>
          {date === today && <span className="muted"> / {fmt(goal)}</span>}
        </div>
        <div className="pts-badge" title="Points this week"><b>{pts.weekPoints}</b><span>pts this week</span></div>
      </div>
      {(day?.stepsSource === "oura" || day?.activeCal != null) && (
        <p className="wear">
          {day?.stepsSource === "oura" && <span className="src">From Oura</span>}
          {day?.activeCal != null && <span>🔥 {fmt(day.activeCal)} active cal</span>}
          {day?.totalCal != null && <span>{fmt(day.totalCal)} total burned</span>}
        </p>
      )}
      {date === today && (
        <div className="meter" aria-hidden="true"><div style={{ width: `${Math.min(100, (todaySteps / goal) * 100)}%` }} /></div>
      )}

      <div className="stepbars" role="img" aria-label={`Steps this week: ${pts.week.map((d) => `${fmtDate(d.date, { weekday: "short" })} ${d.steps ?? 0}`).join(", ")}`}>
        <div className="goal-line" style={{ bottom: `${(goal / max) * 100}%` }} />
        {pts.week.map((d) => (
          <button key={d.date} type="button" className={`sb ${d.date === date ? "sel" : ""}`} disabled={d.date > today} onClick={() => setDate(d.date)}
            aria-label={`${fmtDate(d.date)}: ${d.steps ?? 0} steps, ${d.points} points`}>
            <span className="sb-pts">{d.points ? `+${d.points}` : ""}</span>
            <span className="sb-bar"><span className={(d.steps || 0) >= goal ? "hit" : ""} style={{ height: `${Math.min(100, ((d.steps || 0) / max) * 100)}%` }} /></span>
            <span className="sb-day">{fmtDate(d.date, { weekday: "narrow" })}</span>
          </button>
        ))}
      </div>

      <form className="steps-form" onSubmit={save}>
        <input type="text" inputMode="numeric" aria-label={`Steps for ${fmtDate(date)}`} placeholder="Steps from your phone"
          value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn small" disabled={busy}>{busy ? <Spinner /> : "Save"}</button>
      </form>
      {msg && <p className={msg === "Saved." ? "sub ok" : "err"} style={{ margin: "6px 0 0" }} role="status">{msg}</p>}
      {compact ? (
        <p className="hintline">10K = 1 pt · 15K = +1 · 20K = +2 · +1 per 1K after that. <Link to="/app/points">All points</Link></p>
      ) : (
        <p className="hintline">Connect Oura below for automatic steps, or copy the count from your phone's Health app. A number you type replaces Oura's for that day.</p>
      )}
    </section>
  );
}

export function ReadinessTip({ pts }: { pts: Points }) {
  const r = pts.today.readiness;
  if (r == null) return null;
  const low = r < 70, high = r >= 85;
  return (
    <div className={`readiness ${low ? "low" : high ? "high" : ""}`}>
      <b>Readiness {r}</b>
      {low ? "Your body is asking for an easier day. Use the lighter end of each prescription, or swap for an easy walk."
        : high ? "You're well recovered. A good day to give the session your full effort."
        : "Solid recovery. Train as planned and listen to your body."}
      {pts.today.sleepScore != null && <span className="muted"> · Sleep {pts.today.sleepScore}</span>}
    </div>
  );
}

export function OuraCard() {
  const [s, setS] = useState<OuraStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const flash = new URLSearchParams(location.search).get("oura");
  useEffect(() => { api.oura().then(setS, () => {}); }, []);
  if (!s) return null;
  return (
    <section className="card">
      <h3>Oura ring</h3>
      {flash === "connected" && <p className="sub ok">Connected. Your steps, calories and readiness will sync automatically.</p>}
      {flash === "error" && <p className="err">Couldn't connect to Oura. Try again.</p>}
      {!s.configured ? (
        <p className="sub" style={{ margin: 0 }}>Oura isn't switched on for this app yet.</p>
      ) : s.connected ? (
        <>
          <p className="sub">Synced {s.lastSync ? new Date(s.lastSync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "not yet"}.</p>
          {s.error && <p className="err">{s.error}</p>}
          <div className="row" style={{ marginTop: 0 }}>
            <button className="btn small" disabled={busy} onClick={() => { setBusy(true); api.ouraSync().then((x) => { setS(x); location.reload(); }, () => setBusy(false)); }}>{busy ? <Spinner /> : "Sync now"}</button>
            {s.error && <a className="btn ghost small" href="/auth/oura/connect">Reconnect</a>}
            <button className="btn ghost small" onClick={() => confirm("Disconnect Oura and delete the synced data?") && api.ouraDisconnect().then(setS)}>Disconnect</button>
          </div>
        </>
      ) : (
        <>
          <p className="sub">Sync steps, calories burned, readiness and sleep from your ring. Steps count toward your points automatically.</p>
          <a className="btn" href="/auth/oura/connect">Connect Oura</a>
        </>
      )}
      <p className="hintline">Oura data is used for your stats and points only. It's never shared with the AI that writes your program.</p>
    </section>
  );
}

export function PointsRules() {
  return (
    <section className="card">
      <h3>How points work</h3>
      <ul className="rules">
        {POINTS.steps.map(([min, p, label]) => <li key={min}><b>+{p}</b>{label}</li>)}
        <li><b>+1</b>Every 1,000 steps past {fmt(POINTS.perThousandOver)}</li>
        <li><b>+{POINTS.weekComplete}</b>Finish every session in a program week</li>
        <li><b>+{POINTS.photo}</b>Post a food or workout photo (up to {POINTS.photoDailyMax} a day)</li>
        <li><b>+{POINTS.streakBonus}</b>Every {POINTS.streakEvery} days in a row you use the app</li>
      </ul>
    </section>
  );
}
