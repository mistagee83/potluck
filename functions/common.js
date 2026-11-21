// Shared server helpers: Firebase handles, refusals with a reason, caller checks, project access.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { hasAccess } from './engines/hub/entitlements.js';

if (!getApps().length) initializeApp();
let firestore = null;
export const fs = () => {
  if (!firestore) {
    firestore = getFirestore();
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
};
export const auth = () => getAuth();
export { Timestamp };

export const APP = 'potluck';
export const REGION = 'europe-west1';

/** A callable in this codebase's region. All Potluck functions are callables named pl*. */
export const callable = (handler, options = {}) => onCall({ region: REGION, ...options }, handler);

/** Refuses a call; the client reads `details.reason`. */
export const fail = (code, reason, extra = {}) => { throw new HttpsError(code, reason, { reason, ...extra }); };

export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
export const token = (bytes = 24) => randomBytes(bytes).toString('base64url');
export const rand = (n) => randomInt(n);

/** A teacher: signed in, not anonymous, not a Potluck student token. */
export function teacher(req) {
  if (!req.auth) fail('unauthenticated', 'sign-in');
  const t = req.auth.token ?? {};
  if (t.firebase?.sign_in_provider === 'anonymous' || t.plStudent) fail('permission-denied', 'teacher-only');
  return { uid: req.auth.uid, name: t.name || (t.email ? String(t.email).split('@')[0] : 'Teacher'), email: t.email ?? null };
}

/** A student: a Potluck custom token with plStudent (project id) and plSid (student id). */
export function student(req) {
  const t = req.auth?.token ?? {};
  if (!req.auth || !t.plStudent || !t.plSid) fail('unauthenticated', 'student-only');
  return { uid: req.auth.uid, projectId: t.plStudent, sid: t.plSid };
}

/** The Hub's users/{uid} document (read only; the Hub writes it). */
export async function userDoc(uid) {
  return (await fs().doc(`users/${uid}`).get()).data() ?? null;
}
export async function hubPass(uid) {
  return hasAccess((await userDoc(uid))?.entitlements, APP);
}

export const projectRef = (pid) => fs().doc(`plProjects/${pid}`);
export const secretRef = (pid) => fs().doc(`plSecrets/${pid}`);

/** Loads a project the caller teaches. role: 'lead' (owner only) or 'any' (owner or co-teacher). */
export async function teacherProject(req, projectId, role = 'any') {
  const me = teacher(req);
  if (typeof projectId !== 'string' || !projectId) fail('invalid-argument', 'bad-request');
  const snap = await projectRef(projectId).get();
  if (!snap.exists) fail('not-found', 'no-project');
  const p = snap.data();
  const lead = p.owner === me.uid;
  if (!lead && (role === 'lead' || !(p.coTeachers ?? []).includes(me.uid))) fail('permission-denied', 'not-yours');
  return { me, p, lead, ref: snap.ref, id: snap.id };
}

/** Loads the caller's project and student record. */
export async function studentProject(req) {
  const me = student(req);
  const [ps, ss] = await Promise.all([projectRef(me.projectId).get(), projectRef(me.projectId).collection('students').doc(me.sid).get()]);
  if (!ps.exists || !ss.exists) fail('not-found', 'no-student');
  return { me, p: ps.data(), s: ss.data(), ref: ps.ref };
}

export function needStatus(p, ...statuses) {
  if (!statuses.includes(p.status)) fail('failed-precondition', `status-${p.status}`);
}

/** Student uid for a custom token: stable per student, the same on every approved device. */
export const studentUid = (pid, sid) => `pl_${pid}_${sid}`;
export async function studentToken(pid, sid) {
  return auth().createCustomToken(studentUid(pid, sid), { plStudent: pid, plSid: sid });
}

export const now = () => Date.now();
