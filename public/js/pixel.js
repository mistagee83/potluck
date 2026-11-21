// Meta Pixel with cookie consent, the Hub's pattern (Hub shared/pixel.js): the Pixel loads only after "Accept".
// Without a Pixel id (config PIXEL_ID = null) there is no banner and no tracking; track() calls do nothing.
// Events: ViewContent (landing page), Lead (a teacher's first sign-in on the teacher page).
import { PIXEL_ID } from './config.js';

const KEY = 'mra-cookie-consent'; // 'granted' | 'denied' (the same key as the Hub)
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private mode: this visit only */ } };

let loaded = false;
function loadPixel() {
  if (loaded || !PIXEL_ID) return;
  loaded = true;
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

const queue = [];
export function track(event, params = {}) {
  if (loaded && window.fbq) window.fbq('track', event, params);
  else if (PIXEL_ID) queue.push([event, params]);
}

function banner() {
  if (document.querySelector('.cookie-banner')) return;
  const el = document.createElement('div');
  el.className = 'cookie-banner box';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Cookie consent');
  el.innerHTML = `<p>We use a Meta Pixel cookie to measure our ads. Nothing is set unless you accept.
    <a href="https://mrandrewshub.com/privacy">Privacy Policy</a></p>
    <div class="row"><button class="btn" type="button" data-c="denied">Decline</button>
      <button class="btn primary sm" type="button" data-c="granted">Accept</button></div>`;
  el.addEventListener('click', (e) => {
    const v = e.target.closest('[data-c]')?.dataset.c;
    if (!v) return;
    save(v); el.remove();
    if (v === 'granted') { loadPixel(); queue.splice(0).forEach(([ev, p]) => track(ev, p)); }
  });
  document.body.append(el);
}

/** Once per page load. */
export function initConsent() {
  if (!PIXEL_ID) return;
  const c = read();
  if (c === 'granted') loadPixel();
  else if (!c) banner();
}
export const reopenConsent = () => { if (PIXEL_ID) banner(); };
