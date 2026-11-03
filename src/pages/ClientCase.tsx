import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { myCases } from "../lib/api";
import { TEMPLATES, type Case } from "../lib/protocol";
import { Back } from "../components/ui";

const TRACKER = import.meta.env.VITE_WORKOUT_TRACKER_URL || "https://claude.ai/artifact/3a5A5MnAaBo3ubBhvGbF23";
const TRACKER_TEMPLATES = ["stenosis"];

export default function ClientCase() {
  const { id } = useParams();
  const [c, setC] = useState<Case | null | undefined>();
  useEffect(() => {
    myCases().then((list) => setC(list.find((x) => x.id === id) ?? null), () => setC(null));
  }, [id]);

  if (c === undefined) return <p className="loading">Loading…</p>;
  if (c === null)
    return (
      <>
        <Back to="/app" />
        <p className="sub">This case isn't available on this device.</p>
      </>
    );

  const stage = c.status === "assigned" ? 2 : c.status === "review" ? 1 : 0;
  const t = c.program ? TEMPLATES[c.program.template] : null;
  return (
    <>
      <Back to="/app">Your cases</Back>
      <h2>{c.name}</h2>
      <div className="steps">
        {["Submitted", "In review", "Program ready"].map((s, i) => (
          <div key={s} className={i <= stage ? "on" : ""}>{s}</div>
        ))}
      </div>
      {c.status === "flag" && (
        <div className="alert" style={{ marginTop: 12 }}>
          <b>Get medical care today</b>Your answers included a warning sign. Please see a doctor before starting any
          program.
        </div>
      )}
      {c.status === "assigned" && c.program && t ? (
        <section className="card" style={{ marginTop: 14 }}>
          <h3>Your protocol: {t.name}</h3>
          {c.program.phase && <p className="sub">{c.program.phase}</p>}
          {c.program.notes && <div className="note">{c.program.notes}</div>}
          <ul className="week">
            {t.week.map(([d, x]) => (
              <li key={d + x}><b>{d}</b>{x}</li>
            ))}
          </ul>
          <p className="sub" style={{ marginTop: 12 }}><strong>Avoid for now:</strong> {t.avoid}</p>
          {TRACKER_TEMPLATES.includes(c.program.template) && (
            <a className="btn" href={TRACKER} target="_blank" rel="noopener">Open daily workouts</a>
          )}
          <p className="sub" style={{ margin: "12px 0 0", fontSize: 14 }}>
            Stop any exercise that sends pain further down your leg, and message your therapist.
          </p>
        </section>
      ) : (
        c.status !== "flag" && (
          <section className="card" style={{ marginTop: 14 }}>
            <h3>What happens next</h3>
            <p className="sub" style={{ margin: 0 }}>
              Your physical therapist reviews your answers and imaging, usually within 2 business days, then assigns
              your program here.
            </p>
          </section>
        )
      )}
    </>
  );
}
