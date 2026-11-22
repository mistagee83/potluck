// Project logic shared by the browser and the Cloud Functions (pure, no dependencies): input checks,
// the board's starting tasks, milestone status, the assessment summary, CSV. Everything reads the
// project skeleton (engines/skeleton.js); nothing here knows a particular template.

export const STATUS = Object.freeze({ setup: 'setup', running: 'running', assessing: 'assessing', closed: 'closed' });
export const TASK_STATUS = Object.freeze(['todo', 'doing', 'done']);
export const GROUP_MODES = Object.freeze(['teacher', 'choose']);
export const DAY = 24 * 60 * 60 * 1000;
export const RETENTION_DAYS = 90;
export const EXHIBITION_DAYS = 30;
export const LIMITS = Object.freeze({
  nickname: [2, 20], groupName: 40, groups: [1, 12], link: 500, reflection: 600, blurb: 160,
  taskTitle: 80, comment: 600, answer: 400, projectTitle: 80, ownTasksPerGroup: 40,
  // Hub security audit 2026-11-22, K-7: a join code must not let anyone fill a project with students.
  studentsPerProject: 60,
});

// Hub security audit 2026-11-22, K-7.
/** Wrong join codes one network address may try in an hour (a class shares one address; guessing does not). */
export const BAD_CODES_PER_HOUR = 20;
/** A running project nobody touches for this long is closed automatically (then the 90 days run). */
export const IDLE_CLOSE_DAYS = 180;

/** The last time anything happened in a project (ms): its own changes and every group's last activity. */
export function lastActive(p) {
  const times = [p?.updatedAt, p?.launchedAt, p?.assessingAt, p?.createdAt, ...Object.values(p?.lastActivity ?? {})];
  return Math.max(0, ...times.filter((t) => Number.isFinite(t)));
}
/** A project with student data (running or assessing) that has been idle for IDLE_CLOSE_DAYS. */
export function idleTooLong(p, now) {
  if (![STATUS.running, STATUS.assessing].includes(p?.status)) return false;
  const last = lastActive(p);
  return last > 0 && now - last > IDLE_CLOSE_DAYS * DAY;
}

// ---- codes and names --------------------------------------------------------------------------------

// Join codes: no 0/O, 1/I/L, so a code read off the board is typed right.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** A join code from random integers (rand(n) → 0..n-1); the caller supplies the randomness. */
export function makeCode(rand) {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) s += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return s;
}
export const normalizeCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Display form of a nickname: trimmed, inner spaces collapsed. */
export const cleanNickname = (s) => String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
/** The uniqueness key: case and accents do not make a different name ("Anna" = "anna" = "Ánna"). */
export const nicknameKey = (s) => cleanNickname(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
export function nicknameError(s) {
  const n = cleanNickname(s);
  const [min, max] = LIMITS.nickname;
  if (n.length < min || n.length > max) return 'nickname-length';
  if (!/^[\p{L}\p{N} ._-]+$/u.test(n)) return 'nickname-chars';
  return null;
}

/** A hand-in link: http(s) only, a host with a dot or localhost, no spaces. Returns the link or null. */
export function cleanLink(s) {
  const raw = String(s ?? '').trim();
  if (!raw || raw.length > LIMITS.link || /\s/.test(raw)) return null;
  const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.href;
  } catch { return null; }
}

/** Trimmed text within a limit, or null when it is too long; '' stays ''. */
export function cleanText(s, max) {
  const t = String(s ?? '').trim();
  return t.length > max ? null : t;
}

/** Default group names: "Team 1" ... */
export const defaultGroupNames = (n) => Array.from({ length: n }, (_, i) => `Team ${i + 1}`);

// ---- board --------------------------------------------------------------------------------------------

/** The board's starting tasks for one group, from the skeleton (ids stay stable: <groupId>-<taskId>). */
export function tasksForGroup(skeleton, groupId) {
  const phaseOrder = new Map(skeleton.phases.map((p, i) => [p.id, i]));
  return skeleton.tasks.map((t, i) => ({
    id: `${groupId}-${t.id}`,
    groupId,
    phaseId: t.phaseId,
    title: t.title,
    detail: t.detail,
    roleId: t.roleId,
    ownerSid: null,
    status: 'todo',
    order: phaseOrder.get(t.phaseId) * 100 + i,
    fromTemplate: true,
  }));
}

/** Link milestones in phase order (the ones that are handed in on the board). */
export const linkMilestones = (skeleton) => skeleton.phases.filter((p) => p.milestone.handIn === 'link');

/** The product milestone: the last link hand-in. Its link and blurb go on the exhibition page. */
export const productPhase = (skeleton) => linkMilestones(skeleton).at(-1) ?? null;

/** Today's date as YYYY-MM-DD in the given time zone (the teacher's). */
export function isoDay(ms, timeZone) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  return p; // en-CA formats as YYYY-MM-DD
}
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Status of one milestone for one group: 'done' (handed in), 'late' (due date passed, nothing handed in),
 * 'due' (due today), 'open', or 'class' (shown in class, nothing to hand in). due: YYYY-MM-DD or null.
 */
export function milestoneStatus(phase, submission, due, today) {
  if (phase.milestone.handIn === 'none') return 'class';
  if (submission?.link) return 'done';
  if (!due) return 'open';
  if (today > due) return 'late';
  if (today === due) return 'due';
  return 'open';
}

/** Board progress of a group: done / total tasks, and tasks still without an owner. */
export function taskProgress(tasks) {
  const done = tasks.filter((t) => t.status === 'done').length;
  return { done, total: tasks.length, unclaimed: tasks.filter((t) => !t.ownerSid && t.status !== 'done').length };
}

/** A group is flagged when a milestone is late, or when nothing moved on its board for `staleDays`. */
export function groupFlags({ statuses, lastActivity, now, staleDays = 3 }) {
  const flags = [];
  if (statuses.includes('late')) flags.push('late');
  if (lastActivity && now - lastActivity > staleDays * DAY) flags.push('stuck');
  return flags;
}

// ---- assessment -------------------------------------------------------------------------------------

const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const round1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

/** Weighted mean of criterion scores (1-4) → a percentage (0-100), or null if nothing is scored. */
export function weightedPercent(criteria, scores) {
  let sum = 0; let max = 0;
  for (const c of criteria) {
    const s = scores?.[c.id];
    if (!Number.isInteger(s)) continue;
    sum += s * c.weight; max += 4 * c.weight;
  }
  return max ? Math.round((sum / max) * 100) : null;
}

/**
 * Which criteria a teacher scores. A co-teacher: only their own subject's criteria. The lead teacher:
 * everything no co-teacher covers ("all" criteria and the subjects without a co-teacher).
 * coSubjects: the subjects of the co-teachers who joined.
 */
export function criteriaFor(skeleton, { lead, subject = null, coSubjects = [] }) {
  const covered = new Set(coSubjects);
  return skeleton.assessment.criteria.filter((c) => (lead ? !covered.has(c.subject) : c.subject === subject));
}

/**
 * The summary: per group the teachers' scores (per teacher and combined per criterion), the peer average
 * per peer criterion; per student their group's result, the contribution average they received (1-4)
 * and how many teammates rated them, and whether they did the self-assessment.
 * assessments: [{ kind: 'teacher'|'peer'|'contribution'|'self', rater, groupId?, rated?, scores?, answers? }]
 */
export function summarize({ skeleton, groups, students, assessments }) {
  const criteria = skeleton.assessment.criteria;
  const scale = (q) => q.kind === 'scale';
  const contribQs = skeleton.assessment.contributionQuestions.filter(scale);

  const groupRows = groups.map((g) => {
    const teacher = assessments.filter((a) => a.kind === 'teacher' && a.groupId === g.id);
    // A criterion's teacher score: the mean of the teachers who scored it.
    const combined = {};
    for (const c of criteria) {
      const v = avg(teacher.map((a) => a.scores?.[c.id]).filter(Number.isInteger));
      if (v !== null) combined[c.id] = round1(v);
    }
    const peers = assessments.filter((a) => a.kind === 'peer' && a.groupId === g.id);
    const peer = {};
    for (const c of criteria.filter((x) => x.peer)) {
      const v = avg(peers.map((a) => a.scores?.[c.id]).filter(Number.isInteger));
      if (v !== null) peer[c.id] = round1(v);
    }
    const pct = (() => {
      let sum = 0; let max = 0;
      for (const c of criteria) {
        if (combined[c.id] === undefined) continue;
        sum += combined[c.id] * c.weight; max += 4 * c.weight;
      }
      return max ? Math.round((sum / max) * 100) : null;
    })();
    return {
      groupId: g.id, name: g.name, teacher: combined, teacherPercent: pct, peer,
      peerCount: peers.length, comments: teacher.filter((a) => a.comment).map((a) => ({ rater: a.rater, comment: a.comment })),
    };
  });

  const byGroup = new Map(groupRows.map((r) => [r.groupId, r]));
  const studentRows = students.map((s) => {
    const received = assessments.filter((a) => a.kind === 'contribution' && a.rated === s.id);
    const perRater = received.map((a) => avg(contribQs.map((q) => a.answers?.[q.id]).filter(Number.isInteger))).filter((x) => x !== null);
    const self = assessments.find((a) => a.kind === 'self' && a.rater === s.id);
    const g = byGroup.get(s.groupId);
    return {
      sid: s.id, nickname: s.nickname, groupId: s.groupId ?? null, groupName: g?.name ?? '',
      groupPercent: g?.teacherPercent ?? null, contribution: round1(avg(perRater)), contributionCount: perRater.length,
      selfDone: !!self, self: self?.answers ?? null,
    };
  });
  return { groups: groupRows, students: studentRows };
}

// ---- CSV ------------------------------------------------------------------------------------------------

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Formula injection guard for spreadsheet apps, then RFC 4180 quoting.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (rows) => `${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

/** The export table: one row per student, with the group's per-criterion scores. */
export function summaryCsv(skeleton, summary) {
  const criteria = skeleton.assessment.criteria;
  const head = ['Nickname', 'Group', 'Group score %', ...criteria.map((c) => `${c.name} (teacher)`),
    ...criteria.filter((c) => c.peer).map((c) => `${c.name} (peers)`), 'Contribution (1-4)', 'Contribution ratings', 'Self-assessment',
    ...skeleton.assessment.selfQuestions.map((q) => q.text)];
  const groups = new Map(summary.groups.map((g) => [g.groupId, g]));
  const rows = summary.students.map((s) => {
    const g = groups.get(s.groupId);
    return [s.nickname, s.groupName, s.groupPercent,
      ...criteria.map((c) => g?.teacher[c.id] ?? ''),
      ...criteria.filter((c) => c.peer).map((c) => g?.peer[c.id] ?? ''),
      s.contribution ?? '', s.contributionCount, s.selfDone ? 'yes' : 'no',
      ...skeleton.assessment.selfQuestions.map((q) => s.self?.[q.id] ?? '')];
  });
  return toCsv([head, ...rows]);
}
