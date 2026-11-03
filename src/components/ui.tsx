import { Link } from "react-router-dom";
import { STATUS, type Case, type Status } from "../lib/protocol";

export const Logo = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
    <circle cx="17" cy="17" r="15" fill="none" stroke="var(--gold)" strokeWidth="2" />
    <path d="M7 19c3-4 6-4 10 0s7 4 10 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const Back = ({ to, children = "Back" }: { to: string; children?: React.ReactNode }) => (
  <Link className="back" to={to}>
    <Chevron />
    {children}
  </Link>
);

export const Pill = ({ status }: { status: Status }) => {
  const [label, cls] = STATUS[status] ?? STATUS.new;
  return <span className={`pill ${cls}`}>{label}</span>;
};

export const initials = (n: string) =>
  (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

export const when = (t: number) =>
  t ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export const CaseRow = ({ c, to }: { c: Case; to: string }) => (
  <Link className="case" to={to}>
    <span className="av">{initials(c.name)}</span>
    <span className="who">
      <b>{c.name}</b>
      <span>
        {c.complaint || "Back pain"}. Submitted {when(c.createdAt)}
      </span>
    </span>
    <Pill status={c.status} />
  </Link>
);

export const RED_FLAG_COPY =
  "This program might be right for you, but first you need to see your healthcare provider or doctor ASAP! If you have numbness in the groin or trouble controlling your bladder or bowels, go to the emergency room now.";
