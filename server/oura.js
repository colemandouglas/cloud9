// Oura ring connection (Oura API v2, OAuth2).
//
// IMPORTANT: Oura's API and MCP Agreement (June 2026) forbids using Oura data to
// prompt or otherwise provide input to any AI model. Oura data lives only in the
// wearable_daily table and is used for display and points. Never pass it to
// server/ai.js or any other model call.
import crypto from "node:crypto";
import { db } from "./db.js";

const CLIENT_ID = process.env.OURA_CLIENT_ID;
const CLIENT_SECRET = process.env.OURA_CLIENT_SECRET;
const AUTH_URL = process.env.OURA_AUTH_URL || "https://cloud.ouraring.com/oauth/authorize";
const API = (process.env.OURA_API_BASE || "https://api.ouraring.com").replace(/\/$/, "");
const SYNC_DAYS = 14;
const UA = "BeLikeWater/1.0"; // Oura asks apps to identify themselves
const STALE_MS = 30 * 60 * 1000;
export const ouraConfigured = !!(CLIENT_ID && CLIENT_SECRET);

db.exec(`
  CREATE TABLE IF NOT EXISTS oura_links (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL, refresh_token TEXT, expires_at INTEGER,
    connected_at INTEGER NOT NULL, last_sync_at INTEGER, last_error TEXT
  );
  CREATE TABLE IF NOT EXISTS wearable_daily (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, source TEXT NOT NULL,
    steps INTEGER, active_cal INTEGER, total_cal INTEGER, readiness INTEGER, sleep_score INTEGER,
    updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, date, source)
  );
`);

const link = (userId) => db.prepare(`SELECT * FROM oura_links WHERE user_id = ?`).get(userId);
export const ouraStatus = (userId) => {
  const l = link(userId);
  return { configured: ouraConfigured, connected: !!l, lastSync: l?.last_sync_at ?? null, error: l?.last_error ?? null };
};

export function authorizeUrl(redirectUri, state) {
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, redirect_uri: redirectUri, scope: "daily", state }).toString();
  return u.toString();
}

async function tokenRequest(params) {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: new URLSearchParams({ ...params, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Oura token request failed (${res.status})`);
  return res.json();
}

function saveTokens(userId, t) {
  const expires = t.expires_in ? Date.now() + t.expires_in * 1000 : null;
  db.prepare(`INSERT INTO oura_links (user_id, access_token, refresh_token, expires_at, connected_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, oura_links.refresh_token), expires_at = excluded.expires_at, last_error = NULL`)
    .run(userId, t.access_token, t.refresh_token ?? null, expires, Date.now());
}

export async function finishConnect(userId, code, redirectUri) {
  saveTokens(userId, await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri }));
  await syncOura(userId, { force: true });
}

async function accessToken(userId) {
  const l = link(userId);
  if (!l) return null;
  if (l.expires_at && l.expires_at - 60000 < Date.now() && l.refresh_token) {
    saveTokens(userId, await tokenRequest({ grant_type: "refresh_token", refresh_token: l.refresh_token }));
    return link(userId).access_token;
  }
  return l.access_token;
}

async function collection(token, name, start, end) {
  const out = [];
  let next = null;
  do {
    const u = new URL(`${API}/v2/usercollection/${name}`);
    u.searchParams.set("start_date", start);
    u.searchParams.set("end_date", end);
    if (next) u.searchParams.set("next_token", next);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}`, "User-Agent": UA } });
    if (res.status === 401) throw Object.assign(new Error("unauthorized"), { status: 401 });
    if (!res.ok) throw new Error(`Oura ${name} request failed (${res.status})`);
    const body = await res.json();
    out.push(...(body.data || []));
    next = body.next_token || null;
  } while (next && out.length < 500);
  return out;
}

const running = new Map();

/** Pulls the last two weeks of daily activity, readiness and sleep. Safe to call often. */
export function syncOura(userId, { force = false } = {}) {
  const l = link(userId);
  if (!l || !ouraConfigured) return Promise.resolve();
  if (!force && l.last_sync_at && Date.now() - l.last_sync_at < STALE_MS) return Promise.resolve();
  if (running.has(userId)) return running.get(userId);
  const job = (async () => {
    try {
      const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const start = new Date(Date.now() - SYNC_DAYS * 86400000).toISOString().slice(0, 10);
      let token = await accessToken(userId);
      let data;
      try {
        data = await Promise.all(["daily_activity", "daily_readiness", "daily_sleep"].map((n) => collection(token, n, start, end)));
      } catch (e) {
        if (e.status !== 401 || !link(userId).refresh_token) throw e;
        saveTokens(userId, await tokenRequest({ grant_type: "refresh_token", refresh_token: link(userId).refresh_token }));
        token = link(userId).access_token;
        data = await Promise.all(["daily_activity", "daily_readiness", "daily_sleep"].map((n) => collection(token, n, start, end)));
      }
      const [activity, readiness, sleep] = data;
      const days = new Map();
      const at = (d) => days.get(d) || days.set(d, {}).get(d);
      for (const a of activity) Object.assign(at(a.day), { steps: a.steps, active: a.active_calories, total: a.total_calories });
      for (const r of readiness) at(r.day).readiness = r.score;
      for (const s of sleep) at(s.day).sleep = s.score;
      const up = db.prepare(`INSERT INTO wearable_daily (user_id, date, source, steps, active_cal, total_cal, readiness, sleep_score, updated_at)
        VALUES (?, ?, 'oura', ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, date, source) DO UPDATE SET steps = excluded.steps,
        active_cal = excluded.active_cal, total_cal = excluded.total_cal, readiness = excluded.readiness,
        sleep_score = excluded.sleep_score, updated_at = excluded.updated_at`);
      const num = (v) => (Number.isFinite(v) ? Math.round(v) : null);
      for (const [d, v] of days) up.run(userId, d, num(v.steps), num(v.active), num(v.total), num(v.readiness), num(v.sleep), Date.now());
      db.prepare(`UPDATE oura_links SET last_sync_at = ?, last_error = NULL WHERE user_id = ?`).run(Date.now(), userId);
    } catch (err) {
      const msg = err.status === 401 ? "Oura access expired. Reconnect your ring." : "Couldn't reach Oura. We'll try again shortly.";
      console.error(`Oura sync for ${userId} failed:`, err.message);
      db.prepare(`UPDATE oura_links SET last_sync_at = ?, last_error = ? WHERE user_id = ?`).run(Date.now(), msg, userId);
    } finally {
      running.delete(userId);
    }
  })();
  running.set(userId, job);
  return job;
}

export function disconnectOura(userId) {
  db.prepare(`DELETE FROM oura_links WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM wearable_daily WHERE user_id = ? AND source = 'oura'`).run(userId);
}

export const newState = () => crypto.randomBytes(16).toString("base64url");
