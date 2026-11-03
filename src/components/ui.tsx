import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export const Logo = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
    <circle cx="17" cy="17" r="15" fill="none" stroke="var(--gold)" strokeWidth="2" />
    <path d="M7 19c3-4 6-4 10 0s7 4 10 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const Back = ({ to, children = "Back" }: { to: string; children?: ReactNode }) => (
  <Link className="back" to={to}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    {children}
  </Link>
);

const PATHS: Record<string, ReactNode> = {
  leaf: <path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7" />,
  flag: <><path d="M6 21V4" /><path d="M6 4h11l-2 4 2 4H6" /></>,
  pulse: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  mountain: <><path d="M3 20l6-10 4 6 2-3 6 7z" /><path d="M9 10l1.5 2.5" /></>,
};
export const GoalIcon = ({ name, size = 26 }: { name: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {PATHS[name]}
  </svg>
);

export const Spinner = () => <span className="spinner" aria-hidden="true" />;
