# Potluck – SPEC v0.1

Single source of truth for this repo. Translated from the Hub spec (`D:\dev\Edtechhub\docs\spec-v1.md`,
section "Potluck – projekt-app", Hungarian, 2026-11-21); background in the Hub's `docs/koncepcio-projekt-app.md`.
If the two disagree on Potluck itself, this file wins; shared Hub rules (accounts, credits, entitlements,
Security Rules) are owned by the Hub spec.

Owner: András. There is no "first version and later": the whole product is built, then published (decided
2026-11-21). The phases in section 13 are a build order, not release levels.

## 1. Product in one sentence

Group projects where everyone brings something: a classroom-tested project template that AI fits to the
teacher's class, then one board that runs the project: groups claim tasks, hand in links, and the teacher sees
who did what, through to self, peer and teacher assessment.

## 2. Name and addresses (decided 2026-11-21)

- Name **Potluck**. Tagline: "Group projects where everyone brings something."
- Address `potluck.mrandrewshub.com`; entitlement key and price-key prefix `potluck`; functions codebase `potluck`;
  Firestore prefix `pl`; GitHub `mistagee83/potluck`, branch `dev`.
- Hosting: Cloudflare Pages (`node scripts/build-web.mjs`, output `dist`); no Netlify. Tested locally and on the
  live address, which stays noindex until the Hub lists Potluck.

## 3. Principles

1. **AI runs only for the teacher, at two points:** at the start (tailoring, step by step) and at the end (written
   feedback). Every AI step spends credits (`settings/credits`).
2. **No AI during the project.** Students never talk to a model inside Potluck. (A template may ask students to
   use a chatbot outside Potluck as part of the task, as the anti-guidebook does.)
3. **The model never decides structure.** Every project is one skeleton (section 4); the model only fills its
   fields, and its output is validated against the skeleton schema before it is saved.
4. **The product is made outside** (video, Canva, Drive…). A hand-in is a **link** and a short reflection; no file
   upload (decided 2026-11-21).
5. **Not an LMS:** no course content, timetable, gradebook or Classroom integration; one project from start to end.
6. **No model API key in the client.** All model calls go through Cloud Functions that spend credits first and
   refund on failure.
7. **Phone first** for students; the teacher monitor also works on desktop.

## 4. The project skeleton (decided 2026-11-21)

Every project, whether from a built-in template, from the idea form, or after any AI step, is the same skeleton,
and every part of the app (board, hand-ins, monitor, assessment, exhibition, export) reads only the skeleton.

Code: `engines/skeleton.js` (`SKELETON_SCHEMA`, `validateSkeleton`). The schema uses the JSON Schema subset the
model API accepts, so the same object is sent to the model and used for validation. `checkSkeleton` adds what a
schema cannot say: unique ids, task → phase and task → role references, phase lessons adding up to the duration,
1–10 tasks per phase, required roles fitting the smallest group, criteria subjects, score levels 1–4, at least
one peer-scored criterion and at least one link hand-in.

| Part | Fields |
|---|---|
| `basics` | title, drivingQuestion, summary, brief (to the students), product {type, description}, audience, subjects[1–3] {name, contribution}, level {ageMin, ageMax, cefr?}, duration {unit lessons\|weeks, amount, lessonMinutes}, workingLanguage |
| `groups` | sizeMin, sizeMax, briefs[0–8] (optional different assignments per group) |
| `phases[2–6]` | id, title, goal, lessons (half-lesson steps), steps[1–8] (teacher run sheet), milestone {title, deliverable, handIn link\|none} |
| `roles[2–6]` | id, name, responsibility, optional |
| `tasks` | id, phaseId, title, detail, roleId\|null (the board's starting content) |
| `assessment` | criteria[3–8] {id, name, subject\|"all", weight 1–3, peer, levels[4]}, selfQuestions[2–6], contributionQuestions[2–6] {id, text, kind scale\|text} |
| `handouts[0–6]` | id, title, for student\|group\|teacher, body (Markdown) |
| `teacherNotes` | preparation, variations[0–5] |

Built-in templates are written by hand in this skeleton (`engines/templates/`), so they run without any AI step.
P0 has the anti-guidebook; the other two come in P3.

## 5. Roles

- **Lead teacher:** creates and tailors the project, invites co-teachers, sees everything, closes the project.
- **Co-teacher** (decided 2026-11-21): invited by the lead teacher with an invitation link (no e-mail sending); signs in with their own
  Hub account (a free account is enough; inviting needs the lead teacher's Hub pass). Sees the project and the
  monitor, gives feedback per hand-in, scores with their own subject's criteria. Cannot edit the project, manage
  groups or students, or close it. Their scores are a separate column in the summary.
- **Student:** group member: claims tasks, moves them along, hands in, assesses self and peers.

## 6. Student sign-in

No e-mail, no password: project code + nickname (unique within the project). The browser keeps the student signed
in. The same nickname from a new device signs in only after the teacher approves it (a request on the monitor, one
tap); on a shared computer there is a sign-out button, and signing in again also needs approval. A Cloud Function
handles it (nickname uniqueness, request, approval) and returns a custom token with the student id and the claim
`plStudent` (the project id), so rules can work with `request.auth.uid` and tell students from teachers (Hub SSO
teachers also arrive with custom tokens). Students get no `users/{uid}` document and no welcome credits.

## 7. Flow

1. **Start:** a built-in template, **or** an own idea through the idea form (section 8).
2. **Tailor with AI**, each step approved or regenerated on its own: (1) project plan: phases, lesson-by-lesson or
   week-by-week run; (2) group briefs and roles; (3) the board's tasks per phase; (4) criteria, self and peer
   questions; (5) printable handouts (optional). Input: teachers and subjects, number and size of groups, time,
   level, language, local context. The language is the teacher's choice (decided 2026-11-21): the texts students
   read are written in it, the UI stays English. How the steps work: section 9a.
3. **Launch:** groups (teacher assigns or students choose), a due date for every milestone (set by the teacher at
   launch, editable later; decided 2026-11-21), project code, co-teacher invitations.
4. **Run, without AI:** group board per phase (task, owner, status); milestones (link + reflection + who did what);
   teacher feedback per hand-in, each teacher on their own criteria; monitor: groups × milestones grid, flags for
   late or stuck groups, individual contribution.
5. **Close:** self-assessment, anonymous in-group contribution rating, gallery round (peers score the peer
   criteria), teacher scores per teacher; AI written feedback **one call per group**, with an individual paragraph
   per member, edited and approved by the teacher; once approved, each student sees the group text and their own
   paragraph, never a teammate's (decided 2026-11-21); summary per group and per student; export (PDF/CSV).
6. **Exhibition page** (decided 2026-11-21): a shareable, read-only link with the project title, the group names and
   each group's product link (the last link milestone) with a one-line description the group writes there; no
   nicknames, no scores. The teacher turns it on; the link expires after 30 days (the teacher can extend it) and
   at the latest with the 90-day deletion.

### 7a. Teacher page menu (decided 2026-11-22)

After sign-in the teacher page has a main menu: a bottom bar on phones, a left column from 900px.
- **Projects** (`#/projects`): running and setting-up projects; the card shows status, code, start date and the
  next hand-in date (from the project document, no extra reads). A "New project" button; closed projects are counted
  with a link to the Archive.
- **New project** (`#/new`): three ways in: from a template (`#/new/templates`), from my templates
  (`#/templates`), from my idea (`#/new/idea`, section 8).
- **Templates** (`#/templates`): the teacher's own templates (Hub pass), start or delete.
- **Archive** (`#/archive`): closed projects with the closing and deletion dates.
- **Account** (`#/account`): who is signed in, credits, Hub pass, link to the Hub account, sign-out.
- **Admin** (`#/admin`): Hub admins only.
- Inside a project (`#/p/<id>/<tab>`) the tabs stay; on wide screens they sit in the menu under Projects.
- Every menu step is a browser history entry (Back works); tab switches are not. Old links (`#p=<id>&tab=<tab>`,
  `#invite=<token>`) still work.

## 8. Own idea (decided 2026-11-21)

The teacher does not write free text but fills in an **idea form** whose fields are the skeleton's basics: driving
question or challenge, product (type picker + short description), audience, subjects (1–3) and what each brings,
age/level, duration, number and size of groups, 1–3 required content items or skills, local context (optional).
Step 0 (AI) fills the skeleton from it as a draft template (phases, milestones, roles); the teacher approves or
regenerates, then the same steps 1–5 run as for a template. An own idea has no hand-written base plan, so it cannot
start without AI. A finished project can be saved as the teacher's own template (only theirs).

## 9a. How the AI steps work (P2, 2026-11-21)

- Code: `engines/ai.js` (pure: step parts, inputs, merge, checks, the feedback schema), `functions/ai.js`
  (callables), `functions/llm.js` (the call, prompts, mock), prompts in `functions/prompts/*.md` (versioned).
- Each step has a part schema cut out of `SKELETON_SCHEMA`; the model fills only that part. The teacher's numbers
  (subjects, group size, time, ages, level, language) are written into the skeleton by code, never by the model.
- Order of a call: spend credits (Hub pattern, `creditLedger`) → model → shape check → merge → `checkStep`; one
  repair round with the errors; on failure the credits go back. The result waits as a proposal: the teacher uses
  it, asks for a new version (with an optional note), or discards it.
- A step whose output no longer fits (new numbers, a new plan with new phase ids) is marked "needs a new version";
  launching needs the whole skeleton valid (`launchProblems`).
- The model gets a light schema: bounds (lengths, list sizes, ranges) are sent as text hints, because the full
  bounds were too large for Gemini's constrained decoding; our checks enforce them.
- Secret: `PL_GEMINI_API_KEY` (Secret Manager in production; `functions/.secret.local` for the emulator). The
  emulator uses a mock model unless `PL_MOCK_MODEL=false` (e.g. in `functions/.env.local`, gitignored).
- Final feedback: `feedbackDrafts/{group}` (teachers only) → approved texts in `feedback/{group}` (the group's
  students read it) and `feedbackStudents/{sid}` (only that student). All get `deleteAt` at closing.

## 9. Access and credits (decided 2026-11-21)

| Action | Price key | Credits |
|---|---|---|
| Own idea → draft template (step 0) | `potluck/from-idea` | 2 |
| One tailoring step (1–4) | `potluck/setup-step` | 2 |
| Regenerate one part | `potluck/regenerate` | 1 |
| Handouts | `potluck/handouts` | 2 |
| Final feedback, per group | `potluck/final-feedback` | 1 |

Example: a full tailoring ≈ 8 credits, closing 6 groups 6 credits: about 14 credits a project (of the Hub pass's
100 a month). The price rows go into the Hub's `settings/credits` in P2.

Without a Hub pass: **one active** (not closed) project at a time; AI steps from credits (welcome credits too).
With a Hub pass (`entitlements.potluck` or `all`): unlimited active projects, export, co-teachers. The limit is
checked by the function that creates a project.

## 10. Data retention (decided 2026-11-21)

Closed + 90 days: then student data (nicknames, devices, join requests, tasks, hand-ins, assessments) is deleted
(Firestore TTL on a `deleteAt` field); the teacher keeps the project's skeleton (tailored plan, criteria). The
teacher is reminded to export at closing and before deletion. The Hub's Privacy page gets a student-data section
before launch.

## 11. Data model (draft)

Collections with the `pl` prefix; rules in the Hub's `firestore.rules` (block `// ---- Potluck`).

- `plTemplates/{id}` – `{ slug, title, status: draft|live|archived, owner, source: builtin|upload|project, meta
  { tags, durationHint }, skeleton, projectId?, order, createdAt, updatedAt }`; `owner` '' = shared (doc id = slug),
  uid = a teacher's own. Written by Potluck functions only (the app's own admin goes through them; the Hub admin
  handles payments, credits and accounts only, decided 2026-11-21). Teachers read live shared templates and their
  own; drafts and archived ones only through the admin functions. Projects start from Firestore templates.
- Groups carry `briefId`: the template's angles (`groups.briefs`) are dealt out in turn at launch; the lead teacher
  can change a group's angle; the student sees their group's angle on the Brief tab.

**Potluck admin** (P3, decided 2026-11-21) – for the Hub admins (`settings/admins.emails`, verified e-mail),
reached from the teacher page ("Admin" in the header). Shared templates: import the built-in files
(`engines/templates/`; new ones arrive as drafts, re-import keeps the status), upload a template JSON
(`{ slug, meta, skeleton }` or a bare skeleton: checked against the frame, shown as a preview, saved as a draft),
publish, unpublish, archive, order. **Own templates** need a Hub pass (decided 2026-11-21): Settings → "Save as my
template" (a valid skeleton), at most 30 per teacher, deletable; projects started from them are unaffected.
- `plProjects/{id}` – lead teacher, co-teachers, tailored skeleton, status (`setup`|`running`|`closed`), join code,
  `closedAt`, `deleteAt`.
- under it: `groups/{gid}`, `students/{sid}` (nickname, group, approved devices), `joinRequests/{rid}` (functions
  only), `tasks/{tid}`, `submissions/{subId}` (milestone, group, link, reflection, contributors, teacher feedback),
  `assessments/{aid}` (kind self/contribution/peer/teacher; rater, rated, scores, comment).

## 12. Landing page (decided 2026-11-21)

`potluck.<domain>/` is the landing page for signed-out visitors; signed-in teachers go to their projects. The Meta
ads and the Hub's "Open app" point here. Phone first, English, the Hub voice (teacher to teacher, no exclamation
marks, no emoji), Potluck's own brand (section 15). Hero (design brief, 2026-11-21): title "Group projects where
*everyone brings* something." (the phrase in tomato); under it "Pick a classroom-tested project. AI fits it to your
class. Then one board runs it all."; main button "Pick a project" (→ the teacher page; signed out: sign-in or Hub
`/account?signup=1&return=…`); note "No student accounts. Just a code and a nickname." Sections: hero, the problem, how it works in 3 steps, the templates, what students
see, price, FAQ (student data), closing call to action. Pixel `ViewContent` and registration events with the
Hub's cookie banner; OG tags.

## 13. Phases

| Phase | Result |
|---|---|
| P0 Skeleton | Skeleton schema + validator, the anti-guidebook in it; repo, dev server, teacher sign-in (Hub pattern, SSO), functions codebase, rules block draft |
| P1 Logic without AI | One template, hand-written base plan: create project, groups, student join + approval, board, milestones, monitor, co-teacher, assessments, closing, export, exhibition page, one-active-project limit, TTL. Usable in the owner's own class |
| P2 AI | Idea form and step 0, tailoring steps 1–5, regenerate, final feedback; credit spend in a transaction (Hub `credits.js`), price rows |
| P3 Content | 3 templates: *5-star disaster* (short), *The anti-guidebook* (medium), *The 2050 city budget* (several weeks); template upload in Potluck's own admin |
| P4 Publish | Logo file and favicon, landing page (text, screenshots, Pixel, OG tags), address, Authorized domains, Hub `APP_ORIGINS`, Hub product, Privacy/Terms, full test on phone and desktop with non-admin and student accounts |

## 14. Open questions

1. Landing page text beyond the hero (P4).
2. Brand details the design brief leaves open: a standalone logo file and favicon; desktop layout and the teacher
   screens are built in the brief's style, to be reviewed by András.

## 15. Brand (decided 2026-11-21)

"Picnic cloth + stickers": `design/POTLUCK-DESIGN.md` (rules) and the mockup in `design/` (reference). Cream page,
red-and-white gingham header band with the "Potluck" logo sticker (tomato, rotated -3deg) and a "by Mr. Andrew's
Hub" pill; white sticker cards with a 3px ink outline and a hard 6px ink shadow; Baloo 2 800 for display, Nunito
for everything else; task rows: done = lettuce + filled check circle, claimed = butter + ring, open = white dashed
+ "I'll bring it". Potluck does not use the Hub's palette or fonts. Implemented in `public/css/tokens.css`,
`base.css`, `app.css`.
