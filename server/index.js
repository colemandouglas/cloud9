import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import {
  GOAL_KEYS, GOALS, HEALTH_FOCUS, EVENTS, EVENT_GOALS, EXPERIENCE, BODY_AREAS, OCCASIONS, TONE_FOCUS, ADVENTURES,
  ACTIVITY, PLACES, READINESS, RED_FLAGS, AGG,
} from "../shared/catalog.js";
import { db, UPLOAD_DIR, users, loginTokens, journeys, uploads, blocks, logs } from "./db.js";
import { sendEmail, emailConfigured, escapeHtml } from "./email.js";
import { registerSocial } from "./social.js";
import { videosConfigured } from "./videos.js";
import { ouraConfigured, ouraStatus, authorizeUrl, finishConnect, syncOura, disconnectOura, newState } from "./oura.js";
import { generateBlock, resumeStuck, aiConfigured, STUB, BLOCK_WEEKS, journeyLengthWeeks } from "./ai.js";

const PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 8787;
// Render sets RENDER_EXTERNAL_URL automatically, so links work even if APP_URL is missing.
const APP_URL = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const emailList = (v) => (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const ADMIN_EMAILS = emailList(process.env.ADMIN_EMAILS);
// Private beta: when set, only these emails (plus coaches) can create accounts.
const ALLOWED_EMAILS = emailList(process.env.ALLOWED_EMAILS);
const allowed = (email) => !ALLOWED_EMAILS.length || ALLOWED_EMAILS.includes(email) || ADMIN_EMAILS.includes(email);
const INVITE_ONLY = "Be Like Water is in a private beta right now. Ask for an invite to join.";
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (PROD) {
    console.error("SESSION_SECRET must be set in production.");
    process.exit(1);
  }
  SESSION_SECRET = "dev-only-secret";
}
const SESSION_DAYS = 30;
const LINK_TTL_MS = 30 * 60 * 1000;

// ---------- helpers ----------
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pick = (v, allowed, fallback = "") => (allowed.includes(v) ? v : fallback);
const pickList = (v, allowed) => (Array.isArray(v) ? [...new Set(v.filter((x) => allowed.includes(x)))] : []);
const num = (v, lo, hi) => (v === "" || v == null || isNaN(+v) ? null : Math.min(hi, Math.max(lo, Math.round(+v))));
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00:00Z"));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isAdmin = (u) => !!u && ADMIN_EMAILS.includes(u.email);

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url")}`;
}
function verifySigned(token) {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac || !safeEqual(mac, crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url"))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}
function cookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function setSession(res, userId) {
  const token = sign({ uid: userId, exp: Date.now() + SESSION_DAYS * 86400000 });
  res.append("Set-Cookie", `blw=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${PROD ? "; Secure" : ""}`);
}
function currentUser(req) {
  const s = verifySigned(cookie(req, "blw"));
  return s ? users.byId(s.uid) : null;
}
const requireUser = (req, res, next) => {
  req.user = currentUser(req);
  req.user ? next() : res.status(401).json({ error: "Sign in to continue." });
};
const requireAdmin = (req, res, next) => {
  req.user = currentUser(req);
  isAdmin(req.user) ? next() : res.status(403).json({ error: "Coach access only." });
};

// Simple in-memory throttle for sign-in emails.
const sends = new Map();
function throttled(key, limit = 5, windowMs = 3600000) {
  const now = Date.now();
  const hits = (sends.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  sends.set(key, hits);
  return hits.length > limit;
}

async function sendLoginLink(user, { welcome = false } = {}) {
  const token = crypto.randomBytes(32).toString("base64url");
  loginTokens.create(user.id, sha256(token), LINK_TTL_MS);
  const url = `${APP_URL}/auth/verify?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: welcome ? "Welcome to Be Like Water" : "Your sign-in link",
    heading: welcome ? "Welcome aboard" : "Sign in to Be Like Water",
    body: welcome
      ? "<p>Your journey is saved. Use this link to confirm your email and sign in on any device. It works for 30 minutes, and you can always request a new one.</p>"
      : "<p>Tap the button to sign in. The link works once and expires in 30 minutes.</p>",
    cta: { label: welcome ? "Confirm and sign in" : "Sign in", url },
  });
  return url;
}

async function alertCoaches(subject, html, journeyId) {
  for (const to of ADMIN_EMAILS)
    await sendEmail({ to, subject, heading: subject, body: html, cta: { label: "Open in coach view", url: `${APP_URL}/coach/${journeyId}` } });
}

// ---------- journey intake validation ----------
function cleanDetails(goal, d = {}) {
  const out = { notes: str(d.notes, 2000) };
  if (["event", "tone", "adventure"].includes(goal) && isDate(d.date)) out.date = d.date;
  if (goal === "health") out.focus = pickList(d.focus, HEALTH_FOCUS);
  if (goal === "event") {
    Object.assign(out, {
      event: pick(d.event, EVENTS, "Other"), eventOther: str(d.eventOther, 120), eventGoal: pick(d.eventGoal, EVENT_GOALS),
      targetTime: str(d.targetTime, 40), experience: pick(d.experience, EXPERIENCE),
    });
  }
  if (goal === "tone") Object.assign(out, { occasion: pick(d.occasion, OCCASIONS, "Other"), occasionOther: str(d.occasionOther, 120), focus: pick(d.focus, TONE_FOCUS) });
  if (goal === "adventure") Object.assign(out, { adventure: pick(d.adventure, ADVENTURES, "Other"), adventureOther: str(d.adventureOther, 160) });
  if (goal === "medical") {
    const legSide = pick(d.legSide, ["", "Right", "Left", "Both"]);
    Object.assign(out, {
      area: pick(d.area, BODY_AREAS, "Other"), diagnosis: str(d.diagnosis, 2000), treatmentPlan: str(d.treatmentPlan, 4000),
      restrictions: str(d.restrictions, 2000), reportText: str(d.reportText, 20000), treatments: str(d.treatments, 2000),
      duration: str(d.duration, 40), pain: num(d.pain, 0, 10), backPain: num(d.backPain, 0, 10), legSide,
      legPain: legSide ? num(d.legPain, 0, 10) : null, worse: pickList(d.worse, AGG.map((a) => a[0])),
      eases: pickList(d.eases, AGG.map((a) => a[0])), surgery: d.surgery === true,
    });
  }
  return out;
}
function cleanProfile(p = {}) {
  return {
    name: str(p.name, 120), age: num(p.age, 13, 100), sex: pick(p.sex, ["Female", "Male", "Prefer not to say"]),
    height: str(p.height, 20), weight: str(p.weight, 20), activity: pick(p.activity, ACTIVITY),
    days: num(p.days, 1, 7) ?? 3, minutes: num(p.minutes, 10, 180) ?? 45, places: pickList(p.places, PLACES),
    equipment: str(p.equipment, 500), limitations: str(p.limitations, 1000), likes: str(p.likes, 500),
    dislikes: str(p.dislikes, 500), ownWords: str(p.ownWords, 2000),
  };
}
function cleanScreening(goal, s = {}) {
  return {
    readiness: pickList(s.readiness, READINESS.map((r) => r[0])),
    cleared: s.cleared === true,
    redFlags: goal === "medical" ? pickList(s.redFlags, RED_FLAGS.map((r) => r[0])) : [],
  };
}

/** Decide the journey's starting status from its screening. */
function initialStatus(screening) {
  if (screening.redFlags.length) return ["flagged", "Warning signs reported. See a doctor before starting."];
  if (screening.readiness.length && !screening.cleared) return ["needs_clearance", "Check with your doctor before you start."];
  return ["generating", ""];
}

function startFirstBlock(j) {
  if (!blocks.get(j.id, 0)) blocks.create(j.id, 0, j.startDate);
  journeys.setStatus(j.id, "generating");
  generateBlock(j.id, 0);
}

async function activate(j) {
  const [status, note] = initialStatus(j.screening);
  if (status === "generating") return startFirstBlock(j);
  journeys.setStatus(j.id, status, note);
  if (status === "flagged") {
    const u = users.byId(j.userId);
    await alertCoaches(
      "Red flag on a new journey",
      `<p>${escapeHtml(u?.name || u?.email || "A client")} reported warning signs:</p><ul>${j.screening.redFlags
        .map((f) => `<li>${escapeHtml(RED_FLAGS.find((r) => r[0] === f)?.[1] || f)}</li>`).join("")}</ul><p>Contact them and direct them to medical care before any program.</p>`,
      j.id
    );
  }
}

// What the client sees for a journey.
function journeyView(j, { full = false } = {}) {
  const bl = blocks.forJourney(j.id);
  const base = {
    id: j.id, goal: j.goal, goalTitle: GOALS[j.goal]?.title, status: j.status, statusNote: j.statusNote,
    startDate: j.startDate, details: j.details, createdAt: j.createdAt, lengthWeeks: journeyLengthWeeks(j),
    title: bl.find((b) => b.program)?.program.title || null,
  };
  if (!full) return base;
  return {
    ...base, profile: j.profile, screening: j.screening, coachNote: j.coachNote,
    blocks: bl.map(({ idx, startDate, status, program, error, checkin }) => ({ idx, startDate, status, program, error, checkin })),
    logs: logs.forJourney(j.id),
    uploads: uploads.forJourney(j.id).map((u) => ({ id: u.id, name: u.name, type: u.type, size: u.size })),
  };
}

function ownJourney(req, res) {
  const j = journeys.get(req.params.id);
  if (!j || (j.userId !== req.user.id && !isAdmin(req.user))) {
    res.status(404).json({ error: "Journey not found." });
    return null;
  }
  return j;
}

// ---------- app ----------
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api/") || req.path.startsWith("/auth/")) res.set("Cache-Control", "no-store");
  next();
});

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, _f, cb) => cb(null, crypto.randomUUID()) }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_q, file, cb) => cb(null, ACCEPTED.includes(file.mimetype)),
});

app.get("/api/health", (_req, res) => res.json({ ok: true, ai: aiConfigured ? (STUB ? "stub" : "live") : "off", email: emailConfigured, videos: videosConfigured, oura: ouraConfigured }));

// ----- auth -----
app.get("/api/me", (req, res) => {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: { id: u.id, email: u.email, name: u.name, verified: !!u.verified_at, isAdmin: isAdmin(u), coachWaitlist: !!u.coach_waitlist_at } });
});

app.post("/api/auth/start", async (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email." });
  if (throttled(email)) return res.status(429).json({ error: "Too many sign-in emails. Try again in an hour." });
  if (!users.byEmail(email) && !allowed(email)) return res.status(403).json({ error: INVITE_ONLY });
  const user = users.byEmail(email) || users.create(email, str(req.body?.name, 120));
  const link = await sendLoginLink(user);
  res.json({ sent: true, ...(PROD ? {} : { devLink: link }) });
});

// The emailed link opens a one-tap confirm page; the POST does the sign-in.
// That keeps email link scanners from using up the single-use token.
app.get("/auth/verify", (req, res) => {
  const token = String(req.query.token || "").replace(/[^\w-]/g, "");
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in · Be Like Water</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1F3A33;font-family:Helvetica,Arial,sans-serif;color:#F2F7F6}
form{text-align:center;padding:24px}h1{font-size:28px;margin:0 0 18px}button{font:600 17px Helvetica,Arial,sans-serif;background:#D4AF5A;color:#1F2A1F;border:0;border-radius:10px;padding:14px 28px;cursor:pointer}</style></head>
<body><form method="post" action="/auth/verify"><h1>Be Like Water</h1><input type="hidden" name="token" value="${token}"><button type="submit">Continue signing in</button></form></body></html>`);
});

app.post("/auth/verify", express.urlencoded({ extended: false, limit: "2kb" }), async (req, res) => {
  const uid = loginTokens.consume(sha256(String(req.body?.token || "")));
  if (!uid) return res.redirect("/signin?expired=1");
  users.verify(uid);
  setSession(res, uid);
  for (const j of journeys.pendingForUser(uid)) await activate(j);
  res.redirect("/app");
});

// Permanently deletes the account and everything tied to it (journeys, uploads,
// logs, steps, posts, follows, Oura link and data) via ON DELETE CASCADE.
app.delete("/api/account", requireUser, (req, res) => {
  if (req.body?.confirm !== "DELETE") return res.status(400).json({ error: "Type DELETE to confirm." });
  const files = [
    ...db.prepare(`SELECT u.file f FROM uploads u JOIN journeys j ON j.id = u.journey_id WHERE j.user_id = ?`).all(req.user.id),
    ...db.prepare(`SELECT photo_file f FROM posts WHERE user_id = ? AND photo_file IS NOT NULL`).all(req.user.id),
  ].map((r) => r.f);
  db.prepare(`DELETE FROM users WHERE id = ?`).run(req.user.id);
  for (const f of files) try { unlinkSync(path.join(UPLOAD_DIR, f)); } catch {}
  res.append("Set-Cookie", "blw=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/site", (_req, res) => res.json({ contactEmail: process.env.CONTACT_EMAIL || null }));

app.post("/api/auth/logout", (_req, res) => {
  res.append("Set-Cookie", "blw=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

// ----- journeys -----
app.post("/api/journeys", upload.array("files", 5), async (req, res) => {
  const files = req.files || [];
  const cleanup = () => files.forEach((f) => { try { unlinkSync(f.path); } catch {} });
  let raw;
  try {
    raw = JSON.parse(req.body?.data || "{}");
  } catch {
    cleanup();
    return res.status(400).json({ error: "Malformed request." });
  }
  const goal = pick(raw.goal, GOAL_KEYS);
  if (!goal) { cleanup(); return res.status(400).json({ error: "Pick a goal." }); }
  if (files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) {
    cleanup();
    return res.status(413).json({ error: "Uploads add up to more than 20 MB. Try fewer or smaller files." });
  }
  if (raw.consent !== true) { cleanup(); return res.status(400).json({ error: "Please accept the beta terms." }); }

  const profile = cleanProfile(raw.profile);
  const details = cleanDetails(goal, raw.details);
  const screening = cleanScreening(goal, raw.screening);
  let startDate = isDate(raw.startDate) ? raw.startDate : today();
  if (daysBetween(today(), startDate) < -7 || daysBetween(today(), startDate) > 90) startDate = today();

  let user = currentUser(req);
  let needsVerify = false;
  if (!user) {
    const email = str(raw.email, 200).toLowerCase();
    if (!isEmail(email)) { cleanup(); return res.status(400).json({ error: "Enter a valid email to save your journey." }); }
    if (!users.byEmail(email) && !allowed(email)) { cleanup(); return res.status(403).json({ error: INVITE_ONLY }); }
    user = users.byEmail(email);
    if (user) needsVerify = true; // existing account: prove it's theirs first
    else {
      user = users.create(email, profile.name);
      setSession(res, user.id);
    }
  }
  if (profile.name) users.setName(user.id, profile.name);

  const j = journeys.create({ userId: user.id, goal, details, profile, screening, status: "unverified", startDate });
  for (const f of files) uploads.add(j.id, { file: f.filename, name: str(f.originalname, 200) || "Upload", type: f.mimetype, size: f.size });

  let devLink;
  if (needsVerify) {
    if (!throttled(user.email)) devLink = await sendLoginLink(user);
  } else {
    await activate(j);
    if (!user.verified_at && !currentUser(req)) devLink = await sendLoginLink(user, { welcome: true });
  }
  res.status(201).json({ journey: journeyView(journeys.get(j.id)), needsVerify, ...(PROD || !devLink ? {} : { devLink }) });
});

app.get("/api/journeys", requireUser, (req, res) => res.json({ journeys: journeys.forUser(req.user.id).map((j) => journeyView(j)) }));

app.get("/api/journeys/:id", requireUser, (req, res) => {
  const j = ownJourney(req, res);
  if (j) res.json({ journey: journeyView(j, { full: true }) });
});

app.post("/api/journeys/:id/clearance", requireUser, (req, res) => {
  const j = ownJourney(req, res);
  if (!j) return;
  if (j.status !== "needs_clearance") return res.status(409).json({ error: "This journey doesn't need clearance." });
  if (req.body?.cleared !== true) return res.status(400).json({ error: "Confirm your doctor has cleared you." });
  j.screening.cleared = true;
  setScreening(j.id, j.screening);
  startFirstBlock(journeys.get(j.id));
  res.json({ journey: journeyView(journeys.get(j.id), { full: true }) });
});

app.post("/api/journeys/:id/logs", requireUser, (req, res) => {
  const j = ownJourney(req, res);
  if (!j) return;
  const b = req.body || {};
  const blockIdx = num(b.blockIdx, 0, 100), week = num(b.week, 1, BLOCK_WEEKS), day = num(b.day, 1, 7);
  if (blockIdx == null || week == null || day == null || !blocks.get(j.id, blockIdx)?.program)
    return res.status(400).json({ error: "Unknown session." });
  logs.upsert(j.id, { blockIdx, week, day, done: b.done === true, effort: num(b.effort, 1, 10), pain: num(b.pain, 0, 10), note: str(b.note, 1000) });
  // High pain on a medical journey: tell the coach.
  const pain = num(b.pain, 0, 10);
  if (j.goal === "medical" && pain != null && pain >= 7) {
    const u = users.byId(j.userId);
    alertCoaches("High pain logged", `<p>${escapeHtml(u?.name || u?.email)} logged pain ${pain}/10 on block ${blockIdx + 1}, week ${week}, day ${day}.${b.note ? ` Note: "${escapeHtml(str(b.note, 1000))}"` : ""}</p>`, j.id);
  }
  res.json({ logs: logs.forJourney(j.id) });
});

app.post("/api/journeys/:id/next", requireUser, (req, res) => {
  const j = ownJourney(req, res);
  if (!j) return;
  const bl = blocks.forJourney(j.id);
  const last = bl[bl.length - 1];
  if (!last || last.status !== "ready") return res.status(409).json({ error: "Finish building the current block first." });
  const into = daysBetween(last.startDate, today());
  if (into < (BLOCK_WEEKS - 1) * 7 && !isAdmin(req.user))
    return res.status(409).json({ error: `Your next block unlocks in week ${BLOCK_WEEKS} of this one.` });
  const nominal = addDays(last.startDate, BLOCK_WEEKS * 7);
  const start = daysBetween(nominal, today()) > 0 ? today() : nominal;
  blocks.create(j.id, last.idx + 1, start, str(req.body?.checkin, 2000));
  // Store the check-in on the block being finished so the AI sees it in history.
  setCheckin(j.id, last.idx, str(req.body?.checkin, 2000));
  generateBlock(j.id, last.idx + 1);
  res.json({ journey: journeyView(journeys.get(j.id), { full: true }) });
});

app.post("/api/journeys/:id/retry", requireUser, (req, res) => {
  const j = ownJourney(req, res);
  if (!j) return;
  const failed = blocks.forJourney(j.id).find((b) => b.status === "error");
  if (!failed) return res.status(409).json({ error: "Nothing to retry." });
  blocks.create(j.id, failed.idx, failed.startDate, failed.checkin);
  if (failed.idx === 0) journeys.setStatus(j.id, "generating");
  generateBlock(j.id, failed.idx);
  res.json({ journey: journeyView(journeys.get(j.id), { full: true }) });
});

app.get("/api/uploads/:id", requireUser, (req, res) => {
  const u = uploads.get(req.params.id);
  const j = u && journeys.get(u.journey_id);
  if (!j || (j.userId !== req.user.id && !isAdmin(req.user))) return res.status(404).end();
  res.type(u.type);
  res.set("Content-Disposition", `inline; filename="${u.name.replace(/[^\w.\- ]/g, "_")}"`);
  res.sendFile(path.join(UPLOAD_DIR, u.file));
});

app.post("/api/coach/waitlist", requireUser, (req, res) => {
  users.joinWaitlist(req.user.id);
  res.json({ ok: true });
});

// ----- coach (admin) -----
app.get("/api/admin/journeys", requireAdmin, (_req, res) => {
  const all = journeys.all().map((j) => {
    const u = users.byId(j.userId);
    const l = logs.forJourney(j.id);
    return { ...journeyView(j), user: { email: u?.email, name: u?.name }, sessionsDone: l.filter((x) => x.done).length, maxPain: l.reduce((m, x) => Math.max(m, x.pain ?? 0), 0) };
  });
  res.json({ journeys: all, waitlist: users.all().filter((u) => u.coach_waitlist_at).map((u) => ({ email: u.email, name: u.name, at: u.coach_waitlist_at })) });
});

app.get("/api/admin/journeys/:id", requireAdmin, (req, res) => {
  const j = journeys.get(req.params.id);
  if (!j) return res.status(404).json({ error: "Journey not found." });
  const u = users.byId(j.userId);
  res.json({ journey: { ...journeyView(j, { full: true }), user: { email: u?.email, name: u?.name } } });
});

app.post("/api/admin/journeys/:id/clear", requireAdmin, (req, res) => {
  const j = journeys.get(req.params.id);
  if (!j) return res.status(404).json({ error: "Journey not found." });
  if (!["flagged", "needs_clearance"].includes(j.status)) return res.status(409).json({ error: "This journey isn't on hold." });
  j.screening.cleared = true;
  j.screening.coachCleared = true;
  setScreening(j.id, j.screening);
  startFirstBlock(journeys.get(j.id));
  res.json({ ok: true });
});

app.post("/api/admin/journeys/:id/note", requireAdmin, (req, res) => {
  if (!journeys.get(req.params.id)) return res.status(404).json({ error: "Journey not found." });
  journeys.setCoachNote(req.params.id, str(req.body?.note, 2000));
  res.json({ ok: true });
});

app.post("/api/admin/journeys/:id/regenerate", requireAdmin, (req, res) => {
  const j = journeys.get(req.params.id);
  const bl = j && blocks.forJourney(j.id);
  const last = bl?.[bl.length - 1];
  if (!last) return res.status(404).json({ error: "No block to rebuild." });
  blocks.create(j.id, last.idx, last.startDate, last.checkin);
  generateBlock(j.id, last.idx);
  res.json({ ok: true });
});

// ----- Oura -----
const OURA_REDIRECT = `${APP_URL}/auth/oura/callback`;
app.get("/api/oura", requireUser, (req, res) => res.json(ouraStatus(req.user.id)));
app.get("/auth/oura/connect", (req, res) => {
  const u = currentUser(req);
  if (!u) return res.redirect("/signin");
  if (!ouraConfigured) return res.redirect("/app/points?oura=off");
  const state = sign({ uid: u.id, n: newState(), exp: Date.now() + 15 * 60000 });
  res.redirect(authorizeUrl(OURA_REDIRECT, state));
});
app.get("/auth/oura/callback", async (req, res) => {
  const s = verifySigned(String(req.query.state || ""));
  const u = currentUser(req);
  // The signed-in person must be the one who started the connection.
  if (!s || !u || s.uid !== u.id || !req.query.code) return res.redirect("/app/points?oura=error");
  try {
    await finishConnect(u.id, String(req.query.code), OURA_REDIRECT);
    res.redirect("/app/points?oura=connected");
  } catch (err) {
    console.error("Oura connect failed:", err.message);
    res.redirect("/app/points?oura=error");
  }
});
app.post("/api/oura/sync", requireUser, async (req, res) => {
  await syncOura(req.user.id, { force: true });
  res.json(ouraStatus(req.user.id));
});
app.delete("/api/oura", requireUser, (req, res) => {
  disconnectOura(req.user.id);
  res.json(ouraStatus(req.user.id));
});

registerSocial(app, { requireUser, isAdmin, syncWearables: (id) => Promise.race([syncOura(id), new Promise((r) => setTimeout(r, 6000))]) });

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// Small db helpers used above that need raw updates.
function setScreening(id, s) {
  db.prepare(`UPDATE journeys SET screening = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(s), Date.now(), id);
}
function setCheckin(id, idx, text) {
  db.prepare(`UPDATE blocks SET checkin = ? WHERE journey_id = ? AND idx = ?`).run(text, id, idx);
}

// ----- site + app -----
const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h", setHeaders: (res, p) => p.endsWith("sw.js") && res.set("Cache-Control", "no-cache") }));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  const tooBig = err?.code === "LIMIT_FILE_SIZE" || err?.code === "LIMIT_FILE_COUNT";
  if (!tooBig) console.error(err);
  res.status(tooBig ? 413 : 500).json({ error: tooBig ? "Each file must be under 10 MB, and up to 5 files." : "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`Be Like Water on ${APP_URL} (port ${PORT})`);
  console.log(`  AI: ${aiConfigured ? (STUB ? "TEST MODE (stub programs)" : "Claude") : "NOT CONFIGURED, set ANTHROPIC_API_KEY"}`);
  console.log(`  Videos: ${videosConfigured ? "YouTube lookup on" : "search links only, set YOUTUBE_API_KEY"}`);
  console.log(`  Oura: ${ouraConfigured ? `on (redirect ${OURA_REDIRECT})` : "off, set OURA_CLIENT_ID and OURA_CLIENT_SECRET"}`);
  console.log(`  Email: ${emailConfigured ? "Resend" : "printed to this log"}`);
  console.log(`  Coaches: ${ADMIN_EMAILS.join(", ") || "none, set ADMIN_EMAILS"}`);
  console.log(`  Sign-ups: ${ALLOWED_EMAILS.length ? `invite only (${ALLOWED_EMAILS.length} + coaches)` : "open to anyone"}`);
  resumeStuck();
});
