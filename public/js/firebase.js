// Firebase for the browser: Auth, Firestore and Functions (Firebase JS SDK 12.6.0 from gstatic, as the
// sister apps). Web config values are not secrets; Security Rules protect the data.
// Emulators on localhost and on private LAN addresses (phones testing against the dev machine).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js';
import { firebaseConfig, FUNCTIONS_REGION } from './config.js';

const host = location.hostname;
const LAN = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
export const USE_EMULATORS = host === 'localhost' || host === '127.0.0.1' || LAN.test(host);

/**
 * One Firebase app per page kind. The student page (P1) gets its own named app, so a student sign-in
 * never touches (or signs out) a teacher's session in the same browser.
 */
export function firebase(name = '[DEFAULT]') {
  const app = initializeApp(firebaseConfig, name);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const fns = getFunctions(app, FUNCTIONS_REGION);
  if (USE_EMULATORS) {
    // The Auth emulator on the page's own host name, so a sign-in never crosses sites.
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    const emu = host === 'localhost' ? '127.0.0.1' : host;
    connectFirestoreEmulator(db, emu, 8080);
    connectFunctionsEmulator(fns, emu, 5001);
  }
  /** Calls a Cloud Function; a refusal throws an Error with `reason` (from details) and a short `code`. */
  const call = async (fn, data, options = {}) => {
    try {
      return (await httpsCallable(fns, fn, options.timeout ? { timeout: options.timeout } : undefined)(data)).data;
    } catch (e) {
      const err = new Error(e.message);
      err.code = String(e.code ?? 'unknown').replace(/^functions\//, '');
      err.reason = e.details?.reason
        ?? (err.code === 'deadline-exceeded' ? 'timeout' : err.code === 'unavailable' || err.code === 'internal' ? 'network' : 'unknown');
      throw err;
    }
  };
  return { app, auth, db, call };
}
