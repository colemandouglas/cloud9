import type { Case, Program, Status } from "./protocol";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || "Something went wrong."), { status: res.status });
  return body as T;
}
const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

// ---- Client: cases are remembered on this device by id + secret token ----
const KEY = "blw.cases";
type Saved = { id: string; token: string };
function saved(): Saved[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function remember(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify([s, ...saved().filter((x) => x.id !== s.id)]));
  } catch {
    /* storage blocked: the case still exists, it just won't be listed here */
  }
}

export async function submitIntake(intake: Record<string, unknown>, file?: File | null): Promise<Case> {
  const form = new FormData();
  form.append("intake", JSON.stringify(intake));
  if (file) form.append("imaging", file);
  const r = await call<{ id: string; token: string; case: Case }>("/api/cases", { method: "POST", body: form });
  remember({ id: r.id, token: r.token });
  return r.case;
}

export async function myCases(): Promise<Case[]> {
  const list = saved();
  if (!list.length) return [];
  return (await call<{ cases: Case[] }>("/api/cases/lookup", json("POST", { cases: list }))).cases;
}

// ---- Clinician ----
export const clinician = {
  me: () => call<{ role: string }>("/api/clinician/me"),
  login: (password: string) => call("/api/clinician/login", json("POST", { password })),
  logout: () => call("/api/clinician/logout", { method: "POST" }),
  cases: async () => (await call<{ cases: Case[] }>("/api/clinician/cases")).cases,
  get: async (id: string) => (await call<{ case: Case }>(`/api/clinician/cases/${encodeURIComponent(id)}`)).case,
  update: async (id: string, patch: { status?: Status; program?: Omit<Program, "assignedAt"> }) =>
    (await call<{ case: Case }>(`/api/clinician/cases/${encodeURIComponent(id)}`, json("PATCH", patch))).case,
  imagingUrl: (id: string) => `/api/clinician/cases/${encodeURIComponent(id)}/imaging`,
};
