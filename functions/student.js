// Student callables: join with code + nickname (new devices wait for the teacher), choose a group,
// the board, hand-ins, self/contribution/peer assessment, the gallery. Plus the public exhibition page.
import { FieldValue } from 'firebase-admin/firestore';
import {
  callable, fail, fs, studentProject, needStatus, projectRef, secretRef, sha256, now, studentToken,
} from './common.js';
import {
  STATUS, TASK_STATUS, LIMITS, normalizeCode, CODE_RE, cleanNickname, nicknameKey, nicknameError, cleanLink,
  cleanText, productPhase,
} from './engines/project.js';

const DEVICE_RE = /^[A-Za-z0-9_-]{16,100}$/;
const MAX_PENDING = 3;

const str = (v, max) => {
  const t = cleanText(v, max);
  if (t === null) fail('invalid-argument', 'too-long');
  return t;
};
const devRef = (pid, sid) => fs().doc(`plDevices/${pid}_${sid}`);

// ---- join -----------------------------------------------------------------------------------------------

/**
 * Join with the project code and a nickname. A new nickname signs in at once; a nickname that exists
 * signs in only from a device it already used, otherwise a join request waits for the teacher.
 * Returns { token } or { pending: requestId, projectId }.
 */
export const plJoin = callable(async (req) => {
  const code = normalizeCode(req.data?.code);
  if (!CODE_RE.test(code)) fail('invalid-argument', 'bad-code');
  const nickError = nicknameError(req.data?.nickname);
  if (nickError) fail('invalid-argument', nickError);
  const deviceId = String(req.data?.deviceId ?? '');
  if (!DEVICE_RE.test(deviceId)) fail('invalid-argument', 'bad-device');
  const cs = await fs().doc(`plCodes/${code}`).get();
  if (!cs.exists) fail('not-found', 'bad-code');
  const pid = cs.data().projectId;
  const pref = projectRef(pid);
  const nickname = cleanNickname(req.data.nickname);
  const key = nicknameKey(nickname);
  const deviceHash = sha256(deviceId);

  const result = await fs().runTransaction(async (tx) => {
    const ps = await tx.get(pref);
    if (!ps.exists) fail('not-found', 'bad-code');
    needStatus(ps.data(), STATUS.running, STATUS.assessing);
    const found = await tx.get(pref.collection('students').where('key', '==', key).limit(1));
    if (found.empty) {
      if (ps.data().status !== STATUS.running) fail('failed-precondition', 'joining-closed');
      const sref = pref.collection('students').doc();
      tx.set(sref, { nickname, key, groupId: null, joinedAt: now() });
      tx.set(devRef(pid, sref.id), { projectId: pid, sid: sref.id, devices: [deviceHash] });
      return { sid: sref.id };
    }
    const sid = found.docs[0].id;
    const dev = await tx.get(devRef(pid, sid));
    if ((dev.data()?.devices ?? []).includes(deviceHash)) return { sid };
    // A new device: one pending request per device, a few per student.
    const pending = await tx.get(pref.collection('joinRequests').where('sid', '==', sid).where('status', '==', 'pending'));
    const same = pending.docs.find((d) => d.data().deviceHash === deviceHash);
    if (same) return { pending: same.id };
    if (pending.size >= MAX_PENDING) fail('resource-exhausted', 'too-many-requests');
    const rref = pref.collection('joinRequests').doc();
    tx.set(rref, { sid, nickname: found.docs[0].data().nickname, deviceHash, status: 'pending', createdAt: now() });
    return { pending: rref.id };
  });
  if (result.pending) return { pending: result.pending, projectId: pid };
  return { token: await studentToken(pid, result.sid) };
});

/** Polled by a device that waits for approval: { pending } | { denied } | { token }. */
export const plJoinStatus = callable(async (req) => {
  const pid = String(req.data?.projectId ?? '');
  const deviceId = String(req.data?.deviceId ?? '');
  if (!pid || !DEVICE_RE.test(deviceId)) fail('invalid-argument', 'bad-request');
  const rref = projectRef(pid).collection('joinRequests').doc(String(req.data?.requestId ?? ''));
  const r = await rref.get();
  if (!r.exists || r.data().deviceHash !== sha256(deviceId)) fail('not-found', 'no-request');
  const { status, sid } = r.data();
  if (status === 'pending') return { pending: true };
  if (status === 'denied') return { denied: true };
  if (status !== 'approved') fail('failed-precondition', 'request-gone');
  await rref.update({ status: 'used', usedAt: now() });
  return { token: await studentToken(pid, sid) };
});

/** Sign-out on a shared computer: this device has to be approved again next time. */
export const plLeaveDevice = callable(async (req) => {
  const { me } = await studentProject(req);
  const deviceId = String(req.data?.deviceId ?? '');
  if (!DEVICE_RE.test(deviceId)) fail('invalid-argument', 'bad-device');
  await devRef(me.projectId, me.sid).set({ devices: FieldValue.arrayRemove(sha256(deviceId)) }, { merge: true });
  return { ok: true };
});

export const plChooseGroup = callable(async (req) => {
  const { me, p, ref } = await studentProject(req);
  needStatus(p, STATUS.running);
  if (p.groupMode !== 'choose') fail('failed-precondition', 'teacher-assigns');
  const g = ref.collection('groups').doc(String(req.data?.groupId ?? ''));
  const sref = ref.collection('students').doc(me.sid);
  await fs().runTransaction(async (tx) => {
    const [gs, ss] = await Promise.all([tx.get(g), tx.get(sref)]);
    if (!gs.exists) fail('not-found', 'no-group');
    if (ss.data().groupId) fail('failed-precondition', 'has-group');
    tx.update(sref, { groupId: g.id });
  });
  return { ok: true };
});

// ---- board and hand-ins ------------------------------------------------------------------------------------

function inGroup(s) {
  if (!s.groupId) fail('failed-precondition', 'no-group');
  return s.groupId;
}
const touch = (ref, groupId) => ref.update({ [`lastActivity.${groupId}`]: now() });

/** Board actions: claim, unclaim, status, add, remove (own added tasks). */
export const plTask = callable(async (req) => {
  const { me, p, s, ref } = await studentProject(req);
  needStatus(p, STATUS.running);
  const groupId = inGroup(s);
  const action = req.data?.action;
  if (action === 'add') {
    const phaseId = String(req.data?.phaseId ?? '');
    if (!p.skeleton.phases.some((ph) => ph.id === phaseId)) fail('invalid-argument', 'bad-phase');
    const title = str(req.data?.title, LIMITS.taskTitle);
    if (!title) fail('invalid-argument', 'title-empty');
    const own = await ref.collection('tasks').where('groupId', '==', groupId).where('fromTemplate', '==', false).count().get();
    if (own.data().count >= LIMITS.ownTasksPerGroup) fail('resource-exhausted', 'too-many-tasks');
    const order = p.skeleton.phases.findIndex((ph) => ph.id === phaseId) * 100 + 99;
    const tref = ref.collection('tasks').doc();
    await tref.set({
      groupId, phaseId, title, detail: '', roleId: null, ownerSid: me.sid, status: 'todo', order,
      fromTemplate: false, createdBy: me.sid, updatedAt: now(),
    });
    await touch(ref, groupId);
    return { taskId: tref.id };
  }
  const tref = ref.collection('tasks').doc(String(req.data?.taskId ?? ''));
  await fs().runTransaction(async (tx) => {
    const t = await tx.get(tref);
    if (!t.exists || t.data().groupId !== groupId) fail('not-found', 'no-task');
    const task = t.data();
    if (action === 'claim') {
      if (task.ownerSid && task.ownerSid !== me.sid) fail('failed-precondition', 'taken');
      tx.update(tref, { ownerSid: me.sid, updatedAt: now() });
    } else if (action === 'unclaim') {
      if (task.ownerSid !== me.sid) fail('failed-precondition', 'not-yours');
      tx.update(tref, { ownerSid: null, updatedAt: now() });
    } else if (action === 'status') {
      if (!TASK_STATUS.includes(req.data?.status)) fail('invalid-argument', 'bad-status');
      tx.update(tref, { status: req.data.status, ...(task.ownerSid ? {} : { ownerSid: me.sid }), updatedAt: now() });
    } else if (action === 'remove') {
      if (task.fromTemplate || task.createdBy !== me.sid) fail('failed-precondition', 'not-yours');
      tx.delete(tref);
    } else fail('invalid-argument', 'bad-request');
  });
  await touch(ref, groupId);
  return { ok: true };
});

/** A milestone hand-in: link + reflection + who did it (+ a one-line description on the product). */
export const plSubmit = callable(async (req) => {
  const { me, p, s, ref } = await studentProject(req);
  needStatus(p, STATUS.running);
  const groupId = inGroup(s);
  const phase = p.skeleton.phases.find((ph) => ph.id === req.data?.phaseId);
  if (!phase || phase.milestone.handIn !== 'link') fail('invalid-argument', 'bad-phase');
  const link = cleanLink(req.data?.link);
  if (!link) fail('invalid-argument', 'bad-link');
  const reflection = str(req.data?.reflection, LIMITS.reflection);
  const isProduct = productPhase(p.skeleton)?.id === phase.id;
  const blurb = isProduct ? str(req.data?.blurb ?? '', LIMITS.blurb) : '';
  const members = await ref.collection('students').where('groupId', '==', groupId).select().get();
  const memberIds = new Set(members.docs.map((d) => d.id));
  const contributors = [...new Set(Array.isArray(req.data?.contributors) ? req.data.contributors : [])].filter((x) => memberIds.has(x));
  if (!contributors.length) fail('invalid-argument', 'no-contributors');
  await ref.collection('submissions').doc(`${groupId}_${phase.id}`).set({
    groupId, phaseId: phase.id, link, reflection, contributors, ...(isProduct ? { blurb } : {}),
    submittedBy: me.sid, submittedAt: now(),
  }, { merge: true });
  await touch(ref, groupId);
  return { ok: true };
});

// ---- assessment ------------------------------------------------------------------------------------------

function answersFor(questions, input) {
  const out = {};
  for (const q of questions) {
    const v = input?.[q.id];
    if (v === undefined || v === null || v === '') fail('invalid-argument', 'answer-missing', { question: q.id });
    if (q.kind === 'scale') {
      if (!Number.isInteger(v) || v < 1 || v > 4) fail('invalid-argument', 'bad-answer', { question: q.id });
      out[q.id] = v;
    } else {
      const t = str(v, LIMITS.answer);
      if (!t) fail('invalid-argument', 'answer-missing', { question: q.id });
      out[q.id] = t;
    }
  }
  return out;
}

export const plAssess = callable(async (req) => {
  const { me, p, s, ref } = await studentProject(req);
  needStatus(p, STATUS.assessing);
  const groupId = inGroup(s);
  const a = p.skeleton.assessment;
  const kind = req.data?.kind;
  const base = { kind, rater: me.sid, raterGroup: groupId, updatedAt: now() };
  if (kind === 'self') {
    await ref.collection('assessments').doc(`self_${me.sid}`).set({ ...base, answers: answersFor(a.selfQuestions, req.data.answers) });
  } else if (kind === 'contribution') {
    const rated = String(req.data?.rated ?? '');
    const rs = await ref.collection('students').doc(rated).get();
    if (!rs.exists || rated === me.sid || rs.data().groupId !== groupId) fail('invalid-argument', 'bad-teammate');
    await ref.collection('assessments').doc(`contrib_${me.sid}_${rated}`).set({ ...base, rated, answers: answersFor(a.contributionQuestions, req.data.answers) });
  } else if (kind === 'peer') {
    const target = String(req.data?.groupId ?? '');
    if (target === groupId || !(await ref.collection('groups').doc(target).get()).exists) fail('invalid-argument', 'bad-group');
    const scores = {};
    for (const c of a.criteria.filter((x) => x.peer)) {
      const v = req.data?.scores?.[c.id];
      if (!Number.isInteger(v) || v < 1 || v > 4) fail('invalid-argument', 'bad-score', { criterion: c.id });
      scores[c.id] = v;
    }
    const comment = str(req.data?.comment ?? '', LIMITS.answer);
    await ref.collection('assessments').doc(`peer_${me.sid}_${target}`).set({ ...base, groupId: target, scores, comment });
  } else fail('invalid-argument', 'bad-request');
  return { ok: true };
});

/** The gallery round: every other group's product link and description. */
export const plGallery = callable(async (req) => {
  const { p, s, ref } = await studentProject(req);
  needStatus(p, STATUS.assessing);
  const groupId = inGroup(s);
  return { groups: await products(ref, p, (g) => g.id !== groupId) };
});

async function products(ref, p, keep = () => true) {
  const product = productPhase(p.skeleton);
  const groups = (await ref.collection('groups').orderBy('order').get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter(keep);
  const subs = product ? await ref.collection('submissions').where('phaseId', '==', product.id).get() : { docs: [] };
  const byGroup = new Map(subs.docs.map((d) => [d.data().groupId, d.data()]));
  return groups.map((g) => ({ groupId: g.id, name: g.name, link: byGroup.get(g.id)?.link ?? null, blurb: byGroup.get(g.id)?.blurb ?? '' }));
}

// ---- exhibition (public) ---------------------------------------------------------------------------------

/** The exhibition page: no sign-in; the link's token must match and not be expired. */
export const plExhibitionView = callable(async (req) => {
  const [pid, t] = String(req.data?.link ?? '').split('.');
  if (!pid || !t) fail('not-found', 'no-exhibition');
  const [ps, ss] = await Promise.all([projectRef(pid).get(), secretRef(pid).get()]);
  const p = ps.data();
  if (!p || !ss.exists || ss.data().exhibitionToken !== t || !p.exhibitionUntil || p.exhibitionUntil < now()) {
    fail('not-found', 'no-exhibition');
  }
  return {
    title: p.title,
    product: productPhase(p.skeleton)?.milestone.title ?? '',
    groups: (await products(projectRef(pid), p)).filter((g) => g.link).map(({ name, link, blurb }) => ({ name, link, blurb })),
  };
});
