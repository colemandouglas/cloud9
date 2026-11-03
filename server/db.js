// Case storage on Node's built-in SQLite (no native build step).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "blw.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS cases (
    id          TEXT PRIMARY KEY,
    token_hash  TEXT NOT NULL,
    status      TEXT NOT NULL,
    intake      TEXT NOT NULL,
    program     TEXT,
    imaging     TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS cases_status ON cases(status, created_at);
`);

const toCase = (row) =>
  row && {
    id: row.id,
    status: row.status,
    ...JSON.parse(row.intake),
    program: row.program ? JSON.parse(row.program) : null,
    imaging: row.imaging ? JSON.parse(row.imaging) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

const insertStmt = db.prepare(
  `INSERT INTO cases (id, token_hash, status, intake, imaging, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const getStmt = db.prepare(`SELECT * FROM cases WHERE id = ?`);
const listStmt = db.prepare(`SELECT * FROM cases ORDER BY created_at DESC`);

export function insertCase({ id, tokenHash, status, intake, imaging }) {
  const now = Date.now();
  insertStmt.run(id, tokenHash, status, JSON.stringify(intake), imaging ? JSON.stringify(imaging) : null, now, now);
  return getCase(id);
}

export function getRow(id) {
  return getStmt.get(id);
}

export function getCase(id) {
  return toCase(getStmt.get(id));
}

export function listCases() {
  return listStmt.all().map(toCase);
}

export function updateCase(id, { status, program }) {
  const row = getStmt.get(id);
  if (!row) return null;
  db.prepare(`UPDATE cases SET status = ?, program = ?, updated_at = ? WHERE id = ?`).run(
    status ?? row.status,
    program !== undefined ? JSON.stringify(program) : row.program,
    Date.now(),
    id
  );
  return getCase(id);
}
