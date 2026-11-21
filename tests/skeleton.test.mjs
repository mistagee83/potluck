import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSkeleton, validate, SKELETON_SCHEMA } from '../engines/skeleton.js';
import { TEMPLATES } from '../engines/templates/index.js';

const clone = (x) => structuredClone(x);
const base = () => clone(TEMPLATES[0].skeleton);
const paths = (sk) => validateSkeleton(sk).errors.map((e) => `${e.path}: ${e.message}`);

test('every built-in template is a valid skeleton', () => {
  for (const t of TEMPLATES) {
    const { ok, errors } = validateSkeleton(t.skeleton);
    assert.ok(ok, `${t.slug}: ${JSON.stringify(errors, null, 2)}`);
  }
});

test('template slugs are unique', () => {
  const slugs = TEMPLATES.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('shape: missing, unknown, too long, wrong enum, wrong type', () => {
  const sk = base();
  delete sk.basics.audience;
  sk.basics.extra = 'x';
  sk.basics.title = 'x'.repeat(81);
  sk.basics.product.type = 'novel';
  sk.groups.sizeMin = '3';
  const errs = paths(sk);
  assert.ok(errs.includes('basics.audience: missing'));
  assert.ok(errs.includes('basics.extra: unknown field'));
  assert.ok(errs.some((e) => e.startsWith('basics.title: longer than 80')));
  assert.ok(errs.some((e) => e.startsWith('basics.product.type: not one of')));
  assert.ok(errs.includes('groups.sizeMin: expected integer, got string'));
});

test('shape: empty strings and list sizes', () => {
  const sk = base();
  sk.basics.brief = '   ';
  sk.phases = sk.phases.slice(0, 1);
  const errs = paths(sk);
  assert.ok(errs.includes('basics.brief: empty'));
  assert.ok(errs.includes('phases: fewer than 2 items'));
});

test('nullable fields accept null, others do not', () => {
  const sk = base();
  sk.basics.level.cefr = null;
  assert.ok(validateSkeleton(sk).ok);
  sk.basics.audience = null;
  assert.ok(paths(sk).includes('basics.audience: missing'));
});

test('meaning: unknown phase and role, duplicate ids', () => {
  const sk = base();
  sk.tasks[0].phaseId = 'nowhere';
  sk.tasks[1].roleId = 'boss';
  sk.roles[1].id = sk.roles[0].id;
  const errs = paths(sk);
  assert.ok(errs.includes('tasks[0].phaseId: unknown phase "nowhere"'));
  assert.ok(errs.includes('tasks[1].roleId: unknown role "boss"'));
  assert.ok(errs.some((e) => e.startsWith('roles[1].id: duplicate id')));
});

test('meaning: lessons must add up to the duration', () => {
  const sk = base();
  sk.phases[0].lessons = 3;
  assert.ok(paths(sk).some((e) => e.startsWith('phases: phases add up to')));
});

test('meaning: a phase without tasks', () => {
  const sk = base();
  sk.tasks = sk.tasks.filter((t) => t.phaseId !== 'build');
  assert.ok(paths(sk).includes('tasks: phase "build" has 0 tasks (1-10)'));
});

test('meaning: required roles must fit the smallest group', () => {
  const sk = base();
  sk.groups.sizeMin = 2;
  assert.ok(paths(sk).includes('roles: 3 required roles do not fit a group of 2'));
});

test('meaning: criteria subjects, score levels, peer criterion, a link hand-in', () => {
  const sk = base();
  sk.assessment.criteria[1].subject = 'Maths';
  sk.assessment.criteria[0].levels[3].score = 3;
  sk.assessment.criteria.forEach((c) => { c.peer = false; });
  sk.phases.forEach((p) => { p.milestone.handIn = 'none'; });
  const errs = paths(sk);
  assert.ok(errs.includes('assessment.criteria[1].subject: "Maths" is not a project subject'));
  assert.ok(errs.includes('assessment.criteria[0].levels: needs scores 1, 2, 3, 4 once each'));
  assert.ok(errs.includes('assessment.criteria: at least one criterion must be scored by peers'));
  assert.ok(errs.includes('phases: at least one milestone must be a link hand-in'));
});

test('meaning: ages and weeks', () => {
  const sk = base();
  sk.basics.level.ageMin = 18; sk.basics.level.ageMax = 14;
  assert.ok(paths(sk).includes('basics.level: ageMin is above ageMax'));
  const wk = base();
  wk.basics.duration = { unit: 'weeks', amount: 20, lessonMinutes: 45 };
  assert.ok(paths(wk).includes('basics.duration.amount: weeks must be 1-12'));
});

test('the schema only uses keywords the model API accepts', () => {
  const allowed = new Set(['type', 'properties', 'required', 'items', 'enum', 'minItems', 'maxItems', 'minimum', 'maximum', 'maxLength', 'nullable', 'description']);
  const walk = (s, p) => {
    for (const k of Object.keys(s)) assert.ok(allowed.has(k), `${p}: ${k}`);
    if (s.properties) for (const [k, v] of Object.entries(s.properties)) walk(v, `${p}.${k}`);
    if (s.items) walk(s.items, `${p}[]`);
  };
  walk(SKELETON_SCHEMA, '(root)');
  assert.deepEqual(validate({ type: 'string', maxLength: 3 }, 'abcd'), [{ path: '(root)', message: 'longer than 3 characters' }]);
});
