// The model layer: one JSON-schema-bound Gemini call (Interactions API, the QotD/Hubbaloo call shape),
// prompts from versioned files, and a mock for the emulator.
// Model: gemini-3.8-flash, set by András for every Hub project. If it is unavailable, the call fails with
// ModelUnavailableError and nothing is substituted.
import { readFileSync } from 'node:fs';
import { toModelSchema, partOf, mergePart } from './engines/ai.js';
import { TEMPLATES } from './engines/templates/index.js';

export const MODEL = 'gemini-3.8-flash';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/** Mock: in the emulator by default (no cost), PL_MOCK_MODEL=true|false overrides. */
export function isMock() {
  const flag = process.env.PL_MOCK_MODEL;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.FUNCTIONS_EMULATOR === 'true';
}

export class ModelUnavailableError extends Error {}
export class ModelError extends Error {}

// ---- prompts: functions/prompts/<id>.md; first line "version: <n>", then the template ----------------------
const cache = new Map();
export function prompt(id) {
  if (!cache.has(id)) {
    const raw = readFileSync(new URL(`./prompts/${id}.md`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const m = raw.match(/^version: (\S+)\n/);
    cache.set(id, { version: m ? m[1] : '0', template: m ? raw.slice(m[0].length) : raw });
  }
  return cache.get(id);
}
export const render = (template, vars) => template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));

// ---- the call --------------------------------------------------------------------------------------------
/**
 * One call: system + user text, answer bound to `schema` (our schema, converted for the API).
 * Returns { data, usage }. Throws ModelUnavailableError for a missing model, ModelError otherwise.
 */
export async function generateJson({ system, text, schema, thinking = 'low', mock }) {
  if (isMock()) return { data: await mock(), usage: { mock: true } };
  const key = process.env.PL_GEMINI_API_KEY;
  if (!key) throw new ModelError('PL_GEMINI_API_KEY is missing');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      system_instruction: system,
      input: [{ type: 'text', text }],
      generation_config: { thinking_level: thinking },
      response_format: { type: 'text', mime_type: 'application/json', schema: toModelSchema(schema) },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = JSON.stringify(json).slice(0, 400);
    if (res.status === 404 || /model.*(not found|not supported|unknown)/i.test(msg)) throw new ModelUnavailableError(`${MODEL}: ${msg}`);
    throw new ModelError(`Gemini HTTP ${res.status}: ${msg}`);
  }
  const out = (json.steps || []).filter((s) => s.type === 'model_output').flatMap((s) => s.content || [])
    .filter((c) => c.type === 'text').map((c) => c.text).join('');
  try {
    return { data: JSON.parse(out), usage: json.usage ?? null };
  } catch {
    throw new ModelError('the answer is not JSON');
  }
}

// ---- mock answers (emulator): valid parts built from the current skeleton or the anti-guidebook ------------

/** Lessons spread over the phases in half-lesson steps so they add up to the teacher's amount. */
function spread(phases, amount) {
  const n = phases.length;
  const each = Math.max(0.5, Math.floor((amount / n) * 2) / 2);
  const out = phases.map((p) => ({ ...p, lessons: each }));
  out[n - 1].lessons = Math.max(0.5, amount - each * (n - 1));
  return out;
}

export function mockPart(step, sk, inputs) {
  const tpl = TEMPLATES[0].skeleton;
  const base = sk.phases.length ? sk : mergePart(sk, 'idea', partOf(tpl, 'idea'), inputs);
  const part = structuredClone(partOf(base.tasks.length || step === 'idea' || step === 'plan' || step === 'groups' ? base : tpl, step));
  if (step === 'tasks' && !base.tasks.length) part.tasks = structuredClone(tpl.tasks);
  if (step === 'assessment' && !base.assessment.criteria.length) part.assessment = structuredClone(tpl.assessment);
  if (step === 'handouts' && !base.handouts.length) Object.assign(part, structuredClone(partOf(tpl, 'handouts')));
  if ((step === 'plan' || step === 'idea') && inputs?.unit === 'lessons') part.phases = spread(part.phases, inputs.amount);
  if (step === 'idea' || step === 'plan') part.subjects = (inputs?.subjects ?? []).map((name) => ({ name, contribution: `Mock: what ${name} brings.` }));
  if (step === 'idea') { part.basics.subjects = part.subjects; delete part.subjects; part.basics.title = 'Mock project from an idea'; }
  if (step === 'assessment') {
    const subjects = inputs?.subjects ?? sk.basics.subjects.map((s) => s.name);
    part.assessment.criteria = part.assessment.criteria.map((c) => (c.subject === 'all' || subjects.includes(c.subject) ? c : { ...c, subject: subjects[0] }));
  }
  if (step === 'tasks') {
    const phaseIds = base.phases.map((p) => p.id);
    const roleIds = new Set(base.roles.map((r) => r.id));
    part.tasks = phaseIds.flatMap((pid, i) => [0, 1].map((k) => ({
      id: `${pid}-t${k + 1}`, phaseId: pid, title: `Mock task ${k + 1} of phase ${i + 1}`, detail: 'Mock detail.',
      roleId: k === 0 && roleIds.size ? [...roleIds][0] : null,
    })));
  }
  return part;
}

export const mockFeedback = (members) => ({
  group: 'Mock feedback: your guide is useful and honest. Next time, check the language before you build the product.',
  members: members.map((m) => ({ sid: m.id, text: `Mock: ${m.nickname} did their share and helped the team.` })),
});
