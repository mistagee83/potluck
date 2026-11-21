// Potluck teacher page: sign-in with the Mr. Andrew's Hub account (Google or e-mail; one click from the Hub
// with #sso=<code>), projects, setup and launch, the monitor, groups and join requests, hand-ins and
// feedback, the plan, assessment, the summary and export, co-teachers and the exhibition page.
// Reads are live Firestore listeners (rules: the project's members); every write is a pl* callable.
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithCustomToken,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  collection, doc, onSnapshot, query, where,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { ONE_ACCOUNT_TEXT, authErrorText, isEmail, hubAccountUrl, redeemSso, takeSsoCode } from './hub/sso.js';
import { firebase, USE_EMULATORS } from './firebase.js';
import { publicBaseUrl, HUB_ACCOUNT_URL } from './config.js';
import { TT } from './text.js';
import { esc, t, fmtDay, fmtDate, markdown, drafts, keepFocus, errorText, download, header } from './ui.js';
import { hasAccess } from '/engines/hub/entitlements.js';
import { adminModule } from './admin.js';
import * as P from '/engines/project.js';
import { aiModule } from './teacher-ai.js';

const $app = document.getElementById('app');
const fb = firebase();
const { D, val, clear } = drafts($app);

let user; // undefined: not known yet, null: signed out
const SI = { email: '', note: '', error: '', busy: false };
const S = {
  view: 'home', projects: [], pid: null, p: null, groups: [], students: [], requests: [], tasks: [], subs: [], assess: [],
  tab: null, busy: '', error: '', flash: '', invite: null, inviteLink: '', exhibitionLink: '', summary: null, handinPhase: null,
  credits: null, prices: {}, fbDrafts: [], fieldErrors: [], entitlements: {}, templates: [], ownTemplates: [], isAdmin: false,
};
const subs = { home: null, project: [], account: [] };

// ---- sign-in: one Hub account for every app (Hub spec "Egy fiók, közös belépés") -------------------
const REDIRECT_INSTEAD = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];
async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await signInWithPopup(fb.auth, provider);
  } catch (err) {
    if (REDIRECT_INSTEAD.includes(err.code)) return signInWithRedirect(fb.auth, provider);
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return null;
    throw err;
  }
}
async function step(fn) {
  SI.busy = true; SI.note = ''; SI.error = ''; render();
  try { await fn(); } catch (err) { SI.error = authErrorText(err); }
  SI.busy = false; render();
}
async function emailSignIn(email, password) {
  SI.email = email;
  if (!isEmail(email)) throw { code: 'auth/invalid-email' };
  if (!password) throw { code: 'auth/missing-password' };
  await signInWithEmailAndPassword(fb.auth, email, password);
}
async function resetPassword(email) {
  SI.email = email;
  if (!isEmail(email)) { SI.error = TT.signin.resetHint; return; }
  try { await sendPasswordResetEmail(fb.auth, email); } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }
  SI.note = t(TT.signin.resetSent, { email });
}
let ssoPending = null;
{
  const code = takeSsoCode();
  if (code) {
    ssoPending = redeemSso({ code, redeem: (d) => fb.call('redeemSsoCode', d), signIn: (tk) => signInWithCustomToken(fb.auth, tk) })
      .then(() => true)
      .catch((err) => { console.warn('Hub sign-in link', err?.code || err?.message); return false; })
      .finally(() => { ssoPending = null; });
  }
}
const TEST_TEACHER = { email: 'test-teacher@potluck.test', password: 'emulator-only-teacher' };
async function testTeacherSignIn(n = '') {
  const email = n ? `test-teacher${n}@potluck.test` : TEST_TEACHER.email;
  try { await signInWithEmailAndPassword(fb.auth, email, TEST_TEACHER.password); } catch {
    await createUserWithEmailAndPassword(fb.auth, email, TEST_TEACHER.password);
  }
}

// ---- actions --------------------------------------------------------------------------------------------
async function act(key, fn) {
  S.busy = key; S.error = ''; S.flash = ''; render();
  try { await fn(); } catch (e) { S.error = errorText(e); console.warn(key, e.code, e.reason); }
  S.busy = ''; render();
}
const off = () => (S.busy ? 'disabled' : '');
const call = (fn, data) => fb.call(fn, data);
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// ---- routing: #p=<projectId>&tab=<tab>, #invite=<token> ----------------------------------------------------
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  return { p: h.get('p'), tab: h.get('tab'), invite: h.get('invite') };
}
function setHash() {
  const h = S.pid ? `#p=${S.pid}${S.tab ? `&tab=${S.tab}` : ''}` : '';
  if (location.hash !== h) history.replaceState(null, '', `${location.pathname}${location.search}${h}`);
}

// ---- data -------------------------------------------------------------------------------------------------
function watchAccount() {
  subs.account.forEach((u) => u());
  subs.account = [
    onSnapshot(doc(fb.db, 'users', user.uid), (s) => { S.credits = s.data()?.credits ?? {}; S.entitlements = s.data()?.entitlements ?? {}; render(); }, () => {}),
    onSnapshot(query(collection(fb.db, 'plTemplates'), where('owner', '==', ''), where('status', '==', 'live')), (s) => {
      S.templates = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); render();
    }, () => {}),
    onSnapshot(query(collection(fb.db, 'plTemplates'), where('owner', '==', user.uid)), (s) => {
      S.ownTemplates = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt); render();
    }, () => {}),
    // settings/admins is readable only by Hub admins (Hub rules): a successful read shows the Admin link.
    onSnapshot(doc(fb.db, 'settings', 'admins'), () => { S.isAdmin = true; render(); }, () => { S.isAdmin = false; }),
    onSnapshot(doc(fb.db, 'settings', 'credits'), (s) => { S.prices = s.data()?.prices ?? {}; render(); }, () => {}),
  ];
}

function watchHome() {
  subs.home?.();
  subs.home = onSnapshot(query(collection(fb.db, 'plProjects'), where('members', 'array-contains', user.uid)), (snap) => {
    S.projects = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
    render();
  }, (e) => { S.error = errorText(e); render(); });
}

function closeProject() {
  subs.project.forEach((u) => u()); subs.project = [];
  Object.assign(S, { pid: null, p: null, groups: [], students: [], requests: [], tasks: [], subs: [], assess: [], tab: null, fbDrafts: [], fieldErrors: [],
    inviteLink: '', exhibitionLink: '', summary: null, handinPhase: null });
}

function openProject(pid, tab = null) {
  closeProject();
  S.pid = pid; S.view = 'project'; S.tab = tab;
  const pref = doc(fb.db, 'plProjects', pid);
  const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const fail = (e) => { S.error = errorText(e); render(); };
  subs.project.push(onSnapshot(pref, (s) => {
    if (!s.exists()) { S.error = 'This project is not available.'; closeProject(); S.view = 'home'; render(); return; }
    S.p = { id: s.id, ...s.data() };
    if (!tabsFor(S.p).includes(S.tab)) S.tab = tabsFor(S.p)[0];
    setHash(); render();
  }, fail));
  const sub = (name, q, key, sort) => subs.project.push(onSnapshot(q, (snap) => { S[key] = sort ? list(snap).sort(sort) : list(snap); render(); }, fail));
  sub('groups', collection(pref, 'groups'), 'groups', (a, b) => a.order - b.order);
  sub('students', collection(pref, 'students'), 'students', (a, b) => a.nickname.localeCompare(b.nickname));
  sub('requests', query(collection(pref, 'joinRequests'), where('status', '==', 'pending')), 'requests', (a, b) => a.createdAt - b.createdAt);
  sub('tasks', collection(pref, 'tasks'), 'tasks', (a, b) => a.order - b.order);
  sub('subs', collection(pref, 'submissions'), 'subs');
  sub('assess', collection(pref, 'assessments'), 'assess');
  sub('fbDrafts', collection(pref, 'feedbackDrafts'), 'fbDrafts');
  render();
}

// ---- small pieces -------------------------------------------------------------------------------------------
const STATUS_LABEL = { setup: 'Setting up', running: 'Running', assessing: 'Assessment', closed: 'Closed' };
const chip = (label, kind = '') => `<span class="chip ${kind}">${esc(label)}</span>`;
const errorLine = () => (S.error ? `<p class="error" role="alert">${esc(S.error)}</p>` : '');
const flashLine = () => (S.flash ? `<p class="note" role="status">${esc(S.flash)}</p>` : '');
const nick = (sid) => S.students.find((s) => s.id === sid)?.nickname ?? 'someone';
const groupName = (gid) => S.groups.find((g) => g.id === gid)?.name ?? '';
const lead = () => S.p?.owner === user.uid;
const todayIso = () => P.isoDay(Date.now(), S.p?.timeZone || tz());
const joinUrl = (code) => `${publicBaseUrl()}/join.html?code=${code}`;
const MS_CHIP = { done: ['Handed in', 'ok'], late: ['Late', 'bad'], due: ['Due today', 'warn'], open: ['Open', ''], class: ['In class', ''] };

function topbar() {
  return header(`<span class="who">${esc(user.email ?? user.displayName ?? '')}</span>${S.isAdmin ? '<button class="link-btn" type="button" data-admin>Admin</button>' : ''}<button class="link-btn" type="button" data-signout>${esc(TT.signOut)}</button>`);
}

// ---- sign-in view -------------------------------------------------------------------------------------------
function signInView() {
  const T = TT.signin;
  const dis = SI.busy ? 'disabled' : '';
  const signup = hubAccountUrl({ signup: true, returnTo: `${location.origin}${location.pathname}${location.hash}` });
  return `${header()}<main class="signin">
    <div class="box signin-card">
      <h1>${esc(T.title)}</h1>
      <p class="signin-lead">${esc(ONE_ACCOUNT_TEXT)}</p>
      ${SI.error ? `<p class="error" role="alert">${esc(SI.error)}</p>` : ''}
      ${SI.note ? `<p class="note" role="status">${esc(SI.note)}</p>` : ''}
      <button class="btn primary" type="button" data-google ${dis}>${esc(T.google)}</button>
      <p class="signin-or">${esc(T.or)}</p>
      <form class="signin-form" data-email novalidate>
        <div class="field"><label for="si-email">${esc(T.email)}</label>
          <input id="si-email" type="email" name="email" autocomplete="email" inputmode="email" required value="${esc(SI.email)}"></div>
        <div class="field"><label for="si-password">${esc(T.password)}</label>
          <input id="si-password" type="password" name="password" autocomplete="current-password" required></div>
        <button class="btn" type="submit" ${dis}>${esc(T.submit)}</button>
      </form>
      <p class="signin-links"><button class="link-btn" type="button" data-reset ${dis}>${esc(T.forgot)}</button></p>
      <p class="signin-links">${esc(T.newHere)} <a href="${esc(signup)}">${esc(T.create)}</a></p>
    </div>
    ${USE_EMULATORS ? `<button class="btn" type="button" data-testteacher="" ${dis}>${esc(TT.testTeacher)}</button>
      <button class="btn" type="button" data-testteacher="2" ${dis}>Emulator: sign in as test teacher 2</button>` : ''}
    <p class="signin-links"><a href="/">${esc(T.home)}</a></p>
  </main>`;
}

// ---- home ---------------------------------------------------------------------------------------------------
function templateCard(tpl, own = false) {
  const sk = tpl.skeleton; const b = sk.basics;
  const time = t(b.duration.unit === 'weeks' ? TT.weeks : TT.lessons, { n: b.duration.amount });
  const facts = [b.subjects.map((s) => s.name).join(', '), time, t(TT.ages, { min: b.level.ageMin, max: b.level.ageMax }),
    t(TT.groupSize, { min: sk.groups.sizeMin, max: sk.groups.sizeMax })];
  return `<article class="box card stack">
    <h3>${esc(b.title)}</h3>
    <p class="muted facts">${esc(facts.join(' · '))}</p>
    <p class="dq">${esc(b.drivingQuestion)}</p>
    <p>${esc(b.summary)}</p>
    <div class="row"><button class="btn primary" type="button" data-create="${esc(tpl.id)}" ${off()}>Start this project</button>
      ${own ? `<button class="link-btn danger" type="button" data-deltemplate="${esc(tpl.id)}" ${off()}>Delete</button>` : ''}</div>
  </article>`;
}

function projectCard(p) {
  const role = p.owner === user.uid ? '' : ` · co-teacher (${esc(p.coTeacherInfo?.[user.uid]?.subject ?? '')})`;
  return `<button class="box card project-card" type="button" data-open="${esc(p.id)}">
    <span class="row"><strong>${esc(p.title)}</strong>${chip(STATUS_LABEL[p.status], p.status)}</span>
    <span class="muted">${p.code ? `Code ${esc(p.code)} · ` : ''}started ${esc(fmtDate(p.createdAt))}${role}</span>
  </button>`;
}

function inviteCard() {
  const i = S.invite;
  if (!i) return '';
  if (i.error) return `<div class="box stack"><h2>Invitation</h2><p class="error">${esc(i.error)}</p><button class="btn" type="button" data-dropinvite>Close</button></div>`;
  if (i.own) return `<div class="box stack"><h2>Invitation</h2><p>This is the invitation link of your own project, <strong>${esc(i.title)}</strong>. Send it to a colleague.</p><button class="btn" type="button" data-dropinvite>Close</button></div>`;
  if (i.already) return `<div class="box stack"><h2>Invitation</h2><p>You already teach <strong>${esc(i.title)}</strong>.</p><button class="btn primary" type="button" data-open="${esc(i.projectId)}">Open the project</button></div>`;
  return `<div class="box stack"><h2>Join a project as a co-teacher</h2>
    <p><strong>${esc(i.ownerName)}</strong> invites you to <strong>${esc(i.title)}</strong>. You give feedback on hand-ins and score your own subject's criteria.</p>
    <div class="field"><label for="inv-subject">Your subject in this project</label>
      <select id="inv-subject" data-k="invSubject">${i.subjects.map((s) => `<option ${val('invSubject', i.subjects[0]) === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    <div class="row"><button class="btn primary" type="button" data-acceptinvite ${off()}>Join the project</button>
      <button class="btn" type="button" data-dropinvite>Not now</button></div></div>`;
}

function homeView() {
  const active = S.projects.filter((p) => p.status !== 'closed');
  const closed = S.projects.filter((p) => p.status === 'closed');
  return `${topbar()}<main class="page stack">
    ${errorLine()}${inviteCard()}
    <h1>Your projects</h1>
    ${S.projects.length ? `<div class="list">${active.map(projectCard).join('')}</div>
      ${closed.length ? `<details><summary>Closed projects (${closed.length})</summary><div class="list">${closed.map(projectCard).join('')}</div></details>` : ''}`
      : '<p class="muted">No projects yet. Start one from a template below.</p>'}
    <h2>Start a new project</h2>
    ${S.ownTemplates.length ? `<h2>Your templates</h2><div class="cards">${S.ownTemplates.map((x) => templateCard(x, true)).join('')}</div><h2>Templates</h2>` : ''}
    <div class="cards">${S.templates.map((x) => templateCard(x)).join('')}
      <article class="box card stack"><h3>Your own idea</h3><p>Have a project in mind? Fill in a short form; AI drafts it on the same frame as the templates, and you approve every step.</p>
        <button class="btn primary" type="button" data-newidea ${off()}>Start from my idea</button></article></div>
  </main>`;
}

// ---- project: frame and tabs -----------------------------------------------------------------------------------
const TAB_LABEL = { setup: 'Setup', monitor: 'Monitor', groups: 'Groups', handins: 'Hand-ins', plan: 'Plan', settings: 'Settings', assess: 'Assess', summary: 'Summary' };
function tabsFor(p) {
  return {
    setup: ['setup', 'plan'],
    running: ['monitor', 'groups', 'handins', 'plan', 'settings'],
    assessing: ['assess', 'monitor', 'handins', 'summary', 'settings'],
    closed: ['summary', 'plan', 'settings'],
  }[p.status] ?? ['plan'];
}

function requestsBanner() {
  if (!S.requests.length || !['running', 'assessing'].includes(S.p.status)) return '';
  return `<div class="box banner stack" role="status">${S.requests.map((r) => `<div class="row">
      <span><strong>${esc(r.nickname)}</strong> wants to join from a new device.</span>
      <span class="row"><button class="btn primary sm" type="button" data-decide="${esc(r.id)}" data-approve="1" ${off()}>Let in</button>
      <button class="btn sm" type="button" data-decide="${esc(r.id)}" data-approve="0" ${off()}>Refuse</button></span></div>`).join('')}</div>`;
}

function projectView() {
  const p = S.p;
  if (!p) return `${topbar()}<main class="page"><p class="muted">${esc(TT.loading)}</p></main>`;
  const tabs = tabsFor(p);
  const code = p.code ? `<div class="box code-box"><span class="muted">Project code</span><strong class="code">${esc(p.code)}</strong>
    <span class="muted small">Students open <a href="${esc(joinUrl(p.code))}" target="_blank" rel="noopener">${esc(joinUrl(p.code).replace(/^https?:\/\//, ''))}</a></span></div>` : '';
  const views = { setup: setupView, monitor: monitorView, groups: groupsView, handins: handinsView, plan: planView, settings: settingsView, assess: assessView, summary: summaryView };
  return `${topbar()}<main class="page stack">
    <p><button class="link-btn" type="button" data-home>All projects</button></p>
    <div class="row head"><h1>${esc(p.title)}</h1>${chip(STATUS_LABEL[p.status], p.status)}</div>
    ${code}${requestsBanner()}
    <nav class="tabs" aria-label="Project">${tabs.map((k) => `<button class="tab" type="button" data-tab="${k}" aria-current="${S.tab === k ? 'page' : 'false'}">${TAB_LABEL[k]}</button>`).join('')}</nav>
    ${errorLine()}${flashLine()}
    ${(views[S.tab] ?? planView)()}
  </main>`;
}

// ---- setup -------------------------------------------------------------------------------------------------
function dueFields(phases, editable = true) {
  return phases.map((ph) => {
    const needed = ph.milestone.handIn === 'link';
    return `<div class="field"><label for="due-${esc(ph.id)}">${esc(ph.title)}: ${esc(ph.milestone.title)}${needed ? '' : ' <span class="muted">(in class, optional)</span>'}</label>
      <input id="due-${esc(ph.id)}" type="date" data-k="due-${esc(ph.id)}" value="${esc(val(`due-${ph.id}`, S.p.due?.[ph.id] ?? ''))}" ${editable ? '' : 'disabled'}></div>`;
  }).join('');
}
const dueFromDrafts = () => Object.fromEntries(S.p.skeleton.phases.map((ph) => [ph.id, val(`due-${ph.id}`, S.p.due?.[ph.id] ?? '') || null]));

function setupView() {
  const p = S.p; const sk = p.skeleton;
  if (!lead()) return '<p class="muted">The lead teacher is setting up this project.</p>';
  const subjects = sk.basics.subjects.map((s) => s.name);
  const aiPart = ai.tailorSection();
  if (!sk.phases.length) return aiPart;
  const count = Math.max(1, Math.min(12, Number(val('gcount', p.groupNames.length)) || 1));
  const names = Array.from({ length: count }, (_, i) => val(`gname-${i}`, p.groupNames[i] ?? `Team ${i + 1}`));
  return `${aiPart}<div class="box stack">
      <h2>The project</h2>
      <div class="field"><label for="title">Title</label><input id="title" type="text" maxlength="80" data-k="title" value="${esc(val('title', p.title))}"></div>
      ${subjects.length > 1 ? `<div class="field"><label for="lead-subject">Your subject</label><select id="lead-subject" data-k="leadSubject">${subjects.map((s) => `<option ${val('leadSubject', p.leadSubject) === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="box stack">
      <h2>Groups</h2>
      <p class="muted">Groups of ${sk.groups.sizeMin}-${sk.groups.sizeMax}. You can add groups and move students later.</p>
      <div class="field"><label for="gcount">Number of groups</label><input id="gcount" type="number" min="1" max="12" data-k="gcount" value="${count}"></div>
      <div class="grid2">${names.map((n, i) => `<div class="field"><label for="gname-${i}">Group ${i + 1}</label><input id="gname-${i}" type="text" maxlength="40" data-k="gname-${i}" value="${esc(n)}"></div>`).join('')}</div>
      <fieldset class="field"><legend>Who forms the groups?</legend>
        <label class="check"><input type="radio" name="mode" value="teacher" data-k="groupMode" ${val('groupMode', p.groupMode) === 'teacher' ? 'checked' : ''}> I put the students in groups</label>
        <label class="check"><input type="radio" name="mode" value="choose" data-k="groupMode" ${val('groupMode', p.groupMode) === 'choose' ? 'checked' : ''}> Students choose their group when they join</label>
      </fieldset>
    </div>
    <div class="box stack">
      <h2>Due dates</h2>
      <p class="muted">Every hand-in needs a date: the monitor shows a group as late after it. You can change the dates later.</p>
      <div class="grid2">${dueFields(sk.phases)}</div>
    </div>
    <div class="row">
      <button class="btn" type="button" data-savesetup ${off()}>Save</button>
      <button class="btn primary" type="button" data-launch ${off()}>Launch the project</button>
    </div>`;
}
function setupPayload() {
  const count = Math.max(1, Math.min(12, Number(val('gcount', S.p.groupNames.length)) || 1));
  const out = {
    projectId: S.pid, title: val('title', S.p.title), groupMode: val('groupMode', S.p.groupMode),
    groupNames: Array.from({ length: count }, (_, i) => val(`gname-${i}`, S.p.groupNames[i] ?? `Team ${i + 1}`)),
    due: dueFromDrafts(), timeZone: tz(),
  };
  if (S.p.skeleton.basics.subjects.length > 1) out.leadSubject = val('leadSubject', S.p.leadSubject);
  return out;
}

// ---- monitor -----------------------------------------------------------------------------------------------
function monitorView() {
  const p = S.p; const sk = p.skeleton;
  const milestones = sk.phases.filter((ph) => ph.milestone.handIn === 'link');
  const today = todayIso();
  const unassigned = S.students.filter((s) => !s.groupId);
  const rows = S.groups.map((g) => {
    const members = S.students.filter((s) => s.groupId === g.id);
    const tasks = S.tasks.filter((x) => x.groupId === g.id);
    const prog = P.taskProgress(tasks);
    const statuses = milestones.map((ph) => P.milestoneStatus(ph, S.subs.find((x) => x.id === `${g.id}_${ph.id}`), p.due?.[ph.id], today));
    const flags = P.groupFlags({ statuses, lastActivity: p.lastActivity?.[g.id] ?? null, now: Date.now() });
    return `<tr>
      <th scope="row"><strong>${esc(g.name)}</strong><br><span class="muted small">${members.map((s) => esc(s.nickname)).join(', ') || 'no members yet'}</span></th>
      ${statuses.map((st) => `<td>${chip(...MS_CHIP[st])}</td>`).join('')}
      <td>${prog.done}/${prog.total}${prog.unclaimed ? `<br><span class="muted small">${prog.unclaimed} unclaimed</span>` : ''}</td>
      <td>${flags.map((f) => chip(f === 'late' ? 'Late' : 'No activity for 3 days', 'bad')).join(' ')}</td></tr>`;
  }).join('');
  return `${unassigned.length ? `<p class="note">${unassigned.length} student${unassigned.length > 1 ? 's have' : ' has'} no group yet. <button class="link-btn" type="button" data-tab="groups">Put them in groups</button></p>` : ''}
    <p class="muted">${S.students.length} student${S.students.length === 1 ? '' : 's'} joined · today ${esc(fmtDay(today))}</p>
    <div class="table-wrap"><table class="grid-table">
      <thead><tr><th scope="col">Group</th>${milestones.map((ph) => `<th scope="col">${esc(ph.milestone.title)}<br><span class="muted small">${esc(fmtDay(p.due?.[ph.id]))}</span></th>`).join('')}<th scope="col">Tasks</th><th scope="col">Flags</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${milestones.length + 3}" class="muted">No groups.</td></tr>`}</tbody>
    </table></div>`;
}

// ---- groups ------------------------------------------------------------------------------------------------
function groupSelect(s) {
  const dis = lead() && S.p.status === 'running' ? '' : 'disabled';
  return `<select data-assign="${esc(s.id)}" aria-label="Group of ${esc(s.nickname)}" ${dis}>
    <option value="" ${s.groupId ? '' : 'selected'}>No group</option>
    ${S.groups.map((g) => `<option value="${esc(g.id)}" ${s.groupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>`;
}
function studentRow(s) {
  const canEdit = lead() && S.p.status === 'running';
  return `<li class="row student"><span>${esc(s.nickname)}</span><span class="row">${groupSelect(s)}
    ${canEdit ? `<button class="link-btn danger" type="button" data-removestudent="${esc(s.id)}" ${off()}>Remove</button>` : ''}</span></li>`;
}
// A group's angle (the template's group briefs), changeable by the lead teacher while the project runs.
function angleLine(g, canEdit) {
  const briefs = S.p.skeleton.groups.briefs;
  if (!briefs.length) return '';
  const cur = briefs.find((b) => b.id === g.briefId);
  if (!canEdit) return `<p class="small"><strong>Angle:</strong> ${esc(cur?.title ?? 'none')}</p>`;
  return `<label class="field small">Angle <select data-angle="${esc(g.id)}" ${off()}><option value="" ${cur ? '' : 'selected'}>None</option>${briefs.map((b) => `<option value="${esc(b.id)}" ${b.id === g.briefId ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></label>`;
}

function groupsView() {
  const canEdit = lead() && S.p.status === 'running';
  const unassigned = S.students.filter((s) => !s.groupId);
  return `${S.p.groupMode === 'choose' ? '<p class="muted">Students choose their group when they join. You can still move them here.</p>' : ''}
    ${unassigned.length ? `<div class="box stack"><h2>No group yet</h2><ul class="plain">${unassigned.map(studentRow).join('')}</ul></div>` : ''}
    <div class="cards">${S.groups.map((g) => `<div class="box stack">
      ${canEdit ? `<div class="row"><input type="text" maxlength="40" aria-label="Group name" data-k="rename-${esc(g.id)}" value="${esc(val(`rename-${g.id}`, g.name))}">
        <button class="btn sm" type="button" data-rename="${esc(g.id)}" ${off()}>Rename</button></div>` : `<h2>${esc(g.name)}</h2>`}
      ${angleLine(g, canEdit)}
      <ul class="plain">${S.students.filter((s) => s.groupId === g.id).map(studentRow).join('') || '<li class="muted">No members yet.</li>'}</ul>
    </div>`).join('')}</div>
    ${canEdit ? `<div class="box row"><input type="text" maxlength="40" aria-label="New group name" placeholder="New group name" data-k="newgroup" value="${esc(val('newgroup'))}">
      <button class="btn" type="button" data-addgroup ${off()}>Add a group</button></div>` : ''}`;
}

// ---- hand-ins ----------------------------------------------------------------------------------------------
function handinsView() {
  const p = S.p;
  const milestones = p.skeleton.phases.filter((ph) => ph.milestone.handIn === 'link');
  const phId = S.handinPhase && milestones.some((m) => m.id === S.handinPhase) ? S.handinPhase : milestones[0]?.id;
  const ph = milestones.find((m) => m.id === phId);
  const canFeedback = ['running', 'assessing'].includes(p.status);
  return `<div class="seg" role="group" aria-label="Milestone">${milestones.map((m) => `<button type="button" data-handin="${esc(m.id)}" aria-pressed="${m.id === phId}">${esc(m.milestone.title)}</button>`).join('')}</div>
    <p class="muted">${esc(ph.milestone.deliverable)} · due ${esc(fmtDay(p.due?.[ph.id]) || 'no date')}</p>
    <div class="stack">${S.groups.map((g) => {
      const s = S.subs.find((x) => x.id === `${g.id}_${ph.id}`);
      if (!s) return `<div class="box"><strong>${esc(g.name)}</strong> <span class="muted">· nothing handed in yet</span></div>`;
      const fbs = Object.entries(s.feedback ?? {});
      const mine = s.feedback?.[user.uid]?.text ?? '';
      const k = `fb-${g.id}-${ph.id}`;
      return `<div class="box stack">
        <div class="row"><strong>${esc(g.name)}</strong><span class="muted small">${esc(fmtDate(s.submittedAt))} · by ${esc(nick(s.submittedBy))}</span></div>
        <p><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.link)}</a></p>
        ${s.blurb ? `<p><em>${esc(s.blurb)}</em></p>` : ''}
        <p>${esc(s.reflection) || '<span class="muted">No reflection.</span>'}</p>
        <p class="muted small">Worked on it: ${s.contributors.map((c) => esc(nick(c))).join(', ')}</p>
        ${fbs.filter(([uid]) => uid !== user.uid).map(([, f]) => `<p class="feedback"><strong>${esc(f.name)}:</strong> ${esc(f.text)}</p>`).join('')}
        ${canFeedback ? `<div class="field"><label for="${k}">Your feedback</label><textarea id="${k}" rows="3" maxlength="600" data-k="${k}">${esc(val(k, mine))}</textarea></div>
          <p><button class="btn sm" type="button" data-feedback="${esc(g.id)}" data-phase="${esc(ph.id)}" ${off()}>Save feedback</button></p>`
          : mine ? `<p class="feedback"><strong>You:</strong> ${esc(mine)}</p>` : ''}
      </div>`;
    }).join('')}</div>`;
}

// ---- plan --------------------------------------------------------------------------------------------------
function planView() { return skeletonView(S.p.skeleton, S.p.due ?? {}); }

/** A skeleton, readable: used by the Plan tab and by the admin's template preview. */
function skeletonView(sk, due = {}, { print = true } = {}) {
  const b = sk.basics; const p = { due };
  return `<div class="box stack">
      <p class="dq">${esc(b.drivingQuestion)}</p>
      <p>${esc(b.summary)}</p>
      <p><strong>Brief for the groups:</strong> ${esc(b.brief)}</p>
      <p><strong>Product:</strong> ${esc(b.product.description)}</p>
      <p><strong>Audience:</strong> ${esc(b.audience)}</p>
      <p class="muted small">${esc(b.subjects.map((s) => s.name).join(', '))} · ${b.duration.amount} ${b.duration.unit} · ages ${b.level.ageMin}-${b.level.ageMax}${b.level.cefr ? ` · ${b.level.cefr}` : ''} · groups of ${sk.groups.sizeMin}-${sk.groups.sizeMax}</p>
    </div>
    ${sk.groups.briefs.length ? `<h2>Angles for the groups</h2><ul>${sk.groups.briefs.map((x) => `<li><strong>${esc(x.title)}</strong>: ${esc(x.brief)}</li>`).join('')}</ul>` : ''}
    <h2>Phases</h2>
    ${sk.phases.map((ph, i) => `<details class="box" ${i === 0 ? 'open' : ''}><summary><strong>${i + 1}. ${esc(ph.title)}</strong> <span class="muted">· ${ph.lessons} lesson${ph.lessons === 1 ? '' : 's'}${p.due?.[ph.id] ? ` · due ${esc(fmtDay(p.due[ph.id]))}` : ''}</span></summary>
      <div class="stack"><p>${esc(ph.goal)}</p><ol>${ph.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p><strong>${esc(ph.milestone.title)}:</strong> ${esc(ph.milestone.deliverable)}</p></div></details>`).join('')}
    <h2>Roles</h2>
    <ul>${sk.roles.map((r) => `<li><strong>${esc(r.name)}</strong>${r.optional ? ' (in larger groups)' : ''}: ${esc(r.responsibility)}</li>`).join('')}</ul>
    <h2>Criteria</h2>
    <div class="table-wrap"><table class="grid-table">
      <thead><tr><th scope="col">Criterion</th><th scope="col">1</th><th scope="col">2</th><th scope="col">3</th><th scope="col">4</th></tr></thead>
      <tbody>${sk.assessment.criteria.map((c) => `<tr><th scope="row">${esc(c.name)}<br><span class="muted small">${esc(c.subject === 'all' ? 'All subjects' : c.subject)} · weight ${c.weight}${c.peer ? ' · peers score it' : ''}</span></th>
        ${[1, 2, 3, 4].map((n) => `<td class="small">${esc(c.levels.find((l) => l.score === n)?.descriptor)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    ${sk.handouts.length ? `<h2>Handouts</h2>${sk.handouts.map((h) => `<details class="box handout" id="ho-${esc(h.id)}"><summary><strong>${esc(h.title)}</strong></summary>
      <div class="md">${markdown(h.body)}</div>${print ? `<p><button class="btn sm" type="button" data-print="ho-${esc(h.id)}">Print</button></p>` : ''}</details>`).join('')}` : ''}
    <details class="box"><summary><strong>Teacher notes</strong></summary><div class="stack"><p>${esc(sk.teacherNotes.preparation)}</p>
      <ul>${sk.teacherNotes.variations.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div></details>`;
}

// ---- settings ----------------------------------------------------------------------------------------------
function settingsView() {
  const p = S.p;
  const open = ['running', 'assessing'].includes(p.status);
  const coTeachers = Object.entries(p.coTeacherInfo ?? {});
  const exhibitOn = p.exhibitionUntil && p.exhibitionUntil > Date.now();
  if (!lead()) {
    return `<div class="box stack"><h2>Co-teachers</h2><p>You teach <strong>${esc(p.coTeacherInfo?.[user.uid]?.subject)}</strong> in this project. The lead teacher is ${esc(p.ownerName)}.</p></div>`;
  }
  return `${open ? `<div class="box stack"><h2>Due dates</h2><div class="grid2">${dueFields(p.skeleton.phases)}</div>
      <p><button class="btn" type="button" data-savedue ${off()}>Save the dates</button></p></div>` : ''}
    ${p.status !== 'closed' ? `<div class="box stack"><h2>Co-teachers</h2>
      ${coTeachers.length ? `<ul class="plain">${coTeachers.map(([uid, c]) => `<li class="row"><span>${esc(c.name)} · ${esc(c.subject)}</span>
        <button class="link-btn danger" type="button" data-removeco="${esc(uid)}" ${off()}>Remove</button></li>`).join('')}</ul>` : '<p class="muted">No co-teachers yet.</p>'}
      <p class="muted">A co-teacher gives feedback on hand-ins and scores the criteria of their own subject. Co-teachers need your Hub pass; they sign in with their own free account.</p>
      ${S.inviteLink ? `<div class="field"><label for="invite-link">Invitation link</label><input id="invite-link" type="text" readonly value="${esc(S.inviteLink)}"></div>
        <p class="row"><button class="btn sm" type="button" data-copy="invite-link">Copy</button><span class="muted small">A new link replaces the old one.</span></p>`
        : `<p><button class="btn" type="button" data-invite ${off()}>Create an invitation link</button></p>`}
    </div>` : ''}
    ${p.status !== 'setup' ? `<div class="box stack"><h2>Exhibition page</h2>
      <p class="muted">A page anyone with the link can open: the project title, the group names and each group's product link with its one-line description. No nicknames, no scores.</p>
      ${exhibitOn ? `<p>On until ${esc(fmtDate(p.exhibitionUntil))}.</p>
        ${S.exhibitionLink ? `<div class="field"><label for="exhibit-link">Link</label><input id="exhibit-link" type="text" readonly value="${esc(S.exhibitionLink)}"></div><p><button class="btn sm" type="button" data-copy="exhibit-link">Copy</button></p>`
          : `<p><button class="btn sm" type="button" data-exhibition="link" ${off()}>Show the link</button></p>`}
        <p class="row"><button class="btn sm" type="button" data-exhibition="extend" ${off()}>Extend by 30 days</button>
        <button class="btn sm" type="button" data-exhibition="off" ${off()}>Turn off</button></p>`
        : `<p><button class="btn" type="button" data-exhibition="on" ${off()}>Turn on for 30 days</button></p>`}
    </div>` : ''}
    <div class="box stack"><h2>Save as my template</h2>
      <p class="muted">Keep this project’s plan, tasks and criteria as your own template and start from it next time. Only you see it.</p>
      ${hasAccess(S.entitlements, 'potluck') ? `<div class="field"><label for="tpl-title">Template name</label><input id="tpl-title" type="text" maxlength="80" data-k="tplTitle" value="${esc(val('tplTitle', p.title))}"></div>
        <p><button class="btn sm" type="button" data-savetemplate ${off()}>Save as my template</button></p>`
        : `<p class="note">Own templates need a Hub pass. <a href="${esc(HUB_ACCOUNT_URL)}" target="_blank" rel="noopener">Get a Hub pass</a></p>`}
    </div>
    ${p.status === 'running' ? `<div class="box stack"><h2>Assessment</h2><p>When the groups have presented, start the assessment: students fill in the self-assessment, rate their teammates and score the other groups' products. The board and hand-ins close.</p>
      <p><button class="btn primary" type="button" data-startassess ${off()}>Start the assessment</button></p></div>` : ''}
    ${p.status === 'assessing' ? `<div class="box stack"><h2>Close the project</h2><p>Closing stops the project code. Download the summary first: student data (nicknames, hand-ins, assessments) is deleted 90 days after closing.</p>
      <p><button class="btn primary" type="button" data-close ${off()}>Close the project</button></p></div>` : ''}
    ${p.status === 'closed' ? `<div class="box"><p>Closed on ${esc(fmtDate(p.closedAt))}. Student data is deleted on ${esc(fmtDate(p.deleteAt?.toMillis?.() ?? null))}.</p></div>` : ''}`;
}

// ---- assess ------------------------------------------------------------------------------------------------
function myCriteria() {
  const coSubjects = Object.values(S.p.coTeacherInfo ?? {}).map((c) => c.subject).filter((x) => x !== S.p.leadSubject);
  return lead() ? P.criteriaFor(S.p.skeleton, { lead: true, coSubjects })
    : P.criteriaFor(S.p.skeleton, { lead: false, subject: S.p.coTeacherInfo?.[user.uid]?.subject });
}
function assessView() {
  const crit = myCriteria();
  const selfDone = S.assess.filter((a) => a.kind === 'self').length;
  const contrib = S.assess.filter((a) => a.kind === 'contribution').length;
  const peer = S.assess.filter((a) => a.kind === 'peer').length;
  return `<p class="muted">Self-assessments ${selfDone}/${S.students.length} · teammate ratings ${contrib} · peer scores ${peer}</p>
    <p class="muted">You score: ${crit.map((c) => esc(c.name)).join(', ') || 'no criteria'}.</p>
    ${S.groups.map((g) => {
      const mine = S.assess.find((a) => a.kind === 'teacher' && a.rater === user.uid && a.groupId === g.id);
      const product = S.subs.find((x) => x.groupId === g.id && x.phaseId === P.productPhase(S.p.skeleton)?.id);
      return `<div class="box stack"><div class="row"><h2>${esc(g.name)}</h2>${mine ? chip('Scored', 'ok') : ''}</div>
        ${product ? `<p><a href="${esc(product.link)}" target="_blank" rel="noopener noreferrer">Open the product</a></p>` : '<p class="muted">No product handed in.</p>'}
        ${crit.map((c) => `<fieldset class="field crit"><legend>${esc(c.name)}</legend>
          ${c.levels.map((l) => `<label class="check"><input type="radio" name="sc-${esc(g.id)}-${esc(c.id)}" value="${l.score}" data-k="sc-${esc(g.id)}-${esc(c.id)}" ${String(val(`sc-${g.id}-${c.id}`, mine?.scores?.[c.id] ?? '')) === String(l.score) ? 'checked' : ''}> <strong>${l.score}</strong> ${esc(l.descriptor)}</label>`).join('')}
        </fieldset>`).join('')}
        <div class="field"><label for="cm-${esc(g.id)}">Comment for the group</label><textarea id="cm-${esc(g.id)}" rows="2" maxlength="600" data-k="cm-${esc(g.id)}">${esc(val(`cm-${g.id}`, mine?.comment ?? ''))}</textarea></div>
        <p><button class="btn" type="button" data-score="${esc(g.id)}" ${off()}>Save the scores</button></p>${ai.feedbackSection(g)}</div>`;
    }).join('')}`;
}

// ---- summary -----------------------------------------------------------------------------------------------
function summaryView() {
  const sum = S.summary;
  if (!sum) return `<p><button class="btn" type="button" data-summary ${off()}>Show the summary</button></p>`;
  const crit = S.p.skeleton.assessment.criteria;
  const peerCrit = crit.filter((c) => c.peer);
  const exp = sum.exportOk
    ? `<p class="row no-print"><button class="btn" type="button" data-csv ${off()}>Download CSV</button><button class="btn" type="button" data-printsummary>Print or save as PDF</button>
      <button class="btn" type="button" data-summary ${off()}>Refresh</button></p>`
    : `<p class="note no-print">Export (CSV, PDF) needs a Hub pass. <a href="${esc(HUB_ACCOUNT_URL)}" target="_blank" rel="noopener">Get a Hub pass</a> · <button class="link-btn" type="button" data-summary>Refresh</button></p>`;
  return `${exp}<div id="summary-print" class="stack">
    <h2>${esc(S.p.title)}: groups</h2>
    <div class="table-wrap"><table class="grid-table">
      <thead><tr><th scope="col">Group</th><th scope="col">Score</th>${crit.map((c) => `<th scope="col">${esc(c.name)}</th>`).join('')}${peerCrit.map((c) => `<th scope="col">${esc(c.name)} (peers)</th>`).join('')}</tr></thead>
      <tbody>${sum.summary.groups.map((g) => `<tr><th scope="row">${esc(g.name)}</th><td>${g.teacherPercent === null ? '-' : `${g.teacherPercent}%`}</td>
        ${crit.map((c) => `<td>${g.teacher[c.id] ?? '-'}</td>`).join('')}${peerCrit.map((c) => `<td>${g.peer[c.id] ?? '-'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <h2>Students</h2>
    <div class="table-wrap"><table class="grid-table">
      <thead><tr><th scope="col">Nickname</th><th scope="col">Group</th><th scope="col">Group score</th><th scope="col">Contribution (1-4)</th><th scope="col">Self-assessment</th></tr></thead>
      <tbody>${sum.summary.students.map((s) => `<tr><th scope="row">${esc(s.nickname)}</th><td>${esc(s.groupName)}</td><td>${s.groupPercent === null ? '-' : `${s.groupPercent}%`}</td>
        <td>${s.contribution ?? '-'} <span class="muted small">(${s.contributionCount})</span></td><td>${s.selfDone ? 'done' : '-'}</td></tr>`).join('')}</tbody>
    </table></div>
    ${sum.summary.groups.some((g) => g.comments.length) ? `<h2>Teacher comments</h2>${sum.summary.groups.filter((g) => g.comments.length).map((g) => `<p><strong>${esc(g.name)}:</strong> ${g.comments.map((c) => esc(c.comment)).join(' / ')}</p>`).join('')}` : ''}
  </div>`;
}

// ---- render ------------------------------------------------------------------------------------------------
function render() {
  if (user === undefined) { $app.innerHTML = `${header()}<main class="signin"><p class="muted">${esc(TT.loading)}</p></main>`; return; }
  if (user && S.view === 'project') setHash();
  keepFocus($app, () => { $app.innerHTML = !user ? signInView() : S.view === 'project' ? projectView() : S.view === 'idea' ? `${topbar()}<main class="page stack">${errorLine()}${ai.ideaView()}</main>` : S.view === 'admin' ? `${topbar()}<main class="page stack">${errorLine()}${flashLine()}${admin.view()}</main>` : homeView(); });
}

function printPart(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'DETAILS') el.open = true;
  el.classList.add('print-target'); document.body.classList.add('print-one');
  const done = () => { el.classList.remove('print-target'); document.body.classList.remove('print-one'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}

// ---- AI parts (teacher-ai.js) ------------------------------------------------------------------------
const ai = aiModule({
  S, val, clear, act, call, render, tz, lead, openProject, closeProject, hubAccountUrl: HUB_ACCOUNT_URL,
});
const admin = adminModule({ S, D, val, clear, act, call, render, closeProject, skeletonView });

// ---- events ------------------------------------------------------------------------------------------------
$app.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  const d = el.dataset;
  if ('google' in d) return step(googleSignIn);
  if ('reset' in d) return step(() => resetPassword($app.querySelector('[data-email]').email.value.trim()));
  if ('testteacher' in d) return step(() => testTeacherSignIn(d.testteacher));
  if (ai.onClick(d)) return;
  if (admin.onClick(d)) return;
  if (d.deltemplate) {
    if (!confirm('Delete this template? Projects started from it stay as they are.')) return;
    return act('deltemplate', () => call('plDeleteTemplate', { id: d.deltemplate }));
  }
  if ('savetemplate' in d) return act('savetemplate', async () => { await call('plSaveAsTemplate', { projectId: S.pid, title: val('tplTitle', S.p.title) }); clear('tplTitle'); S.flash = 'Saved. It is under Your templates on the start page.'; });
  if ('signout' in d) { closeProject(); S.view = 'home'; setHash(); return signOut(fb.auth); }
  if ('home' in d) { closeProject(); S.view = 'home'; S.error = ''; setHash(); return render(); }
  if (d.open) { S.invite = null; S.error = ''; return openProject(d.open); }
  if (d.tab) { S.tab = d.tab; S.error = ''; S.flash = ''; setHash(); render(); return window.scrollTo(0, 0); }
  if (d.handin) { S.handinPhase = d.handin; return render(); }
  if ('dropinvite' in d) { S.invite = null; return render(); }
  if (d.create) {
    return act('create', async () => {
      const { projectId } = await call('plCreateProject', { templateId: d.create, timeZone: tz() });
      openProject(projectId);
    });
  }
  if ('acceptinvite' in d) {
    return act('accept', async () => {
      const { projectId } = await call('plAcceptInvite', { invite: S.invite.token, subject: val('invSubject', S.invite.subjects[0]) });
      S.invite = null; openProject(projectId);
    });
  }
  if ('savesetup' in d) return act('save', async () => { await call('plUpdateProject', setupPayload()); clear(''); S.flash = 'Saved.'; });
  if ('launch' in d) {
    return act('launch', async () => {
      await call('plUpdateProject', setupPayload()); clear('');
      await call('plLaunch', { projectId: S.pid });
      S.tab = 'monitor'; S.flash = 'The project is running. Show the code to your students.';
    });
  }
  if ('savedue' in d) return act('due', async () => { await call('plUpdateProject', { projectId: S.pid, due: dueFromDrafts() }); clear('due-'); S.flash = 'Dates saved.'; });
  if (d.decide) return act('decide', () => call('plDecideJoin', { projectId: S.pid, requestId: d.decide, approve: d.approve === '1' }));
  if (d.rename) return act('rename', async () => { await call('plRenameGroup', { projectId: S.pid, groupId: d.rename, name: val(`rename-${d.rename}`) }); clear(`rename-${d.rename}`); });
  if ('addgroup' in d) return act('addgroup', async () => { await call('plAddGroup', { projectId: S.pid, name: val('newgroup') }); clear('newgroup'); });
  if (d.removestudent) {
    if (!confirm(`Remove ${nick(d.removestudent)} from the project? Their tasks become unclaimed.`)) return;
    return act('remove', () => call('plRemoveStudent', { projectId: S.pid, sid: d.removestudent }));
  }
  if (d.feedback) {
    const k = `fb-${d.feedback}-${d.phase}`;
    return act('feedback', async () => { await call('plFeedback', { projectId: S.pid, groupId: d.feedback, phaseId: d.phase, text: val(k) }); clear(k); S.flash = 'Feedback saved.'; });
  }
  if ('invite' in d) return act('invite', async () => { const { invite } = await call('plCreateInvite', { projectId: S.pid }); S.inviteLink = `${location.origin}/teacher.html#invite=${invite}`; });
  if (d.removeco) {
    if (!confirm('Remove this co-teacher from the project?')) return;
    return act('removeco', () => call('plRemoveCoTeacher', { projectId: S.pid, uid: d.removeco }));
  }
  if (d.copy) { const inp = document.getElementById(d.copy); inp.select(); navigator.clipboard?.writeText(inp.value).catch(() => {}); S.flash = 'Copied.'; return render(); }
  if (d.exhibition) {
    return act('exhibition', async () => {
      const r = await call('plExhibition', { projectId: S.pid, action: d.exhibition });
      S.exhibitionLink = r.link ? `${publicBaseUrl()}/exhibit.html#${r.link}` : (d.exhibition === 'off' ? '' : S.exhibitionLink);
    });
  }
  if ('startassess' in d) {
    if (!confirm('Start the assessment? The board and the hand-ins close for the students.')) return;
    return act('assess', async () => { await call('plStartAssessment', { projectId: S.pid }); S.tab = 'assess'; });
  }
  if ('close' in d) {
    if (!confirm('Close the project? The code stops working, and student data is deleted in 90 days.')) return;
    return act('close', async () => { await call('plCloseProject', { projectId: S.pid }); S.tab = 'summary'; });
  }
  if (d.score) {
    const g = d.score;
    const scores = {};
    for (const c of myCriteria()) {
      const picked = $app.querySelector(`input[name="sc-${CSS.escape(g)}-${CSS.escape(c.id)}"]:checked`);
      if (picked) scores[c.id] = Number(picked.value);
    }
    return act('score', async () => { await call('plTeacherScore', { projectId: S.pid, groupId: g, scores, comment: val(`cm-${g}`, $app.querySelector(`#cm-${CSS.escape(g)}`)?.value ?? '') }); clear(`sc-${g}-`); clear(`cm-${g}`); S.flash = 'Scores saved.'; });
  }
  if ('summary' in d) return act('summary', async () => { S.summary = await call('plSummary', { projectId: S.pid }); });
  if ('csv' in d) {
    return act('csv', async () => {
      const r = await call('plSummary', { projectId: S.pid, csv: true });
      S.summary = r;
      if (r.csv) download(`${S.p.title.replace(/[^\w-]+/g, '-').toLowerCase()}-summary.csv`, r.csv);
    });
  }
  if ('printsummary' in d) return printPart('summary-print');
  if (d.print) return printPart(d.print);
});

$app.addEventListener('change', (e) => {
  const sid = e.target.dataset?.assign;
  if (sid) act('assign', () => call('plAssignStudent', { projectId: S.pid, sid, groupId: e.target.value || null }));
  if (e.target.dataset?.k === 'gcount') render();
  if (e.target.dataset?.angle) act('angle', () => call('plSetGroupBrief', { projectId: S.pid, groupId: e.target.dataset.angle, briefId: e.target.value || null }));
  if ('tplfile' in (e.target.dataset ?? {})) admin.readFile(e.target);
});

$app.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if ('email' in f.dataset) step(() => emailSignIn(f.email.value.trim(), f.password.value));
});

// ---- start ---------------------------------------------------------------------------------------------------
async function loadInvite(token) {
  try { S.invite = { ...(await call('plInviteInfo', { invite: token })), token }; } catch (e) { S.invite = { error: errorText(e) }; }
  render();
}

render();
onAuthStateChanged(fb.auth, async (u) => {
  const next = u && !u.isAnonymous && !(await u.getIdTokenResult()).claims.plStudent ? u : null;
  if (!next && ssoPending && await ssoPending) return;
  user = next;
  subs.home?.(); subs.home = null;
  subs.account.forEach((u) => u()); subs.account = [];
  if (!user) { closeProject(); S.view = 'home'; render(); return; }
  SI.email = ''; SI.note = ''; SI.error = '';
  watchHome();
  watchAccount();
  const h = readHash();
  if (h.invite) { history.replaceState(null, '', location.pathname); loadInvite(h.invite); }
  if (h.p) openProject(h.p, h.tab); else render();
});
