// The AI steps (SPEC 7-9), pure and shared: the idea form and the tailoring inputs, which part of the
// skeleton each step writes (its schema is cut out of SKELETON_SCHEMA), how a step's output is merged and
// checked, which later steps go stale, and the final-feedback schema. No model calls here: the functions
// call the model and use these to check and apply what comes back.
import { SKELETON_SCHEMA, SKELETON_VERSION, LIMITS as SK, PRODUCT_TYPES, CEFR, DURATION_UNITS, validate, checkSkeleton } from './skeleton.js';

const P = SKELETON_SCHEMA.properties;
const B = P.basics.properties;
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const str = (maxLength) => ({ type: 'string', maxLength });

// Working languages the teacher can pick for the project content (the UI stays English).
export const LANGUAGES = Object.freeze({
  en: 'English', de: 'German', es: 'Spanish', fr: 'French', it: 'Italian', hu: 'Hungarian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
});

// ---- steps ------------------------------------------------------------------------------------------
// key: price key (potluck/<action>); owns: top-level skeleton paths the step writes.
export const STEPS = Object.freeze({
  idea: { n: 0, label: 'Draft the project from your idea', owns: ['basics', 'phases', 'roles', 'teacherNotes'] },
  plan: { n: 1, label: 'Project plan', owns: ['phases', 'basics.subjects'] },
  groups: { n: 2, label: 'Group briefs and roles', owns: ['basics.brief', 'groups.briefs', 'roles'] },
  tasks: { n: 3, label: 'Tasks on the board', owns: ['tasks'] },
  assessment: { n: 4, label: 'Criteria and questions', owns: ['assessment'] },
  handouts: { n: 5, label: 'Printable handouts', owns: ['handouts', 'teacherNotes'] },
});
export const TAILOR_STEPS = ['plan', 'groups', 'tasks', 'assessment', 'handouts'];
export const REQUIRED_STEPS = ['plan', 'groups', 'tasks', 'assessment']; // handouts are optional

/** The price key of a step: first run, regeneration, or the special ones. */
export function actionFor(step, { regenerate = false } = {}) {
  if (regenerate) return 'regenerate';
  if (step === 'idea') return 'from-idea';
  if (step === 'handouts') return 'handouts';
  return 'setup-step';
}

// What the model returns per step (subsets of the skeleton schema, so a valid part fits the skeleton).
export const PART_SCHEMAS = Object.freeze({
  idea: obj({
    basics: obj({
      title: B.title, drivingQuestion: B.drivingQuestion, summary: B.summary, brief: B.brief, product: B.product,
      audience: B.audience, subjects: B.subjects,
    }),
    phases: P.phases,
    roles: P.roles,
    teacherNotes: P.teacherNotes,
  }),
  plan: obj({ phases: P.phases, subjects: B.subjects }),
  groups: obj({ brief: B.brief, briefs: P.groups.properties.briefs, roles: P.roles }),
  tasks: obj({ tasks: P.tasks }),
  assessment: obj({ assessment: P.assessment }),
  handouts: obj({ handouts: P.handouts, teacherNotes: P.teacherNotes }),
});

// ---- inputs -------------------------------------------------------------------------------------------

const clean = (s) => String(s ?? '').trim();
const int = (v) => (Number.isInteger(Number(v)) && String(v).trim() !== '' ? Number(v) : NaN);

/**
 * The tailoring inputs (teacher's numbers; the model never decides them): subjects, groups, time,
 * level, language, local context. Returns { ok, value, errors: [{ field, message }] }.
 */
export function checkInputs(raw) {
  const errors = [];
  const err = (field, message) => errors.push({ field, message });
  const subjects = (Array.isArray(raw?.subjects) ? raw.subjects : []).map(clean).filter(Boolean);
  if (subjects.length < SK.subjects[0] || subjects.length > SK.subjects[1]) err('subjects', 'Give 1-3 subjects (Subject 1 at least).');
  if (subjects.some((s) => s.length > SK.name)) err('subjects', `A subject name has at most ${SK.name} characters.`);
  if (new Set(subjects.map((s) => s.toLowerCase())).size !== subjects.length) err('subjects', 'Each subject once.');
  const groupCount = int(raw?.groupCount);
  if (!(groupCount >= 1 && groupCount <= 12)) err('groupCount', 'Give 1-12 groups.');
  const sizeMin = int(raw?.sizeMin); const sizeMax = int(raw?.sizeMax);
  if (!(sizeMin >= 2 && sizeMin <= 8) || !(sizeMax >= sizeMin && sizeMax <= 8)) err('groupSize', 'Group size: 2-8 students, the smaller number first.');
  const unit = DURATION_UNITS.includes(raw?.unit) ? raw.unit : null;
  if (!unit) err('unit', 'Choose lessons or weeks.');
  const amount = int(raw?.amount);
  const [aMin, aMax] = unit === 'weeks' ? SK.weeks : SK.lessons;
  if (!(amount >= aMin && amount <= aMax)) err('amount', `Give ${aMin}-${aMax} ${unit ?? 'lessons'}.`);
  const lessonMinutes = int(raw?.lessonMinutes);
  if (!(lessonMinutes >= SK.lessonMinutes[0] && lessonMinutes <= SK.lessonMinutes[1])) err('lessonMinutes', 'A lesson is 30-120 minutes.');
  const ageMin = int(raw?.ageMin); const ageMax = int(raw?.ageMax);
  if (!(ageMin >= SK.ageMin && ageMax <= SK.ageMax && ageMin <= ageMax)) err('ages', `Ages ${SK.ageMin}-${SK.ageMax}, the younger first.`);
  const cefr = raw?.cefr ? String(raw.cefr) : null;
  if (cefr !== null && !CEFR.includes(cefr)) err('cefr', 'Choose a level from A1 to C2, or none.');
  const language = LANGUAGES[raw?.language] ? raw.language : null;
  if (!language) err('language', 'Choose a language.');
  const context = clean(raw?.context);
  if (context.length > 400) err('context', 'Local context: at most 400 characters.');
  return {
    ok: errors.length === 0,
    errors,
    value: { subjects, groupCount, sizeMin, sizeMax, unit, amount, lessonMinutes, ageMin, ageMax, cefr, language, context },
  };
}

/** The idea form: the inputs plus the idea itself (decided 2026-11-21: a form, not free text). */
export const IDEA_FIELDS = Object.freeze({
  challenge: 240, product: 240, audience: 160, contributions: 240, mustHave: 240,
});
const IDEA_REQUIRED = { challenge: 'Write the challenge or driving question.', product: 'Describe the product.', audience: 'Say who sees the product.' };
const IDEA_LABELS = { challenge: 'Challenge', product: 'Product', audience: 'Audience', contributions: 'What each subject brings', mustHave: 'Required content' };
export function checkIdea(raw) {
  const base = checkInputs(raw);
  const errors = [...base.errors];
  const v = { ...base.value };
  const productType = PRODUCT_TYPES.includes(raw?.productType) ? raw.productType : null;
  if (!productType) errors.push({ field: 'productType', message: 'Choose what the groups make.' });
  v.productType = productType;
  for (const [field, max] of Object.entries(IDEA_FIELDS)) {
    v[field] = clean(raw?.[field]);
    const required = ['challenge', 'product', 'audience'].includes(field);
    if (required && !v[field]) errors.push({ field, message: IDEA_REQUIRED[field] });
    if (v[field].length > max) errors.push({ field, message: `${IDEA_LABELS[field]}: at most ${max} characters.` });
  }
  return { ok: errors.length === 0, errors, value: v };
}

/** Teacher numbers written straight into the skeleton (never by the model). */
export function applyInputs(sk, inputs) {
  const out = structuredClone(sk);
  const old = new Map((out.basics.subjects ?? []).map((s) => [s.name.toLowerCase(), s.contribution]));
  out.basics.subjects = inputs.subjects.map((name) => ({ name, contribution: old.get(name.toLowerCase()) || `What ${name} brings to the project.` }));
  out.basics.level = { ageMin: inputs.ageMin, ageMax: inputs.ageMax, cefr: inputs.cefr };
  out.basics.duration = { unit: inputs.unit, amount: inputs.amount, lessonMinutes: inputs.lessonMinutes };
  out.basics.workingLanguage = inputs.language;
  out.groups.sizeMin = inputs.sizeMin;
  out.groups.sizeMax = inputs.sizeMax;
  return out;
}

/** An empty skeleton for an own idea before step 0 (shape only; it is not valid until the steps ran). */
export function blankSkeleton(inputs, idea) {
  return applyInputs({
    schemaVersion: SKELETON_VERSION,
    basics: {
      title: '', drivingQuestion: idea.challenge, summary: '', brief: '', product: { type: idea.productType, description: idea.product },
      audience: idea.audience, subjects: [], level: { ageMin: 0, ageMax: 0, cefr: null }, duration: { unit: 'lessons', amount: 1, lessonMinutes: 45 }, workingLanguage: 'en',
    },
    groups: { sizeMin: 0, sizeMax: 0, briefs: [] },
    phases: [], roles: [], tasks: [],
    assessment: { criteria: [], selfQuestions: [], contributionQuestions: [] },
    handouts: [], teacherNotes: { preparation: '', variations: [] },
  }, inputs);
}

// ---- merging and checking ----------------------------------------------------------------------------------

/** A step's part as it is in a skeleton now (what the model sees as the starting point; the mock returns it). */
export function partOf(sk, step) {
  const b = sk.basics;
  return {
    idea: () => ({
      basics: { title: b.title, drivingQuestion: b.drivingQuestion, summary: b.summary, brief: b.brief, product: b.product, audience: b.audience, subjects: b.subjects },
      phases: sk.phases, roles: sk.roles, teacherNotes: sk.teacherNotes,
    }),
    plan: () => ({ phases: sk.phases, subjects: b.subjects }),
    groups: () => ({ brief: b.brief, briefs: sk.groups.briefs, roles: sk.roles }),
    tasks: () => ({ tasks: sk.tasks }),
    assessment: () => ({ assessment: sk.assessment }),
    handouts: () => ({ handouts: sk.handouts, teacherNotes: sk.teacherNotes }),
  }[step]();
}

/** The skeleton with a step's output applied (inputs are applied again on top: numbers stay the teacher's). */
export function mergePart(sk, step, part, inputs) {
  const out = structuredClone(sk);
  if (step === 'idea') {
    Object.assign(out.basics, part.basics);
    out.phases = part.phases; out.roles = part.roles; out.teacherNotes = part.teacherNotes;
  } else if (step === 'plan') {
    out.phases = part.phases;
    out.basics.subjects = part.subjects;
  } else if (step === 'groups') {
    out.basics.brief = part.brief; out.groups.briefs = part.briefs; out.roles = part.roles;
  } else if (step === 'tasks') {
    out.tasks = part.tasks;
  } else if (step === 'assessment') {
    out.assessment = part.assessment;
  } else if (step === 'handouts') {
    out.handouts = part.handouts; out.teacherNotes = part.teacherNotes;
  }
  if (!inputs) return out;
  // Subject names and every number come from the teacher; the model only wrote the contributions.
  const contrib = new Map(out.basics.subjects.map((s) => [s.name.toLowerCase(), s.contribution]));
  const merged = applyInputs(out, inputs);
  merged.basics.subjects = inputs.subjects.map((name) => ({ name, contribution: contrib.get(name.toLowerCase()) || `What ${name} brings to the project.` }));
  return merged;
}

const OWNER = [
  ['assessment', 'assessment'], ['tasks', 'tasks'], ['handouts', 'handouts'], ['teacherNotes', 'handouts'],
  ['roles', 'groups'], ['groups', 'groups'], ['basics.brief', 'groups'], ['phases', 'plan'], ['basics', 'plan'],
];
/** Which step an error path belongs to. */
export function stepOfPath(path) {
  for (const [prefix, step] of OWNER) if (path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`)) return step;
  return 'plan';
}

/**
 * Checks a candidate skeleton after `step`. Errors in this step's own fields (and in the steps before it)
 * make the output unusable; errors in later steps only make those steps stale (they must run again).
 * done: the steps already applied. Returns { errors, stale }.
 */
export function checkStep(candidate, step, done = []) {
  const all = [...validate(SKELETON_SCHEMA, candidate), ...checkSkeletonSafe(candidate)];
  const errors = []; const stale = new Set();
  for (const e of all) {
    const owner = stepOfPath(e.path);
    // Step 0 writes basics, phases and roles: those must be right after it.
    const mine = step === 'idea' ? owner === 'plan' || e.path === 'roles' || e.path.startsWith('roles') : owner === step;
    if (mine) errors.push(e);
    else if (done.includes(owner)) stale.add(owner);
  }
  return { errors, stale: [...stale] };
}

/** Problems that block launching: the full skeleton check, grouped by the step that fixes them. */
export function launchProblems(sk) {
  const all = [...validate(SKELETON_SCHEMA, sk), ...checkSkeletonSafe(sk)];
  const by = {};
  for (const e of all) (by[stepOfPath(e.path)] ??= []).push(e);
  return by;
}

// checkSkeleton reads nested fields, so run it only when the shape is there.
function checkSkeletonSafe(sk) {
  try { return checkSkeleton(sk); } catch { return []; }
}

// ---- final feedback -------------------------------------------------------------------------------------------

export const FEEDBACK_LIMITS = Object.freeze({ group: 1200, member: 800 });
export const FEEDBACK_SCHEMA = obj({
  group: { ...str(FEEDBACK_LIMITS.group), description: 'feedback to the whole group: what worked, what to improve' },
  members: {
    type: 'array', minItems: 1, maxItems: 8,
    items: obj({ sid: { type: 'string', maxLength: 40 }, text: str(FEEDBACK_LIMITS.member) }),
  },
});
/** The model's feedback must name exactly the group's members, once each. */
export function checkFeedback(fb, memberIds) {
  const errors = validate(FEEDBACK_SCHEMA, fb);
  if (errors.length) return errors;
  const ids = fb.members.map((m) => m.sid);
  if (ids.length !== memberIds.length || !memberIds.every((s) => ids.includes(s))) {
    return [{ path: 'members', message: `needs one paragraph for each of: ${memberIds.join(', ')}` }];
  }
  return [];
}

// ---- schema for the model API --------------------------------------------------------------------------------

/**
 * SKELETON_SCHEMA marks optional values with `nullable` (OpenAPI style). The model API takes JSON Schema:
 * a nullable value becomes type [t, "null"] (an enum gets null as a member).
 * Bounds (lengths, list sizes, number ranges) make the API's constrained decoding too large for big
 * parts ("too many states"), so they go into the description as text; validate() still enforces them
 * on our side, and a failed check gets one repair round.
 */
const BOUNDS = ['maxLength', 'minItems', 'maxItems', 'minimum', 'maximum'];
export function toModelSchema(s) {
  if (Array.isArray(s)) return s.map(toModelSchema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'nullable' || BOUNDS.includes(k)) continue;
    out[k] = k === 'properties' ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toModelSchema(pv)])) : toModelSchema(v);
  }
  const hints = [];
  if (s.maxLength) hints.push(`at most ${s.maxLength} characters`);
  if (s.minItems !== undefined || s.maxItems !== undefined) hints.push(`${s.minItems ?? 0}-${s.maxItems ?? 'any'} items`);
  if (s.minimum !== undefined || s.maximum !== undefined) hints.push(`from ${s.minimum ?? '-'} to ${s.maximum ?? '-'}`);
  if (hints.length) out.description = [s.description, hints.join(', ')].filter(Boolean).join('; ');
  if (s.nullable) {
    out.type = [s.type, 'null'];
    if (s.enum) out.enum = [...s.enum, null];
  }
  return out;
}
