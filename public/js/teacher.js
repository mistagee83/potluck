// Potluck teacher page (P0): sign-in with the Mr. Andrew's Hub account (Google or e-mail; one click from
// the Hub with #sso=<code>), then the built-in templates read from the project skeleton. Projects,
// groups, the board and the monitor come in P1.
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithCustomToken,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { ONE_ACCOUNT_TEXT, authErrorText, isEmail, hubAccountUrl, redeemSso, takeSsoCode } from './hub/sso.js';
import { firebase, USE_EMULATORS } from './firebase.js';
import { TT, t, esc } from './text.js';
import { TEMPLATES } from '/engines/templates/index.js';

const $app = document.getElementById('app');
const fb = firebase();

let user; // undefined: not known yet, null: signed out
const SI = { email: '', note: '', error: '', busy: false };

// ---- sign-in: one Hub account for every app (Hub spec "Egy fiók, közös belépés") -------------------
// Google (popup first, redirect only if popups are blocked) or e-mail and password. New e-mail accounts
// are made on the Hub (/account?signup=1), which sends the teacher back here signed in.
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
  SI.note = t(TT.signin.resetSent, { email }); // the same answer whether or not the account exists
}
// One click from the Hub: started before the first auth state; signed out while it runs = still loading.
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
// Emulator only: a local test teacher. The account exists only in the Auth emulator.
const TEST_TEACHER = { email: 'test-teacher@potluck.test', password: 'emulator-only-teacher' };
async function testTeacherSignIn() {
  try { await signInWithEmailAndPassword(fb.auth, TEST_TEACHER.email, TEST_TEACHER.password); } catch {
    await createUserWithEmailAndPassword(fb.auth, TEST_TEACHER.email, TEST_TEACHER.password);
  }
}

// ---- views ------------------------------------------------------------------------------------------
const wordmark = () => `<a class="wordmark" href="/">Pot<span>luck</span></a>`;

function signInView() {
  const T = TT.signin;
  const off = SI.busy ? 'disabled' : '';
  const signup = hubAccountUrl({ signup: true, returnTo: `${location.origin}${location.pathname}` });
  return `<main class="signin">
    <div class="brand">${wordmark()}</div>
    <div class="box signin-card">
      <h1>${esc(T.title)}</h1>
      <p class="signin-lead">${esc(ONE_ACCOUNT_TEXT)}</p>
      ${SI.error ? `<p class="error" role="alert">${esc(SI.error)}</p>` : ''}
      ${SI.note ? `<p class="note" role="status">${esc(SI.note)}</p>` : ''}
      <button class="btn primary" type="button" data-google ${off}>${esc(T.google)}</button>
      <p class="signin-or">${esc(T.or)}</p>
      <form class="signin-form" data-email novalidate>
        <div class="field"><label for="si-email">${esc(T.email)}</label>
          <input id="si-email" type="email" name="email" autocomplete="email" inputmode="email" required value="${esc(SI.email)}"></div>
        <div class="field"><label for="si-password">${esc(T.password)}</label>
          <input id="si-password" type="password" name="password" autocomplete="current-password" required></div>
        <button class="btn" type="submit" ${off}>${esc(T.submit)}</button>
      </form>
      <p class="signin-links"><button class="link-btn" type="button" data-reset ${off}>${esc(T.forgot)}</button></p>
      <p class="signin-links">${esc(T.newHere)} <a href="${esc(signup)}">${esc(T.create)}</a></p>
    </div>
    ${USE_EMULATORS ? `<button class="btn" type="button" data-testteacher ${off}>${esc(TT.testTeacher)}</button>` : ''}
    <p class="signin-links"><a href="/">${esc(T.home)}</a></p>
  </main>`;
}

function templateCard({ skeleton: sk }) {
  const b = sk.basics;
  const time = t(b.duration.unit === 'weeks' ? TT.weeks : TT.lessons, { n: b.duration.amount });
  const facts = [
    b.subjects.map((s) => s.name).join(', '), time,
    t(TT.ages, { min: b.level.ageMin, max: b.level.ageMax }),
    t(TT.groupSize, { min: sk.groups.sizeMin, max: sk.groups.sizeMax }),
    t(TT.phases, { n: sk.phases.length }),
  ];
  return `<article class="box card stack">
    <h3>${esc(b.title)}</h3>
    <p class="muted facts">${esc(facts.join(' · '))}</p>
    <p class="dq">${esc(b.drivingQuestion)}</p>
  </article>`;
}

function homeView() {
  return `<header class="topbar">${wordmark()}
      <span class="muted who">${esc(user.email ?? user.displayName ?? '')}</span>
      <button class="link-btn" type="button" data-signout>${esc(TT.signOut)}</button></header>
    <main class="page stack">
      <h1>${esc(TT.templatesTitle)}</h1>
      <p class="muted">${esc(TT.templatesLead)}</p>
      <div class="cards">${TEMPLATES.map(templateCard).join('')}</div>
    </main>`;
}

function render() {
  if (user === undefined) { $app.innerHTML = `<main class="signin"><div class="brand">${wordmark()}</div><p class="muted">${esc(TT.loading)}</p></main>`; return; }
  $app.innerHTML = user ? homeView() : signInView();
}

// ---- events -------------------------------------------------------------------------------------------
$app.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  const d = el.dataset;
  if ('google' in d) step(googleSignIn);
  else if ('reset' in d) step(() => resetPassword($app.querySelector('[data-email]').email.value.trim()));
  else if ('testteacher' in d) step(testTeacherSignIn);
  else if ('signout' in d) signOut(fb.auth);
});
$app.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if ('email' in f.dataset) step(() => emailSignIn(f.email.value.trim(), f.password.value));
});

render();
onAuthStateChanged(fb.auth, async (u) => {
  const next = u && !u.isAnonymous ? u : null;
  // A Hub sign-in link is being redeemed: stay on the loading screen until it signs the teacher in.
  if (!next && ssoPending && await ssoPending) return;
  user = next;
  if (user) { SI.email = ''; SI.note = ''; SI.error = ''; }
  render();
});
