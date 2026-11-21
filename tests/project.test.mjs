import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../engines/project.js';
import { TEMPLATES } from '../engines/templates/index.js';

const sk = TEMPLATES[0].skeleton;

test('join codes use the unambiguous alphabet', () => {
  let i = 0;
  const code = P.makeCode((n) => (i++ * 7) % n);
  assert.match(code, P.CODE_RE);
  assert.ok(!/[01OIL]/.test(P.CODE_ALPHABET));
  assert.equal(P.normalizeCode(' ab-c d2 '), 'ABCD2');
});

test('nicknames: clean, key, errors', () => {
  assert.equal(P.cleanNickname('  Anna   Kis '), 'Anna Kis');
  assert.equal(P.nicknameKey('Ánna'), P.nicknameKey('anna'));
  assert.equal(P.nicknameError('A'), 'nickname-length');
  assert.equal(P.nicknameError('x'.repeat(21)), 'nickname-length');
  assert.equal(P.nicknameError('<b>hi</b>'), 'nickname-chars');
  assert.equal(P.nicknameError('Pisti_2'), null);
  assert.equal(P.nicknameError('Zoë-K.'), null);
});

test('links: https added, other schemes and junk refused', () => {
  assert.equal(P.cleanLink('canva.com/design/abc'), 'https://canva.com/design/abc');
  assert.equal(P.cleanLink('http://example.org/x'), 'http://example.org/x');
  assert.equal(P.cleanLink('javascript:alert(1)'), null);
  assert.equal(P.cleanLink('ftp://example.org'), null);
  assert.equal(P.cleanLink('not a link'), null);
  assert.equal(P.cleanLink('hello'), null);
  assert.equal(P.cleanLink(''), null);
});

test('board tasks come from the skeleton, per group, stable ids', () => {
  const tasks = P.tasksForGroup(sk, 'g1');
  assert.equal(tasks.length, sk.tasks.length);
  assert.ok(tasks.every((t) => t.id.startsWith('g1-') && t.status === 'todo' && t.ownerSid === null));
  const orders = tasks.map((t) => t.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test('product phase is the last link milestone', () => {
  assert.equal(P.productPhase(sk).id, 'build');
  assert.equal(P.linkMilestones(sk).length, 4);
});

test('milestone status', () => {
  const link = sk.phases[0]; const none = sk.phases.at(-1);
  assert.equal(P.milestoneStatus(none, null, '2026-11-01', '2026-11-20'), 'class');
  assert.equal(P.milestoneStatus(link, { link: 'https://x.io' }, '2026-11-01', '2026-11-20'), 'done');
  assert.equal(P.milestoneStatus(link, null, '2026-11-19', '2026-11-20'), 'late');
  assert.equal(P.milestoneStatus(link, null, '2026-11-20', '2026-11-20'), 'due');
  assert.equal(P.milestoneStatus(link, null, '2026-11-21', '2026-11-20'), 'open');
  assert.equal(P.milestoneStatus(link, null, null, '2026-11-20'), 'open');
  assert.equal(P.isoDay(Date.UTC(2026, 10, 20, 23, 30), 'Europe/Budapest'), '2026-11-21');
});

test('flags: late and stuck', () => {
  const now = Date.UTC(2026, 10, 20);
  assert.deepEqual(P.groupFlags({ statuses: ['done', 'late'], lastActivity: now, now }), ['late']);
  assert.deepEqual(P.groupFlags({ statuses: ['open'], lastActivity: now - 4 * P.DAY, now }), ['stuck']);
  assert.deepEqual(P.groupFlags({ statuses: ['open'], lastActivity: null, now }), []);
});

test('criteria per teacher: co-teacher their subject, lead the rest', () => {
  const lead = P.criteriaFor(sk, { lead: true, coSubjects: ['Foreign language'] }).map((c) => c.id);
  const co = P.criteriaFor(sk, { lead: false, subject: 'Foreign language' }).map((c) => c.id);
  assert.deepEqual(lead, ['useful', 'design']);
  assert.deepEqual(co, ['natural', 'accuracy', 'presentation']);
  assert.equal(P.criteriaFor(sk, { lead: true }).length, sk.assessment.criteria.length);
});

test('summary: teacher means, weighted percent, peers, contribution, self', () => {
  const groups = [{ id: 'g1', name: 'Team 1' }, { id: 'g2', name: 'Team 2' }];
  const students = [{ id: 's1', nickname: 'Anna', groupId: 'g1' }, { id: 's2', nickname: 'Bea', groupId: 'g1' }, { id: 's3', nickname: 'Cili', groupId: 'g2' }];
  const all4 = Object.fromEntries(sk.assessment.criteria.map((c) => [c.id, 4]));
  const assessments = [
    { kind: 'teacher', rater: 't1', groupId: 'g1', scores: all4, comment: 'Great tips.' },
    { kind: 'teacher', rater: 't2', groupId: 'g1', scores: { natural: 2 } },
    { kind: 'peer', rater: 's3', groupId: 'g1', scores: { useful: 3, design: 4, presentation: 2 } },
    { kind: 'contribution', rater: 's2', rated: 's1', answers: { 'did-share': 4, helped: 3 } },
    { kind: 'self', rater: 's1', answers: { proud: 'The map', learned: 'no cap', effort: 4 } },
  ];
  const sum = P.summarize({ skeleton: sk, groups, students, assessments });
  const g1 = sum.groups[0];
  assert.equal(g1.teacher.natural, 3); // mean of 4 and 2
  assert.equal(g1.teacher.useful, 4);
  // weights: useful 2, natural 2, accuracy 1, design 1, presentation 1 → (8+6+4+4+4)/(28) = 26/28
  assert.equal(g1.teacherPercent, Math.round((26 / 28) * 100));
  assert.deepEqual(g1.peer, { useful: 3, design: 4, presentation: 2 });
  assert.equal(sum.groups[1].teacherPercent, null);
  const anna = sum.students[0];
  assert.equal(anna.contribution, 3.5);
  assert.equal(anna.contributionCount, 1);
  assert.equal(anna.selfDone, true);
  assert.equal(sum.students[1].selfDone, false);

  const csv = P.summaryCsv(sk, sum);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 4);
  assert.ok(lines[1].startsWith('Anna,Team 1,93,'));
});

test('CSV quoting and formula guard', () => {
  assert.equal(P.toCsv([['a,b', 'say "hi"', '=SUM(A1)', null]]), '"a,b","say ""hi""",\'=SUM(A1),\r\n');
});
