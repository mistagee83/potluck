// The project skeleton (Hub spec "Potluck – projekt-app" → "Projektváz"; SPEC section 4).
// Every project is one skeleton: a built-in template, a project made from the idea form, and the result
// of every AI step all fill these fields, and every part of the app (board, hand-ins, monitor,
// assessment, exhibition, export) reads only these fields. The model never invents structure: its
// output is checked against SKELETON_SCHEMA (shape) and checkSkeleton (references and totals).
//
// SKELETON_SCHEMA uses the JSON Schema subset that Gemini structured output accepts (type, properties,
// required, items, enum, minItems/maxItems, minimum/maximum, maxLength, nullable). The same object is
// sent to the model and used by validate() here, so the two can never drift apart.
// Pure module, no dependencies: runs in the browser and in the Cloud Functions.

export const SKELETON_VERSION = 1;

export const PRODUCT_TYPES = [
  'magazine', 'video', 'presentation', 'map', 'podcast', 'website', 'poster', 'event', 'prototype', 'report', 'other',
];
export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const DURATION_UNITS = ['lessons', 'weeks'];
export const HAND_IN = ['link', 'none']; // 'none': shown in class (a presentation), nothing to hand in
export const QUESTION_KINDS = ['scale', 'text']; // scale: 1-4, text: a short answer
export const HANDOUT_FOR = ['student', 'group', 'teacher'];

// Limits in one place (the schema below and the idea form use them).
export const LIMITS = {
  title: 80, short: 60, name: 40, line: 160, text: 240, long: 400, notes: 600, handout: 4000,
  subjects: [1, 3], phases: [2, 6], steps: [1, 8], roles: [2, 6], tasksPerPhase: [1, 10],
  briefs: [0, 8], criteria: [3, 8], questions: [2, 6], handouts: [0, 6], variations: [0, 5],
  ageMin: 6, ageMax: 19, lessons: [1, 60], weeks: [1, 12], lessonMinutes: [30, 120],
};

const str = (maxLength) => ({ type: 'string', maxLength });
const id = { type: 'string', maxLength: 24, description: 'short lowercase id, unique within its list (a-z, 0-9, -)' };
const list = (items, [minItems, maxItems]) => ({ type: 'array', items, minItems, maxItems });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });

const question = obj({
  id,
  text: str(LIMITS.line),
  kind: { type: 'string', enum: QUESTION_KINDS },
});

export const SKELETON_SCHEMA = obj({
  schemaVersion: { type: 'integer', minimum: SKELETON_VERSION, maximum: SKELETON_VERSION },
  basics: obj({
    title: str(LIMITS.title),
    drivingQuestion: { ...str(LIMITS.line), description: 'the challenge the groups answer, one question' },
    summary: str(LIMITS.long),
    brief: { ...str(LIMITS.long), description: 'what every group does, said to the students' },
    product: obj({ type: { type: 'string', enum: PRODUCT_TYPES }, description: str(LIMITS.text) }),
    audience: { ...str(LIMITS.line), description: 'who sees the finished product' },
    subjects: list(obj({ name: str(LIMITS.name), contribution: str(LIMITS.text) }), LIMITS.subjects),
    level: obj({
      ageMin: { type: 'integer', minimum: LIMITS.ageMin, maximum: LIMITS.ageMax },
      ageMax: { type: 'integer', minimum: LIMITS.ageMin, maximum: LIMITS.ageMax },
      cefr: { type: 'string', enum: CEFR, nullable: true, description: 'only when a language is assessed' },
    }, ['ageMin', 'ageMax']),
    duration: obj({
      unit: { type: 'string', enum: DURATION_UNITS },
      amount: { type: 'integer', minimum: 1, maximum: LIMITS.lessons[1] },
      lessonMinutes: { type: 'integer', minimum: LIMITS.lessonMinutes[0], maximum: LIMITS.lessonMinutes[1] },
    }),
    workingLanguage: { type: 'string', maxLength: 8, description: 'language of the students’ work, ISO code (en, de, ...)' },
  }),
  groups: obj({
    sizeMin: { type: 'integer', minimum: 1, maximum: 8 },
    sizeMax: { type: 'integer', minimum: 1, maximum: 8 },
    briefs: {
      ...list(obj({ id, title: str(LIMITS.short), brief: str(LIMITS.long) }), LIMITS.briefs),
      description: 'optional different assignments per group; empty when every group has the same brief',
    },
  }),
  phases: list(obj({
    id,
    title: str(LIMITS.short),
    goal: str(LIMITS.text),
    lessons: { type: 'number', minimum: 0.5, maximum: LIMITS.lessons[1], description: 'time in lessons (0.5 steps)' },
    steps: { ...list(str(LIMITS.text), LIMITS.steps), description: 'the teacher’s run sheet for this phase' },
    milestone: obj({
      title: str(LIMITS.short),
      deliverable: str(LIMITS.text),
      handIn: { type: 'string', enum: HAND_IN },
    }),
  }), LIMITS.phases),
  roles: list(obj({
    id,
    name: str(LIMITS.name),
    responsibility: str(LIMITS.text),
    optional: { type: 'boolean', description: 'true: only in groups larger than the number of required roles' },
  }), LIMITS.roles),
  tasks: list(obj({
    id,
    phaseId: id,
    title: str(LIMITS.title),
    detail: str(LIMITS.text),
    roleId: { ...id, nullable: true, description: 'the role that usually takes it, or null' },
  }, ['id', 'phaseId', 'title', 'detail', 'roleId']), [2, LIMITS.phases[1] * LIMITS.tasksPerPhase[1]]),
  assessment: obj({
    criteria: list(obj({
      id,
      name: str(LIMITS.short),
      subject: { ...str(LIMITS.name), description: 'a subject name from basics.subjects, or "all"' },
      weight: { type: 'integer', minimum: 1, maximum: 3 },
      peer: { type: 'boolean', description: 'true: other groups score it in the gallery round' },
      levels: list(obj({ score: { type: 'integer', minimum: 1, maximum: 4 }, descriptor: str(LIMITS.text) }), [4, 4]),
    }), LIMITS.criteria),
    selfQuestions: list(question, LIMITS.questions),
    contributionQuestions: list(question, LIMITS.questions),
  }),
  handouts: list(obj({
    id,
    title: str(LIMITS.short),
    for: { type: 'string', enum: HANDOUT_FOR },
    body: { ...str(LIMITS.handout), description: 'Markdown: headings, lists, bold; no images, no links' },
  }), LIMITS.handouts),
  teacherNotes: obj({
    preparation: str(LIMITS.notes),
    variations: list(str(LIMITS.text), LIMITS.variations),
  }),
});

// ---- shape check: the JSON Schema subset above ----------------------------------------------------

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);

/** Checks value against schema; returns a list of { path, message }. Unknown keys are errors too. */
export function validate(schema, value, path = '', errors = []) {
  const err = (message) => errors.push({ path: path || '(root)', message });
  if (value === null || value === undefined) {
    if (value === null && schema.nullable) return errors;
    err('missing');
    return errors;
  }
  const t = typeOf(value);
  const want = schema.type;
  const typeOk = t === want || (want === 'number' && t === 'integer');
  if (!typeOk) { err(`expected ${want}, got ${t}`); return errors; }
  if (want === 'string') {
    if (!value.trim()) err('empty');
    if (schema.maxLength && value.length > schema.maxLength) err(`longer than ${schema.maxLength} characters`);
    if (schema.enum && !schema.enum.includes(value)) err(`not one of ${schema.enum.join(', ')}`);
  }
  if (want === 'integer' || want === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) err(`below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) err(`above ${schema.maximum}`);
  }
  if (want === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) err(`fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) err(`more than ${schema.maxItems} items`);
    value.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`, errors));
  }
  if (want === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push({ path: path ? `${path}.${key}` : key, message: 'missing' });
    }
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties[key];
      const p = path ? `${path}.${key}` : key;
      if (!sub) { errors.push({ path: p, message: 'unknown field' }); continue; }
      if (v === undefined) continue;
      validate(sub, v, p, errors);
    }
  }
  return errors;
}

// ---- meaning check: ids, references, totals -------------------------------------------------------

const ID = /^[a-z0-9][a-z0-9-]{0,23}$/;

function uniqueIds(items, path, errors) {
  const seen = new Set();
  items.forEach((item, i) => {
    if (!ID.test(item.id)) errors.push({ path: `${path}[${i}].id`, message: 'not a short lowercase id' });
    if (seen.has(item.id)) errors.push({ path: `${path}[${i}].id`, message: `duplicate id "${item.id}"` });
    seen.add(item.id);
  });
  return seen;
}

/** References and totals the schema cannot express. Run only on a skeleton whose shape is valid. */
export function checkSkeleton(sk) {
  const errors = [];
  const b = sk.basics;
  if (b.level.ageMin > b.level.ageMax) errors.push({ path: 'basics.level', message: 'ageMin is above ageMax' });
  const [wMin, wMax] = LIMITS.weeks;
  if (b.duration.unit === 'weeks' && (b.duration.amount < wMin || b.duration.amount > wMax)) {
    errors.push({ path: 'basics.duration.amount', message: `weeks must be ${wMin}-${wMax}` });
  }
  if (sk.groups.sizeMin > sk.groups.sizeMax) errors.push({ path: 'groups', message: 'sizeMin is above sizeMax' });

  uniqueIds(sk.groups.briefs, 'groups.briefs', errors);
  const phaseIds = uniqueIds(sk.phases, 'phases', errors);
  const roleIds = uniqueIds(sk.roles, 'roles', errors);
  uniqueIds(sk.tasks, 'tasks', errors);
  uniqueIds(sk.assessment.criteria, 'assessment.criteria', errors);
  uniqueIds(sk.assessment.selfQuestions, 'assessment.selfQuestions', errors);
  uniqueIds(sk.assessment.contributionQuestions, 'assessment.contributionQuestions', errors);
  uniqueIds(sk.handouts, 'handouts', errors);

  // Lessons: the phases must add up to the duration when it is given in lessons (half a lesson slack).
  if (b.duration.unit === 'lessons') {
    const total = sk.phases.reduce((s, p) => s + p.lessons, 0);
    if (Math.abs(total - b.duration.amount) > 0.5) {
      errors.push({ path: 'phases', message: `phases add up to ${total} lessons, the duration is ${b.duration.amount}` });
    }
  }
  sk.phases.forEach((p, i) => {
    if ((p.lessons * 2) % 1 !== 0) errors.push({ path: `phases[${i}].lessons`, message: 'use half-lesson steps' });
  });
  if (!sk.phases.some((p) => p.milestone.handIn === 'link')) {
    errors.push({ path: 'phases', message: 'at least one milestone must be a link hand-in' });
  }

  // Tasks: known phase and role, every phase has 1-10 tasks.
  const perPhase = new Map([...phaseIds].map((pid) => [pid, 0]));
  sk.tasks.forEach((t, i) => {
    if (!phaseIds.has(t.phaseId)) errors.push({ path: `tasks[${i}].phaseId`, message: `unknown phase "${t.phaseId}"` });
    else perPhase.set(t.phaseId, perPhase.get(t.phaseId) + 1);
    if (t.roleId !== null && !roleIds.has(t.roleId)) errors.push({ path: `tasks[${i}].roleId`, message: `unknown role "${t.roleId}"` });
  });
  const [tMin, tMax] = LIMITS.tasksPerPhase;
  for (const [pid, n] of perPhase) {
    if (n < tMin || n > tMax) errors.push({ path: 'tasks', message: `phase "${pid}" has ${n} tasks (${tMin}-${tMax})` });
  }

  // Roles: the required ones must fit the smallest group.
  const required = sk.roles.filter((r) => !r.optional).length;
  if (required > sk.groups.sizeMin) {
    errors.push({ path: 'roles', message: `${required} required roles do not fit a group of ${sk.groups.sizeMin}` });
  }

  // Assessment: each criterion's subject is a project subject or "all"; levels are 1-4 once each;
  // at least one criterion is scored by peers.
  const subjects = new Set(b.subjects.map((s) => s.name));
  sk.assessment.criteria.forEach((c, i) => {
    if (c.subject !== 'all' && !subjects.has(c.subject)) {
      errors.push({ path: `assessment.criteria[${i}].subject`, message: `"${c.subject}" is not a project subject` });
    }
    const scores = c.levels.map((l) => l.score).sort().join(',');
    if (scores !== '1,2,3,4') errors.push({ path: `assessment.criteria[${i}].levels`, message: 'needs scores 1, 2, 3, 4 once each' });
  });
  if (!sk.assessment.criteria.some((c) => c.peer)) {
    errors.push({ path: 'assessment.criteria', message: 'at least one criterion must be scored by peers' });
  }
  return errors;
}

/** Shape first, then meaning. Returns { ok, errors: [{ path, message }] }. */
export function validateSkeleton(sk) {
  const errors = validate(SKELETON_SCHEMA, sk);
  if (!errors.length) errors.push(...checkSkeleton(sk));
  return { ok: errors.length === 0, errors };
}
