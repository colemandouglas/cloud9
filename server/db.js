// Storage on Node's built-in SQLite (no native build step).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "app.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
    verified_at INTEGER, coach_waitlist_at INTEGER, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_tokens (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL, used_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS journeys (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal TEXT NOT NULL, details TEXT NOT NULL, profile TEXT NOT NULL, screening TEXT NOT NULL,
    status TEXT NOT NULL, status_note TEXT NOT NULL DEFAULT '', coach_note TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS journeys_user ON journeys(user_id, created_at);
  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY, journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    file TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS blocks (
    journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE, idx INTEGER NOT NULL,
    start_date TEXT NOT NULL, status TEXT NOT NULL, program TEXT, error TEXT, checkin TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL, PRIMARY KEY (journey_id, idx)
  );
  CREATE TABLE IF NOT EXISTS steps (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, steps INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, date)
  );
  CREATE TABLE IF NOT EXISTS checkins (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, PRIMARY KEY (user_id, date)
  );
  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL, PRIMARY KEY (follower_id, followee_id)
  );
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL,
    text TEXT NOT NULL, photo_file TEXT, date TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS posts_time ON posts(created_at);
  CREATE TABLE IF NOT EXISTS cheers (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (post_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS videos (
    name_key TEXT PRIMARY KEY, video_id TEXT, title TEXT, channel TEXT, reason TEXT, fetched_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS logs (
    journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE, block_idx INTEGER NOT NULL,
    week INTEGER NOT NULL, day INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0,
    effort INTEGER, pain INTEGER, note TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL,
    PRIMARY KEY (journey_id, block_idx, week, day)
  );
`);

// Columns added after the first release.
const cols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
if (!cols.includes("handle")) db.exec(`ALTER TABLE users ADD COLUMN handle TEXT`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_handle ON users(handle)`);

const now = () => Date.now();
const J = (s) => (s ? JSON.parse(s) : null);

// ---------- users ----------
export const users = {
  byEmail: (email) => db.prepare(`SELECT * FROM users WHERE email = ?`).get(email),
  byId: (id) => db.prepare(`SELECT * FROM users WHERE id = ?`).get(id),
  create(email, name) {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)`).run(id, email, name || "", now());
    return users.byId(id);
  },
  setName: (id, name) => db.prepare(`UPDATE users SET name = ? WHERE id = ? AND name = ''`).run(name, id),
  verify: (id) => db.prepare(`UPDATE users SET verified_at = COALESCE(verified_at, ?) WHERE id = ?`).run(now(), id),
  joinWaitlist: (id) => db.prepare(`UPDATE users SET coach_waitlist_at = COALESCE(coach_waitlist_at, ?) WHERE id = ?`).run(now(), id),
  all: () => db.prepare(`SELECT * FROM users ORDER BY created_at DESC`).all(),
  byHandle: (h) => db.prepare(`SELECT * FROM users WHERE handle = ?`).get(h),
  setHandle: (id, h) => db.prepare(`UPDATE users SET handle = ? WHERE id = ?`).run(h, id),
  setDisplayName: (id, n) => db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(n, id),
};

// ---------- login tokens ----------
export const loginTokens = {
  create(userId, tokenHash, ttlMs) {
    db.prepare(`INSERT INTO login_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)`).run(tokenHash, userId, now() + ttlMs);
  },
  /** Marks the token used and returns its user id, or null if invalid/expired/used. */
  consume(tokenHash) {
    const row = db.prepare(`SELECT * FROM login_tokens WHERE token_hash = ?`).get(tokenHash);
    if (!row || row.used_at || row.expires_at < now()) return null;
    db.prepare(`UPDATE login_tokens SET used_at = ? WHERE token_hash = ?`).run(now(), tokenHash);
    return row.user_id;
  },
};

// ---------- journeys ----------
const toJourney = (r) =>
  r && {
    id: r.id, userId: r.user_id, goal: r.goal, details: J(r.details), profile: J(r.profile), screening: J(r.screening),
    status: r.status, statusNote: r.status_note, coachNote: r.coach_note, startDate: r.start_date,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };

export const journeys = {
  create({ userId, goal, details, profile, screening, status, statusNote = "", startDate }) {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO journeys (id, user_id, goal, details, profile, screening, status, status_note, start_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, goal, JSON.stringify(details), JSON.stringify(profile), JSON.stringify(screening), status, statusNote, startDate, now(), now());
    return journeys.get(id);
  },
  get: (id) => toJourney(db.prepare(`SELECT * FROM journeys WHERE id = ?`).get(id)),
  forUser: (userId) => db.prepare(`SELECT * FROM journeys WHERE user_id = ? ORDER BY created_at DESC`).all(userId).map(toJourney),
  all: () => db.prepare(`SELECT * FROM journeys ORDER BY created_at DESC`).all().map(toJourney),
  setStatus: (id, status, note = "") =>
    db.prepare(`UPDATE journeys SET status = ?, status_note = ?, updated_at = ? WHERE id = ?`).run(status, note, now(), id),
  setCoachNote: (id, note) => db.prepare(`UPDATE journeys SET coach_note = ?, updated_at = ? WHERE id = ?`).run(note, now(), id),
  pendingForUser: (userId) =>
    db.prepare(`SELECT * FROM journeys WHERE user_id = ? AND status = 'unverified'`).all(userId).map(toJourney),
};

// ---------- uploads ----------
export const uploads = {
  add(journeyId, f) {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO uploads (id, journey_id, file, name, type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, journeyId, f.file, f.name, f.type, f.size, now());
  },
  forJourney: (journeyId) => db.prepare(`SELECT * FROM uploads WHERE journey_id = ? ORDER BY created_at`).all(journeyId),
  get: (id) => db.prepare(`SELECT * FROM uploads WHERE id = ?`).get(id),
};

// ---------- program blocks ----------
const toBlock = (r) =>
  r && { idx: r.idx, startDate: r.start_date, status: r.status, program: J(r.program), error: r.error, checkin: r.checkin, createdAt: r.created_at };

export const blocks = {
  create(journeyId, idx, startDate, checkin = "") {
    db.prepare(
      `INSERT OR REPLACE INTO blocks (journey_id, idx, start_date, status, checkin, created_at) VALUES (?, ?, ?, 'generating', ?, ?)`
    ).run(journeyId, idx, startDate, checkin, now());
  },
  ready: (journeyId, idx, program) =>
    db.prepare(`UPDATE blocks SET status = 'ready', program = ?, error = NULL WHERE journey_id = ? AND idx = ?`).run(JSON.stringify(program), journeyId, idx),
  fail: (journeyId, idx, error) =>
    db.prepare(`UPDATE blocks SET status = 'error', error = ? WHERE journey_id = ? AND idx = ?`).run(String(error).slice(0, 500), journeyId, idx),
  forJourney: (journeyId) => db.prepare(`SELECT * FROM blocks WHERE journey_id = ? ORDER BY idx`).all(journeyId).map(toBlock),
  get: (journeyId, idx) => toBlock(db.prepare(`SELECT * FROM blocks WHERE journey_id = ? AND idx = ?`).get(journeyId, idx)),
  stuck: () => db.prepare(`SELECT journey_id, idx FROM blocks WHERE status = 'generating'`).all(),
};

// ---------- workout logs ----------
const toLog = (r) => ({ blockIdx: r.block_idx, week: r.week, day: r.day, done: !!r.done, effort: r.effort, pain: r.pain, note: r.note, updatedAt: r.updated_at });

export const logs = {
  upsert(journeyId, { blockIdx, week, day, done, effort, pain, note }) {
    db.prepare(
      `INSERT INTO logs (journey_id, block_idx, week, day, done, effort, pain, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (journey_id, block_idx, week, day) DO UPDATE SET done = excluded.done, effort = excluded.effort,
       pain = excluded.pain, note = excluded.note, updated_at = excluded.updated_at`
    ).run(journeyId, blockIdx, week, day, done ? 1 : 0, effort, pain, note, now());
  },
  forJourney: (journeyId) =>
    db.prepare(`SELECT * FROM logs WHERE journey_id = ? ORDER BY block_idx, week, day`).all(journeyId).map(toLog),
};
