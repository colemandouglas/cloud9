export type Status = "unverified" | "generating" | "active" | "flagged" | "needs_clearance" | "error";

export interface Exercise { name: string; prescription: string; cue: string }
export interface Day { day: number; type: string; title: string; duration_min: number; intensity: string; exercises: Exercise[] }
export interface Week { week: number; focus: string; days: Day[] }
export interface Program {
  title: string; overview: string; phases: { name: string; weeks: string; goal: string }[]; weeks: Week[];
  guidelines: string[]; stop_rules: string[]; nutrition_tips: string[]; next_block_preview: string;
}
export interface Block { idx: number; startDate: string; status: "generating" | "ready" | "error"; program: Program | null; error: string | null; checkin: string }
export interface Log { blockIdx: number; week: number; day: number; done: boolean; effort: number | null; pain: number | null; note: string; updatedAt: number }
export interface JourneySummary {
  id: string; goal: string; goalTitle: string; status: Status; statusNote: string; startDate: string;
  details: Record<string, any>; createdAt: number; lengthWeeks: number; title: string | null;
}
export interface Journey extends JourneySummary {
  profile: Record<string, any>; screening: { readiness: string[]; cleared: boolean; redFlags: string[] }; coachNote: string;
  blocks: Block[]; logs: Log[]; uploads: { id: string; name: string; type: string; size: number }[];
  user?: { email: string; name: string };
}
export interface Me { id: string; email: string; name: string; verified: boolean; isAdmin: boolean; coachWaitlist: boolean }

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError("You seem to be offline. Check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || "Something went wrong.", res.status);
  return body as T;
}
const post = (data: unknown = {}) =>
  ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) as RequestInit;

export const api = {
  me: async () => (await call<{ user: Me }>("/api/me")).user,
  signIn: (email: string) => call<{ sent: boolean; devLink?: string }>("/api/auth/start", post({ email })),
  signOut: () => call("/api/auth/logout", post()),
  createJourney(data: Record<string, unknown>, files: File[]) {
    const form = new FormData();
    form.append("data", JSON.stringify(data));
    files.forEach((f) => form.append("files", f));
    return call<{ journey: JourneySummary; needsVerify: boolean; devLink?: string }>("/api/journeys", { method: "POST", body: form });
  },
  journeys: async () => (await call<{ journeys: JourneySummary[] }>("/api/journeys")).journeys,
  journey: async (id: string) => (await call<{ journey: Journey }>(`/api/journeys/${id}`)).journey,
  log: async (id: string, entry: Omit<Log, "updatedAt">) => (await call<{ logs: Log[] }>(`/api/journeys/${id}/logs`, post(entry))).logs,
  clearance: async (id: string) => (await call<{ journey: Journey }>(`/api/journeys/${id}/clearance`, post({ cleared: true }))).journey,
  nextBlock: async (id: string, checkin: string) => (await call<{ journey: Journey }>(`/api/journeys/${id}/next`, post({ checkin }))).journey,
  retry: async (id: string) => (await call<{ journey: Journey }>(`/api/journeys/${id}/retry`, post())).journey,
  joinWaitlist: () => call("/api/coach/waitlist", post()),
  uploadUrl: (id: string) => `/api/uploads/${id}`,
  admin: {
    journeys: () => call<{ journeys: (JourneySummary & { user: { email: string; name: string }; sessionsDone: number; maxPain: number })[]; waitlist: { email: string; name: string; at: number }[] }>("/api/admin/journeys"),
    journey: async (id: string) => (await call<{ journey: Journey }>(`/api/admin/journeys/${id}`)).journey,
    clear: (id: string) => call(`/api/admin/journeys/${id}/clear`, post()),
    note: (id: string, note: string) => call(`/api/admin/journeys/${id}/note`, post({ note })),
    regenerate: (id: string) => call(`/api/admin/journeys/${id}/regenerate`, post()),
  },
};

// ---------- dates ----------
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const toUTC = (s: string) => new Date(s + "T00:00:00Z").getTime();
export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const addDays = (s: string, n: number) => new Date(toUTC(s) + n * 86400000).toISOString().slice(0, 10);
export const fmtDate = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", opts);

/** Where today falls in a journey: the block, week (1-4) and day (1-7), or null if outside any ready block. */
export function locate(blocks: Block[], date = todayStr()) {
  for (const b of [...blocks].reverse()) {
    if (!b.program) continue;
    const n = daysBetween(b.startDate, date);
    if (n >= 0 && n < b.program.weeks.length * 7) return { block: b, week: Math.floor(n / 7) + 1, day: (n % 7) + 1, offset: n };
  }
  return null;
}
