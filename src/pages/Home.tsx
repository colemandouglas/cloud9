import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, ApiError, type JourneySummary } from "../lib/api";
import { GOALS } from "../lib/catalog";
import { GoalIcon } from "../components/ui";

export const STATUS_LABEL: Record<string, [string, string]> = {
  active: ["Active", "p-assigned"], generating: ["Building", "p-new"], flagged: ["See a doctor first", "p-flag"],
  needs_clearance: ["Needs clearance", "p-review"], error: ["Needs attention", "p-flag"], unverified: ["Confirm email", "p-review"],
};

export default function Home() {
  const [list, setList] = useState<JourneySummary[] | null>(null);
  const [authErr, setAuthErr] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.journeys().then(setList, (e) => (e instanceof ApiError && e.status === 401 ? setAuthErr(true) : setErr(e.message)));
  }, []);

  if (authErr) return <Navigate to="/signin" replace />;
  if (err) return <p className="err">{err}</p>;
  if (!list) return <p className="loading">Loading…</p>;
  if (list.length === 1) return <Navigate to={`/app/j/${list[0].id}`} replace />;

  return (
    <>
      <h2>Your journeys</h2>
      {list.length === 0 && <p className="sub">You haven't started one yet.</p>}
      {list.map((j) => {
        const [label, cls] = STATUS_LABEL[j.status] || ["", ""];
        return (
          <Link key={j.id} className="case" to={`/app/j/${j.id}`}>
            <span className="av"><GoalIcon name={GOALS[j.goal as keyof typeof GOALS]?.icon} size={20} /></span>
            <span className="who"><b>{j.title || j.goalTitle}</b><span>Started {new Date(j.startDate + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></span>
            <span className={`pill ${cls}`}>{label}</span>
          </Link>
        );
      })}
      <Link className="btn ghost" to="/" style={{ marginTop: 10 }}>Start a new journey</Link>
    </>
  );
}
