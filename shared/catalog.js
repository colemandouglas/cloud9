// Shared between the server (validation, AI prompt) and the app (builder UI).

export const GOALS = {
  health: {
    title: "General health and mobility",
    blurb: "Move better, feel stronger, and build habits that last.",
    icon: "leaf",
  },
  event: {
    title: "Train for an event",
    blurb: "From your first 5K to HYROX or a marathon.",
    icon: "flag",
  },
  medical: {
    title: "Recover with your doctor's plan",
    blurb: "Upload an MRI, X-ray, diagnosis or treatment plan and we build around it.",
    icon: "pulse",
  },
  tone: {
    title: "Lean out for an event or season",
    blurb: "Lose weight and get toned for a wedding, summer or ski season.",
    icon: "sun",
  },
  adventure: {
    title: "Get ready for an adventure",
    blurb: "Build strength and endurance for a trek, ski trip or expedition.",
    icon: "mountain",
  },
};
export const GOAL_KEYS = Object.keys(GOALS);

export const HEALTH_FOCUS = ["Move without pain", "Get stronger", "More energy", "Flexibility and mobility", "Balance and longevity", "Better posture"];

export const EVENTS = [
  "5K", "10K", "Half marathon", "Marathon", "HYROX", "Sprint triathlon", "Olympic triathlon",
  "Half Ironman (70.3)", "Ironman", "Spartan or obstacle race", "Gran fondo or century ride", "Trail or ultra race", "Other",
];
export const EVENT_GOALS = ["Finish comfortably", "Hit a time goal", "Compete for a placing"];
export const EXPERIENCE = ["First time", "Done a few", "Experienced"];

export const BODY_AREAS = ["Lower back or spine", "Neck", "Shoulder", "Hip", "Knee", "Ankle or foot", "Other"];

export const OCCASIONS = ["Wedding", "Summer or beach trip", "Ski season", "Reunion or big birthday", "Photo shoot", "Other"];
export const TONE_FOCUS = ["Lose fat", "Tone and define", "Both"];

export const ADVENTURES = [
  "Trek or long hike", "High-altitude climb (Kilimanjaro, Everest base camp)", "Ski or snowboard trip", "Cycling tour",
  "Rock climbing", "Backcountry hunting or packing", "Surf trip", "Other",
];

export const ACTIVITY = ["Mostly sitting", "Lightly active", "Active a few days a week", "Train most days"];
export const DAYS = [2, 3, 4, 5, 6];
export const MINUTES = [20, 30, 45, 60, 75];
export const PLACES = ["Gym", "Home with some equipment", "Home with no equipment", "Outdoors"];

// General readiness screen (all goals). Any "yes" asks for a doctor's clearance first.
export const READINESS = [
  ["heart", "A doctor has said I have a heart condition or should only exercise under supervision"],
  ["chest", "I get chest pain when I'm active, or have had chest pain at rest in the last month"],
  ["dizzy", "I lose my balance from dizziness, or have passed out"],
  ["meds", "I take medication for blood pressure or a heart condition"],
  ["pregnant", "I'm pregnant or gave birth in the last 6 months"],
];

// Spine red flags (medical path, lower back). Any "yes" stops the program until a doctor clears it.
export const RED_FLAGS = [
  ["groin", "Numbness in the groin, buttocks or inner thighs"],
  ["bladder", "New trouble controlling bladder or bowels"],
  ["weak", "Leg weakness that is getting worse, or foot drop"],
  ["fever", "Fever, unexplained weight loss, or a history of cancer"],
  ["trauma", "Pain that started with a fall or accident"],
];

export const AGG = [
  ["sit", "Sitting"], ["stand", "Standing still"], ["walk", "Walking"],
  ["bendf", "Bending forward"], ["bendb", "Leaning back"], ["lie", "Lying down"],
];

export const DAY_TYPES = ["strength", "cardio", "mobility", "rehab", "skill", "recovery", "rest"];

/** Spine pattern hint passed to the AI and shown to the coach. */
export function spinePattern(worse = [], eases = [], surgery = false, legSymptoms = false) {
  const flex = (worse.includes("stand") || worse.includes("walk") || worse.includes("bendb")) &&
    (eases.includes("sit") || eases.includes("bendf") || eases.includes("lie"));
  const ext = (worse.includes("sit") || worse.includes("bendf")) &&
    (eases.includes("walk") || eases.includes("stand") || eases.includes("bendb"));
  if (surgery) return "Recent spine surgery: follow the surgeon's written restrictions and protocol phases.";
  if (flex && !ext) return "Symptoms ease with flexion and worsen upright, a pattern often seen with lumbar stenosis (flexion bias).";
  if (ext && !flex) return "Symptoms ease upright and worsen with sitting or bending, a pattern often seen with disc irritation (possible extension preference).";
  if (!legSymptoms) return "Back pain without leg symptoms and no clear directional pattern: general stabilization approach.";
  return "Mixed pattern with no clear directional preference: stay conservative and symptom-guided.";
}

// ---------- Points ----------
// One place to tune the reward rules. The app explains them from these values.
export const POINTS = {
  steps: [
    [10000, 1, "Hit 10,000 steps"],
    [15000, 1, "Bonus for 15,000 steps"],
    [20000, 2, "Bonus for 20,000 steps"],
  ],
  perThousandOver: 20000, // +1 for every full 1,000 steps past this
  weekComplete: 5, // every program session in a week done
  photo: 1, // food or workout photo post
  photoDailyMax: 2,
  streakEvery: 7, // bonus every N days in a row
  streakBonus: 3,
};

/** Points earned from one day's steps. */
export function stepPoints(steps) {
  let pts = 0;
  for (const [min, p] of POINTS.steps) if (steps >= min) pts += p;
  if (steps > POINTS.perThousandOver) pts += Math.floor((steps - POINTS.perThousandOver) / 1000);
  return pts;
}

export const POST_KINDS = [["workout", "Workout"], ["food", "Food"], ["win", "Win"]];
