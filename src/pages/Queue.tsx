import { useEffect, useState } from "react";
import { clinician } from "../lib/api";
import type { Case, Status } from "../lib/protocol";
import { CaseRow } from "../components/ui";

const ORDER: Record<Status, number> = { flag: 0, new: 1, review: 2, assigned: 3 };
const FILTERS: [Status | "all", string][] = [["all", "All"], ["flag", "Red flag"], ["new", "New"], ["review", "In review"], ["assigned", "Assigned"]];

export default function Queue() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");

  useEffect(() => {
    let live = true;
    const load = () => clinician.cases().then((c) => live && (setCases(c), setErr("")), () => live && setErr("Cases couldn't load. Retrying…"));
    load();
    const t = setInterval(load, 30000);
    return () => { live = false; clearInterval(t); };
  }, []);

  if (!cases) return <p className="loading">{err || "Loading cases…"}</p>;
  const counts: Record<string, number> = { all: cases.length };
  cases.forEach((c) => (counts[c.status] = (counts[c.status] || 0) + 1));
  const list = cases
    .filter((c) => filter === "all" || c.status === filter)
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.createdAt - a.createdAt);

  return (
    <>
      <h2>Review queue</h2>
      <p className="sub">Red flags first, then new intakes.</p>
      <div className="filters">
        {FILTERS.map(([k, l]) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} {counts[k] || 0}</button>
        ))}
      </div>
      {err && <p className="err">{err}</p>}
      {list.length ? (
        list.map((c) => <CaseRow key={c.id} c={c} to={`/clinician/case/${c.id}`} />)
      ) : (
        <section className="card">
          <h3>No cases here</h3>
          <p className="sub" style={{ margin: 0 }}>Intakes submitted in the client view show up in this queue.</p>
        </section>
      )}
    </>
  );
}
