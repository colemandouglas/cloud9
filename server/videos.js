// Finds a short demo video for an exercise. YouTube supplies short, embeddable
// candidates with their like counts and top comments; Claude picks the one that
// actually demonstrates the move well and that viewers rate positively.
// Results are cached per exercise name and shared across everyone.
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db.js";
import { MODEL } from "./ai.js";

const YT_KEY = process.env.YOUTUBE_API_KEY;
export const videosConfigured = !!YT_KEY;
const CACHE_DAYS = 60;
let client = null;
const anthropic = () => (client ??= new Anthropic());

export const nameKey = (name) => String(name).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
export const searchUrl = (name) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to ${name} exercise`)}`;

async function yt(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: YT_KEY })) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`YouTube ${path} ${res.status}`), { status: res.status });
  return res.json();
}

async function candidates(name) {
  const search = await yt("search", {
    part: "snippet", type: "video", q: `how to ${name} exercise proper form`, videoDuration: "short",
    videoEmbeddable: "true", safeSearch: "strict", relevanceLanguage: "en", maxResults: "10",
  });
  const ids = search.items.map((i) => i.id.videoId).filter(Boolean);
  if (!ids.length) return [];
  const stats = await yt("videos", { part: "statistics,contentDetails,status,snippet", id: ids.join(",") });
  const list = stats.items
    .filter((v) => v.status?.embeddable && Number(v.statistics?.viewCount || 0) >= 1000)
    .map((v) => {
      const views = Number(v.statistics.viewCount || 0), likes = Number(v.statistics.likeCount || 0);
      return {
        id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, description: (v.snippet.description || "").slice(0, 300),
        duration: v.contentDetails.duration, views, likes, likeRate: views ? likes / views : 0, comments: [],
      };
    })
    // Most liked first, weighted toward a strong like rate.
    .sort((a, b) => b.likes * (0.5 + b.likeRate * 20) - a.likes * (0.5 + a.likeRate * 20))
    .slice(0, 5);
  for (const c of list) {
    try {
      const t = await yt("commentThreads", { part: "snippet", videoId: c.id, order: "relevance", maxResults: "12", textFormat: "plainText" });
      c.comments = t.items.map((i) => i.snippet.topLevelComment.snippet.textDisplay.slice(0, 200));
    } catch {
      /* comments disabled */
    }
  }
  return list;
}

async function choose(name, list) {
  const res = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: { type: "object", additionalProperties: false, required: ["choice", "reason"], properties: { choice: { type: "integer" }, reason: { type: "string" } } },
      },
    },
    system:
      "You pick exercise demo videos for a training and rehab app. Choose the candidate that clearly demonstrates the named exercise with good form, suits a beginner or someone recovering from pain, and has positive viewer comments (helpful, clear, worked for me). Reject videos that show a different exercise, push extreme or risky variations, are mostly selling something, or have comments complaining about form or misinformation. Reply with the candidate's number, or -1 if none is good enough, and one short sentence why.",
    messages: [{
      role: "user",
      content: `Exercise: ${name}\n\n` + list.map((c, i) =>
        `#${i}: "${c.title}" by ${c.channel} (${c.duration}, ${c.views} views, ${c.likes} likes)\nDescription: ${c.description}\nTop comments:\n${c.comments.map((x) => `- ${x}`).join("\n") || "(none)"}`
      ).join("\n\n"),
    }],
  });
  if (res.stop_reason === "refusal") return { choice: -1, reason: "" };
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

const pending = new Map();

/** { videoId, title, channel, reason } or { searchUrl } when no good video was found or lookup isn't set up. */
export async function findVideo(name) {
  const key = nameKey(name);
  const fallback = { searchUrl: searchUrl(name) };
  if (!key) return fallback;
  const row = db.prepare(`SELECT * FROM videos WHERE name_key = ?`).get(key);
  if (row && Date.now() - row.fetched_at < CACHE_DAYS * 86400000)
    return row.video_id ? { videoId: row.video_id, title: row.title, channel: row.channel, reason: row.reason } : fallback;
  if (!YT_KEY || !process.env.ANTHROPIC_API_KEY) return fallback;
  if (pending.has(key)) return pending.get(key);

  const job = (async () => {
    try {
      const list = await candidates(name);
      let pick = { choice: -1, reason: "" };
      if (list.length) pick = await choose(name, list);
      const c = list[pick.choice];
      db.prepare(`INSERT OR REPLACE INTO videos (name_key, video_id, title, channel, reason, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(key, c?.id ?? null, c?.title ?? null, c?.channel ?? null, c ? pick.reason : null, Date.now());
      return c ? { videoId: c.id, title: c.title, channel: c.channel, reason: pick.reason } : fallback;
    } catch (err) {
      console.error(`Video lookup for "${name}" failed:`, err.message);
      return fallback; // not cached, so it retries next time
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}
