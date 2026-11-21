import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTemplate, slugify } from '../engines/template-io.js';
import { TEMPLATES } from '../engines/templates/index.js';
import { validateSkeleton } from '../engines/skeleton.js';
import { tasksForGroup, linkMilestones, productPhase } from '../engines/project.js';

test('the three launch templates are valid and distinct', () => {
  assert.deepEqual(TEMPLATES.map((t) => t.slug), ['anti-guidebook', 'five-star-disaster', 'city-budget-2050']);
  for (const t of TEMPLATES) {
    assert.ok(validateSkeleton(t.skeleton).ok, t.slug);
    assert.ok(linkMilestones(t.skeleton).length >= 1, t.slug);
    assert.ok(productPhase(t.skeleton), t.slug);
    assert.ok(tasksForGroup(t.skeleton, 'g1').length >= t.skeleton.phases.length, t.slug);
  }
});

test('sizes: short, medium, several weeks', () => {
  const d = Object.fromEntries(TEMPLATES.map((t) => [t.slug, t.skeleton.basics.duration]));
  assert.deepEqual(d['five-star-disaster'], { unit: 'lessons', amount: 2, lessonMinutes: 45 });
  assert.deepEqual(d['anti-guidebook'], { unit: 'lessons', amount: 4, lessonMinutes: 45 });
  assert.deepEqual(d['city-budget-2050'], { unit: 'weeks', amount: 3, lessonMinutes: 45 });
  const lessons = TEMPLATES[2].skeleton.phases.reduce((s, p) => s + p.lessons, 0);
  assert.equal(lessons, 6); // decided 2026-11-21: 3 weeks, 6 lessons
});

test('readTemplate: wrapped, bare, slug from the title, meta cleaned', () => {
  const t = TEMPLATES[1];
  const wrapped = readTemplate({ slug: t.slug, meta: { tags: ['a', 3], durationHint: 'x'.repeat(60) }, skeleton: t.skeleton });
  assert.ok(wrapped.ok);
  assert.deepEqual(wrapped.value.meta.tags, ['a']);
  assert.equal(wrapped.value.meta.durationHint.length, 40);
  const bare = readTemplate(JSON.stringify(t.skeleton));
  assert.ok(bare.ok);
  assert.equal(bare.value.slug, '5-star-disaster');
  assert.equal(slugify('Ünnepi  Kártyák!'), 'unnepi-kartyak');
});

test('readTemplate: errors for a broken skeleton and a bad slug', () => {
  const sk = structuredClone(TEMPLATES[0].skeleton);
  sk.tasks = [];
  const r = readTemplate({ slug: 'Bad Slug', skeleton: sk });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'slug'));
  assert.ok(r.errors.some((e) => e.path === 'tasks'));
  assert.equal(readTemplate({ hello: 1 }).ok, false);
});
