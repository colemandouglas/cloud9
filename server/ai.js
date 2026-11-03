// Builds each 4-week program block with Claude. The first block comes from the
// intake; every later block also sees the workout log and check-in, so the
// program adapts to how the person is actually responding.
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GOALS, DAY_TYPES, READINESS, RED_FLAGS, AGG, spinePattern } from "../shared/catalog.js";
import { UPLOAD_DIR, journeys, blocks, uploads, logs, users } from "./db.js";
import { sendEmail } from "./email.js";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const STUB = process.env.AI_MODE === "stub";
export const aiConfigured = STUB || !!process.env.ANTHROPIC_API_KEY;
export const BLOCK_WEEKS = 4;
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 8787}`;

let client = null;
const getClient = () => (client ??= new Anthropic());

// ---------- output schema ----------
const str = { type: "string" };
const strList = { type: "array", items: str };
const obj = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

const PROGRAM_SCHEMA = obj({
  title: str,
  overview: str,
  phases: { type: "array", items: obj({ name: str, weeks: str, goal: str }) },
  weeks: {
    type: "array",
    items: obj({
      week: { type: "integer" },
      focus: str,
      days: {
        type: "array",
        items: obj({
          day: { type: "integer" },
          type: { type: "string", enum: DAY_TYPES },
          title: str,
          duration_min: { type: "integer" },
          intensity: str,
          exercises: { type: "array", items: obj({ name: str, prescription: str, cue: str }) },
        }),
      },
    }),
  },
  guidelines: strList,
  stop_rules: strList,
  nutrition_tips: strList,
  next_block_preview: str,
});

const SYSTEM = `You are the head coach at Be Like Water, a training and recovery service. You write individualized programs that a person follows on their own from a phone, so every session must be clear, specific and safe to do without supervision.

How programs work:
- A journey is split into 4-week blocks. You are writing one block at a time. Each block has exactly 4 weeks, and each week has exactly 7 days numbered 1 to 7, where day 1 is the block's start date and the rest follow in order. Days the person isn't training are type "rest" (or "recovery" for an easy walk or mobility) with few or no exercises.
- Respect the person's available training days per week, session length, and where they can train. Never prescribe equipment they don't have.
- Each exercise gets a plain-language name, a prescription (sets x reps, time, distance, or pace/effort such as "RPE 6" or "conversational pace"), and one short coaching cue.
- Progress gradually across the 4 weeks. Week 4 of a block is usually a lighter consolidation week unless an event date requires otherwise.
- "phases" is the roadmap for the whole journey (all blocks), so the person can see where they're heading. Keep it consistent with earlier blocks.
- If an event, trip or occasion date is given, periodize toward it and taper in the final 1-2 weeks before it.
- Write in a warm, direct, encouraging voice. Short sentences. No jargon without a plain explanation.

Safety:
- You are not diagnosing anything. Never claim a diagnosis; describe patterns as "often seen with".
- For medical and rehab journeys: the doctor's or surgeon's restrictions and treatment plan override everything. Start conservatively, build tolerance, and keep pain monitoring rules front and center. Use the uploaded imaging reports and documents to understand the condition, but don't over-read imaging findings; symptoms and response to loading guide progression.
- Lower back: favor spine-sparing core endurance (for example McGill curl-up, side plank, bird dog), hip hinge retraining, walking, and nerve glides when there are leg symptoms. For a flexion-bias pattern (stenosis-like), avoid loaded extension early. For an extension-preference pattern (disc-like), limit prolonged slumped sitting and loaded flexion early. Introduce rotation and impact gradually and only after tolerance is shown.
- stop_rules must always include: stop if pain spreads further down a limb, if there is new numbness or weakness, or if pain during exercise goes above 5 out of 10 or is worse the next morning; plus anything specific to the person.
- nutrition_tips: general healthy-eating habits only (protein, hydration, whole foods, sustainable deficit for fat loss). No specific calorie targets, diets or supplements. Leave it empty if nutrition isn't relevant to the goal.

Adapting later blocks: you will see the previous blocks and the workout log (sessions done, effort 1-10, pain 0-10, notes) plus the person's check-in. Adjust: progress what's going well, regress or swap anything associated with rising pain or very high effort, and address missed sessions realistically.`;

// ---------- prompt assembly ----------
const label = (list, v) => list.find((x) => x[0] === v)?.[1] ?? v;

function weeksUntil(dateStr, from) {
  if (!dateStr) return null;
  const ms = new Date(dateStr + "T00:00:00Z") - new Date(from + "T00:00:00Z");
  return Math.round(ms / (7 * 86400000));
}

export function journeyLengthWeeks(j) {
  const target = j.details?.date;
  const w = weeksUntil(target, j.startDate);
  if (w && w > 0) return Math.min(52, Math.max(BLOCK_WEEKS, w));
  return 12;
}

function describeJourney(j, user) {
  const d = j.details || {}, p = j.profile || {}, s = j.screening || {};
  const lines = [
    `Goal: ${GOALS[j.goal]?.title || j.goal}`,
    `Name: ${user?.name || p.name || "Not given"}`,
    `Journey start date: ${j.startDate}. Planned journey length: ${journeyLengthWeeks(j)} weeks.`,
  ];
  const add = (k, v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length) && lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);

  // Goal-specific
  add("Focus areas", d.focus);
  add("Event", d.event === "Other" ? d.eventOther : d.event);
  add("Event goal", d.eventGoal);
  add("Target time", d.targetTime);
  add("Event experience", d.experience);
  add("Occasion", d.occasion === "Other" ? d.occasionOther : d.occasion);
  add("Adventure", d.adventure === "Other" ? d.adventureOther : d.adventure);
  add("Target date", d.date);
  if (d.date) add("Weeks from start to target date", weeksUntil(d.date, j.startDate));
  add("Body area", d.area);
  add("Diagnosis (in their words)", d.diagnosis);
  add("Doctor's treatment plan", d.treatmentPlan);
  add("Doctor's restrictions", d.restrictions);
  if (d.area === "Lower back or spine") {
    add("Back pain now (0-10)", d.backPain);
    add("Leg symptoms", d.legSide ? `${d.legSide}, ${d.legPain}/10` : "None");
    add("Worse with", (d.worse || []).map((v) => label(AGG, v)));
    add("Eased by", (d.eases || []).map((v) => label(AGG, v)));
    add("Spine surgery in the past year", d.surgery ? "Yes" : "No");
    add("Pattern note", spinePattern(d.worse, d.eases, d.surgery, !!d.legSide));
  } else {
    add("Pain now (0-10)", d.pain);
  }
  add("How long", d.duration);
  add("Treatments so far", d.treatments);
  add("Imaging or report text (pasted)", d.reportText);
  add("Details", d.notes);

  // Profile
  add("Age", p.age);
  add("Sex", p.sex);
  add("Height", p.height);
  add("Weight", p.weight);
  add("Current activity", p.activity);
  add("Training days per week", p.days);
  add("Minutes per session", p.minutes);
  add("Where they train", p.places);
  add("Equipment they have", p.equipment);
  add("Injuries or limitations", p.limitations);
  add("Likes", p.likes);
  add("Dislikes", p.dislikes);
  add("In their own words", p.ownWords);

  // Screening
  add("Readiness screen answers", (s.readiness || []).map((v) => label(READINESS, v)));
  if (s.cleared) lines.push("They confirmed a doctor has cleared them to exercise.");
  add("Red flags reported", (s.redFlags || []).map((v) => label(RED_FLAGS, v)));
  if (j.coachNote) add("Note from their coach (follow it)", j.coachNote);
  return lines.join("\n");
}

function describeHistory(j, idx) {
  const prev = blocks.forJourney(j.id).filter((b) => b.idx < idx && b.program);
  if (!prev.length) return "";
  const allLogs = logs.forJourney(j.id);
  const out = [];
  for (const b of prev) {
    const bl = allLogs.filter((l) => l.blockIdx === b.idx);
    const planned = b.program.weeks.flatMap((w) => w.days.filter((d) => d.type !== "rest").map((d) => ({ w: w.week, d })));
    const done = bl.filter((l) => l.done);
    out.push(`\nBlock ${b.idx + 1} ("${b.program.title}", started ${b.startDate}): ${done.length} of ${planned.length} planned sessions completed.`);
    for (const w of b.program.weeks) out.push(`  Week ${w.week}: ${w.focus}`);
    for (const l of bl) {
      const day = b.program.weeks.find((w) => w.week === l.week)?.days.find((d) => d.day === l.day);
      out.push(`  Log W${l.week}D${l.day} ${day ? `"${day.title}"` : ""}: ${l.done ? "done" : "not done"}` +
        `${l.effort != null ? `, effort ${l.effort}/10` : ""}${l.pain != null ? `, pain ${l.pain}/10` : ""}${l.note ? `, note: "${l.note}"` : ""}`);
    }
    if (b.checkin) out.push(`  Check-in before the next block: "${b.checkin}"`);
  }
  return out.join("\n");
}

async function attachments(journeyId) {
  const blocksOut = [];
  for (const u of uploads.forJourney(journeyId)) {
    const data = (await readFile(path.join(UPLOAD_DIR, u.file))).toString("base64");
    if (u.type === "application/pdf") {
      blocksOut.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data }, title: u.name });
    } else {
      blocksOut.push({ type: "image", source: { type: "base64", media_type: u.type, data } });
    }
  }
  return blocksOut;
}

// ---------- validation ----------
function normalize(p) {
  if (!p || !Array.isArray(p.weeks) || !p.weeks.length) throw new Error("Program came back without weeks.");
  p.weeks = p.weeks.slice(0, BLOCK_WEEKS).map((w, i) => {
    const byDay = new Map((w.days || []).map((d) => [d.day, d]));
    const days = [];
    for (let n = 1; n <= 7; n++) {
      const d = byDay.get(n) || { day: n, type: "rest", title: "Rest", duration_min: 0, intensity: "", exercises: [] };
      days.push({ ...d, day: n, type: DAY_TYPES.includes(d.type) ? d.type : "rest", exercises: d.exercises || [] });
    }
    return { week: i + 1, focus: w.focus || "", days };
  });
  for (const k of ["phases", "guidelines", "stop_rules", "nutrition_tips"]) p[k] = Array.isArray(p[k]) ? p[k] : [];
  return p;
}

// ---------- generation ----------
async function callClaude(content) {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: PROGRAM_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The AI declined to write this program. A coach will take a look.");
  if (msg.stop_reason === "max_tokens") throw new Error("The program was too long to finish. Try again.");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

function stubProgram(j, idx) {
  const train = Number(j.profile?.days) || 3;
  const pattern = [1, 3, 5, 2, 4, 6].slice(0, train);
  return {
    title: `[Test program] ${GOALS[j.goal]?.title || "Program"}, block ${idx + 1}`,
    overview: "This is a placeholder from test mode (AI_MODE=stub). Set ANTHROPIC_API_KEY to generate a real program.",
    phases: [{ name: "Foundation", weeks: "1-4", goal: "Build the habit" }, { name: "Build", weeks: "5-8", goal: "Add load" }],
    weeks: [1, 2, 3, 4].map((w) => ({
      week: w,
      focus: `Test week ${w}`,
      days: [1, 2, 3, 4, 5, 6, 7].map((d) =>
        pattern.includes(d)
          ? { day: d, type: "strength", title: "Test session", duration_min: 30, intensity: "Easy", exercises: [
              { name: "Bird dog", prescription: "3 x 8 each side", cue: "Keep your back still." },
              { name: "Side plank", prescription: "3 x 20 s each side", cue: "Long line from head to heels." },
            ] }
          : { day: d, type: "rest", title: "Rest", duration_min: 0, intensity: "", exercises: [] }
      ),
    })),
    guidelines: ["Test mode guideline."],
    stop_rules: ["Stop if pain spreads down your leg."],
    nutrition_tips: [],
    next_block_preview: "Next block adds load.",
  };
}

const running = new Set();

export async function generateBlock(journeyId, idx) {
  const key = `${journeyId}:${idx}`;
  if (running.has(key)) return;
  running.add(key);
  try {
    const j = journeys.get(journeyId);
    const user = users.byId(j.userId);
    const b = blocks.get(journeyId, idx);
    let program;
    if (!aiConfigured) throw new Error("The program builder isn't switched on yet. We'll build your program as soon as it is.");
    if (STUB) {
      await new Promise((r) => setTimeout(r, 1500));
      program = stubProgram(j, idx);
    } else {
      const content = [
        ...(await attachments(journeyId)),
        {
          type: "text",
          text:
            `Today is ${new Date().toISOString().slice(0, 10)}. Write block ${idx + 1} of this journey ` +
            `(weeks ${idx * BLOCK_WEEKS + 1}-${(idx + 1) * BLOCK_WEEKS} overall), starting ${b.startDate}.\n\n` +
            `About the person:\n${describeJourney(j, user)}` +
            (idx > 0 ? `\n\nHistory so far:${describeHistory(j, idx)}` : "") +
            (uploads.forJourney(journeyId).length ? "\n\nTheir uploaded medical documents are attached above." : ""),
        },
      ];
      program = await callClaude(content);
    }
    blocks.ready(journeyId, idx, normalize(program));
    if (j.status !== "active") journeys.setStatus(journeyId, "active");
    if (user) {
      await sendEmail({
        to: user.email,
        subject: idx === 0 ? "Your program is ready" : `Block ${idx + 1} of your program is ready`,
        heading: idx === 0 ? `${user.name ? user.name.split(" ")[0] + ", y" : "Y"}our program is ready` : "Your next block is ready",
        body: `<p>${idx === 0 ? "We've built your first 4 weeks." : "We've adjusted your next 4 weeks based on how the last block went."} Open the app to see today's session.</p>`,
        cta: { label: "Open my program", url: `${APP_URL}/app` },
      });
    }
  } catch (err) {
    console.error(`Block ${idx} for journey ${journeyId} failed:`, err);
    const msg = err instanceof Anthropic.APIError
      ? "The program builder is busy right now. Try again in a few minutes."
      : err.message || "Something went wrong building your program.";
    blocks.fail(journeyId, idx, msg);
    if (idx === 0) journeys.setStatus(journeyId, "error", msg);
  } finally {
    running.delete(key);
  }
}

/** Restart any generation interrupted by a server restart. */
export function resumeStuck() {
  for (const { journey_id, idx } of blocks.stuck()) generateBlock(journey_id, idx);
}
