// Reading a template upload (P3): { slug?, meta?, skeleton } or a bare skeleton, checked against the
// project frame. Pure; used by the admin functions and the tests.
import { validateSkeleton } from './skeleton.js';

export const SLUG = /^[a-z0-9][a-z0-9-]{1,47}$/;

export const slugify = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

/** A template as an upload: { slug?, meta?, skeleton } or a bare skeleton. Returns { ok, value, errors }. */
export function readTemplate(input) {
  const obj = typeof input === 'string' ? JSON.parse(input) : input;
  const skeleton = obj?.skeleton ?? obj;
  const { ok, errors } = validateSkeleton(skeleton);
  const slug = obj?.slug ?? slugify(skeleton?.basics?.title);
  const out = [...errors];
  if (!SLUG.test(slug ?? '')) out.push({ path: 'slug', message: 'a short lowercase slug (a-z, 0-9, dashes)' });
  const meta = {
    tags: Array.isArray(obj?.meta?.tags) ? obj.meta.tags.filter((x) => typeof x === 'string').slice(0, 8).map((x) => x.slice(0, 30)) : [],
    durationHint: typeof obj?.meta?.durationHint === 'string' ? obj.meta.durationHint.slice(0, 40) : '',
  };
  return { ok: ok && out.length === errors.length, errors: out, value: { slug, meta, skeleton } };
}

