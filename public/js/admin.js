// The Potluck admin (P3; Hub admins only, settings/admins): shared templates. Import the built-in files,
// upload a template JSON (checked, shown as a preview, saved as a draft), publish, unpublish, archive and
// order. teacher.js owns the page and the state; this module renders the admin view and its buttons.
import { esc, fmtDate } from './ui.js';

export function adminModule(ctx) {
  const { S, val, clear, act, call, render } = ctx;
  const off = () => (S.busy ? 'disabled' : '');
  const A = { list: null, builtins: [], check: null, open: null };
  S.admin = A;

  async function load() { const r = await call('plAdminTemplates', {}); A.list = r.templates; A.builtins = r.builtins; }

  const STATUS_CHIP = { live: ['Live', 'ok'], draft: ['Draft', 'warn'], archived: ['Archived', ''] };
  function row(tpl) {
    const [label, kind] = STATUS_CHIP[tpl.status] ?? [tpl.status, ''];
    const open = A.open === tpl.id;
    return `<div class="box stack">
      <div class="row head"><h3>${esc(tpl.title)}</h3><span class="chip ${kind}">${esc(label)}</span></div>
      <p class="muted small">${esc(tpl.slug)} · ${esc(tpl.source)} · updated ${esc(fmtDate(tpl.updatedAt))}${tpl.meta?.durationHint ? ` · ${esc(tpl.meta.durationHint)}` : ''}</p>
      <div class="row">
        ${tpl.status !== 'live' ? `<button class="btn primary sm" type="button" data-tplstatus="live" data-tpl="${esc(tpl.id)}" ${off()}>Publish</button>` : `<button class="btn sm" type="button" data-tplstatus="draft" data-tpl="${esc(tpl.id)}" ${off()}>Unpublish</button>`}
        ${tpl.status !== 'archived' ? `<button class="btn sm" type="button" data-tplstatus="archived" data-tpl="${esc(tpl.id)}" ${off()}>Archive</button>` : ''}
        <label class="row small">Order <input type="number" min="0" max="999" style="width:90px" data-k="order-${esc(tpl.id)}" value="${esc(val(`order-${tpl.id}`, tpl.order ?? 0))}"></label>
        <button class="btn sm" type="button" data-tplorder="${esc(tpl.id)}" ${off()}>Save order</button>
        <button class="link-btn" type="button" data-tplopen="${esc(tpl.id)}">${open ? 'Hide' : 'Preview'}</button>
      </div>
      ${open ? `<div class="stack">${ctx.skeletonView(tpl.skeleton, {}, { print: false })}</div>` : ''}
    </div>`;
  }

  function uploadBox() {
    const c = A.check;
    return `<div class="box stack"><h2>Upload a template</h2>
      <p class="muted">A template is a JSON file: <code>{ "slug": "...", "meta": { "tags": [], "durationHint": "..." }, "skeleton": { ... } }</code>, or a bare skeleton. It is checked against the project frame, shown as a preview, and saved as a draft.</p>
      <div class="field"><label for="tpl-file">JSON file</label><input id="tpl-file" type="file" accept="application/json,.json" data-tplfile></div>
      <div class="field"><label for="tpl-json">or paste it here</label><textarea id="tpl-json" rows="6" data-k="tplJson" spellcheck="false">${esc(val('tplJson'))}</textarea></div>
      <p class="row"><button class="btn sm" type="button" data-tplcheck ${off()}>Check</button></p>
      ${c ? (c.ok ? `<p class="note">It fits the project frame: <strong>${esc(c.template.skeleton.basics.title)}</strong> (${esc(c.template.slug)}).</p>
          <label class="check"><input type="checkbox" data-k="tplReplace" ${val('tplReplace', false) ? 'checked' : ''}> Replace a template with the same slug</label>
          <p class="row"><button class="btn primary sm" type="button" data-tplsave ${off()}>Save as draft</button></p>
          <details class="box"><summary>Preview</summary><div class="stack">${ctx.skeletonView(c.template.skeleton, {}, { print: false })}</div></details>`
        : `<div class="error"><p>${c.errors.length} problem${c.errors.length === 1 ? '' : 's'}:</p><ul>${c.errors.map((e) => `<li><code>${esc(e.path)}</code>: ${esc(e.message)}</li>`).join('')}</ul></div>`) : ''}
    </div>`;
  }

  function view() {
    if (!A.list) return `<p><button class="link-btn" type="button" data-home>All projects</button></p><h1>Admin</h1><p class="muted">Loading the templates.</p>`;
    const missing = A.builtins.filter((slug) => !A.list.some((x) => x.slug === slug));
    return `<p><button class="link-btn" type="button" data-home>All projects</button></p>
      <h1>Templates</h1>
      <p class="muted">Teachers see the live templates, in this order. Drafts and archived templates stay here.</p>
      <div class="box stack"><h2>Built-in templates</h2>
        <p class="muted">${A.builtins.length} template file${A.builtins.length === 1 ? '' : 's'} in the code${missing.length ? `; not imported yet: ${missing.map(esc).join(', ')}` : ', all imported'}. Importing again updates their content and keeps their status.</p>
        <p><button class="btn sm" type="button" data-tplimport ${off()}>Import the built-in templates</button></p></div>
      <div class="list">${A.list.map(row).join('') || '<p class="muted">No templates yet.</p>'}</div>
      ${uploadBox()}`;
  }

  async function readFile(input) {
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > 900_000) { S.error = 'The file is too large (at most 900 KB).'; render(); return; }
    const text = await f.text();
    ctx.D.tplJson = text; A.check = null; render();
  }

  function onClick(d) {
    if ('admin' in d) { ctx.closeProject(); S.view = 'admin'; A.list = null; render(); act('admin', load); return true; }
    if (d.tplopen) { A.open = A.open === d.tplopen ? null : d.tplopen; render(); return true; }
    if (d.tplstatus) { act('tpl', async () => { await call('plAdminSetTemplate', { id: d.tpl, status: d.tplstatus }); await load(); }); return true; }
    if (d.tplorder) { act('tpl', async () => { await call('plAdminSetTemplate', { id: d.tplorder, order: Number(val(`order-${d.tplorder}`)) }); clear(`order-${d.tplorder}`); await load(); }); return true; }
    if ('tplimport' in d) { act('tpl', async () => { const r = await call('plAdminImportBuiltins', {}); await load(); S.flash = `Imported: ${r.results.filter((x) => x.imported).map((x) => x.slug).join(', ')}.`; }); return true; }
    if ('tplcheck' in d) {
      act('tpl', async () => {
        let json;
        try { json = JSON.parse(val('tplJson')); } catch { A.check = { ok: false, errors: [{ path: '(file)', message: 'this is not valid JSON' }] }; return; }
        A.check = await call('plAdminUpload', { json });
      });
      return true;
    }
    if ('tplsave' in d) {
      act('tpl', async () => {
        const r = await call('plAdminUpload', { json: JSON.parse(val('tplJson')), save: true, replace: !!val('tplReplace', false) });
        A.check = null; clear('tpl'); await load(); S.flash = `Saved as a draft: ${r.saved}. Publish it when it is ready.`;
      });
      return true;
    }
    return false;
  }

  return { view, onClick, readFile };
}
