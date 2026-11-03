import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { myCases } from "../lib/api";
import type { Case } from "../lib/protocol";
import { CaseRow } from "../components/ui";

export default function ClientHome() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    myCases().then(setCases, () => {
      setCases([]);
      setErr("Your cases couldn't load. Check your connection and reopen the page.");
    });
  }, []);
  return (
    <>
      <section className="card">
        <h2>Start your recovery</h2>
        <p className="sub">
          Tell us what's hurting and add your MRI or X-ray report. A physical therapist reviews it and builds your
          protocol, built around how you want to move again.
        </p>
        <Link className="btn" to="/app/intake">Start intake</Link>
      </section>
      {cases === null && <p className="loading">Loading your cases…</p>}
      {cases && cases.length > 0 && (
        <>
          <h3>Your cases</h3>
          {cases.map((c) => <CaseRow key={c.id} c={c} to={`/app/case/${c.id}`} />)}
        </>
      )}
      {err && <p className="sub">{err}</p>}
      {cases && cases.length > 0 && (
        <p className="sub" style={{ fontSize: 14 }}>Cases are remembered on this device.</p>
      )}
    </>
  );
}
