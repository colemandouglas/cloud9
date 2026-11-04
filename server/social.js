// Steps, points, friends, community feed and exercise videos.
import crypto from "node:crypto";
import path from "node:path";
import { unlinkSync } from "node:fs";
import multer from "multer";
import { POST_KINDS } from "../shared/catalog.js";
import { db, users, UPLOAD_DIR } from "./db.js";
import { summarize, addDays } from "./points.js";
import { findVideo } from "./videos.js";

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00:00Z"));
const utcToday = () => new Date().toISOString().slice(0, 10);
/** The client's local date, trusted only within a day of the server's. */
const localDate = (v) => {
  const t = utcToday();
  return isDate(v) && v >= addDays(t, -1) && v <= addDays(t, 1) ? v : t;
};
const HANDLE = /^[a-z0-9_]{3,20}$/;

function ensureHandle(u) {
  if (u.handle) return u.handle;
  const base = (u.name || u.email.split("@")[0]).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || "mover";
  for (let i = 0; i < 50; i++) {
    const h = i === 0 && base.length >= 3 ? base : `${base}${crypto.randomInt(100, 9999)}`;
    if (!users.byHandle(h)) {
      users.setHandle(u.id, h);
      return h;
    }
  }
  const h = `mover${crypto.randomInt(100000, 999999)}`;
  users.setHandle(u.id, h);
  return h;
}

const publicUser = (u) => ({ handle: ensureHandle(u), name: u.name || u.handle });

const photoUpload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, _f, cb) => cb(null, crypto.randomUUID()) }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_q, f, cb) => cb(null, f.mimetype === "image/jpeg") // the app re-encodes to JPEG, which also strips location data,
});

export function registerSocial(app, { requireUser, isAdmin }) {
  // ----- daily check-in (streaks) -----
  app.post("/api/checkin", requireUser, (req, res) => {
    db.prepare(`INSERT OR IGNORE INTO checkins (user_id, date) VALUES (?, ?)`).run(req.user.id, localDate(req.body?.date));
    res.json({ ok: true });
  });

  // ----- points + steps -----
  app.get("/api/points", requireUser, (req, res) => res.json(summarize(req.user.id, localDate(req.query.date))));

  app.put("/api/steps", requireUser, (req, res) => {
    const today = localDate(req.body?.today);
    const date = req.body?.date;
    if (!isDate(date) || date > today || date < addDays(today, -13)) return res.status(400).json({ error: "You can log steps for the last two weeks." });
    const steps = Math.round(Number(req.body?.steps));
    if (!Number.isFinite(steps) || steps < 0 || steps > 120000) return res.status(400).json({ error: "Enter a step count between 0 and 120,000." });
    db.prepare(`INSERT INTO steps (user_id, date, steps, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, date) DO UPDATE SET steps = excluded.steps, updated_at = excluded.updated_at`).run(req.user.id, date, steps, Date.now());
    res.json(summarize(req.user.id, today));
  });

  // ----- profile -----
  app.get("/api/profile", requireUser, (req, res) => res.json(publicUser(users.byId(req.user.id))));
  app.put("/api/profile", requireUser, (req, res) => {
    const handle = str(req.body?.handle, 20).toLowerCase();
    const name = str(req.body?.name, 60);
    if (!HANDLE.test(handle)) return res.status(400).json({ error: "Usernames are 3-20 letters, numbers or underscores." });
    const taken = users.byHandle(handle);
    if (taken && taken.id !== req.user.id) return res.status(409).json({ error: "That username is taken." });
    users.setHandle(req.user.id, handle);
    if (name) users.setDisplayName(req.user.id, name);
    res.json(publicUser(users.byId(req.user.id)));
  });

  // ----- friends -----
  app.get("/api/friends", requireUser, (req, res) => {
    const today = localDate(req.query.date);
    const me = users.byId(req.user.id);
    const following = db.prepare(`SELECT u.* FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ?`).all(me.id);
    const followers = db.prepare(`SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ?`).all(me.id);
    const row = (u) => {
      const s = summarize(u.id, today);
      return { ...publicUser(u), me: u.id === me.id, weekPoints: s.weekPoints, totalPoints: s.totalPoints, streak: s.streak, todaySteps: s.today.steps };
    };
    const board = [me, ...following].map(row).sort((a, b) => b.weekPoints - a.weekPoints || b.streak - a.streak);
    const followingIds = new Set(following.map((u) => u.id));
    res.json({
      board,
      followers: followers.map((u) => ({ ...publicUser(u), followingBack: followingIds.has(u.id) })),
    });
  });
  app.post("/api/friends", requireUser, (req, res) => {
    const handle = str(req.body?.handle, 40).toLowerCase().replace(/^@/, "");
    const u = users.byHandle(handle);
    if (!u) return res.status(404).json({ error: `No one goes by @${handle} yet. Check the spelling, or invite them.` });
    if (u.id === req.user.id) return res.status(400).json({ error: "That's you!" });
    db.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)`).run(req.user.id, u.id, Date.now());
    res.json({ ok: true });
  });
  app.delete("/api/friends/:handle", requireUser, (req, res) => {
    const u = users.byHandle(String(req.params.handle).toLowerCase());
    if (u) db.prepare(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`).run(req.user.id, u.id);
    res.json({ ok: true });
  });

  // ----- community -----
  const postView = (p, me) => ({
    id: p.id, kind: p.kind, text: p.text, date: p.date, createdAt: p.created_at,
    photoUrl: p.photo_file ? `/api/community/${p.id}/photo` : null,
    author: { handle: p.handle, name: p.name || p.handle },
    cheers: p.cheers, cheered: !!p.cheered, mine: p.user_id === me.id, canDelete: p.user_id === me.id || isAdmin(me),
  });

  app.get("/api/community", requireUser, (req, res) => {
    const me = users.byId(req.user.id);
    ensureHandle(me);
    const before = Number(req.query.before) || Date.now() + 1;
    const following = req.query.scope === "following";
    const rows = db.prepare(`
      SELECT p.*, u.handle, u.name,
        (SELECT COUNT(*) FROM cheers c WHERE c.post_id = p.id) cheers,
        (SELECT 1 FROM cheers c WHERE c.post_id = p.id AND c.user_id = ?) cheered
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.created_at < ? ${following ? "AND (p.user_id = ? OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))" : ""}
      ORDER BY p.created_at DESC LIMIT 30`).all(...(following ? [me.id, before, me.id, me.id] : [me.id, before]));
    rows.forEach((r) => !r.handle && (r.handle = ensureHandle(users.byId(r.user_id))));
    res.json({ posts: rows.map((r) => postView(r, me)) });
  });

  app.post("/api/community", requireUser, photoUpload.single("photo"), (req, res) => {
    const text = str(req.body?.text, 280);
    const kind = POST_KINDS.some(([k]) => k === req.body?.kind) ? req.body.kind : "win";
    if (!text && !req.file) return res.status(400).json({ error: "Add a photo or a few words." });
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO posts (id, user_id, kind, text, photo_file, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.user.id, kind, text, req.file?.filename ?? null, localDate(req.body?.date), Date.now());
    res.status(201).json({ ok: true, id });
  });

  app.post("/api/community/:id/cheer", requireUser, (req, res) => {
    const exists = db.prepare(`SELECT 1 FROM posts WHERE id = ?`).get(req.params.id);
    if (!exists) return res.status(404).json({ error: "Post not found." });
    const had = db.prepare(`SELECT 1 FROM cheers WHERE post_id = ? AND user_id = ?`).get(req.params.id, req.user.id);
    if (had) db.prepare(`DELETE FROM cheers WHERE post_id = ? AND user_id = ?`).run(req.params.id, req.user.id);
    else db.prepare(`INSERT INTO cheers (post_id, user_id) VALUES (?, ?)`).run(req.params.id, req.user.id);
    res.json({ cheered: !had });
  });

  app.delete("/api/community/:id", requireUser, (req, res) => {
    const p = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(req.params.id);
    if (!p) return res.status(404).json({ error: "Post not found." });
    if (p.user_id !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ error: "You can only delete your own posts." });
    db.prepare(`DELETE FROM posts WHERE id = ?`).run(p.id);
    if (p.photo_file) try { unlinkSync(path.join(UPLOAD_DIR, p.photo_file)); } catch {}
    res.json({ ok: true });
  });

  app.get("/api/community/:id/photo", requireUser, (req, res) => {
    const p = db.prepare(`SELECT photo_file FROM posts WHERE id = ?`).get(req.params.id);
    if (!p?.photo_file) return res.status(404).end();
    res.set("Cache-Control", "private, max-age=86400");
    res.type("image/jpeg").sendFile(path.join(UPLOAD_DIR, p.photo_file));
  });

  // ----- exercise videos -----
  app.get("/api/videos", requireUser, async (req, res) => {
    const name = str(req.query.name, 160);
    if (!name) return res.status(400).json({ error: "Which exercise?" });
    res.json(await findVideo(name));
  });
}
