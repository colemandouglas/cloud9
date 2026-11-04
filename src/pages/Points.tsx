import { OuraCard, PointsRules, ReadinessTip, StepsPanel, usePoints } from "../components/steps";

export default function PointsPage() {
  const { pts, setPts, err } = usePoints();
  if (err) return <p className="err">{err}</p>;
  if (!pts) return <p className="loading">Loading…</p>;
  return (
    <>
      <h2>Points</h2>
      <div className="stats">
        <div className="card stat"><b>{pts.streak}</b><span>day streak{pts.streak === 1 ? "" : "s"}</span></div>
        <div className="card stat"><b>{pts.weekPoints}</b><span>points this week</span></div>
        <div className="card stat"><b>{pts.totalPoints}</b><span>all-time points</span></div>
      </div>
      <ReadinessTip pts={pts} />
      <StepsPanel pts={pts} setPts={setPts} />
      <OuraCard />
      <section className="card">
        <h3>This week</h3>
        <ul className="week">
          {pts.week.filter((d) => d.points > 0).map((d) => (
            <li key={d.date}>
              <b>{new Date(d.date + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}</b>
              <span>
                {[d.stepPts && `Steps +${d.stepPts}`, d.weekPts && `Program week +${d.weekPts}`, d.photoPts && `Photos +${d.photoPts}`, d.streakPts && `Streak +${d.streakPts}`]
                  .filter(Boolean).join(" · ")}
                <strong style={{ float: "right" }}>+{d.points}</strong>
              </span>
            </li>
          ))}
          {!pts.week.some((d) => d.points > 0) && <li><span className="muted">No points yet this week. Log your steps or finish a session to get going.</span></li>}
        </ul>
        <p className="hintline">Best streak: {pts.bestStreak} day{pts.bestStreak === 1 ? "" : "s"} · Program weeks completed: {pts.weeksCompleted}</p>
      </section>
      <PointsRules />
    </>
  );
}
