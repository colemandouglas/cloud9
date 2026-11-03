// Clinical content for the prototype. Templates, aggravating factors, red
// flags and the pattern note are all reviewed by a clinician before use.

export type TemplateKey = "stenosis" | "disc" | "general" | "postop";
export type Status = "new" | "review" | "assigned" | "flag";

export interface Template {
  name: string;
  fit: string;
  week: [string, string][];
  avoid: string;
}

export const TEMPLATES: Record<TemplateKey, Template> = {
  stenosis: {
    name: "Lumbar stenosis, flexion bias",
    fit: "Leg symptoms worse standing or walking, eased by sitting or bending forward.",
    week: [
      ["Mon", "Strength A: lower body and McGill core"],
      ["Tue", "Mobility, nerve glides, low-impact cardio"],
      ["Wed", "Strength B: upper body and anti-rotation"],
      ["Thu", "Mobility, nerve glides, low-impact cardio"],
      ["Fri", "Strength C: legs and hips"],
      ["Sat", "Walk plus sport skill work"],
      ["Sun", "Rest"],
    ],
    avoid: "Back-bending under load, prone extension (supermans), jumping until phase 3.",
  },
  disc: {
    name: "Disc herniation, directional preference",
    fit: "Leg symptoms worse sitting or bending, eased by standing, walking or gentle extension. Clinician confirms the direction.",
    week: [
      ["Daily", "Repeated movements in the preferred direction, every 2 to 3 hours"],
      ["Mon", "Walking program and core endurance"],
      ["Wed", "Hip strength and hinge retraining"],
      ["Fri", "Walking program and core endurance"],
      ["Sat", "Longer walk, graded sitting tolerance"],
    ],
    avoid: "Prolonged slumped sitting and loaded forward bending early on.",
  },
  general: {
    name: "General low back pain, stabilization",
    fit: "Back pain without leg symptoms, no clear directional pattern.",
    week: [
      ["Mon", "Full-body strength with McGill core"],
      ["Tue", "Walk 30 min"],
      ["Wed", "Hip and trunk endurance"],
      ["Thu", "Walk 30 min plus mobility"],
      ["Fri", "Full-body strength"],
      ["Sat", "Activity of choice"],
    ],
    avoid: "Long periods in one position. Change posture every 30 to 40 minutes.",
  },
  postop: {
    name: "Post-surgical, surgeon protocol",
    fit: "Recent spine surgery. Follows the surgeon's written restrictions.",
    week: [
      ["Daily", "Walking, building time each week as cleared"],
      ["Mon", "Protocol phase exercises"],
      ["Wed", "Protocol phase exercises"],
      ["Fri", "Protocol phase exercises"],
    ],
    avoid: "Anything the surgical protocol restricts, especially lifting and twisting limits.",
  },
};

export const PHASES = ["Phase 1: foundation", "Phase 2: load and rotation", "Phase 3: sport prep"];

export const AGG: [string, string][] = [
  ["sit", "Sitting"],
  ["stand", "Standing still"],
  ["walk", "Walking"],
  ["bendf", "Bending forward"],
  ["bendb", "Leaning back"],
  ["lie", "Lying down"],
];

export const FLAGS: [string, string][] = [
  ["groin", "Numbness in the groin, buttocks or inner thighs"],
  ["bladder", "New trouble controlling bladder or bowels"],
  ["weak", "Leg weakness that is getting worse, or foot drop"],
  ["fever", "Fever, unexplained weight loss, or a history of cancer"],
  ["trauma", "Pain that started with a fall or accident"],
];

export const DURATIONS = ["Under 6 weeks", "6 to 12 weeks", "3 to 12 months", "Over a year"];

export const STATUS: Record<Status, [string, string]> = {
  new: ["New", "p-new"],
  review: ["In review", "p-review"],
  assigned: ["Program assigned", "p-assigned"],
  flag: ["Red flag", "p-flag"],
};

export interface Program {
  template: TemplateKey;
  phase: string;
  notes: string;
  assignedAt: number;
}

export interface Case {
  id: string;
  status: Status;
  name: string;
  age: number | null;
  email: string;
  complaint: string;
  legSide: string;
  legPain: number;
  backPain: number;
  duration: string;
  worse: string[];
  eases: string[];
  surgery: boolean;
  report: string;
  goals: string;
  treatments: string;
  flags: string[];
  program: Program | null;
  imaging: { name: string; type: string } | null;
  createdAt: number;
  updatedAt: number;
}

export const aggLabel = (v: string) => AGG.find((a) => a[0] === v)?.[1] ?? v;
export const flagLabel = (v: string) => FLAGS.find((f) => f[0] === v)?.[1] ?? v;

/** A suggested template plus the reasoning, for the clinician to confirm. */
export function pattern(c: Pick<Case, "worse" | "eases" | "surgery" | "legPain" | "legSide">): [TemplateKey | null, string] {
  const w = c.worse || [], e = c.eases || [];
  const flex = (w.includes("stand") || w.includes("walk") || w.includes("bendb")) && (e.includes("sit") || e.includes("bendf") || e.includes("lie"));
  const ext = (w.includes("sit") || w.includes("bendf")) && (e.includes("walk") || e.includes("stand") || e.includes("bendb"));
  if (c.surgery) return ["postop", "Recent surgery reported. Request the surgeon's protocol before assigning."];
  if (flex && !ext) return ["stenosis", "Symptoms ease with flexion and worsen upright, a pattern often seen with stenosis. Confirm on assessment."];
  if (ext && !flex) return ["disc", "Symptoms ease upright and worsen with sitting or bending, a pattern often seen with disc irritation. Confirm directional preference on assessment."];
  if (!c.legSide) return ["general", "No leg symptoms and no clear direction. Confirm on assessment."];
  return [null, "Mixed pattern. Needs a live assessment before choosing a template."];
}
