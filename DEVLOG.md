# Potluck – DEVLOG

## P0 – Skeleton (2026-11-21)

**Decisions (András, 2026-11-21)**
- Name Potluck, tagline "Group projects where everyone brings something.", hero text from András (SPEC 12).
  Address `potluck.mrandrewshub.com`; entitlement key, price-key prefix and functions codebase `potluck`;
  Firestore prefix `pl`.
- No version split: the whole product is built, then published; phases are a build order.
- Brand: placeholder for now (neutral tokens, text wordmark); Potluck's own brand before P4.
- GitHub: private repo `mistagee83/potluck`, branch `dev`. Hosting: Cloudflare Pages, no Netlify (WordNerd pattern).
- Hand-ins are links only; final AI feedback one call per group; one active project without a Hub pass; data
  deleted 90 days after closing; templates in Potluck's own admin; exhibition page and landing page are in;
  co-teachers need the lead teacher's Hub pass; own ideas through an idea form mapped onto the skeleton.

**Built**
- Repo skeleton on the WordNerd pattern: `package.json` (no dependencies), `firebase.json` (codebase `potluck`,
  emulators, deny-deploy hooks for Firestore/Storage rules), `.firebaserc` (`mrashub`), `.gitignore`.
- Scripts: `serve.mjs` (port 5175), `build-web.mjs` (`public/` + `engines/` → `dist/`), `sync-hub.mjs` (Hub
  `entitlements.js`, `credits.js`, `sso.js` copied in), `sync-engines.mjs`, `deny-deploy.mjs`.
- **Project skeleton** `engines/skeleton.js`: `SKELETON_SCHEMA` in the JSON Schema subset the model API accepts
  (the same object goes to the model and validates its output), `validate` (shape, unknown fields rejected),
  `checkSkeleton` (ids, references, lesson totals, tasks per phase, roles vs group size, criteria subjects and
  levels, a peer criterion, a link hand-in), `validateSkeleton`.
- **The anti-guidebook** in the skeleton (`engines/templates/anti-guidebook.js`), translated and made international
  from the March 2026 publication: 4 lessons, 5 phases with milestones (4 link hand-ins + the presentation),
  4 roles (scout optional), 15 tasks, 5 criteria with 4 levels each (3 peer-scored), self and contribution
  questions, 2 handouts (AI editor prompt card, tip hunting sheet), teacher notes with 3 variations.
- Teacher page `public/teacher.html` + `js/teacher.js`: Hub sign-in panel (Google, e-mail/password, password
  reset, "Create your account" → Hub `/account?signup=1&return=…`), Hub SSO (`#sso=` → `redeemSsoCode` →
  custom token), emulator test teacher; signed in it lists the built-in templates from the skeleton.
- Placeholder landing `public/index.html` with the hero text (noindex), `config.js` (Firebase web config, all six
  fields checked against the Hub's), `firebase.js` (Auth, Firestore, Functions; emulators on localhost/LAN),
  `_headers` (Cloudflare Pages, noindex, no-cache).
- `functions/` stub without dependencies (added in P1).
- Emulator copy of the Hub's rules with a draft `// ---- Potluck` block: `plTeacher()` (teacher without the
  `plStudent` claim), `plTemplates` read for shared and own templates, `plProjects` closed until P1.

**Verified**
- `npm test`: 12 tests pass (every template valid; shape errors: missing, unknown, too long, enum, type, empty,
  list sizes, nullable; meaning errors: references, duplicates, lesson total, empty phase, roles vs group size,
  criteria subject/levels/peer, link hand-in, ages, weeks; the schema uses only model-API keywords).
- Browser (built-in browser, local server + Auth/Firestore emulators; the Firestore emulator loaded the rules
  with the Potluck block): test teacher signed in, template card shown, signed out, wrong password shows
  "The e-mail or the password is not right."; 375 px wide without overflow; landing placeholder renders.
- `npm run build:web` builds `dist/` with `engines/`; `sync:hub --check` up to date.

**Not tested**
- Google sign-in and the Hub SSO link (need the real Auth and the Hub's functions; the Hub's `APP_ORIGINS`
  allows localhost, so it can be tried locally against production Auth, or after launch).

**Not done / next**
- Hosting (Cloudflare Pages project), the Hub's `APP_ORIGINS` / `APP_NAMES`, Auth authorized domains: P4.
- The Potluck rules block in the Hub's `firestore.rules`: with András's approval, when P1 needs it.
- P1 (logic without AI) waits for approval.
