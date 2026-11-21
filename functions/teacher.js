// Teacher callables: create and set up a project, launch it, manage groups, students and join requests,
// feedback, assessment, closing, co-teachers, the exhibition page and the export.
import { FieldValue } from 'firebase-admin/firestore';
import {
  callable, fail, fs, teacher, teacherProject, needStatus, hubPass, projectRef, secretRef, sha256, token, rand,
  now, Timestamp,
} from './common.js';
import { templateFor } from './templates.js';
import { validateSkeleton } from './engines/skeleton.js';
import { TAILOR_STEPS, launchProblems } from './engines/ai.js';
import { inputsFromSkeleton } from './ai.js';
import {
  STATUS, GROUP_MODES, LIMITS, DAY, RETENTION_DAYS, EXHIBITION_DAYS, DATE_RE, makeCode, cleanText,
  defaultGroupNames, tasksForGroup, linkMilestones, criteriaFor, summarize, summaryCsv,
} from './engines/project.js';

const str = (v, max, reason = 'bad-request') => {
  const t = cleanText(v, max);
  if (t === null) fail('invalid-argument', reason);
  return t;
};
const subjectsOf = (p) => p.skeleton.basics.subjects.map((s) => s.name);

// ---- create and set up ------------------------------------------------------------------------------

/** New project from a built-in template. Without a Hub pass only one project may be active. */
export const plCreateProject = callable(async (req) => {
  const me = teacher(req);
  const tpl = await templateFor(me.uid, req.data?.templateId);
  const { ok } = validateSkeleton(tpl.skeleton);
  if (!ok) fail('internal', 'bad-template');
  if (!(await hubPass(me.uid))) {
    const mine = await fs().collection('plProjects').where('owner', '==', me.uid).select('status').get();
    if (mine.docs.some((d) => d.data().status !== STATUS.closed)) fail('failed-precondition', 'one-active');
  }
  const ref = fs().collection('plProjects').doc();
  const t = now();
  await ref.set({
    owner: me.uid,
    ownerName: me.name,
    members: [me.uid],
    coTeachers: [],
    coTeacherInfo: {},
    leadSubject: tpl.skeleton.basics.subjects[0].name,
    title: tpl.skeleton.basics.title,
    templateSlug: tpl.slug || null,
    templateId: tpl.id,
    source: 'template',
    tailor: { inputs: inputsFromSkeleton(tpl.skeleton, 4), done: TAILOR_STEPS, stale: [], proposal: null },
    skeleton: tpl.skeleton,
    status: STATUS.setup,
    groupMode: 'teacher',
    groupNames: defaultGroupNames(4),
    due: {},
    timeZone: typeof req.data?.timeZone === 'string' ? req.data.timeZone.slice(0, 60) : 'UTC',
    code: null,
    lastActivity: {},
    exhibitionUntil: null,
    createdAt: t,
    updatedAt: t,
  });
  return { projectId: ref.id };
});

/** Setup fields; groups only before launch, due dates and title until closing. */
export const plUpdateProject = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.setup, STATUS.running, STATUS.assessing);
  const d = req.data;
  const patch = { updatedAt: now() };
  if (d.title !== undefined) {
    const title = str(d.title, LIMITS.projectTitle);
    if (!title) fail('invalid-argument', 'title-empty');
    patch.title = title;
  }
  if (d.timeZone !== undefined && typeof d.timeZone === 'string') patch.timeZone = d.timeZone.slice(0, 60);
  if (d.due !== undefined) {
    const due = { ...p.due };
    const ids = new Set(p.skeleton.phases.map((x) => x.id));
    for (const [phaseId, date] of Object.entries(d.due ?? {})) {
      if (!ids.has(phaseId)) fail('invalid-argument', 'bad-phase');
      if (date !== null && !DATE_RE.test(String(date))) fail('invalid-argument', 'bad-date');
      due[phaseId] = date;
    }
    patch.due = due;
  }
  if (d.leadSubject !== undefined || d.groupMode !== undefined || d.groupNames !== undefined) {
    needStatus(p, STATUS.setup);
    if (d.leadSubject !== undefined) {
      if (!subjectsOf(p).includes(d.leadSubject)) fail('invalid-argument', 'bad-subject');
      patch.leadSubject = d.leadSubject;
    }
    if (d.groupMode !== undefined) {
      if (!GROUP_MODES.includes(d.groupMode)) fail('invalid-argument', 'bad-mode');
      patch.groupMode = d.groupMode;
    }
    if (d.groupNames !== undefined) {
      const names = Array.isArray(d.groupNames) ? d.groupNames.map((n) => str(n, LIMITS.groupName)) : null;
      const [min, max] = LIMITS.groups;
      if (!names || names.length < min || names.length > max || names.some((n) => !n)) fail('invalid-argument', 'bad-groups');
      patch.groupNames = names;
    }
  }
  await ref.update(patch);
  return { ok: true };
});

async function uniqueCode(pid) {
  for (let i = 0; i < 20; i += 1) {
    const code = makeCode(rand);
    const ref = fs().doc(`plCodes/${code}`);
    const ok = await fs().runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return false;
      tx.set(ref, { projectId: pid, createdAt: now() });
      return true;
    });
    if (ok) return code;
  }
  fail('internal', 'no-code');
}

// Groups get the template's angles (groups.briefs) in turn; the teacher can change a group's angle.
const angleFor = (skeleton, i) => (skeleton.groups.briefs.length ? skeleton.groups.briefs[i % skeleton.groups.briefs.length].id : null);
function writeGroup(batch, pref, groupId, name, order, skeleton) {
  batch.set(pref.collection('groups').doc(groupId), { name, order, briefId: angleFor(skeleton, order), createdAt: now() });
  for (const t of tasksForGroup(skeleton, groupId)) {
    const { id, ...task } = t;
    batch.set(pref.collection('tasks').doc(id), { ...task, updatedAt: now() });
  }
}

/** Launch: every link milestone needs a due date; groups and their boards are created, the code issued. */
export const plLaunch = callable(async (req) => {
  const { p, ref, id } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.setup);
  if (p.tailor?.proposal) fail('failed-precondition', 'proposal-open');
  const problems = launchProblems(p.skeleton);
  if (Object.keys(problems).length) fail('failed-precondition', 'plan-incomplete', { steps: Object.keys(problems) });
  const missing = linkMilestones(p.skeleton).filter((ph) => !p.due?.[ph.id]);
  if (missing.length) fail('failed-precondition', 'due-missing', { phases: missing.map((x) => x.id) });
  const code = await uniqueCode(id);
  const batch = fs().batch();
  p.groupNames.forEach((name, i) => writeGroup(batch, ref, `g${i + 1}`, name, i, p.skeleton));
  batch.update(ref, { status: STATUS.running, code, launchedAt: now(), updatedAt: now(), nextGroup: p.groupNames.length + 1 });
  await batch.commit();
  return { code };
});

export const plAddGroup = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.running);
  const name = str(req.data?.name, LIMITS.groupName);
  if (!name) fail('invalid-argument', 'bad-groups');
  const count = (await ref.collection('groups').count().get()).data().count;
  if (count >= LIMITS.groups[1]) fail('failed-precondition', 'too-many-groups');
  const n = p.nextGroup ?? count + 1;
  const batch = fs().batch();
  writeGroup(batch, ref, `g${n}`, name, n, p.skeleton);
  batch.update(ref, { nextGroup: n + 1, updatedAt: now() });
  await batch.commit();
  return { groupId: `g${n}` };
});

/** Changes a group's angle (one of the skeleton's group briefs). */
export const plSetGroupBrief = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.running);
  const briefId = req.data?.briefId ?? null;
  if (briefId !== null && !p.skeleton.groups.briefs.some((b) => b.id === briefId)) fail('invalid-argument', 'bad-brief');
  const g = ref.collection('groups').doc(String(req.data?.groupId ?? ''));
  if (!(await g.get()).exists) fail('not-found', 'no-group');
  await g.update({ briefId });
  return { ok: true };
});

export const plRenameGroup = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.running, STATUS.assessing);
  const name = str(req.data?.name, LIMITS.groupName);
  if (!name) fail('invalid-argument', 'bad-groups');
  const g = ref.collection('groups').doc(String(req.data?.groupId ?? ''));
  if (!(await g.get()).exists) fail('not-found', 'no-group');
  await g.update({ name });
  return { ok: true };
});

/** Puts a student in a group (or takes them out with groupId null). Their claimed tasks are released. */
export const plAssignStudent = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.running);
  const sref = ref.collection('students').doc(String(req.data?.sid ?? ''));
  const groupId = req.data?.groupId ?? null;
  if (groupId !== null && !(await ref.collection('groups').doc(String(groupId)).get()).exists) fail('not-found', 'no-group');
  await fs().runTransaction(async (tx) => {
    const s = await tx.get(sref);
    if (!s.exists) fail('not-found', 'no-student');
    if (s.data().groupId === groupId) return;
    const claimed = await tx.get(ref.collection('tasks').where('ownerSid', '==', sref.id));
    claimed.forEach((t) => tx.update(t.ref, { ownerSid: null, updatedAt: now() }));
    tx.update(sref, { groupId });
  });
  return { ok: true };
});

/** Removes a student (a wrong or duplicate join): record, devices, open requests; tasks are released. */
export const plRemoveStudent = callable(async (req) => {
  const { p, ref, id } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.running);
  const sid = String(req.data?.sid ?? '');
  const sref = ref.collection('students').doc(sid);
  if (!(await sref.get()).exists) fail('not-found', 'no-student');
  const [tasks, reqs] = await Promise.all([
    ref.collection('tasks').where('ownerSid', '==', sid).get(),
    ref.collection('joinRequests').where('sid', '==', sid).get(),
  ]);
  const batch = fs().batch();
  tasks.forEach((t) => batch.update(t.ref, { ownerSid: null, updatedAt: now() }));
  reqs.forEach((r) => batch.delete(r.ref));
  batch.delete(sref);
  batch.delete(fs().doc(`plDevices/${id}_${sid}`));
  await batch.commit();
  return { ok: true };
});

/** Approves or refuses a sign-in from a new device. */
export const plDecideJoin = callable(async (req) => {
  const { p, ref, id } = await teacherProject(req, req.data?.projectId, 'any');
  needStatus(p, STATUS.running, STATUS.assessing);
  const rref = ref.collection('joinRequests').doc(String(req.data?.requestId ?? ''));
  const approve = req.data?.approve === true;
  await fs().runTransaction(async (tx) => {
    const r = await tx.get(rref);
    if (!r.exists || r.data().status !== 'pending') fail('failed-precondition', 'request-gone');
    if (approve) {
      const dref = fs().doc(`plDevices/${id}_${r.data().sid}`);
      tx.set(dref, { projectId: id, sid: r.data().sid, devices: FieldValue.arrayUnion(r.data().deviceHash) }, { merge: true });
    }
    tx.update(rref, { status: approve ? 'approved' : 'denied', decidedAt: now() });
  });
  return { ok: true };
});

// ---- feedback and assessment ----------------------------------------------------------------------------

export const plFeedback = callable(async (req) => {
  const { me, p, ref } = await teacherProject(req, req.data?.projectId, 'any');
  needStatus(p, STATUS.running, STATUS.assessing);
  const text = str(req.data?.text, LIMITS.comment);
  const sub = ref.collection('submissions').doc(`${req.data?.groupId}_${req.data?.phaseId}`);
  if (!(await sub.get()).exists) fail('not-found', 'no-submission');
  await sub.update({ [`feedback.${me.uid}`]: text ? { text, name: me.name, at: now() } : FieldValue.delete() });
  return { ok: true };
});

export const plStartAssessment = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.running);
  await ref.update({ status: STATUS.assessing, assessingAt: now(), updatedAt: now() });
  return { ok: true };
});

/** A teacher's scores for one group, on the criteria this teacher scores. */
export const plTeacherScore = callable(async (req) => {
  const { me, p, ref, lead } = await teacherProject(req, req.data?.projectId, 'any');
  needStatus(p, STATUS.assessing);
  const groupId = String(req.data?.groupId ?? '');
  if (!(await ref.collection('groups').doc(groupId).get()).exists) fail('not-found', 'no-group');
  // A co-teacher of the lead's own subject scores alongside the lead (the scores are averaged).
  const coSubjects = Object.values(p.coTeacherInfo ?? {}).map((c) => c.subject).filter((x) => x !== p.leadSubject);
  const mine = criteriaFor(p.skeleton, lead ? { lead: true, coSubjects } : { lead: false, subject: p.coTeacherInfo?.[me.uid]?.subject });
  const scores = {};
  for (const c of mine) {
    const v = req.data?.scores?.[c.id];
    if (v === undefined || v === null) continue;
    if (!Number.isInteger(v) || v < 1 || v > 4) fail('invalid-argument', 'bad-score');
    scores[c.id] = v;
  }
  const comment = str(req.data?.comment ?? '', LIMITS.comment);
  await ref.collection('assessments').doc(`teacher_${me.uid}_${groupId}`).set({
    kind: 'teacher', rater: me.uid, raterName: me.name, groupId, scores, comment, updatedAt: now(),
  });
  return { ok: true };
});

/** Closing: the code stops working; student data gets deleteAt (Firestore TTL, 90 days). */
export const plCloseProject = callable(async (req) => {
  const { p, ref, id } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.assessing);
  const closedAt = now();
  const deleteAt = Timestamp.fromMillis(closedAt + RETENTION_DAYS * DAY);
  const writer = fs().bulkWriter();
  for (const col of ['groups', 'students', 'joinRequests', 'tasks', 'submissions', 'assessments', 'feedbackDrafts', 'feedback', 'feedbackStudents']) {
    const docs = await ref.collection(col).get();
    docs.forEach((d) => writer.update(d.ref, { deleteAt }));
  }
  const devices = await fs().collection('plDevices').where('projectId', '==', id).get();
  devices.forEach((d) => writer.delete(d.ref));
  if (p.code) writer.delete(fs().doc(`plCodes/${p.code}`));
  writer.update(ref, { status: STATUS.closed, closedAt, deleteAt, code: null, updatedAt: closedAt });
  await writer.close();
  return { deleteAt: deleteAt.toMillis() };
});

// ---- co-teachers -----------------------------------------------------------------------------------------

/** An invitation link token (the lead teacher's Hub pass is needed). A new one replaces the old one. */
export const plCreateInvite = callable(async (req) => {
  const { me, p, id } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.setup, STATUS.running, STATUS.assessing);
  if (!(await hubPass(me.uid))) fail('permission-denied', 'hub-pass');
  const t = token();
  await secretRef(id).set({ inviteHash: sha256(t), inviteAt: now() }, { merge: true });
  return { invite: `${id}.${t}` };
});

export const plInviteInfo = callable(async (req) => {
  const me = teacher(req);
  const [pid, t] = String(req.data?.invite ?? '').split('.');
  const [ps, ss] = await Promise.all([projectRef(pid).get(), secretRef(pid).get()]);
  if (!ps.exists || !ss.exists || ss.data().inviteHash !== sha256(t)) fail('not-found', 'bad-invite');
  const p = ps.data();
  if (p.status === STATUS.closed) fail('failed-precondition', 'status-closed');
  return {
    projectId: pid, title: p.title, ownerName: p.ownerName, subjects: p.skeleton.basics.subjects.map((s) => s.name),
    already: p.owner === me.uid || (p.coTeachers ?? []).includes(me.uid), own: p.owner === me.uid,
  };
});

export const plAcceptInvite = callable(async (req) => {
  const me = teacher(req);
  const [pid, t] = String(req.data?.invite ?? '').split('.');
  const ref = projectRef(pid);
  const [ps, ss] = await Promise.all([ref.get(), secretRef(pid).get()]);
  if (!ps.exists || !ss.exists || ss.data().inviteHash !== sha256(t)) fail('not-found', 'bad-invite');
  const p = ps.data();
  needStatus(p, STATUS.setup, STATUS.running, STATUS.assessing);
  if (p.owner === me.uid) fail('failed-precondition', 'own-project');
  if (!subjectsOf(p).includes(req.data?.subject)) fail('invalid-argument', 'bad-subject');
  if (!(await hubPass(p.owner))) fail('permission-denied', 'owner-hub-pass');
  await ref.update({
    coTeachers: FieldValue.arrayUnion(me.uid),
    members: FieldValue.arrayUnion(me.uid),
    [`coTeacherInfo.${me.uid}`]: { name: me.name, subject: req.data.subject, joinedAt: now() },
    updatedAt: now(),
  });
  return { projectId: pid };
});

export const plRemoveCoTeacher = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  const uid = String(req.data?.uid ?? '');
  if (!(p.coTeachers ?? []).includes(uid)) fail('not-found', 'no-coteacher');
  await ref.update({
    coTeachers: FieldValue.arrayRemove(uid), members: FieldValue.arrayRemove(uid),
    [`coTeacherInfo.${uid}`]: FieldValue.delete(), updatedAt: now(),
  });
  return { ok: true };
});

// ---- exhibition and export -------------------------------------------------------------------------------

/** Exhibition page: 'on' (a new link, 30 days), 'extend', 'off', or 'link' (the current link again). */
export const plExhibition = callable(async (req) => {
  const { p, ref, id } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.running, STATUS.assessing, STATUS.closed);
  const action = req.data?.action;
  if (action === 'off') {
    await Promise.all([ref.update({ exhibitionUntil: null }), secretRef(id).set({ exhibitionToken: null }, { merge: true })]);
    return { on: false };
  }
  const limit = p.deleteAt ? p.deleteAt.toMillis() : Infinity;
  const until = Math.min(now() + EXHIBITION_DAYS * DAY, limit);
  if (until <= now()) fail('failed-precondition', 'deleted');
  if (action === 'extend') {
    if (!p.exhibitionUntil) fail('failed-precondition', 'exhibition-off');
    await ref.update({ exhibitionUntil: until });
    return { on: true, until };
  }
  if (action === 'link') {
    const t = (await secretRef(id).get()).data()?.exhibitionToken;
    if (!t || !p.exhibitionUntil) fail('failed-precondition', 'exhibition-off');
    return { on: true, until: p.exhibitionUntil, link: `${id}.${t}` };
  }
  if (action !== 'on') fail('invalid-argument', 'bad-request');
  // The token is kept (function-only plSecrets) so the teacher can copy the link again later.
  const t = token(18);
  await Promise.all([ref.update({ exhibitionUntil: until }), secretRef(id).set({ exhibitionToken: t }, { merge: true })]);
  return { on: true, until, link: `${id}.${t}` };
});

async function readAll(ref) {
  const [groups, students, assessments] = await Promise.all(['groups', 'students', 'assessments'].map((c) => ref.collection(c).get()));
  const list = (q) => q.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { groups: list(groups).sort((a, b) => a.order - b.order), students: list(students), assessments: list(assessments) };
}

/** The summary (everyone who teaches the project) and the CSV export (Hub pass of the lead teacher). */
export const plSummary = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'any');
  needStatus(p, STATUS.assessing, STATUS.closed);
  const data = await readAll(ref);
  const summary = summarize({ skeleton: p.skeleton, ...data });
  const exportOk = await hubPass(p.owner);
  return { summary, exportOk, csv: req.data?.csv && exportOk ? summaryCsv(p.skeleton, summary) : null };
});

