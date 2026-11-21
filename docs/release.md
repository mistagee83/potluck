# Potluck – release (P4)

Order matters: each step needs the ones before it. Every step that changes something live is done only with
András's approval. "Chrome" = in András's own Chrome, signed in (decided 2026-11-21); secrets are typed by András.

## A. Hub repo (`D:\dev\Edtechhub`, branch `dev`)

1. Commit: `shared/sso.js` (Potluck origin and name), `firestore.rules` (Potluck block), `firestore.indexes.json`
   (TTL on `deleteAt` for 9 collection groups), `hub/privacy.html` (students, Gemini, 90 days), spec.
2. Deploy rules and indexes from the Hub repo: `firebase deploy --only firestore:rules,firestore:indexes`.
   TTL policies take a while to become active (Firebase console → Firestore → TTL).
3. Deploy the Hub functions (they check app origins with the copied `sso.js`): `firebase deploy --only functions:hub`.
4. Push `dev` and `main` (Cloudflare Pages builds `main`): the Hub site gets the new Privacy page and the
   "Open app" origin.

## B. Firebase (Chrome)

5. Authentication → Settings → Authorized domains: add `potluck.mrandrewshub.com`.
6. Secret Manager: `PL_GEMINI_API_KEY` (András types the key; e.g. `firebase functions:secrets:set PL_GEMINI_API_KEY`
   in a terminal, or Google Cloud console → Secret Manager).

## C. Potluck functions

7. `firebase deploy --only functions:potluck` from `D:\dev\Potluck` (40 callables, europe-west1, the secret bound to
   the AI callables).

## D. Hub admin (Chrome, https://mrandrewshub.com/admin/)

8. Credits → prices: `potluck/from-idea` 2, `potluck/setup-step` 2, `potluck/regenerate` 1, `potluck/handouts` 2,
   `potluck/final-feedback` 1.
9. Products → new product: `slug: potluck`, `type: app`, `appUrl: https://potluck.mrandrewshub.com/teacher.html`,
   title "Potluck", tagline "Group projects where everyone brings something.", cover image (the OG image), status
   draft until step 14.

## E. Cloudflare (Chrome)

10. Workers & Pages → create a Pages project from GitHub `mistagee83/potluck`: production branch `main`, build command
    `node scripts/build-web.mjs`, output directory `dist`.
11. Custom domain `potluck.mrandrewshub.com` on the project (Cloudflare adds the DNS record).

## F. Go live

12. Potluck `main` = `dev` (merge or push), with `noindex` removed from `public/index.html` and `public/_headers`
    (the landing page only; app pages stay noindex).
13. Potluck admin (`/teacher.html` → Admin): import the built-in templates, publish the three.
14. Hub product → live. Full test on the live address: landing, sign-in (Google and e-mail), "Open app" from the
    Hub, a project from a template and one from an idea (real credits), a student on a phone, assessment,
    feedback, export, exhibition, closing.

## After launch

- Firestore console: TTL policies active on the 9 collection groups.
- Meta Pixel: when the Hub gets a Pixel id, set `PIXEL_ID` in `public/js/config.js`.
