// Potluck student page: join with the project code and a nickname (a new device waits for the teacher),
// choose a group, the group board, hand-ins, the brief; in the assessment phase the self-assessment,
// teammate ratings and the gallery round. Its own named Firebase app, so it never touches a teacher's
// sign-in in the same browser. Reads are live listeners; writes are pl* callables.
import { onAuthStateChanged, signInWithCustomToken, signOut } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { collection, doc, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { firebase } from './firebase.js';
import { esc, fmtDay, fmtDate, markdown, drafts, keepFocus, errorText, header } from './ui.js';
import * as P from '/engines/project.js';

const $app = document.getElementById('app');
const fb = firebase('student');
const { val, clear } = drafts($app);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* not available */ } },
};

// One random id per browser: a nickname signs in again without approval only from a device it used.
function deviceId() {
  let id = store.get('pl:device');
  if (!id || !/^[A-Za-z0-9_-]{16,100}$/.test(id)) {
    const b = crypto.getRandomValues(new Uint8Array(24));
    id = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    store.set('pl:device', id);
  }
  return id;
}

let me; // undefined: not known, null: signed out, { pid, sid }
const S = {
  pending: JSON.parse(store.get('pl:pending') || 'null'), denied: false,
  p: null, student: null, students: [], groups: [], tasks: [], subs: [], mine: [], gallery: null,
  tab: null, phase: null, busy: '', error: '', flash: '',
};
const subs = { base: [], group: [] };

async function act(key, fn) {
  S.busy = key; S.error = ''; S.flash = ''; render();
  try { await fn(); } catch (e) { S.error = errorText(e); console.warn(key, e.code, e.reason); }
  S.busy = ''; render();
}
const off = () => (S.busy ? 'disabled' : '');

// ---- join -------------------------------------------------------------------------------------------------
async function join(code, nickname) {
  const r = await fb.call('plJoin', { code, nickname, deviceId: deviceId() });
  if (r.token) { await signInWithCustomToken(fb.auth, r.token); return; }
  S.pending = { projectId: r.projectId, requestId: r.pending, nickname };
  store.set('pl:pending', JSON.stringify(S.pending));
  poll();
}
let pollTimer = null;
function poll() {
  clearTimeout(pollTimer);
  if (!S.pending) return;
  pollTimer = setTimeout(async () => {
    try {
      const r = await fb.call('plJoinStatus', { projectId: S.pending.projectId, requestId: S.pending.requestId, deviceId: deviceId() });
      if (r.token) { S.pending = null; store.set('pl:pending', null); await signInWithCustomToken(fb.auth, r.token); return; }
      if (r.denied) { S.pending = null; store.set('pl:pending', null); S.denied = true; render(); return; }
    } catch (e) {
      if (e.reason === 'no-request' || e.reason === 'request-gone') { S.pending = null; store.set('pl:pending', null); render(); return; }
    }
    poll();
  }, 4000);
}

// ---- data -------------------------------------------------------------------------------------------------
function stopAll() {
  [...subs.base, ...subs.group].forEach((u) => u()); subs.base = []; subs.group = [];
  Object.assign(S, { p: null, student: null, students: [], groups: [], tasks: [], subs: [], mine: [], gallery: null });
}
const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const fail = (e) => { S.error = errorText(e); render(); };

function watch() {
  stopAll();
  const pref = doc(fb.db, 'plProjects', me.pid);
  subs.base.push(onSnapshot(pref, (s) => { S.p = s.exists() ? s.data() : null; render(); }, fail));
  subs.base.push(onSnapshot(doc(pref, 'students', me.sid), (s) => {
    const before = S.student?.groupId;
    S.student = s.exists() ? s.data() : null;
    if (!S.student) { S.error = 'Your teacher removed you from this project.'; }
    if (S.student?.groupId !== before) watchGroup();
    render();
  }, fail));
  subs.base.push(onSnapshot(collection(pref, 'students'), (s) => { S.students = list(s); render(); }, fail));
  subs.base.push(onSnapshot(collection(pref, 'groups'), (s) => { S.groups = list(s).sort((a, b) => a.order - b.order); render(); }, fail));
  subs.base.push(onSnapshot(query(collection(pref, 'assessments'), where('rater', '==', me.sid)), (s) => { S.mine = list(s); render(); }, fail));
}
function watchGroup() {
  subs.group.forEach((u) => u()); subs.group = []; S.tasks = []; S.subs = [];
  const gid = S.student?.groupId;
  if (!gid) return;
  const pref = doc(fb.db, 'plProjects', me.pid);
  subs.group.push(onSnapshot(query(collection(pref, 'tasks'), where('groupId', '==', gid)), (s) => { S.tasks = list(s).sort((a, b) => a.order - b.order); render(); }, fail));
  subs.group.push(onSnapshot(query(collection(pref, 'submissions'), where('groupId', '==', gid)), (s) => { S.subs = list(s); render(); }, fail));
}

// ---- pieces -----------------------------------------------------------------------------------------------
const errorLine = () => (S.error ? `<p class="error" role="alert">${esc(S.error)}</p>` : '');
const flashLine = () => (S.flash ? `<p class="note" role="status">${esc(S.flash)}</p>` : '');
const chip = (label, kind = '') => `<span class="chip ${kind}">${esc(label)}</span>`;
const nick = (sid) => S.students.find((s) => s.id === sid)?.nickname ?? 'someone';
const teammates = () => S.students.filter((s) => s.groupId && s.groupId === S.student?.groupId);
const role = (id) => S.p.skeleton.roles.find((r) => r.id === id);
const MS_CHIP = { done: ['Handed in', 'ok'], late: ['Late', 'bad'], due: ['Due today', 'warn'], open: ['Open', ''], class: ['In class', ''] };
const today = () => P.isoDay(Date.now(), S.p?.timeZone || 'UTC');
const scale = (name, k, current) => `<div class="scale" role="radiogroup">${[1, 2, 3, 4].map((n) => `<label><input type="radio" name="${esc(name)}" value="${n}" data-k="${esc(k)}" ${String(val(k, current ?? '')) === String(n) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
  <p class="muted small scale-legend"><span>1 low</span><span>4 high</span></p>`;

function frame(body, tabs = []) {
  const g = S.groups.find((x) => x.id === S.student?.groupId);
  return `${header(`<span class="who">${esc(S.student?.nickname ?? '')}</span>${g ? `<span class="chip tag">${esc(g.name)}</span>` : ''}<button class="link-btn" type="button" data-leave>Sign out</button>`)}
    <main class="page stack">
      ${S.p ? `<h1>${esc(S.p.title)}</h1>` : ''}
      ${tabs.length ? `<nav class="tabs">${tabs.map(([k, label]) => `<button class="tab" type="button" data-tab="${k}" aria-current="${S.tab === k ? 'page' : 'false'}">${esc(label)}</button>`).join('')}</nav>` : ''}
      ${errorLine()}${flashLine()}${body}
    </main>`;
}

// ---- views ------------------------------------------------------------------------------------------------
function joinView() {
  const code = val('code', new URLSearchParams(location.search).get('code') ?? '');
  return `${header()}<main class="signin">
    <form class="box signin-card" data-join novalidate>
      <h1>Join your project</h1>
      <p class="signin-lead">Type the code your teacher shows and a nickname your group will know you by. No e-mail, no password.</p>
      ${S.denied ? '<p class="error" role="alert">Your teacher did not let this device in. Ask your teacher.</p>' : ''}${errorLine()}
      <div class="field"><label for="code">Project code</label><input id="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" data-k="code" value="${esc(code)}"></div>
      <div class="field"><label for="nickname">Nickname</label><input id="nickname" type="text" autocomplete="nickname" maxlength="20" data-k="nickname" value="${esc(val('nickname'))}"></div>
      <button class="btn primary" type="submit" ${off()}>Join</button>
      <p class="muted small">Joined before on another phone or computer? Use the same nickname: your teacher lets this device in.</p>
    </form>
  </main>`;
}

function pendingView() {
  return `${header()}<main class="signin">
    <div class="box signin-card"><h1>Wait for your teacher</h1>
      <p><strong>${esc(S.pending.nickname ?? '')}</strong> has joined before from another device. Your teacher sees a request and lets this device in.</p>
      <p class="muted">This page checks every few seconds.</p>
      <button class="btn" type="button" data-cancelpending>Use another nickname</button></div></main>`;
}

function chooseView() {
  if (S.p.groupMode !== 'choose') return frame('<div class="box"><p>You are in. Your teacher puts you in a group soon: this page updates by itself.</p></div>');
  return frame(`<div class="box stack"><h2>Choose your group</h2>
    ${S.groups.map((g) => {
      const members = S.students.filter((s) => s.groupId === g.id).map((s) => s.nickname);
      return `<div class="row choose"><span><strong>${esc(g.name)}</strong><br><span class="muted small">${members.map(esc).join(', ') || 'nobody yet'}</span></span>
        <button class="btn sm" type="button" data-choose="${esc(g.id)}" ${off()}>Join ${esc(g.name)}</button></div>`;
    }).join('')}</div>`);
}

function currentPhaseId() {
  const sk = S.p.skeleton;
  if (S.phase && sk.phases.some((ph) => ph.id === S.phase)) return S.phase;
  const firstOpen = sk.phases.find((ph) => ph.milestone.handIn === 'link' && !S.subs.some((x) => x.phaseId === ph.id));
  return (firstOpen ?? sk.phases.at(-1)).id;
}

function boardView() {
  const sk = S.p.skeleton;
  const phId = currentPhaseId();
  const ph = sk.phases.find((x) => x.id === phId);
  const tasks = S.tasks.filter((x) => x.phaseId === phId);
  const st = P.milestoneStatus(ph, S.subs.find((x) => x.phaseId === phId), S.p.due?.[phId], today());
  return `<div class="seg scroll" role="group" aria-label="Phase">${sk.phases.map((x, i) => `<button type="button" data-phase="${esc(x.id)}" aria-pressed="${x.id === phId}">${i + 1}. ${esc(x.title)}</button>`).join('')}</div>
    <div class="box stack"><p>${esc(ph.goal)}</p>
      <p class="row"><strong>${esc(ph.milestone.title)}</strong>${chip(...MS_CHIP[st])}${S.p.due?.[phId] ? `<span class="muted small">due ${esc(fmtDay(S.p.due[phId]))}</span>` : ''}</p>
      <p class="muted small">${esc(ph.milestone.deliverable)}</p>
      ${ph.milestone.handIn === 'link' ? '<p><button class="link-btn" type="button" data-tab="handins">Hand it in</button></p>' : ''}</div>
    <div class="box stack">
      <div class="row head"><h2>${esc(ph.title)}</h2><span class="chip tag">${esc(S.groups.find((g) => g.id === S.student.groupId)?.name ?? '')}</span></div>
      <ul class="plain tasks">${tasks.map(taskRow).join('') || '<li class="muted">No tasks in this phase.</li>'}</ul>
      <div class="row"><input type="text" maxlength="80" placeholder="Add a task to this phase" aria-label="New task" data-k="newtask-${esc(phId)}" value="${esc(val(`newtask-${phId}`))}">
        <button class="btn sm" type="button" data-addtask="${esc(phId)}" ${off()}>Add</button></div>
    </div>`;
}

// A task row (design: done = lettuce + filled circle with a check, claimed = butter + ring, open = white,
// dashed, "I'll bring it"). The circle marks a claimed task done, or done back to claimed.
const CHECK = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"></path></svg>';
function taskRow(x) {
  const mine = x.ownerSid === me.sid;
  const state = x.status === 'done' ? 'done' : x.ownerSid ? 'claimed' : 'open';
  const r = x.roleId ? role(x.roleId) : null;
  const circle = state === 'open'
    ? '<span class="circle" aria-hidden="true"></span>'
    : `<button class="circle-hit" type="button" data-toggle="${esc(x.id)}" aria-pressed="${state === 'done'}" aria-label="${state === 'done' ? 'Mark as not done' : 'Mark as done'}: ${esc(x.title)}" ${off()}><span class="circle">${state === 'done' ? CHECK : ''}</span></button>`;
  const side = state === 'open'
    ? `<button class="btn bring" type="button" data-claim="${esc(x.id)}" ${off()}>I'll bring it</button>`
    : `<span class="task-owner">${mine ? 'You' : esc(nick(x.ownerSid))}</span>${mine && state !== 'done' ? `<button class="link-btn small" type="button" data-unclaim="${esc(x.id)}" ${off()}>Drop it</button>` : ''}`;
  return `<li class="task ${state}">${circle}
    <div class="task-body"><div class="task-title">${esc(x.title)}</div>
      ${x.detail || r ? `<div class="task-detail">${r ? `${esc(r.name)}${x.detail ? ' · ' : ''}` : ''}${esc(x.detail)}</div>` : ''}
      ${!x.fromTemplate && x.createdBy === me.sid ? `<button class="link-btn danger small" type="button" data-removetask="${esc(x.id)}" ${off()}>Delete</button>` : ''}</div>
    <div class="task-side">${side}</div></li>`;
}

function handinsView(readOnly = false) {
  const sk = S.p.skeleton;
  const product = P.productPhase(sk);
  const team = teammates();
  return sk.phases.filter((ph) => ph.milestone.handIn === 'link').map((ph) => {
    const s = S.subs.find((x) => x.phaseId === ph.id);
    const st = P.milestoneStatus(ph, s, S.p.due?.[ph.id], today());
    const k = (f) => `hi-${ph.id}-${f}`;
    const contributors = s?.contributors ?? [me.sid];
    const fbs = Object.values(s?.feedback ?? {});
    return `<div class="box stack">
      <div class="row"><h2>${esc(ph.milestone.title)}</h2>${chip(...MS_CHIP[st])}${S.p.due?.[ph.id] ? `<span class="muted small">due ${esc(fmtDay(S.p.due[ph.id]))}</span>` : ''}</div>
      <p class="muted">${esc(ph.milestone.deliverable)}</p>
      ${s ? `<p class="small">Handed in ${esc(fmtDate(s.submittedAt))} by ${esc(nick(s.submittedBy))}: <a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.link)}</a></p>` : ''}
      ${fbs.map((f) => `<p class="feedback"><strong>${esc(f.name)}:</strong> ${esc(f.text)}</p>`).join('')}
      ${readOnly ? '' : `<div class="field"><label for="${k('link')}">Link to your work</label><input id="${k('link')}" type="url" inputmode="url" placeholder="https://" maxlength="500" data-k="${k('link')}" value="${esc(val(k('link'), s?.link ?? ''))}"></div>
      <p class="muted small">Use a share link that opens without signing in.</p>
      ${ph.id === product?.id ? `<div class="field"><label for="${k('blurb')}">Your product in one sentence (on the exhibition page)</label><input id="${k('blurb')}" type="text" maxlength="160" data-k="${k('blurb')}" value="${esc(val(k('blurb'), s?.blurb ?? ''))}"></div>` : ''}
      <div class="field"><label for="${k('refl')}">What did you do, and what would you do differently?</label><textarea id="${k('refl')}" rows="3" maxlength="600" data-k="${k('refl')}">${esc(val(k('refl'), s?.reflection ?? ''))}</textarea></div>
      <fieldset class="field"><legend>Who worked on it?</legend>${team.map((m) => `<label class="check"><input type="checkbox" data-k="${k(`c-${m.id}`)}" ${val(k(`c-${m.id}`), contributors.includes(m.id)) ? 'checked' : ''}> ${esc(m.nickname)}</label>`).join('')}</fieldset>
      <p><button class="btn primary" type="button" data-submit="${esc(ph.id)}" ${off()}>${s ? 'Update the hand-in' : 'Hand it in'}</button></p>`}
    </div>`;
  }).join('');
}

function briefView() {
  const sk = S.p.skeleton; const b = sk.basics;
  return `<div class="box stack"><p class="dq">${esc(b.drivingQuestion)}</p><p>${esc(b.brief)}</p>
      <p><strong>What you make:</strong> ${esc(b.product.description)}</p><p><strong>For whom:</strong> ${esc(b.audience)}</p></div>
    <h2>Roles</h2><ul>${sk.roles.map((r) => `<li><strong>${esc(r.name)}</strong>${r.optional ? ' (in larger groups)' : ''}: ${esc(r.responsibility)}</li>`).join('')}</ul>
    <h2>How you are assessed</h2><ul>${sk.assessment.criteria.map((c) => `<li><strong>${esc(c.name)}</strong>: ${esc(c.levels.find((l) => l.score === 4)?.descriptor)}</li>`).join('')}</ul>
    ${sk.handouts.filter((h) => h.for !== 'teacher').map((h) => `<details class="box"><summary><strong>${esc(h.title)}</strong></summary><div class="md">${markdown(h.body)}</div></details>`).join('')}`;
}

function selfView() {
  const a = S.p.skeleton.assessment;
  const done = S.mine.find((x) => x.kind === 'self');
  return `<div class="box stack"><div class="row"><h2>About your own work</h2>${done ? chip('Saved', 'ok') : ''}</div>
    ${a.selfQuestions.map((q) => `<div class="field"><label ${q.kind === 'text' ? `for="sq-${esc(q.id)}"` : ''}>${esc(q.text)}</label>
      ${q.kind === 'scale' ? scale(`sq-${q.id}`, `sq-${q.id}`, done?.answers?.[q.id]) : `<textarea id="sq-${esc(q.id)}" rows="3" maxlength="400" data-k="sq-${esc(q.id)}">${esc(val(`sq-${q.id}`, done?.answers?.[q.id] ?? ''))}</textarea>`}</div>`).join('')}
    <p><button class="btn primary" type="button" data-saveself ${off()}>Save</button></p></div>`;
}

function teammatesView() {
  const a = S.p.skeleton.assessment;
  const others = teammates().filter((m) => m.id !== me.sid);
  if (!others.length) return '<p class="muted">You have no teammates to rate.</p>';
  return `<p class="muted">Your teammates never see what you wrote; your teacher sees only the averages.</p>${others.map((m) => {
    const done = S.mine.find((x) => x.kind === 'contribution' && x.rated === m.id);
    return `<div class="box stack"><div class="row"><h2>${esc(m.nickname)}</h2>${done ? chip('Saved', 'ok') : ''}</div>
      ${a.contributionQuestions.map((q) => `<div class="field"><label ${q.kind === 'text' ? `for="cq-${esc(m.id)}-${esc(q.id)}"` : ''}>${esc(q.text)}</label>
        ${q.kind === 'scale' ? scale(`cq-${m.id}-${q.id}`, `cq-${m.id}-${q.id}`, done?.answers?.[q.id]) : `<textarea id="cq-${esc(m.id)}-${esc(q.id)}" rows="2" maxlength="400" data-k="cq-${esc(m.id)}-${esc(q.id)}">${esc(val(`cq-${m.id}-${q.id}`, done?.answers?.[q.id] ?? ''))}</textarea>`}</div>`).join('')}
      <p><button class="btn" type="button" data-savecontrib="${esc(m.id)}" ${off()}>Save</button></p></div>`;
  }).join('')}`;
}

function galleryView() {
  if (!S.gallery) return `<p><button class="btn" type="button" data-loadgallery ${off()}>Show the other groups' work</button></p>`;
  const crit = S.p.skeleton.assessment.criteria.filter((c) => c.peer);
  return S.gallery.map((g) => {
    const done = S.mine.find((x) => x.kind === 'peer' && x.groupId === g.groupId);
    return `<div class="box stack"><div class="row"><h2>${esc(g.name)}</h2>${done ? chip('Saved', 'ok') : ''}</div>
      ${g.link ? `<p><a class="btn sm" href="${esc(g.link)}" target="_blank" rel="noopener noreferrer">Open their work</a></p>${g.blurb ? `<p><em>${esc(g.blurb)}</em></p>` : ''}` : '<p class="muted">Nothing handed in.</p>'}
      ${crit.map((c) => `<div class="field"><span class="label-like">${esc(c.name)}</span><p class="muted small">4 = ${esc(c.levels.find((l) => l.score === 4)?.descriptor)}</p>${scale(`pq-${g.groupId}-${c.id}`, `pq-${g.groupId}-${c.id}`, done?.scores?.[c.id])}</div>`).join('')}
      <div class="field"><label for="pc-${esc(g.groupId)}">One thing they did well (optional)</label><textarea id="pc-${esc(g.groupId)}" rows="2" maxlength="400" data-k="pc-${esc(g.groupId)}">${esc(val(`pc-${g.groupId}`, done?.comment ?? ''))}</textarea></div>
      <p><button class="btn" type="button" data-savepeer="${esc(g.groupId)}" ${off()}>Save</button></p></div>`;
  }).join('');
}

function inView() {
  const p = S.p;
  if (p.status === 'closed') return frame('<div class="box"><p>This project is closed. Thank you for taking part.</p></div>');
  if (!S.student?.groupId) return chooseView();
  if (p.status === 'assessing') {
    const tabs = [['self', 'Yourself'], ['team', 'Teammates'], ['gallery', 'Gallery'], ['handins', 'Hand-ins']];
    if (!tabs.some(([k]) => k === S.tab)) S.tab = 'self';
    const views = { self: selfView, team: teammatesView, gallery: galleryView, handins: () => handinsView(true) };
    return frame(views[S.tab](), tabs);
  }
  const tabs = [['board', 'Board'], ['handins', 'Hand-ins'], ['brief', 'Brief']];
  if (!tabs.some(([k]) => k === S.tab)) S.tab = 'board';
  const views = { board: boardView, handins: () => handinsView(false), brief: briefView };
  return frame(views[S.tab](), tabs);
}

function render() {
  keepFocus($app, () => {
    if (me === undefined) { $app.innerHTML = `${header()}<main class="signin"><p class="muted">Loading</p></main>`; return; }
    if (!me) { $app.innerHTML = S.pending ? pendingView() : joinView(); return; }
    if (!S.p || !S.student) { $app.innerHTML = frame(S.error ? '' : '<p class="muted">Loading</p>'); return; }
    $app.innerHTML = inView();
  });
}

// ---- events -----------------------------------------------------------------------------------------------
const pickScale = (name) => { const el = $app.querySelector(`input[name="${CSS.escape(name)}"]:checked`); return el ? Number(el.value) : null; };
const call = (fn, data) => fb.call(fn, data);

$app.addEventListener('submit', (e) => {
  e.preventDefault();
  if ('join' in e.target.dataset) {
    S.denied = false;
    act('join', () => join(val('code', e.target.code.value), val('nickname', e.target.nickname.value)));
  }
});

$app.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  const d = el.dataset;
  if ('cancelpending' in d) { S.pending = null; store.set('pl:pending', null); clearTimeout(pollTimer); return render(); }
  if ('leave' in d) {
    if (!confirm('Sign out on this device? Next time your teacher has to let this device in again.')) return;
    return act('leave', async () => { try { await call('plLeaveDevice', { deviceId: deviceId() }); } finally { await signOut(fb.auth); } });
  }
  if (d.tab) { S.tab = d.tab; S.error = ''; S.flash = ''; render(); return window.scrollTo(0, 0); }
  if (d.phase) { S.phase = d.phase; return render(); }
  if (d.choose) return act('choose', () => call('plChooseGroup', { groupId: d.choose }));
  if (d.claim) return act('task', () => call('plTask', { action: 'claim', taskId: d.claim }));
  if (d.unclaim) return act('task', () => call('plTask', { action: 'unclaim', taskId: d.unclaim }));
  if (d.toggle) {
    const x = S.tasks.find((t) => t.id === d.toggle);
    return act('task', () => call('plTask', { action: 'status', taskId: d.toggle, status: x?.status === 'done' ? 'todo' : 'done' }));
  }
  if (d.removetask) return act('task', () => call('plTask', { action: 'remove', taskId: d.removetask }));
  if (d.addtask) {
    const k = `newtask-${d.addtask}`;
    return act('task', async () => { await call('plTask', { action: 'add', phaseId: d.addtask, title: val(k) }); clear(k); });
  }
  if (d.submit) {
    const ph = d.submit; const k = (f) => `hi-${ph}-${f}`;
    const s = S.subs.find((x) => x.phaseId === ph);
    const before = s?.contributors ?? [me.sid];
    const contributors = teammates().filter((m) => val(k(`c-${m.id}`), before.includes(m.id))).map((m) => m.id);
    return act('submit', async () => {
      await call('plSubmit', { phaseId: ph, link: val(k('link'), s?.link ?? ''), reflection: val(k('refl'), s?.reflection ?? ''), blurb: val(k('blurb'), s?.blurb ?? ''), contributors });
      clear(`hi-${ph}-`); S.flash = 'Handed in. Your teacher sees it now.';
    });
  }
  if ('saveself' in d) {
    const answers = {};
    for (const q of S.p.skeleton.assessment.selfQuestions) answers[q.id] = q.kind === 'scale' ? pickScale(`sq-${q.id}`) : val(`sq-${q.id}`, S.mine.find((x) => x.kind === 'self')?.answers?.[q.id] ?? '');
    return act('self', async () => { await call('plAssess', { kind: 'self', answers }); clear('sq-'); S.flash = 'Saved.'; });
  }
  if (d.savecontrib) {
    const m = d.savecontrib; const answers = {};
    const prev = S.mine.find((x) => x.kind === 'contribution' && x.rated === m)?.answers ?? {};
    for (const q of S.p.skeleton.assessment.contributionQuestions) answers[q.id] = q.kind === 'scale' ? pickScale(`cq-${m}-${q.id}`) : val(`cq-${m}-${q.id}`, prev[q.id] ?? '');
    return act('contrib', async () => { await call('plAssess', { kind: 'contribution', rated: m, answers }); clear(`cq-${m}-`); S.flash = 'Saved.'; });
  }
  if ('loadgallery' in d) return act('gallery', async () => { S.gallery = (await call('plGallery', {})).groups; });
  if (d.savepeer) {
    const g = d.savepeer; const scores = {};
    for (const c of S.p.skeleton.assessment.criteria.filter((x) => x.peer)) scores[c.id] = pickScale(`pq-${g}-${c.id}`);
    const prev = S.mine.find((x) => x.kind === 'peer' && x.groupId === g)?.comment ?? '';
    return act('peer', async () => { await call('plAssess', { kind: 'peer', groupId: g, scores, comment: val(`pc-${g}`, prev) }); clear(`pq-${g}-`); clear(`pc-${g}`); S.flash = 'Saved.'; });
  }
});

// ---- start ------------------------------------------------------------------------------------------------
render();
if (S.pending) poll();
onAuthStateChanged(fb.auth, async (u) => {
  const claims = u ? (await u.getIdTokenResult()).claims : {};
  if (u && claims.plStudent && claims.plSid) {
    me = { pid: claims.plStudent, sid: claims.plSid };
    S.pending = null; store.set('pl:pending', null);
    watch();
  } else {
    me = null; stopAll();
  }
  render();
});
