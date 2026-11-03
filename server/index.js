import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { UPLOAD_DIR, insertCase, getRow, getCase, listCases, updateCase } from "./db.js";

const PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 8787;

let CLINICIAN_PASSWORD = process.env.CLINICIAN_PASSWORD;
if (!CLINICIAN_PASSWORD) {
  if (PROD) {
    console.error("CLINICIAN_PASSWORD must be set in production.");
    process.exit(1);
  }
  CLINICIAN_PASSWORD = "dev-clinician";
  console.warn('[dev] CLINICIAN_PASSWORD not set, using "dev-clinician".');
}
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const STATUSES = ["new", "review", "assigned", "flag"];
const TEMPLATES = ["stenosis", "disc", "general", "postop"];
const PHASES = ["Phase 1: foundation", "Phase 2: load and rotation", "Phase 3: sport prep"];
const AGG = ["sit", "stand", "walk", "bendf", "bendb", "lie"];
const FLAGS = ["groin", "bladder", "weak", "fever", "trauma"];
const DURATIONS = ["Under 6 weeks", "6 to 12 weeks", "3 to 12 months", "Over a year"];
const SIDES = ["", "Right", "Left", "Both"];

// ---------- helpers ----------
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const pickList = (v, allowed) => (Array.isArray(v) ? [...new Set(v.filter((x) => allowed.includes(x)))] : []);
const score = (v) => Math.min(10, Math.max(0, Math.round(Number(v) || 0)));

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}
function verify(token) {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  if (!safeEqual(mac, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}
function cookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function requireClinician(req, res, next) {
  if (verify(cookie(req, "blw_session"))?.role === "clinician") return next();
  res.status(401).json({ error: "Sign in as a clinician." });
}

function cleanIntake(raw) {
  const legSide = pick(raw.legSide, SIDES, "");
  return {
    name: str(raw.name, 120),
    age: raw.age ? Math.min(120, Math.max(0, parseInt(raw.age, 10) || 0)) || null : null,
    email: str(raw.email, 200),
    complaint: str(raw.complaint, 300),
    legSide,
    legPain: legSide ? score(raw.legPain) : 0,
    backPain: score(raw.backPain),
    duration: pick(raw.duration, DURATIONS, DURATIONS[0]),
    worse: pickList(raw.worse, AGG),
    eases: pickList(raw.eases, AGG),
    surgery: raw.surgery === true,
    report: str(raw.report, 20000),
    goals: str(raw.goals, 2000),
    treatments: str(raw.treatments, 2000),
    flags: pickList(raw.flags, FLAGS),
  };
}

// ---------- app ----------
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^image\/(png|jpe?g|webp|heic|heif)$/.test(file.mimetype) || file.mimetype === "application/pdf"),
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Client: submit an intake. Returns the case id plus a secret token the
// client keeps on their device to view the case later.
app.post("/api/cases", upload.single("imaging"), (req, res) => {
  let raw;
  try {
    raw = JSON.parse(req.body?.intake || "{}");
  } catch {
    return res.status(400).json({ error: "Malformed intake." });
  }
  const intake = cleanIntake(raw);
  if (!intake.name) return res.status(400).json({ error: "Enter your name." });
  if (raw.consent !== true) return res.status(400).json({ error: "Consent is required." });
  if (!intake.flags.length && raw.noFlags !== true)
    return res.status(400).json({ error: "Answer the emergency safety checks first." });

  const id = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("base64url");
  const imaging = req.file
    ? { file: req.file.filename, name: str(req.file.originalname, 200), type: req.file.mimetype, size: req.file.size }
    : null;
  const c = insertCase({ id, tokenHash: sha256(token), status: intake.flags.length ? "flag" : "new", intake, imaging });
  res.status(201).json({ id, token, case: clientView(c) });
});

// Client: look up their own cases by id + token pairs.
app.post("/api/cases/lookup", (req, res) => {
  const pairs = Array.isArray(req.body?.cases) ? req.body.cases.slice(0, 50) : [];
  const out = [];
  for (const p of pairs) {
    const row = getRow(String(p?.id || ""));
    if (row && safeEqual(row.token_hash, sha256(String(p?.token || "")))) out.push(clientView(getCase(row.id)));
  }
  res.json({ cases: out });
});

// What a client sees about their own case (no internal file paths).
function clientView(c) {
  const { imaging, ...rest } = c;
  return { ...rest, imaging: imaging ? { name: imaging.name, type: imaging.type } : null };
}

// Clinician auth
app.post("/api/clinician/login", (req, res) => {
  if (!safeEqual(String(req.body?.password || ""), CLINICIAN_PASSWORD))
    return res.status(401).json({ error: "Wrong password." });
  const token = sign({ role: "clinician", exp: Date.now() + SESSION_TTL_MS });
  res.set(
    "Set-Cookie",
    `blw_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${PROD ? "; Secure" : ""}`
  );
  res.json({ ok: true });
});
app.post("/api/clinician/logout", (_req, res) => {
  res.set("Set-Cookie", "blw_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  res.json({ ok: true });
});
app.get("/api/clinician/me", requireClinician, (_req, res) => res.json({ role: "clinician" }));

app.get("/api/clinician/cases", requireClinician, (_req, res) => res.json({ cases: listCases().map(clientView) }));
app.get("/api/clinician/cases/:id", requireClinician, (req, res) => {
  const c = getCase(req.params.id);
  c ? res.json({ case: clientView(c) }) : res.status(404).json({ error: "Case not found." });
});
app.get("/api/clinician/cases/:id/imaging", requireClinician, (req, res) => {
  const c = getCase(req.params.id);
  if (!c?.imaging) return res.status(404).end();
  res.type(c.imaging.type);
  res.set("Content-Disposition", `inline; filename="${c.imaging.name.replace(/[^\w.\- ]/g, "_")}"`);
  res.sendFile(path.join(UPLOAD_DIR, c.imaging.file));
});
app.patch("/api/clinician/cases/:id", requireClinician, (req, res) => {
  const c = getCase(req.params.id);
  if (!c) return res.status(404).json({ error: "Case not found." });
  const patch = {};
  if (req.body?.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: "Unknown status." });
    patch.status = req.body.status;
  }
  if (req.body?.program !== undefined) {
    const p = req.body.program;
    if (!TEMPLATES.includes(p?.template)) return res.status(400).json({ error: "Unknown template." });
    patch.program = {
      template: p.template,
      phase: pick(p.phase, PHASES, PHASES[0]),
      notes: str(p.notes, 2000),
      assignedAt: Date.now(),
    };
    // A red-flag case keeps its flag until the clinician clears it explicitly.
    if (patch.status === undefined) patch.status = c.status === "flag" ? "flag" : "assigned";
  }
  res.json({ case: clientView(updateCase(c.id, patch)) });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// Production: serve the built site and app.
const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  const tooBig = err?.code === "LIMIT_FILE_SIZE";
  if (!tooBig) console.error(err);
  res.status(tooBig ? 413 : 500).json({ error: tooBig ? "That file is over 10 MB." : "Something went wrong." });
});

app.listen(PORT, () => console.log(`Be Like Water API on http://localhost:${PORT}`));
