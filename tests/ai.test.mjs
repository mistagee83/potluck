import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../engines/ai.js';
import { validate, validateSkeleton } from '../engines/skeleton.js';
import { TEMPLATES } from '../engines/templates/index.js';

const sk = () => structuredClone(TEMPLATES[0].skeleton);
const INPUTS = {
  subjects: ['Foreign language'], groupCount: 5, sizeMin: 3, sizeMax: 4, unit: 'lessons', amount: 4, lessonMinutes: 45,
  ageMin: 14, ageMax: 17, cefr: 'B1', language: 'en', context: 'A small town school.',
};

test('inputs: valid, and every wrong field reported', () => {
  assert.ok(A.checkInputs(INPUTS).ok);
  const bad = A.checkInputs({ ...INPUTS, subjects: [], groupCount: 20, sizeMin: 5, sizeMax: 3, unit: 'days', ageMin: 18, ageMax: 12, cefr: 'D1', language: 'xx', context: 'x'.repeat(401) });
  const fields = bad.errors.map((e) => e.field);
  for (const f of ['subjects', 'groupCount', 'groupSize', 'unit', 'ages', 'cefr', 'language', 'context']) assert.ok(fields.includes(f), f);
  assert.ok(A.checkInputs({ ...INPUTS, unit: 'weeks', amount: 13 }).errors.some((e) => e.field === 'amount'));
  assert.ok(A.checkInputs({ ...INPUTS, cefr: '' }).ok);
});

test('idea form: required fields and product type', () => {
  const idea = { ...INPUTS, productType: 'podcast', challenge: 'How do we make our town greener?', product: 'A 5-minute podcast episode', audience: 'The town council' };
  assert.ok(A.checkIdea(idea).ok);
  const bad = A.checkIdea({ ...INPUTS, productType: 'novel', challenge: '' });
  assert.deepEqual(bad.errors.map((e) => e.field).sort(), ['audience', 'challenge', 'product', 'productType']);
});

test('price keys per step', () => {
  assert.equal(A.actionFor('idea'), 'from-idea');
  assert.equal(A.actionFor('plan'), 'setup-step');
  assert.equal(A.actionFor('handouts'), 'handouts');
  assert.equal(A.actionFor('tasks', { regenerate: true }), 'regenerate');
});

test('every step part of the template fits its part schema', () => {
  for (const step of Object.keys(A.PART_SCHEMAS)) {
    assert.deepEqual(validate(A.PART_SCHEMAS[step], A.partOf(sk(), step)), [], step);
  }
});

test('merging a part keeps the teacher numbers', () => {
  const part = A.partOf(sk(), 'plan');
  part.subjects = [{ name: 'Foreign language', contribution: 'Writing for real readers.' }];
  const out = A.mergePart(sk(), 'plan', part, { ...INPUTS, ageMin: 15, sizeMax: 4 });
  assert.equal(out.basics.level.ageMin, 15);
  assert.equal(out.basics.subjects[0].contribution, 'Writing for real readers.');
  assert.equal(out.basics.duration.amount, 4);
  // a subject the model invented is dropped, the teacher's list wins
  const extra = A.mergePart(sk(), 'plan', { ...part, subjects: [...part.subjects, { name: 'Maths', contribution: 'x' }] }, INPUTS);
  assert.deepEqual(extra.basics.subjects.map((s) => s.name), ['Foreign language']);
});

test('checkStep: the template is clean after every step', () => {
  for (const step of A.TAILOR_STEPS) {
    const r = A.checkStep(A.mergePart(sk(), step, A.partOf(sk(), step), INPUTS), step, A.TAILOR_STEPS);
    assert.deepEqual(r, { errors: [], stale: [] }, step);
  }
});

test('checkStep: new phase ids make the tasks stale, not the plan wrong', () => {
  const part = A.partOf(sk(), 'plan');
  part.phases = part.phases.map((p) => ({ ...p, id: `new-${p.id}` }));
  const r = A.checkStep(A.mergePart(sk(), 'plan', part, INPUTS), 'plan', A.TAILOR_STEPS);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.stale, ['tasks']);
});

test('checkStep: own errors block the step', () => {
  const part = A.partOf(sk(), 'plan');
  part.phases[0].lessons = 3; // the lessons no longer add up to the teacher's 4
  const r = A.checkStep(A.mergePart(sk(), 'plan', part, INPUTS), 'plan', A.TAILOR_STEPS);
  assert.ok(r.errors.some((e) => e.path === 'phases'));
  const t = A.partOf(sk(), 'tasks');
  t.tasks[0].roleId = 'boss';
  assert.ok(A.checkStep(A.mergePart(sk(), 'tasks', t, INPUTS), 'tasks', A.TAILOR_STEPS).errors.length);
});

test('step 0 on a blank skeleton: basics, phases, roles must be right; later parts may be empty', () => {
  const idea = { ...INPUTS, productType: 'magazine', challenge: 'What does a new student need?', product: 'A guide', audience: 'Exchange students' };
  const blank = A.blankSkeleton(INPUTS, idea);
  const ok = A.checkStep(A.mergePart(blank, 'idea', A.partOf(sk(), 'idea'), INPUTS), 'idea', []);
  assert.deepEqual(ok.errors, []);
  const part = A.partOf(sk(), 'idea');
  part.roles = part.roles.slice(0, 1);
  assert.ok(A.checkStep(A.mergePart(blank, 'idea', part, INPUTS), 'idea', []).errors.some((e) => e.path.startsWith('roles')));
});

test('launch problems are grouped by step', () => {
  assert.deepEqual(A.launchProblems(sk()), {});
  const s = sk(); s.tasks = [];
  assert.ok(A.launchProblems(s).tasks.length);
  assert.ok(validateSkeleton(sk()).ok);
});

test('feedback: one paragraph per member', () => {
  const fb = { group: 'Good work.', members: [{ sid: 'a', text: 'Clear writing.' }, { sid: 'b', text: 'Great photos.' }] };
  assert.deepEqual(A.checkFeedback(fb, ['a', 'b']), []);
  assert.equal(A.checkFeedback(fb, ['a', 'b', 'c'])[0].path, 'members');
  assert.equal(A.checkFeedback({ group: '', members: [] }, ['a']).length > 0, true);
});

test('model schema: nullable becomes a type list', () => {
  const m = A.toModelSchema(A.PART_SCHEMAS.tasks);
  assert.deepEqual(m.properties.tasks.items.properties.roleId.type, ['string', 'null']);
  assert.ok(!JSON.stringify(m).includes('nullable'));
  assert.ok(!/maxLength|maxItems|minimum/.test(JSON.stringify(m)));
  assert.match(m.properties.tasks.items.properties.title.description ?? '', /at most 80 characters/);
});
