// The AI parts of the teacher page (SPEC 7-9): credits, the idea form, tailoring step by step with
// approve / new version / discard, and the final written feedback per group. teacher.js owns the state
// and the page; this module renders its parts and handles its buttons.
import { esc, markdown } from './ui.js';
import { balance } from '/engines/hub/credits.js';
import { STEPS, TAILOR_STEPS, LANGUAGES, actionFor, launchProblems, IDEA_FIELDS } from '/engines/ai.js';
import { PRODUCT_TYPES, CEFR } from '/engines/skeleton.js';

const STEP_HELP = {
  plan: 'Phases, lesson-by-lesson run and milestones for your time and class.',
  groups: 'The brief the groups get, different angles per group if it helps, and the roles.',
  tasks: 'The tasks on each group’s board, phase by phase.',
  assessment: 'Criteria with four levels, self-assessment and teammate questions.',
  handouts: 'Printable sheets for the students (optional).',
  idea: 'The basics, phases, milestones and roles from your idea.',
};

export function aiModule(ctx) {
  const { S, val, clear, act, call, render } = ctx;
  const off = () => (S.busy ? 'disabled' : '');

  // ---- credits ----------------------------------------------------------------------------------------
  const bal = () => balance(S.credits ?? {}, Date.now());
  const price = (action) => S.prices?.[`potluck/${action}`];
  const costLabel = (action) => {
    const n = price(action);
    if (n === undefined || n === null) return 'not available yet';
    return n === 0 ? 'free' : `${n} credit${n === 1 ? '' : 's'}`;
  };
  const canPay = (action) => {
    const n = price(action);
    return n !== undefined && n !== null && (bal().unlimited || bal().total >= n);
  };
  function creditsLine() {
    const b = bal();
    return `<p class="muted small">${b.unlimited ? 'Unlimited credits' : `You have ${b.total} credit${b.total === 1 ? '' : 's'}`} ·
      <a href="${esc(ctx.hubAccountUrl)}" target="_blank" rel="noopener">Get credits or a Hub pass</a></p>`;
  }

  // ---- class inputs (shared by the idea form and tailoring) -------------------------------------------------
  function inputsFields(prefix, cur) {
    const v = (k, d) => val(`${prefix}${k}`, cur?.[k] ?? d);
    const subjects = cur?.subjects ?? [];
    const sel = (k, opts, d) => `<select id="${prefix}${k}" data-k="${prefix}${k}">${opts.map(([value, label]) => `<option value="${esc(value)}" ${String(v(k, d)) === String(value) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
    const num = (k, label, d, min, max) => `<div class="field"><label for="${prefix}${k}">${label}</label><input id="${prefix}${k}" type="number" min="${min}" max="${max}" data-k="${prefix}${k}" value="${esc(v(k, d))}"></div>`;
    return `<div class="grid2">
        ${[0, 1, 2].map((i) => `<div class="field"><label for="${prefix}subject${i}">Subject ${i + 1}${i ? ' (optional)' : ''}</label>
          <input id="${prefix}subject${i}" type="text" maxlength="40" data-k="${prefix}subject${i}" value="${esc(val(`${prefix}subject${i}`, subjects[i] ?? ''))}"></div>`).join('')}
      </div>
      <div class="grid2">
        ${num('groupCount', 'Number of groups', 4, 1, 12)}
        ${num('sizeMin', 'Smallest group', 3, 2, 8)}
        ${num('sizeMax', 'Largest group', 4, 2, 8)}
        ${num('amount', 'How long', 4, 1, 60)}
        <div class="field"><label for="${prefix}unit">in</label>${sel('unit', [['lessons', 'lessons'], ['weeks', 'weeks']], 'lessons')}</div>
        ${num('lessonMinutes', 'Minutes per lesson', 45, 30, 120)}
        ${num('ageMin', 'Youngest students (age)', 14, 6, 19)}
        ${num('ageMax', 'Oldest students (age)', 17, 6, 19)}
        <div class="field"><label for="${prefix}cefr">Language level (if a language is assessed)</label>${sel('cefr', [['', 'none'], ...CEFR.map((c) => [c, c])], '')}</div>
        <div class="field"><label for="${prefix}language">Language of the students’ texts</label>${sel('language', Object.entries(LANGUAGES), 'en')}</div>
      </div>
      <div class="field"><label for="${prefix}context">Anything about your class or town the plan should use (optional)</label>
        <textarea id="${prefix}context" rows="2" maxlength="400" data-k="${prefix}context">${esc(v('context', ''))}</textarea></div>`;
  }
  function readInputs(prefix, cur) {
    const v = (k, d) => val(`${prefix}${k}`, cur?.[k] ?? d);
    const subjects = cur?.subjects ?? [];
    return {
      subjects: [0, 1, 2].map((i) => val(`${prefix}subject${i}`, subjects[i] ?? '')).map((s) => s.trim()).filter(Boolean),
      groupCount: Number(v('groupCount', 4)), sizeMin: Number(v('sizeMin', 3)), sizeMax: Number(v('sizeMax', 4)),
      unit: v('unit', 'lessons'), amount: Number(v('amount', 4)), lessonMinutes: Number(v('lessonMinutes', 45)),
      ageMin: Number(v('ageMin', 14)), ageMax: Number(v('ageMax', 17)), cefr: v('cefr', '') || null, language: v('language', 'en'),
      context: v('context', ''),
    };
  }
  const fieldErrors = () => (S.fieldErrors?.length ? `<ul class="error">${S.fieldErrors.map((e) => `<li>${esc(e.message)}</li>`).join('')}</ul>` : '');

  // ---- idea form ----------------------------------------------------------------------------------------------
  function ideaView() {
    const area = (k, label, rows = 2, hint = '') => `<div class="field"><label for="idea-${k}">${label}</label>${hint ? `<span class="muted small">${hint}</span>` : ''}
      <textarea id="idea-${k}" rows="${rows}" maxlength="${IDEA_FIELDS[k]}" data-k="idea-${k}">${esc(val(`idea-${k}`))}</textarea></div>`;
    return `<p><button class="link-btn" type="button" data-home>All projects</button></p>
      <h1>Start from <span class="hl">your idea</span></h1>
      <p class="muted">Fill in what you know; AI drafts the plan on Potluck’s project frame, and you approve or change every step.</p>
      ${creditsLine()}
      <div class="box stack"><h2>The idea</h2>
        ${area('challenge', 'The challenge or driving question', 2, 'For example: what does a new student from abroad really need to know?')}
        <div class="field"><label for="idea-productType">What the groups make</label>
          <select id="idea-productType" data-k="idea-productType">${PRODUCT_TYPES.map((p) => `<option ${val('idea-productType', 'presentation') === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        ${area('product', 'Describe the product', 2)}
        ${area('audience', 'Who sees it', 1)}
        ${area('contributions', 'What each subject should bring (optional)', 2)}
        ${area('mustHave', 'Content or skills it must cover (optional)', 2)}
      </div>
      <div class="box stack"><h2>Your class</h2>${inputsFields('idea-', { subjects: [] })}</div>
      ${fieldErrors()}
      <p class="row"><button class="btn primary" type="button" data-ideago ${off()} ${canPay('from-idea') ? '' : 'disabled'}>Draft my project</button>
        <span class="muted small">${esc(costLabel('from-idea'))}</span></p>`;
  }

  // ---- tailoring ------------------------------------------------------------------------------------------------
  function stepRow(step, t) {
    const done = (t.done ?? []).includes(step);
    const stale = (t.stale ?? []).includes(step);
    const waiting = t.proposal?.step === step;
    const action = actionFor(step, { regenerate: done || waiting });
    const status = waiting ? '<span class="chip warn">Waiting for you</span>' : stale ? '<span class="chip bad">Needs a new version</span>' : done ? '<span class="chip ok">Done</span>' : '<span class="chip">Not yet</span>';
    const blocked = t.proposal && !waiting;
    const needIdea = S.p.source === 'idea' && !(t.done ?? []).includes('idea') && step !== 'idea';
    return `<li class="step-row">
      <div><strong>${STEPS[step].n}. ${esc(STEPS[step].label)}</strong> ${status}<br><span class="muted small">${esc(STEP_HELP[step])}</span></div>
      ${waiting ? '' : `<div class="row"><button class="btn sm" type="button" data-step="${step}" ${off()} ${blocked || needIdea || !canPay(action) ? 'disabled' : ''}>${done || stale ? 'Write a new version' : 'Write it'}</button>
        <span class="muted small">${esc(costLabel(action))}</span></div>`}
    </li>`;
  }

  function partPreview(step, part) {
    const list = (xs) => `<ul>${xs.join('')}</ul>`;
    if (step === 'idea') {
      const b = part.basics;
      return `<p><strong>${esc(b.title)}</strong></p><p class="dq">${esc(b.drivingQuestion)}</p><p>${esc(b.summary)}</p>
        <p><strong>Brief:</strong> ${esc(b.brief)}</p><p><strong>Product:</strong> ${esc(b.product.description)}</p>
        ${partPreview('plan', { phases: part.phases, subjects: b.subjects })}
        <h3>Roles</h3>${list(part.roles.map((r) => `<li><strong>${esc(r.name)}</strong>: ${esc(r.responsibility)}</li>`))}`;
    }
    if (step === 'plan') {
      return `${list(part.subjects.map((s) => `<li><strong>${esc(s.name)}</strong>: ${esc(s.contribution)}</li>`))}
        <ol>${part.phases.map((ph) => `<li><strong>${esc(ph.title)}</strong> · ${ph.lessons} lesson${ph.lessons === 1 ? '' : 's'}<br>${esc(ph.goal)}
          <br><span class="muted small">Milestone: ${esc(ph.milestone.title)} (${ph.milestone.handIn === 'link' ? 'link' : 'in class'}): ${esc(ph.milestone.deliverable)}</span></li>`).join('')}</ol>`;
    }
    if (step === 'groups') {
      return `<p><strong>Brief:</strong> ${esc(part.brief)}</p>
        ${part.briefs.length ? `<h3>Angles</h3>${list(part.briefs.map((b) => `<li><strong>${esc(b.title)}</strong>: ${esc(b.brief)}</li>`))}` : ''}
        <h3>Roles</h3>${list(part.roles.map((r) => `<li><strong>${esc(r.name)}</strong>${r.optional ? ' (larger groups)' : ''}: ${esc(r.responsibility)}</li>`))}`;
    }
    if (step === 'tasks') {
      const phases = S.p.skeleton.phases;
      return phases.map((ph) => `<h3>${esc(ph.title)}</h3>${list(part.tasks.filter((x) => x.phaseId === ph.id).map((x) => `<li><strong>${esc(x.title)}</strong> <span class="muted small">${esc(x.detail)}</span></li>`))}`).join('');
    }
    if (step === 'assessment') {
      const a = part.assessment;
      return `<h3>Criteria</h3>${list(a.criteria.map((c) => `<li><strong>${esc(c.name)}</strong> (${esc(c.subject)}, weight ${c.weight}${c.peer ? ', peers' : ''}): 4 = ${esc(c.levels.find((l) => l.score === 4)?.descriptor)}</li>`))}
        <h3>Self-assessment</h3>${list(a.selfQuestions.map((q) => `<li>${esc(q.text)}</li>`))}
        <h3>About each teammate</h3>${list(a.contributionQuestions.map((q) => `<li>${esc(q.text)}</li>`))}`;
    }
    if (step === 'handouts') {
      return part.handouts.map((h) => `<details class="box"><summary>${esc(h.title)}</summary><div class="md">${markdown(h.body)}</div></details>`).join('')
        + `<h3>Teacher notes</h3><p>${esc(part.teacherNotes.preparation)}</p>`;
    }
    return '';
  }

  function proposalBox(t) {
    const prop = t.proposal;
    if (!prop) return '';
    const regenAction = actionFor(prop.step, { regenerate: true });
    return `<div class="box stack proposal" id="proposal">
      <div class="row head"><h2>New: ${esc(STEPS[prop.step].label)}</h2><span class="chip warn">Waiting for you</span></div>
      ${prop.stale?.length ? `<p class="note">If you use this, ${prop.stale.map((s) => STEPS[s].label.toLowerCase()).join(', ')} will need a new version.</p>` : ''}
      <div class="stack preview">${partPreview(prop.step, prop.part)}</div>
      <div class="field"><label for="note">Want something different? Say what (optional)</label>
        <input id="note" type="text" maxlength="300" data-k="note" value="${esc(val('note'))}"></div>
      <div class="row"><button class="btn primary sm" type="button" data-accept ${off()}>Use this</button>
        <button class="btn sm" type="button" data-step="${prop.step}" ${off()} ${canPay(regenAction) ? '' : 'disabled'}>Write a new version (${esc(costLabel(regenAction))})</button>
        <button class="link-btn" type="button" data-discard ${off()}>Discard</button></div>
    </div>`;
  }

  function tailorSection() {
    const t = S.p.tailor ?? { done: TAILOR_STEPS, stale: [] };
    const steps = S.p.source === 'idea' ? ['idea', ...TAILOR_STEPS] : TAILOR_STEPS;
    const problems = launchProblems(S.p.skeleton);
    const missing = Object.keys(problems);
    return `<div class="box stack">
      <h2>Fit it to <span class="hl">your class</span></h2>
      <p class="muted">${S.p.source === 'idea' ? 'Run the steps in order; you approve each one.' : 'The template works as it is. To fit it to your class, give your numbers and let AI rewrite the steps you want.'}</p>
      ${creditsLine()}
      <details ${S.p.source === 'idea' || S.openInputs ? 'open' : ''}><summary>Your class: subjects, groups, time, level, language</summary>
        <div class="stack">${inputsFields('ti-', t.inputs)}${fieldErrors()}
        <p><button class="btn sm" type="button" data-saveinputs ${off()} ${t.proposal ? 'disabled' : ''}>Save these numbers</button></p></div></details>
      <ul class="plain steps">${steps.map((s) => stepRow(s, t)).join('')}</ul>
      ${missing.length ? `<p class="note">Before you launch: ${missing.map((s) => esc(STEPS[s]?.label ?? s)).join(', ')} still need${missing.length === 1 ? 's' : ''} work.</p>` : ''}
    </div>${proposalBox(t)}`;
  }

  // ---- final feedback ------------------------------------------------------------------------------------------
  function feedbackSection(g) {
    const draft = S.fbDrafts?.find((d) => d.id === g.id);
    const members = S.students.filter((s) => s.groupId === g.id);
    const canEdit = ctx.lead() && ['assessing', 'closed'].includes(S.p.status);
    if (!ctx.lead()) return '';
    const action = 'final-feedback';
    const head = `<div class="row head"><h3>Written feedback</h3>${draft?.approvedAt ? '<span class="chip ok">Students see it</span>' : draft ? '<span class="chip warn">Draft</span>' : ''}</div>`;
    if (!draft) {
      return `<div class="stack fb">${head}<p class="muted small">AI drafts a text for the group and a paragraph for each member from the scores, hand-ins and ratings. You edit it before the students see it.</p>
        ${S.p.status === 'assessing' ? `<p class="row"><button class="btn sm" type="button" data-fbdraft="${g.id}" ${off()} ${canPay(action) && members.length ? '' : 'disabled'}>Draft the feedback</button><span class="muted small">${esc(costLabel(action))}</span></p>` : ''}</div>`;
    }
    const k = (x) => `fb-${g.id}-${x}`;
    const memberText = (sid) => draft.members?.find((m) => m.sid === sid)?.text ?? '';
    return `<div class="stack fb">${head}
      <div class="field"><label for="${k('group')}">To the group</label><textarea id="${k('group')}" rows="4" maxlength="1200" data-k="${k('group')}" ${canEdit ? '' : 'disabled'}>${esc(val(k('group'), draft.group ?? ''))}</textarea></div>
      ${members.map((m) => `<div class="field"><label for="${k(m.id)}">To ${esc(m.nickname)} only</label><textarea id="${k(m.id)}" rows="3" maxlength="800" data-k="${k(m.id)}" ${canEdit ? '' : 'disabled'}>${esc(val(k(m.id), memberText(m.id)))}</textarea></div>`).join('')}
      ${canEdit ? `<p class="row"><button class="btn primary sm" type="button" data-fbapprove="${g.id}" ${off()}>${draft.approvedAt ? 'Update what students see' : 'Show it to the students'}</button>
        ${S.p.status === 'assessing' ? `<button class="btn sm" type="button" data-fbdraft="${g.id}" ${off()} ${canPay(action) ? '' : 'disabled'}>New draft (${esc(costLabel(action))})</button>` : ''}</p>` : ''}
    </div>`;
  }

  // ---- buttons ---------------------------------------------------------------------------------------------------
  const errorsFrom = (e) => { S.fieldErrors = e?.details?.errors ?? e?.errors ?? []; };
  function onClick(d) {
    if ('newidea' in d) { S.view = 'idea'; S.fieldErrors = []; ctx.closeProject(); render(); window.scrollTo(0, 0); return true; }
    if ('ideago' in d) {
      const inputs = readInputs('idea-', { subjects: [] });
      const idea = { ...inputs, productType: val('idea-productType', 'presentation') };
      for (const k of Object.keys(IDEA_FIELDS)) idea[k] = val(`idea-${k}`);
      act('idea', async () => {
        S.fieldErrors = [];
        try {
          const { projectId } = await call('plCreateFromIdea', { idea, timeZone: ctx.tz() });
          clear('idea-'); ctx.openProject(projectId, 'setup');
        } catch (e) { errorsFrom(e); throw e; }
      });
      return true;
    }
    if ('saveinputs' in d) {
      act('inputs', async () => {
        S.fieldErrors = [];
        try {
          const r = await call('plTailorInputs', { projectId: S.pid, inputs: readInputs('ti-', S.p.tailor?.inputs) });
          clear('ti-'); S.flash = r.stale?.length ? `Saved. Needs a new version: ${r.stale.map((s) => STEPS[s].label).join(', ')}.` : 'Saved.';
        } catch (e) { errorsFrom(e); throw e; }
      });
      return true;
    }
    if (d.step) {
      act('step', async () => {
        await call('plTailorStep', { projectId: S.pid, step: d.step, note: val('note') });
        clear('note');
        setTimeout(() => document.getElementById('proposal')?.scrollIntoView({ behavior: 'smooth' }), 50);
      });
      return true;
    }
    if ('accept' in d) { act('accept', async () => { const r = await call('plTailorDecide', { projectId: S.pid, accept: true }); clear('note'); S.flash = r.stale?.length ? `Used. Now write a new version of: ${r.stale.map((s) => STEPS[s].label).join(', ')}.` : 'Used.'; }); return true; }
    if ('discard' in d) { act('discard', () => call('plTailorDecide', { projectId: S.pid, accept: false })); return true; }
    if (d.fbdraft) { act('fbdraft', async () => { await call('plFeedbackDraft', { projectId: S.pid, groupId: d.fbdraft }); clear(`fb-${d.fbdraft}-`); }); return true; }
    if (d.fbapprove) {
      const g = d.fbapprove; const k = (x) => `fb-${g}-${x}`;
      const draft = S.fbDrafts?.find((x) => x.id === g);
      const members = S.students.filter((s) => s.groupId === g).map((m) => ({ sid: m.id, text: val(k(m.id), draft?.members?.find((x) => x.sid === m.id)?.text ?? '') }));
      act('fbapprove', async () => { await call('plFeedbackApprove', { projectId: S.pid, groupId: g, group: val(k('group'), draft?.group ?? ''), members }); S.flash = 'The students see the feedback now.'; });
      return true;
    }
    return false;
  }

  return { creditsLine, ideaView, tailorSection, feedbackSection, onClick };
}
