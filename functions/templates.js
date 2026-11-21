// Templates in Firestore (P3): plTemplates/{id}. Shared templates (owner '') come from the Potluck admin:
// the built-in files are imported, or a template JSON is uploaded, checked and shown as a preview, then
// published. A teacher with a Hub pass can save a project as their own template (owner = uid, only theirs).
// Doc: { slug, title, status: draft|live|archived, owner, source: builtin|upload|project, meta, skeleton,
//        projectId?, order, createdAt, updatedAt }. Shared templates use the slug as the doc id.
import { callable, fail, fs, teacher, teacherProject, hubPass, now } from './common.js';
import { TEMPLATES } from './engines/templates/index.js';
import { validateSkeleton, LIMITS } from './engines/skeleton.js';
import { readTemplate } from './engines/template-io.js';
import { cleanText } from './engines/project.js';

export const TEMPLATE_STATUS = ['draft', 'live', 'archived'];
const MAX_OWN = 30;
const col = () => fs().collection('plTemplates');

/** An admin of the Hub (settings/admins.emails, verified e-mail), as the Hub's own functions check it. */
export async function admin(req) {
  const me = teacher(req);
  const email = req.auth.token.email;
  if (!email || req.auth.token.email_verified !== true) fail('permission-denied', 'admin-only');
  const admins = (await fs().doc('settings/admins').get()).data()?.emails ?? [];
  if (!admins.includes(email)) fail('permission-denied', 'admin-only');
  return me;
}

const listItem = (d) => {
  const t = d.data();
  return { id: d.id, slug: t.slug, title: t.title, status: t.status, source: t.source, order: t.order ?? 0, meta: t.meta, skeleton: t.skeleton, updatedAt: t.updatedAt };
};

// ---- admin ------------------------------------------------------------------------------------------------

export const plAdminTemplates = callable(async (req) => {
  await admin(req);
  const snap = await col().where('owner', '==', '').get();
  const builtins = TEMPLATES.map((t) => t.slug);
  return { templates: snap.docs.map(listItem).sort((a, b) => a.order - b.order), builtins };
});

/** Imports the built-in template files. New ones arrive as drafts; existing ones keep their status. */
export const plAdminImportBuiltins = callable(async (req) => {
  await admin(req);
  const t = now();
  const batch = fs().batch();
  const results = [];
  for (const [i, tpl] of TEMPLATES.entries()) {
    const r = readTemplate(tpl);
    if (!r.ok) { results.push({ slug: tpl.slug, errors: r.errors }); continue; }
    const ref = col().doc(tpl.slug);
    const old = await ref.get();
    batch.set(ref, {
      slug: tpl.slug, title: tpl.skeleton.basics.title, owner: '', source: 'builtin', meta: r.value.meta, skeleton: tpl.skeleton,
      status: old.exists ? old.data().status : 'draft', order: old.exists ? (old.data().order ?? i) : i,
      createdAt: old.exists ? old.data().createdAt : t, updatedAt: t,
    });
    results.push({ slug: tpl.slug, imported: true, status: old.exists ? old.data().status : 'draft' });
  }
  await batch.commit();
  return { results };
});

/** Checks an uploaded template; with save: true it is stored as a draft (replace: true overwrites a slug). */
export const plAdminUpload = callable(async (req) => {
  await admin(req);
  let r;
  try { r = readTemplate(req.data?.json); } catch { fail('invalid-argument', 'bad-json'); }
  if (!r.ok || !req.data?.save) return { ok: r.ok, errors: r.errors.slice(0, 40), template: r.value };
  const ref = col().doc(r.value.slug);
  const old = await ref.get();
  if (old.exists && !req.data.replace) fail('already-exists', 'slug-taken');
  if (old.exists && old.data().owner !== '') fail('already-exists', 'slug-taken');
  const t = now();
  await ref.set({
    slug: r.value.slug, title: r.value.skeleton.basics.title, owner: '', source: 'upload', meta: r.value.meta, skeleton: r.value.skeleton,
    status: 'draft', order: old.exists ? (old.data().order ?? 99) : 99, createdAt: old.exists ? old.data().createdAt : t, updatedAt: t,
  });
  return { ok: true, saved: r.value.slug };
});

export const plAdminSetTemplate = callable(async (req) => {
  await admin(req);
  const ref = col().doc(String(req.data?.id ?? ''));
  const s = await ref.get();
  if (!s.exists || s.data().owner !== '') fail('not-found', 'no-template');
  const patch = { updatedAt: now() };
  if (req.data.status !== undefined) {
    if (!TEMPLATE_STATUS.includes(req.data.status)) fail('invalid-argument', 'bad-status');
    if (req.data.status === 'live' && !validateSkeleton(s.data().skeleton).ok) fail('failed-precondition', 'bad-template');
    patch.status = req.data.status;
  }
  if (req.data.order !== undefined) {
    if (!Number.isInteger(req.data.order) || req.data.order < 0 || req.data.order > 999) fail('invalid-argument', 'bad-request');
    patch.order = req.data.order;
  }
  await ref.update(patch);
  return { ok: true };
});

// ---- teachers ------------------------------------------------------------------------------------------------

/** Saves a project's skeleton as the teacher's own template (Hub pass; decided 2026-11-21). */
export const plSaveAsTemplate = callable(async (req) => {
  const { me, p, id } = await teacherProject(req, req.data?.projectId, 'lead');
  if (!(await hubPass(me.uid))) fail('permission-denied', 'hub-pass-template');
  if (!validateSkeleton(p.skeleton).ok) fail('failed-precondition', 'plan-incomplete');
  const own = await col().where('owner', '==', me.uid).count().get();
  if (own.data().count >= MAX_OWN) fail('resource-exhausted', 'too-many-templates');
  const title = cleanText(req.data?.title ?? p.title, LIMITS.title);
  if (!title) fail('invalid-argument', 'title-empty');
  const ref = col().doc();
  const t = now();
  const skeleton = structuredClone(p.skeleton);
  skeleton.basics.title = title;
  await ref.set({
    slug: '', title, owner: me.uid, source: 'project', projectId: id, meta: { tags: [], durationHint: '' }, skeleton,
    status: 'live', order: 0, createdAt: t, updatedAt: t,
  });
  return { templateId: ref.id };
});

export const plDeleteTemplate = callable(async (req) => {
  const me = teacher(req);
  const ref = col().doc(String(req.data?.id ?? ''));
  const s = await ref.get();
  if (!s.exists || s.data().owner !== me.uid) fail('not-found', 'no-template');
  await ref.delete();
  return { ok: true };
});

/** The template a new project starts from: a live shared one, or the caller's own. */
export async function templateFor(uid, templateId) {
  const s = await col().doc(String(templateId ?? '')).get();
  const t = s.data();
  if (!s.exists || !(t.owner === uid || (t.owner === '' && t.status === 'live'))) fail('not-found', 'no-template');
  return { id: s.id, ...t };
}
