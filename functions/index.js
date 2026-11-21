// Potluck Cloud Functions (codebase `potluck`, Node 22, 2nd gen, europe-west1).
// Planned (SPEC "Functions"): createProject (one-active-project limit), joinProject (code + nickname,
// custom token for students), join-request approval, the AI steps (credit spend first, refund on failure,
// output validated against the project skeleton), closeProject (sets deleteAt for the 90-day TTL).
// Empty on purpose in P0: dependencies (firebase-admin, firebase-functions) are added in P1.
export {};
