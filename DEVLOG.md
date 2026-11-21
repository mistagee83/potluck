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

## P1 – Logic without AI (2026-11-21)

**Decisions (András, 2026-11-21)**
- Exhibition page: project title, group names, each group's product link with a one-line description; no
  nicknames, no scores; on for 30 days, the teacher can extend or turn it off.
- Every milestone gets a due date from the teacher at launch (editable later); the monitor flags late groups.
- Co-teachers are invited with a link only (no e-mail sending).
- `firebase-admin` and `firebase-functions` in `functions/` (as the sister apps).
- Brand: "Picnic cloth + stickers" (`design/POTLUCK-DESIGN.md` + mockup), applied in P1 instead of P4.

**Built**
- `engines/project.js` (pure, shared): join codes without look-alike letters, nickname rules and uniqueness key
  (case and accents ignored), link cleaning (http/https only), board tasks per group from the skeleton, milestone
  status (done / late / due / open / in class), flags (late, no activity for 3 days), criteria per teacher, the
  summary (teacher scores averaged per criterion, weighted percent, peer averages, contribution averages, self
  done), CSV with a formula-injection guard.
- Cloud Functions (27 callables, all `pl*`): teacher side `plCreateProject` (one active project without a Hub
  pass), `plUpdateProject`, `plLaunch` (needs every link milestone dated; groups + boards + unique code),
  `plAddGroup`, `plRenameGroup`, `plAssignStudent`, `plRemoveStudent`, `plDecideJoin`, `plFeedback`,
  `plStartAssessment`, `plTeacherScore`, `plCloseProject` (code off, devices deleted, `deleteAt` = +90 days on all
  student data), `plCreateInvite` / `plInviteInfo` / `plAcceptInvite` / `plRemoveCoTeacher` (lead's Hub pass),
  `plExhibition`, `plSummary` (CSV with the lead's Hub pass); student side `plJoin` (new nickname in at once, a
  known nickname from a new device waits for the teacher), `plJoinStatus`, `plLeaveDevice`, `plChooseGroup`,
  `plTask`, `plSubmit`, `plAssess`, `plGallery`; public `plExhibitionView`.
- Students: custom token, uid `pl_<project>_<student>`, claims `plStudent` + `plSid`; devices as SHA-256 hashes in
  `plDevices` (function-only).
- Rules (emulator copy): project members and the project's students read; tasks and hand-ins only for the
  student's own group; a student reads only the assessments they wrote; `plCodes`, `plDevices`, `plSecrets` closed.
- Teacher page: projects, templates, invitation card; per project Setup (title, groups, who forms them, due dates,
  launch), Monitor (groups × milestones, tasks, flags, unassigned students), Groups (assign, move, remove,
  rename, add), Hand-ins (per milestone, feedback per teacher), Plan (phases, roles, criteria, printable handouts,
  teacher notes), Settings (dates, co-teachers, exhibition, start assessment, close), Assess (scores per group on
  this teacher's criteria), Summary (groups, students, CSV, print/PDF). Join requests appear as a banner.
- Student page `join.html`: code + nickname, waiting screen for a new device, choose a group, Board (phases, task
  rows, "I'll bring it", done toggle, own tasks), Hand-ins (link, reflection, who worked on it, one-liner for the
  product), Brief; in the assessment phase Yourself, Teammates, Gallery.
- Exhibition page `exhibit.html#<link>`.
- Brand: tokens, base and app CSS, gingham header with the logo sticker on every page, landing placeholder with
  the brief's hero copy.

**Verified (emulators: auth, firestore, functions; built-in browser)**
- `npm test`: 22 tests pass (skeleton 12, project logic 10).
- Whole flow: create (and the one-active limit without a Hub pass), launch refused without dates then launched,
  three students joined (one through the page on a 375 px phone view), a known nickname from a second device
  waited, the teacher let it in, the token was issued once; assigned to groups, claimed and finished tasks, added
  a task, a `javascript:` link refused, hand-ins with feedback shown to the student; co-teacher invited, refused
  before joining, read the project after, could not launch or close; assessment: self (refused until complete),
  contribution, gallery peer scores, scores by both teachers averaged (natural 3 and 1 → 2, group 86%); summary
  and CSV; exhibition page shown, a wrong token refused; closed: code and devices gone, `deleteAt` on student data.
- Rules: a student cannot read all tasks, another group's tasks, join requests, all assessments, secrets,
  devices, codes or other projects; a teacher who is not a member cannot read the project.
- Phone width (375 px): no horizontal overflow on the student board.

**Not tested / not done**
- Google sign-in and Hub SSO (need the real Auth and the Hub functions).
- Print output of handouts and the summary (print dialog not driven).
- The Potluck rules block is not in the Hub's `firestore.rules` yet, and the TTL policy on `deleteAt` is not set
  up (both are Hub-repo changes, with András's approval). Nothing deployed.
- Mia/Leo-style sample content in the design mockup is placeholder; teacher screens and desktop layout follow the
  brief's style but are not in the mockup.
