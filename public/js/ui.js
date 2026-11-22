// Small UI helpers shared by the teacher, student and exhibition pages (no framework).
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** The gingham header: logo sticker left, a cream pill right (text never sits on the gingham). */
export const header = (right = '') => `<header class="topbar"><a class="logo" href="/">Potluck</a><span class="pill">${right || "by Mr. Andrew's Hub"}</span></header>`;
export const t = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/** "Mon 24 Nov" from YYYY-MM-DD (a calendar date, no time zone shift). */
export function fmtDay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
export const fmtDate = (ms) => (ms ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms)) : '');

/** Markdown subset for handouts: ## headings, - and 1. lists, > quotes, **bold**, paragraphs. Escaped first. */
export function markdown(src) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of String(src ?? '').split('\n')) {
    const l = line.trimEnd();
    let m;
    if (!l.trim()) { close(); continue; }
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { close(); out.push(`<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`); continue; }
    if ((m = l.match(/^[-*]\s+(.*)$/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = l.match(/^\d+\.\s+(.*)$/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = l.match(/^>\s?(.*)$/))) { close(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    close(); out.push(`<p>${inline(l)}</p>`);
  }
  close();
  return out.join('');
}

/**
 * Drafts: form fields keep their text across re-renders (live data re-renders the page while someone
 * types). An input with data-k="key" writes to drafts[key]; views read val(key, fallback).
 */
export function drafts(root) {
  const D = {};
  root.addEventListener('input', (e) => {
    const k = e.target.dataset?.k;
    if (!k) return;
    D[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  });
  return {
    D,
    val: (k, fallback = '') => (k in D ? D[k] : fallback),
    clear: (prefix) => { for (const k of Object.keys(D)) if (k.startsWith(prefix)) delete D[k]; },
  };
}

/** Re-render keeping the focused field and its caret. */
export function keepFocus(root, paint) {
  const a = document.activeElement;
  const key = a && root.contains(a) ? (a.id ? `#${CSS.escape(a.id)}` : a.dataset?.k ? `[data-k="${CSS.escape(a.dataset.k)}"]` : null) : null;
  const pos = key && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
  const scroll = window.scrollY;
  paint();
  if (key) {
    const el = root.querySelector(key);
    if (el) { el.focus({ preventScroll: true }); if (pos && el.setSelectionRange) try { el.setSelectionRange(...pos); } catch { /* not a text field */ } }
  }
  window.scrollTo(0, scroll);
}

/** Error messages for refusals (details.reason from the functions). */
export const ERRORS = {
  'sign-in': 'Please sign in again.',
  'teacher-only': 'This page is for teachers. Sign in with your teacher account.',
  'student-only': 'Join the project with its code first.',
  'one-active': 'Without a Hub pass you can run one project at a time. Close the active one, or get a Hub pass for more.',
  'due-missing': 'Give every hand-in a due date before you launch.',
  'hub-pass': 'Inviting a co-teacher needs a Hub pass.',
  'owner-hub-pass': 'The lead teacher needs a Hub pass to have co-teachers.',
  'bad-invite': 'This invitation link does not work any more. Ask for a new one.',
  'own-project': 'This is your own project.',
  'bad-code': 'There is no project with this code. Check the code on the board.',
  'nickname-length': 'A nickname has 2-20 characters.',
  'nickname-chars': 'Use letters, numbers, spaces, dots, dashes or underscores.',
  'joining-closed': 'This project does not take new students any more.',
  'too-many-requests': 'Your teacher has several requests from you already. Wait for them.',
  'bad-link': 'This is not a working link. Copy the share link of your work (it starts with https://).',
  'no-contributors': 'Tick who worked on this.',
  'answer-missing': 'Answer every question.',
  'bad-score': 'Choose a score for every criterion.',
  'taken': 'Someone else has taken this task.',
  'no-group': 'You are not in a group yet.',
  'has-group': 'You are already in a group.',
  'teacher-assigns': 'Your teacher puts you in a group.',
  'title-empty': 'Write a title.',
  'too-long': 'This text is too long.',
  'too-many-groups': 'A project has at most 12 groups.',
  'bad-groups': 'Every group needs a name (1-12 groups).',
  'no-submission': 'Nothing has been handed in yet.',
  'request-gone': 'This request has already been decided.',
  'status-closed': 'This project is closed.',
  'status-assessing': 'The project is in the assessment phase.',
  'status-running': 'The project is already running.',
  'status-setup': 'The project has not started yet.',
  'not-yours': 'You cannot change this.',
  'exhibition-off': 'Turn the exhibition page on first.',
  insufficient: 'Not enough credits. Get credits or a Hub pass on your Hub account.',
  'no-price': 'This step is not available yet.',
  'model-unavailable': 'The AI is not available right now. Your credits were not used. Try again later.',
  'generation-failed': 'The AI could not write a usable version. Your credits were given back. Try again, or say what you want differently.',
  'bad-input': 'Check the fields marked below.',
  'proposal-open': 'Use or discard the waiting version first.',
  'plan-incomplete': 'Some steps still need work before you can launch: see Fit it to your class.',
  'idea-first': 'Approve the draft from your idea first.',
  'no-proposal': 'There is nothing waiting.',
  'no-members': 'This group has no members.',
  'feedback-empty': 'Write the text for the group.',
  'bad-step': 'This step is not available here.',
  'admin-only': 'This is for Hub admins.',
  'bad-json': 'This is not valid JSON.',
  'slug-taken': 'A template with this slug exists. Tick Replace to overwrite it.',
  'bad-template': 'This template does not fit the project frame.',
  'no-template': 'This template is not available.',
  'hub-pass-template': 'Own templates need a Hub pass.',
  'too-many-templates': 'You have 30 templates. Delete one first.',
  'bad-brief': 'Choose one of the angles.',
  'assessment-first': 'Write the assessment step first: the criteria come with it.',
  network: 'No connection. Check the internet and try again.',
  timeout: 'This took too long. Try again.',
};
export const errorText = (e) => ERRORS[e?.reason] ?? `Something went wrong. Try again. (${e?.code ?? 'unknown'})`;

/** A browser download of text (CSV). */
export function download(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
