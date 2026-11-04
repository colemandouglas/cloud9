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

export interface DayPoints {
  activeCal?: number | null; totalCal?: number | null; readiness?: number | null; sleepScore?: number | null; stepsSource?: string;
  date: string; steps: number | null; stepPts: number; photoPts: number; weekPts: number; streakPts: number; points: number }
export interface Points { today: DayPoints; week: DayPoints[]; weekPoints: number; totalPoints: number; streak: number; bestStreak: number; weeksCompleted: number }
export interface Friend { handle: string; name: string; me: boolean; weekPoints: number; totalPoints: number; streak: number; todaySteps: number | null }
export interface Post {
  id: string; kind: string; text: string; date: string; createdAt: number; photoUrl: string | null;
  author: { handle: string; name: string }; cheers: number; cheered: boolean; mine: boolean; canDelete: boolean;
}
export interface OuraStatus { configured: boolean; connected: boolean; lastSync: number | null; error: string | null }
export type Video = { videoId: string; title: string; channel: string; reason: string } | { searchUrl: string };

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
  deleteAccount: () => call("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) }),
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
  checkin: () => call("/api/checkin", post({ date: todayStr() })),
  points: () => call<Points>(`/api/points?date=${todayStr()}`),
  setSteps: (date: string, steps: number) =>
    call<Points>("/api/steps", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, steps, today: todayStr() }) }),
  profile: () => call<{ handle: string; name: string }>("/api/profile"),
  saveProfile: (handle: string, name: string) =>
    call<{ handle: string; name: string }>("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, name }) }),
  friends: () => call<{ board: Friend[]; followers: { handle: string; name: string; followingBack: boolean }[] }>(`/api/friends?date=${todayStr()}`),
  follow: (handle: string) => call("/api/friends", post({ handle })),
  unfollow: (handle: string) => call(`/api/friends/${encodeURIComponent(handle)}`, { method: "DELETE" }),
  feed: async (scope: "everyone" | "following", before?: number) =>
    (await call<{ posts: Post[] }>(`/api/community?scope=${scope}${before ? `&before=${before}` : ""}`)).posts,
  createPost(kind: string, text: string, photo: Blob | null) {
    const form = new FormData();
    form.append("kind", kind);
    form.append("text", text);
    form.append("date", todayStr());
    if (photo) form.append("photo", photo, "photo.jpg");
    return call<{ id: string }>("/api/community", { method: "POST", body: form });
  },
  cheer: (id: string) => call<{ cheered: boolean }>(`/api/community/${id}/cheer`, post()),
  deletePost: (id: string) => call(`/api/community/${id}`, { method: "DELETE" }),
  oura: () => call<OuraStatus>("/api/oura"),
  ouraSync: () => call<OuraStatus>("/api/oura/sync", post()),
  ouraDisconnect: () => call<OuraStatus>("/api/oura", { method: "DELETE" }),
  video: (name: string) => call<Video>(`/api/videos?name=${encodeURIComponent(name)}`),
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
