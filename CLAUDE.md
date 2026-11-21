# Potluck

Group projects where everyone brings something: a classroom-tested project template that AI fits to the class,
then one board that runs the project, from tasks and link hand-ins to self, peer and teacher assessment.
One app under Mr. Andrew's EdTech Hub.

## Read first

- `SPEC.md` is the single source of truth. If code and spec disagree, stop and ask.
- `DEVLOG.md` records every phase, decision and deviation. Keep it current.
- Template sources: the owner's teacher publications in the Hub repo, `D:\dev\Edtechhub\alapanyagok\` (Hungarian
  .docx, gitignored there). Translate and make them international; never copy them into this repo.
- **First step of every session:** `git fetch` and `git status -sb`. If `dev` is behind `origin/dev`, `git pull`
  first; ask if there are local changes. Work happens on more than one machine.

## How we work

- Talk to András in Hungarian. Code, comments, commit messages, docs and all product text are in English.
- Work in phases P0 to P4 (SPEC section 13). They are a build order, not release levels: the whole product is
  built, then published. Never suggest an "MVP / later" split. After each phase: write the DEVLOG entry, show what
  was built and how it was verified, then STOP and wait for approval. Never start the next phase on your own.
- Ask before any step that has more than one reasonable outcome. Do not guess. Open questions (SPEC section 14) are
  András's to answer.
- Report honestly: say what was tested, what was not, and what failed.

## Branches and deploys

- All work happens on the `dev` branch. `main` is production (Cloudflare Pages, once set up): every push to `main`
  goes live. Never commit to, push to, or merge into `main` without András's explicit approval.
- No Netlify. Testing happens locally and on the live address, which is noindex until the Hub lists Potluck.

## Rules that must not be broken

1. **One skeleton.** Every project is `engines/skeleton.js`. Every screen reads the skeleton; every model output
   is validated with `validateSkeleton` (or the part's schema) before it is saved. The model never decides
   structure and never returns free text where a field is expected.
2. **AI only for the teacher, at the start and at the end.** No model call while a project runs, none for students.
3. **No model API key in the client.** Model calls only in Cloud Functions, which spend credits first and refund
   on failure (Hub `credits.js` pattern).
4. **Students have no accounts:** project code + nickname, custom token with the `plStudent` claim; a new device
   needs the teacher's approval.
5. **Hand-ins are links.** No file upload.
6. Students never see other groups' assessments, and contribution ratings are anonymous.

## Stack

- Front end: vanilla JS (ES modules), HTML, CSS. No framework, no bundler. `public/` is the site;
  `scripts/build-web.mjs` copies `public/` + `engines/` into `dist/` for hosting.
- Firebase project `mrashub` (shared with the Hub and the other apps; never create a new one).
  - Auth: teachers with Google or e-mail (Hub accounts, SSO from the Hub); students with a custom token.
  - Firestore: only `pl`-prefixed collections. `users/{uid}` and `creditLedger` belong to the Hub: read only, except
    the credit spend/refund the Hub's credit pattern prescribes (copy of the Hub's `shared/credits.js`).
  - Cloud Functions: codebase `potluck`, Node 22, 2nd gen, europe-west1. Secrets in Secret Manager.
- Firebase config: `public/js/config.js`, values from the Hub's `D:\dev\Edtechhub\shared\firebase-config.js`.
  Never invent or leave out a field. Firebase JS SDK 12.6.0 from gstatic (as Hubbaloo).
- Model: `gemini-3.8-flash` (set by András for every Hub project). Use this exact name. If it is unavailable, stop
  and tell András; do not pick a substitute. Structured output with `SKELETON_SCHEMA` (or a part of it); prompts are
  versioned files in the repo.
- Deploy only this app's parts: `firebase deploy --only functions:potluck`. Never deploy Firestore or Storage
  rules from this repo; a predeploy hook blocks it.
- Do not add dependencies without asking. Front end and engines stay dependency-free; tests use `node:test`.

## Connection to the EdTech Hub

- Shared rules have a single source: the Hub repo at `D:\dev\Edtechhub` (branch `dev`). Read its `CLAUDE.md` and
  `docs/spec-v1.md` ("Firestore adatmodell", "Kreditek", "Közös Auth és app-integráció", "Security Rules",
  "Potluck – projekt-app", in Hungarian) when work touches accounts, credits, entitlements or rules.
- Sister apps with the same setup, useful as working examples (read only, never change them from here): WordNerd
  `D:\dev\wordnerd` (the closest: same repo layout), Hubbaloo `D:\dev\Hubbaloo` (teacher sign-in page, code +
  nickname students, credits), Quiz of the Damned `D:\dev\QotD` (Gemini calls in `functions/gemini.js`).
- Firestore rules: the Potluck block goes into the Hub's `firestore.rules` between `// ---- Potluck` and
  `// ---- end Potluck`. The copies here (`firestore.rules`, `storage.rules`) are for the emulators only. Changing
  the Hub's means a commit in the Hub repo and a deploy from there; ask András before doing either.
- Before launch the Hub's `shared/sso.js` needs `https://potluck.mrandrewshub.com` in `APP_ORIGINS` / `APP_NAMES`
  (a Hub change, then `npm run sync:hub` here). Local development works already (localhost is allowed).
- Work that touches both repos: commit each repo separately on its own `dev` branch.

## Brand

- "Picnic cloth + stickers" (2026-11-21): the rules are in `design/POTLUCK-DESIGN.md`, the mockup (zip) next to it
  is the reference. Follow the brief for every new screen: ink outlines, hard offset shadows only on top-level
  objects, gingham only in the header, text never directly on gingham, tomato as text only at headline size.
- Raw tokens only in `public/css/tokens.css`, role variables (`--c-*`) only in `public/css/base.css`; page and
  component styles in `public/css/app.css`. The header comes from `header()` in `public/js/ui.js`.
- Hub voice in all UI text: teacher to teacher, short concrete sentences, sentence case, buttons start with a verb,
  no exclamation marks, no emoji.

## Commands

- Static dev server: `npm run serve` (http://localhost:5175; serves `public/` and `/engines/`)
- Teacher page: http://localhost:5175/teacher.html (with the emulators running it shows the test-teacher button)
- Emulators: `npm run emulators` (auth, firestore, functions; needs the Firebase CLI)
- Unit tests: `npm test` (`node:test`, no dependencies)
- Model in the emulator: a mock by default (free). For real calls put `PL_MOCK_MODEL=false` in
  `functions/.env.local` (gitignored) and restart the emulators; the key is in `functions/.secret.local`. Remove
  the line afterwards. Model calls are logged as `pl-model` lines (step, attempt, tokens).
- Hub shared modules: `npm run sync:hub` copies the Hub's `shared/entitlements.js`, `credits.js` into
  `engines/hub/` and `sso.js` into `public/js/hub/` (`--check` only reports); never edit the copies.
- Copy engines into functions/: `npm run sync:engines` (automatic before a functions deploy)
- Static build (what hosting runs): `npm run build:web` → `dist/`
- Deploy (only with András's approval): `firebase deploy --only functions:potluck`
