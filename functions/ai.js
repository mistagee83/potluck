// The AI steps (SPEC 7-9): own idea → step 0, tailoring steps 1-5 with approve / regenerate, and the final
// written feedback per group. Every call spends credits first (Hub pattern) and gives them back when the
// call or its checks fail. The model only fills fields of the skeleton; the teacher's numbers are applied
// on top, and the result is checked before the teacher sees it.
import { defineSecret } from 'firebase-functions/params';
import {
  callable, fail, fs, teacher, teacherProject, needStatus, hubPass, now,
} from './common.js';
import { spendCredits, refundCredits, CreditError } from './credits.js';
import { generateJson, prompt, render, mockPart, mockFeedback, ModelUnavailableError, MODEL, isMock } from './llm.js';
import {
  STEPS, TAILOR_STEPS, PART_SCHEMAS, LANGUAGES, actionFor, checkInputs, checkIdea, applyInputs, blankSkeleton,
  mergePart, checkStep, partOf, editCriteria, FEEDBACK_SCHEMA, FEEDBACK_LIMITS, checkFeedback,
} from './engines/ai.js';
import { validate } from './engines/skeleton.js';
import { STATUS, defaultGroupNames, cleanText } from './engines/project.js';

const GEMINI_KEY = defineSecret('PL_GEMINI_API_KEY');
const AI = { secrets: [GEMINI_KEY], timeoutSeconds: 180, memory: '512MiB' };
const APP = 'potluck';

// ---- helpers ------------------------------------------------------------------------------------------

/** Spend, run, refund on failure. fn gets nothing and returns the checked result. */
async function withCredits(uid, action, ref, fn) {
  let spend;
  try {
    spend = await spendCredits(fs(), { uid, app: APP, action, ref });
  } catch (e) {
    if (e instanceof CreditError) {
      if (e.code === 'insufficient') fail('failed-precondition', 'insufficient', { balance: e.balance, cost: e.cost });
      if (e.code === 'unknown_action') fail('failed-precondition', 'no-price');
    }
    throw e;
  }
  try {
    return { ...(await fn()), cost: spend.cost, balanceAfter: spend.balanceAfter };
  } catch (e) {
    await refundCredits(fs(), spend.ledgerId).catch((err) => console.error('refund failed', spend.ledgerId, err));
    if (e instanceof ModelUnavailableError) { console.error('model unavailable', MODEL, e.message); fail('unavailable', 'model-unavailable'); }
    if (e?.httpErrorCode) throw e; // a refusal from fail()
    console.error('generation failed', action, e?.message);
    fail('internal', 'generation-failed');
  }
}

const inputsText = (i) => [
  `- Subjects: ${i.subjects.join(', ')}`,
  `- ${i.groupCount} groups of ${i.sizeMin}-${i.sizeMax} students`,
  `- Time: ${i.amount} ${i.unit}, lessons of ${i.lessonMinutes} minutes`,
  `- Students aged ${i.ageMin}-${i.ageMax}${i.cefr ? `, language level ${i.cefr}` : ''}`,
  `- Language of the students' texts: ${LANGUAGES[i.language]}`,
  i.context ? `- Local context: ${i.context}` : '',
].filter(Boolean).join('\n');

function vars(inputs, sk, note) {
  return {
    ageMin: inputs.ageMin, ageMax: inputs.ageMax, languageName: LANGUAGES[inputs.language], inputs: inputsText(inputs),
    amount: inputs.amount, unit: inputs.unit, sizeMin: inputs.sizeMin, groupCount: inputs.groupCount,
    lessonsRule: inputs.unit === 'lessons' ? 'half-lesson steps, e.g. 0.5, 1, 1.5' : 'give each phase its share of the lessons in half-lesson steps',
    subjectList: inputs.subjects.map((s) => `"${s}"`).join(', '),
    project: sk ? JSON.stringify(sk) : '',
    phaseIds: sk ? sk.phases.map((p) => `"${p.id}"`).join(', ') : '',
    roleIds: sk ? sk.roles.map((r) => `"${r.id}"`).join(', ') : '',
    note: note ? `The teacher asks: ${note}` : '',
  };
}

/** One model call for a step, with one repair round when the checks fail. Returns { part, stale }. */
async function runStep(step, sk, inputs, done, note, extraVars = {}) {
  const system = render(prompt('system').template, vars(inputs, sk, note));
  const v = { ...vars(inputs, sk, note), ...extraVars };
  let text = render(prompt(step).template, v);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { data, usage } = await generateJson({
      system, text, schema: PART_SCHEMAS[step], thinking: step === 'idea' || step === 'plan' ? 'medium' : 'low',
      mock: () => mockPart(step, sk, inputs),
    });
    console.log('pl-model', JSON.stringify({ step, attempt, model: isMock() ? 'mock' : MODEL, promptVersion: prompt(step).version, usage }));
    const shape = validate(PART_SCHEMAS[step], data);
    const candidate = shape.length ? null : mergePart(sk, step, data, inputs);
    const { errors, stale } = candidate ? checkStep(candidate, step, done) : { errors: shape, stale: [] };
    if (!errors.length) return { part: data, stale };
    console.warn('pl-model-check', step, attempt, JSON.stringify(errors.slice(0, 10)));
    text += `\n\nYour previous answer had these problems; answer again with all of them fixed:\n${errors.slice(0, 20).map((e) => `- ${e.path}: ${e.message}`).join('\n')}`;
  }
  throw new Error('checks failed twice');
}

const noteOf = (v) => {
  const t = cleanText(v ?? '', 300);
  if (t === null) fail('invalid-argument', 'too-long');
  return t;
};

/** Default tailoring inputs read from a skeleton (a built-in template starts from its own numbers). */
export function inputsFromSkeleton(sk, groupCount = 4) {
  const b = sk.basics;
  return {
    subjects: b.subjects.map((s) => s.name), groupCount, sizeMin: sk.groups.sizeMin, sizeMax: sk.groups.sizeMax,
    unit: b.duration.unit, amount: b.duration.amount, lessonMinutes: b.duration.lessonMinutes,
    ageMin: b.level.ageMin, ageMax: b.level.ageMax, cefr: b.level.cefr ?? null, language: b.workingLanguage in LANGUAGES ? b.workingLanguage : 'en', context: '',
  };
}

// ---- own idea --------------------------------------------------------------------------------------------

/** Step 0: a new project from the idea form. Spends `from-idea`; the draft waits for the teacher's approval. */
export const plCreateFromIdea = callable(async (req) => {
  const me = teacher(req);
  const { ok, value: idea, errors } = checkIdea(req.data?.idea);
  if (!ok) fail('invalid-argument', 'bad-input', { errors });
  if (!(await hubPass(me.uid))) {
    const mine = await fs().collection('plProjects').where('owner', '==', me.uid).select('status').get();
    if (mine.docs.some((d) => d.data().status !== STATUS.closed)) fail('failed-precondition', 'one-active');
  }
  const ref = fs().collection('plProjects').doc();
  const blank = blankSkeleton(idea, idea);
  const extra = {
    challenge: idea.challenge, productType: idea.productType, product: idea.product, audience: idea.audience,
    contributions: idea.contributions || 'not given', mustHave: idea.mustHave || 'not given',
  };
  const out = await withCredits(me.uid, actionFor('idea'), `${ref.id}/idea`, () => runStep('idea', blank, idea, [], '', extra));
  const inputs = { ...idea };
  for (const k of Object.keys(extra)) delete inputs[k];
  const t = now();
  await ref.set({
    owner: me.uid, ownerName: me.name, members: [me.uid], coTeachers: [], coTeacherInfo: {},
    leadSubject: inputs.subjects[0], title: 'New project', templateSlug: null, source: 'idea', idea: extra,
    skeleton: blank, status: STATUS.setup, groupMode: 'teacher', groupNames: defaultGroupNames(inputs.groupCount), due: {},
    timeZone: typeof req.data?.timeZone === 'string' ? req.data.timeZone.slice(0, 60) : 'UTC', code: null, lastActivity: {},
    exhibitionUntil: null, createdAt: t, updatedAt: t,
    tailor: { inputs, done: [], stale: [], proposal: { step: 'idea', part: out.part, stale: [], at: t, cost: out.cost } },
  });
  return { projectId: ref.id, balanceAfter: out.balanceAfter };
}, AI);

// ---- tailoring ---------------------------------------------------------------------------------------------

/** Saves the teacher's numbers and applies them to the skeleton (no AI, no credits). */
export const plTailorInputs = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.setup);
  if (p.tailor?.proposal) fail('failed-precondition', 'proposal-open');
  const { ok, value, errors } = checkInputs(req.data?.inputs);
  if (!ok) fail('invalid-argument', 'bad-input', { errors });
  const sk = applyInputs(p.skeleton, value);
  // Steps whose output no longer fits the new numbers must run again.
  const done = p.tailor?.done ?? (p.source === 'idea' ? [] : TAILOR_STEPS);
  const stale = new Set(p.tailor?.stale ?? []);
  // Step 0 is never re-run for this: its fields belong to the plan and roles steps from now on.
  for (const step of done) if (step !== 'idea' && checkStep(sk, step, done).errors.length) stale.add(step);
  const names = Array.from({ length: value.groupCount }, (_, i) => p.groupNames[i] ?? `Team ${i + 1}`);
  await ref.update({
    skeleton: sk, groupNames: names, leadSubject: value.subjects.includes(p.leadSubject) ? p.leadSubject : value.subjects[0],
    'tailor.inputs': value, 'tailor.done': done, 'tailor.stale': [...stale], updatedAt: now(),
  });
  return { stale: [...stale] };
});

/** Runs one step (1-5, or step 0 again) and keeps the result as a proposal for the teacher. */
export const plTailorStep = callable(async (req) => {
  const { me, p, ref, id } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.setup);
  const step = req.data?.step;
  if (!STEPS[step]) fail('invalid-argument', 'bad-step');
  if (step === 'idea' && p.source !== 'idea') fail('invalid-argument', 'bad-step');
  const inputs = p.tailor?.inputs ?? inputsFromSkeleton(p.skeleton, p.groupNames.length);
  const done = p.tailor?.done ?? (p.source === 'idea' ? [] : TAILOR_STEPS);
  if (p.source === 'idea' && step !== 'idea' && !done.includes('idea')) fail('failed-precondition', 'idea-first');
  const regenerate = p.tailor?.proposal?.step === step || done.includes(step);
  const note = noteOf(req.data?.note);
  const out = await withCredits(me.uid, actionFor(step, { regenerate }), `${id}/${step}`, () => runStep(step, p.skeleton, inputs, done, note,
    step === 'idea' ? { ...p.idea } : {}));
  const proposal = { step, part: out.part, stale: out.stale, at: now(), cost: out.cost };
  await ref.update({ 'tailor.proposal': proposal, 'tailor.inputs': inputs, 'tailor.done': done, updatedAt: now() });
  return { balanceAfter: out.balanceAfter, stale: out.stale };
}, AI);

/** Applies the proposal to the skeleton (accept) or drops it. */
export const plTailorDecide = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.setup);
  const prop = p.tailor?.proposal;
  if (!prop) fail('failed-precondition', 'no-proposal');
  if (req.data?.accept !== true) {
    await ref.update({ 'tailor.proposal': null, updatedAt: now() });
    return { ok: true };
  }
  const inputs = p.tailor.inputs;
  const sk = mergePart(p.skeleton, prop.step, prop.part, inputs);
  const done = [...new Set([...(p.tailor.done ?? []), prop.step])];
  const stale = new Set([...(p.tailor.stale ?? []), ...prop.stale]);
  stale.delete(prop.step);
  stale.delete('idea');
  // Re-check every done step against the new skeleton (an accepted plan can break the tasks).
  for (const s of done) if (s !== prop.step && s !== 'idea' && checkStep(sk, s, done).errors.length) stale.add(s);
  await ref.update({
    skeleton: sk, title: prop.step === 'idea' ? sk.basics.title : p.title,
    'tailor.proposal': null, 'tailor.done': done, 'tailor.stale': [...stale], updatedAt: now(),
  });
  return { stale: [...stale] };
});

/** The criteria edited by hand: free, lead teacher, before launch; checked like a model's output. */
export const plEditCriteria = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.setup);
  // A waiting AI version of the assessment (or of step 0) would overwrite the edit when used.
  if (['assessment', 'idea'].includes(p.tailor?.proposal?.step)) fail('failed-precondition', 'proposal-open');
  if (!p.skeleton.assessment.selfQuestions.length) fail('failed-precondition', 'assessment-first');
  const done = p.tailor?.done ?? (p.source === 'idea' ? [] : TAILOR_STEPS);
  const { criteria, errors, complete } = editCriteria(p.skeleton, req.data?.criteria, done);
  if (errors.length) fail('invalid-argument', 'bad-input', { errors: errors.slice(0, 30) });
  const nextDone = new Set(done);
  const stale = new Set(p.tailor?.stale ?? []);
  if (complete) { nextDone.add('assessment'); stale.delete('assessment'); }
  await ref.update({
    'skeleton.assessment.criteria': criteria, 'tailor.done': [...nextDone], 'tailor.stale': [...stale], updatedAt: now(),
  });
  return { ok: true };
});

// ---- final feedback ---------------------------------------------------------------------------------------

/** A draft of the written feedback for one group (one call, one paragraph per member). */
export const plFeedbackDraft = callable(async (req) => {
  const { me, p, ref, id } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.assessing);
  const groupId = String(req.data?.groupId ?? '');
  const g = await ref.collection('groups').doc(groupId).get();
  if (!g.exists) fail('not-found', 'no-group');
  const [studentsQ, subsQ, assessQ, tasksQ] = await Promise.all([
    ref.collection('students').where('groupId', '==', groupId).get(),
    ref.collection('submissions').where('groupId', '==', groupId).get(),
    ref.collection('assessments').get(),
    ref.collection('tasks').where('groupId', '==', groupId).get(),
  ]);
  const members = studentsQ.docs.map((d) => ({ id: d.id, nickname: d.data().nickname }));
  if (!members.length) fail('failed-precondition', 'no-members');
  const assess = assessQ.docs.map((d) => d.data());
  const sk = p.skeleton;
  const nick = (sid) => members.find((m) => m.id === sid)?.nickname ?? 'a former member';
  const scaleQs = sk.assessment.contributionQuestions.filter((q) => q.kind === 'scale');
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
  const memberLines = members.map((m) => {
    const tasks = tasksQ.docs.map((d) => d.data()).filter((t) => t.ownerSid === m.id);
    const contrib = assess.filter((a) => a.kind === 'contribution' && a.rated === m.id)
      .map((a) => avg(scaleQs.map((q) => a.answers?.[q.id]).filter(Number.isInteger))).filter((x) => x !== null);
    const self = assess.find((a) => a.kind === 'self' && a.rater === m.id)?.answers;
    return `- sid ${m.id}, nickname ${m.nickname}: tasks done ${tasks.filter((t) => t.status === 'done').map((t) => t.title).join('; ') || 'none'}; `
      + `tasks open ${tasks.filter((t) => t.status !== 'done').length}; contribution average from teammates ${avg(contrib) ?? 'none'} (${contrib.length} ratings); `
      + `self-assessment ${self ? JSON.stringify(self) : 'not done'}`;
  }).join('\n');
  const teacherScores = assess.filter((a) => a.kind === 'teacher' && a.groupId === groupId).map((a) => ({ scores: a.scores, comment: a.comment }));
  const peer = {};
  for (const c of sk.assessment.criteria.filter((x) => x.peer)) {
    peer[c.name] = avg(assess.filter((a) => a.kind === 'peer' && a.groupId === groupId).map((a) => a.scores?.[c.id]).filter(Number.isInteger));
  }
  const handins = subsQ.docs.map((d) => d.data()).map((s) => ({
    milestone: sk.phases.find((ph) => ph.id === s.phaseId)?.milestone.title, by: s.contributors.map(nick), reflection: s.reflection,
  }));
  const language = sk.basics.workingLanguage in LANGUAGES ? sk.basics.workingLanguage : 'en';
  const v = {
    title: sk.basics.title, drivingQuestion: sk.basics.drivingQuestion,
    criteria: JSON.stringify(sk.assessment.criteria.map((c) => ({ id: c.id, name: c.name, best: c.levels.find((l) => l.score === 4)?.descriptor }))),
    groupName: g.data().name, teacherScores: JSON.stringify(teacherScores), peerScores: JSON.stringify(peer), handins: JSON.stringify(handins),
    members: memberLines, languageName: LANGUAGES[language], note: noteOf(req.data?.note) ? `The teacher asks: ${noteOf(req.data.note)}` : '',
    ageMin: sk.basics.level.ageMin, ageMax: sk.basics.level.ageMax, inputs: '', amount: '', unit: '', sizeMin: '', groupCount: '', lessonsRule: '',
    subjectList: '', project: '', phaseIds: '', roleIds: '',
  };
  const out = await withCredits(me.uid, 'final-feedback', `${id}/feedback/${groupId}`, async () => {
    const system = render(prompt('system').template, v);
    let text = render(prompt('feedback').template, v);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { data, usage } = await generateJson({ system, text, schema: FEEDBACK_SCHEMA, mock: () => mockFeedback(members) });
      console.log('pl-model', JSON.stringify({ step: 'feedback', attempt, model: isMock() ? 'mock' : MODEL, usage }));
      const errors = checkFeedback(data, members.map((m) => m.id));
      if (!errors.length) return { feedback: data };
      text += `\n\nYour previous answer had these problems; answer again with all of them fixed:\n${errors.map((e) => `- ${e.path}: ${e.message}`).join('\n')}`;
    }
    throw new Error('feedback checks failed twice');
  });
  await ref.collection('feedbackDrafts').doc(groupId).set({ ...out.feedback, at: now(), by: me.uid, approvedAt: null });
  return { balanceAfter: out.balanceAfter };
}, AI);

/** The teacher's edited feedback goes to the students: the group text to the group, each paragraph to its student. */
export const plFeedbackApprove = callable(async (req) => {
  const { p, ref } = await teacherProject(req, req.data?.projectId, 'lead');
  needStatus(p, STATUS.assessing, STATUS.closed);
  const groupId = String(req.data?.groupId ?? '');
  const group = cleanText(req.data?.group, FEEDBACK_LIMITS.group);
  if (!group) fail('invalid-argument', group === null ? 'too-long' : 'feedback-empty');
  const members = (await ref.collection('students').where('groupId', '==', groupId).get()).docs.map((d) => d.id);
  const texts = new Map((Array.isArray(req.data?.members) ? req.data.members : []).map((m) => [String(m?.sid), cleanText(m?.text, FEEDBACK_LIMITS.member)]));
  if ([...texts.values()].some((t) => t === null)) fail('invalid-argument', 'too-long');
  const batch = fs().batch();
  const t = now();
  const extra = p.deleteAt ? { deleteAt: p.deleteAt } : {};
  batch.set(ref.collection('feedback').doc(groupId), { groupId, text: group, approvedAt: t, ...extra });
  for (const sid of members) {
    const text = texts.get(sid);
    if (text) batch.set(ref.collection('feedbackStudents').doc(sid), { groupId, text, approvedAt: t, ...extra });
  }
  batch.set(ref.collection('feedbackDrafts').doc(groupId), { approvedAt: t }, { merge: true });
  await batch.commit();
  return { ok: true };
});

