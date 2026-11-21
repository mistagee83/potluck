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

## P2 – AI (2026-11-21)

**Decisions (András, 2026-11-21)**
- Gemini key: `PL_GEMINI_API_KEY`, locally in `functions/.secret.local` (András put it there).
- The approved final feedback is shown to the students: the group text and their own paragraph only.
- The teacher chooses the language of the students' texts; the UI stays English.

**Built**
- `engines/ai.js`: step definitions and price keys (`from-idea`, `setup-step`, `regenerate`, `handouts`,
  `final-feedback`), part schemas cut out of the skeleton schema, the class inputs and the idea form with checks,
  teacher numbers applied by code (`applyInputs`), `mergePart`, `checkStep` (own errors block, other steps go
  stale), `launchProblems`, the feedback schema and check, `toModelSchema` (nullable → type list; bounds → text).
- `functions/llm.js`: one Interactions API call bound to a JSON schema, model `gemini-3.8-flash` (an unavailable
  model stops with `model-unavailable`, nothing substituted), versioned prompts, a mock for the emulator.
- `functions/credits.js`: the Hub's spend/refund pattern (copied from Hubbaloo).
- `functions/ai.js`: `plCreateFromIdea` (step 0; the project is created only when the draft succeeded),
  `plTailorInputs`, `plTailorStep` (proposal, optional note, one repair round), `plTailorDecide`,
  `plFeedbackDraft`, `plFeedbackApprove`. `plLaunch` now refuses an open proposal or an invalid skeleton; closing
  also dates the feedback collections. Template projects start with their own numbers as inputs, all steps done.
- Prompts `functions/prompts/`: system (v2: sentence case, ids ≤ 24 characters), idea, plan, groups, tasks,
  assessment, handouts, feedback.
- Teacher page (`public/js/teacher-ai.js`): credit balance and prices (from `users/{uid}` and `settings/credits`),
  "Start from my idea" form, "Fit it to your class" (inputs, steps with status Done / Not yet / Needs a new version
  / Waiting for you, cost per button), proposal preview with Use this / Write a new version / Discard, launch
  blockers; per group on Assess: draft feedback, edit, "Show it to the students".
- Student page: "Feedback from your teacher" (group text + "For you") on Yourself and after closing.
- Rules (emulator copy): `feedbackDrafts` teachers only, `feedback/{group}` that group's students,
  `feedbackStudents/{sid}` that student only.

**Verified**
- `npm test`: 34 tests pass (skeleton 12, project 10, AI steps 12).
- Emulator with the mock model: own idea → step 0 → steps 1-4, credits 30 → 20; changing the time made the plan
  "needs a new version" and launching was refused; a new plan cost 1 credit (regenerate).
- Emulator with the real model (`gemini-3.8-flash`, András's key): own idea (a greener-school podcast, Biology +
  English, 6 lessons, B2) → step 0 (one repair round: an id was too long) → plan, groups, tasks, assessment,
  handouts, all usable on the first try after the schema fix; launched; two students, hand-ins, ratings, scores;
  feedback drafted, edited, approved. 40 → 28 credits (2 + 5 × 2; the failed call was refunded). Calls used about
  1,200-4,300 tokens each.
- Found and fixed with the real model: Title Case titles (prompt v2), the full bounds schema was refused by
  Gemini ("too many states") for the tasks part (bounds now sent as text), refusal details were dropped on the
  client (field errors now shown).
- Rules: a student reads the group feedback and their own paragraph; a teammate's paragraph and the draft are
  refused. The student page shows the approved feedback (375 px).

**Not done / next**
- Saving a finished project as the teacher's own template (SPEC 8): not built; fits P3 with template upload.
- The five `potluck/*` price rows are not in the Hub's `settings/credits` yet (Hub admin, Credits tab).
- Production: `PL_GEMINI_API_KEY` in Secret Manager, the rules block and TTL in the Hub repo, functions deploy:
  all with András's approval. Nothing deployed.

## P3 – Content (2026-11-21)

**Decisions (András, 2026-11-21)**
- Templates reach the admin as a JSON file (checked, previewed, saved as a draft, then published).
- Own templates (a project saved for later) need a Hub pass.
- The 2050 city budget: 3 weeks, 6 lessons.

**Built**
- Templates written by hand in the skeleton, from the owner's publications, translated and made international:
  `five-star-disaster.js` (May 2026: 2 lessons, 3 phases, 4 roles, 11 tasks, 5 criteria, euphemism toolkit and
  brainstorm handouts; subjects Foreign language + Tourism and marketing) and `city-budget-2050.js` (January 2026:
  3 weeks / 6 lessons, 5 phases, 4 roles, 16 tasks, 6 criteria, 4 group angles, budget worksheet with the payback
  method, AI advisor and investor prompt cards for use outside Potluck, pitch phrases; Mathematics, Foreign
  language, Economics). Together with the anti-guidebook: short, medium, several weeks.
- Templates in Firestore (`functions/templates.js`): `plAdminTemplates`, `plAdminImportBuiltins`, `plAdminUpload`
  (check or save), `plAdminSetTemplate` (status, order), `plSaveAsTemplate`, `plDeleteTemplate`; `plCreateProject`
  now starts from a Firestore template (live shared or own). Admin check as in the Hub (verified e-mail in
  `settings/admins.emails`). `engines/template-io.js`: reading an upload (wrapped or bare, slug from the title).
- Group angles: groups get `briefId` at launch (in turn), `plSetGroupBrief`; shown on Plan, Groups (select) and
  the student's Brief.
- Teacher page: templates and "Your templates" from Firestore, delete own; "Save as my template" in Settings (Hub
  pass, otherwise a note); "Admin" link for Hub admins (settings/admins is readable only by them) → admin view
  (`public/js/admin.js`): import, publish/unpublish/archive/order, preview, upload (file or paste) with the error
  list or a preview.
- Rules (emulator copy): teachers read live shared templates and their own.

**Verified**
- `npm test`: 38 tests pass (+ templates: all three valid, sizes, 6 lessons for 2050, upload reading and errors).
- Emulator: admin imported the three built-ins (drafts), published them, the teacher's start page lists them in
  order; upload: broken JSON and a too-long title refused with the reason, a good copy saved as a draft. A teacher
  who is not an admin: admin call refused, the draft not readable, a project from the draft refused, only the live
  three listed. Started the 2050 project, launched: four groups got the four angles; an angle changed; the student
  in that group sees "Your angle: Floating city". Saved the project as an own template, started a project from it,
  deleted the template (the project stayed).

**Not done / next**
- P4 (publish): logo file and favicon, landing page, address, Hub `APP_ORIGINS` / product, Privacy/Terms, the
  Hub-repo rules block and TTL, price rows, Secret Manager key, deploy. All with András's approval.

## P4 – Publish (in progress, 2026-11-21)

**Decisions (András, 2026-11-21)**
- Logo and favicon: made from the design brief (Claude). Console steps (Cloudflare, Firebase, Hub admin) in
  András's Chrome by Claude, with a question before every save; secrets typed by András.

**Built so far**
- Brand images in `public/img/brand/`: logo sticker, app icon 512 and 180 (apple-touch), favicons 16/32/48, OG image
  1200×630, drawn with the brand fonts by `public/dev/brand.html` (developer tool; re-export from there).
- Landing page `public/index.html` + `css/landing.css`: hero, the problem with a sample board, how it works in 3
  steps, the three templates, what students see, price (free start, Hub pass €9/100 credits), FAQ (accounts,
  student data, AI, hand-ins, co-teachers), closing call to action, footer with Hub links; OG and Twitter tags;
  favicons on every page.
- `public/js/pixel.js`: the Hub's consent pattern; `PIXEL_ID` null (the Hub has none yet), so no banner and no
  tracking; events wired (ViewContent and InitiateCheckout on the landing page, Lead on the first teacher sign-in).
- Hub repo (not committed yet): Potluck origin in `shared/sso.js`, the Potluck rules block in `firestore.rules`,
  TTL on `deleteAt` for the 9 student-data collection groups, Privacy page (students, Gemini API, 90 days), spec.
  Hub tests: 64 pass. The Potluck emulator copy of the rules is now the Hub's file.
- `docs/release.md`: the release steps in order.

**Verified**
- Landing page at 375 px and desktop: no horizontal overflow, the hero matches the mockup.
- `npm test` 38 pass.

**Release progress (2026-11-21)**
- Hub: rules + TTL deployed (the live rules were checked against the Hub repo before: identical), Hub functions
  deployed, Hub `dev` and `main` pushed (`4d0eb1c`).
- Firebase Auth: `potluck.mrandrewshub.com` authorized. Secret `PL_GEMINI_API_KEY` set by András (version 1,
  enabled). Potluck functions deployed: 40 callables.
- Hub admin: the five `potluck/*` price rows saved; product `potluck` (app, subscription, appUrl
  https://potluck.mrandrewshub.com, cover = OG image) saved as a draft.
- Landing page: hands a Hub "Open app" `#sso=` code to `/teacher.html` (tested locally); indexable now, with
  `robots.txt` and `sitemap.xml`; the app pages and `/dev/` stay noindex (headers + meta).
- Waiting: the Potluck `main` branch (needs András's explicit approval), then Cloudflare Pages + domain.
- Potluck `main` created and pushed (András's approval), Cloudflare Pages project `potluck` (GitHub
  `mistagee83/potluck`, production branch `main`, build `node scripts/build-web.mjs`, output `dist`;
  `potluck-a4d.pages.dev`), custom domain `potluck.mrandrewshub.com` active (CNAME added by Cloudflare).
- Headers: Pages serves `/teacher.html` as `/teacher`; noindex and no-cache now also on the pretty URLs.
- Live: signed in through the Hub (`/account?return=…` → SSO code → Potluck teacher page, Admin link shown),
  imported and published the three templates, started "Live test: 5-star disaster" (no credits), launched (code
  issued), a student joined in a second tab, was put in Team 1, claimed and finished a task and handed in a link;
  the monitor showed "Handed in" and 1/11 live.
- Not yet: the Hub product is still a draft (publishing it lists Potluck on the Hub); an AI step with real
  credits not run live; the live test project is still open (András can close it, or keep it as a demo).
- Hub product `potluck` published (András's approval): https://mrandrewshub.com/p/potluck. "Open app" there opens
  Potluck signed in (Hub SSO code → landing → teacher page), tested live.

**P4 status**: Potluck is live and listed on the Hub. Open: an AI step with real credits and a phone test on the
live address (not run here), Google sign-in directly on Potluck (not run here), the open test project "Live
test: 5-star disaster".
