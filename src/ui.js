// Panels: library, inspector, show, paperwork.
import { CAT, CATS, specLine, val } from './catalog.js';
import { S, UI, esc, fmtFt, fmtN, pushUndo, dirty, save } from './state.js';
import { objs, sel, rebuildOne, duplicate, removeItem, select, fillTruss, fixturesOn, trussName } from './objects.js';
import { rigReport, patchMap, paperHTML, pill, patchCSV, gearCounts } from './paperwork.js';
import { applyEnv, buildCrowd } from './engine.js';
import { DEG } from './models.js';

export const $ = s => document.querySelector(s);
export const thumbs = {};
export const isMobile = () => matchMedia('(max-width: 820px)').matches;
export const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();

/* toast + clipboard */
let toastT = 0;
export function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
export function copy(text, msg) {
  const fb = () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(msg); } catch { toast('Select the text and copy it manually'); } ta.remove(); };
  try { navigator.clipboard.writeText(text).then(() => toast(msg), fb); } catch { fb(); }
}

/* ---------- library ---------- */
let placingCb = null;
export function renderLibrary(onPick) {
  placingCb = onPick;
  const q = ($('#libSearch')?.value || '').trim().toLowerCase();
  const html = CATS.map(c => {
    const items = Object.entries(CAT).filter(([k, d]) => d.cat === c && (!q || (d.name + ' ' + c + ' ' + k).toLowerCase().includes(q)));
    if (!items.length) return '';
    return `<div class="lcat">${c}</div><div class="lgrid">${items.map(([k, d]) => `
      <button class="card${UI.placing === k ? ' on' : ''}" data-t="${k}" title="${esc(d.name)} — ${esc(specLine(k))}">
        <span class="th">${thumbs[k] ? `<img src="${thumbs[k]}" alt="" draggable="false">` : ''}</span>
        <span class="nm">${esc(d.name)}</span><span class="sp">${esc(specLine(k))}</span>
      </button>`).join('')}</div>`;
  }).join('') || '<p class="note">No gear matches that search.</p>';
  $('#libList').innerHTML = html;
  $('#libCount').textContent = Object.keys(CAT).length + ' items';
  $('#libList').querySelectorAll('.card').forEach(b => b.onclick = () => placingCb(b.dataset.t));
}
export function markPlacing() { document.querySelectorAll('.card').forEach(b => b.classList.toggle('on', b.dataset.t === UI.placing)); }

/* ---------- inspector ---------- */
const SW = ['#ffffff', '#ffd2a1', '#ff9a3c', '#ff3f86', '#ff2ad4', '#b14dff', '#5b5bff', '#3fa2ff', '#7fe3ff', '#38f2a6'];
const pct = (v, mn, mx) => ((v - mn) / (mx - mn) * 100).toFixed(1) + '%';
function field(s, v) {
  const id = 'f_' + s.k;
  if (s.t === 'bool') return `<label class="tog" for="${id}">${esc(s.l)}<input type="checkbox" id="${id}" data-k="${s.k}" ${v ? 'checked' : ''}></label>`;
  if (s.t === 'sel') return `<label class="f"><span>${esc(s.l)}${s.u ? ` (${s.u})` : ''}</span><select id="${id}" data-k="${s.k}">${s.opts.map(o => `<option value="${o}" ${String(o) === String(v) ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  if (s.t === 'range') return `<label class="f wide"><span>${esc(s.l)}<em id="${id}_v">${v}${s.u || ''}</em></span><input type="range" id="${id}" data-k="${s.k}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}" style="--p:${pct(v, s.min, s.max)}"></label>`;
  if (s.t === 'color') return `<div class="f wide"><span>${esc(s.l)}</span><div class="swatches">${SW.map(c => `<button type="button" data-sw="${c}" class="${c === v ? 'on' : ''}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}<input type="color" id="${id}" data-k="${s.k}" value="${v}" style="width:22px;height:22px;padding:0;border-radius:50%" aria-label="Custom color"></div></div>`;
  if (s.t === 'text') return `<label class="f wide"><span>${esc(s.l)}</span><input type="text" id="${id}" data-k="${s.k}" value="${esc(v)}"></label>`;
  return `<label class="f"><span>${esc(s.l)}</span><span class="unit"><input type="number" id="${id}" data-k="${s.k}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}">${s.u ? `<i>${s.u}</i>` : ''}</span></label>`;
}
const LIVE = ['pan', 'tilt', 'dim', 'color', 'text', 'content'];
const LIGHTS = () => Object.keys(CAT).filter(k => CAT[k].mount === 'hang');
let lastFill = 'spot';
export const focusFill = () => { const e = $('#fillSec'); if (e) { e.scrollIntoView({ block: 'start', behavior: 'smooth' }); e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 900); } };

/* ---------- scene list ---------- */
export function renderScene(onPick) {
  const el = $('#pane-scene'); if (el.hidden) return;
  const groups = CATS.map(c => [c, [...objs.values()].filter(o => o.def.cat === c).sort((a, b) => a.item.id - b.item.id)]).filter(g => g[1].length);
  el.innerHTML = `<div class="empty"><h3>Scene</h3><p>Everything in the design. Click a row to select it and fly the camera to it.</p></div>` +
    groups.map(([c, list]) => `<div class="sgrp"><h4>${c} <span>${list.length}</span></h4>${list.map(o => {
      const it = o.item, p = it.props;
      const name = it.type === 'truss' ? `${trussName(it.id)} <small>${p.size}″ · ${p.len} ft</small>` : esc(o.def.name);
      const dot = o.def.model && p.color ? `<i class="dot" style="background:${p.color}"></i>` : '';
      return `<button class="srow${UI.selId === it.id ? ' on' : ''}" data-id="${it.id}"><span>${dot}${name}</span><em>${fmtFt(it.x)}, ${fmtFt(it.z)}${it.y ? ` · ${fmtFt(it.y)} up` : ''}</em></button>`;
    }).join('')}</div>`).join('');
  el.querySelectorAll('.srow').forEach(b => b.onclick = () => onPick(+b.dataset.id));
}
let editing = false;
export function renderInspector() {
  const el = $('#pane-insp'), o = sel();
  if (!o) {
    el.innerHTML = `<div class="empty"><h3>Nothing selected</h3>
      <p>Click anything on the stage to edit it here. To add gear, drag it in from the Library. Lights snap onto truss and hang on their own.</p>
      <div class="keys"><kbd>Drag</kbd><span>Move the selected thing</span><kbd>R</kbd><span>Rotate 90° (Shift+R for 15°)</span><kbd>D</kbd><span>Duplicate</span><kbd>Del</kbd><span>Delete</span><kbd>Ctrl Z</kbd><span>Undo (Ctrl Shift Z to redo)</span><kbd>F</kbd><span>Zoom to the selection</span><kbd>1–4</kbd><span>3D, Plan, Front, Crowd POV</span><kbd>Space</kbd><span>Play or pause the show</span><kbd>Esc</kbd><span>Cancel / deselect</span></div></div>
      <div class="sec"><h4>Camera</h4><div class="keys" style="margin:0"><kbd>Drag</kbd><span>Orbit around the stage</span><kbd>Right-drag</kbd><span>Slide the view (two fingers on a trackpad)</span><kbd>Scroll</kbd><span>Zoom</span><kbd>Double-click</kbd><span>Fly to that object</span></div></div>
      <div class="sec"><h4>Units</h4><p class="note" style="margin:0">Feet throughout. Height is the bottom of floor gear, the bottom chord of truss, and the clamp point of hung fixtures. Downstage is +Z, toward the crowd.</p></div>`;
    return;
  }
  const it = o.item, d = o.def, p = it.props, s = o.size, pt = patchMap().get(it.id);
  const rig = it.type === 'truss' ? rigReport().rows.find(r => r.id === it.id) : null;
  const onIt = it.type === 'truss' ? fixturesOn(o).length : 0, defN = Math.max(2, Math.round(p.len / 6));
  const yLabel = d.model && p.hung ? 'Clamp height' : it.type === 'truss' ? 'Trim' : 'Height';
  el.innerHTML = `
    <div class="ihead"><span class="th">${thumbs[it.type] ? `<img src="${thumbs[it.type]}" alt="">` : ''}</span>
      <div><h3>${esc(d.name)}</h3><div class="chips"><span class="chip">#${it.id}</span>${pt ? `<span class="chip dmx">DMX ${pt.u}.${String(pt.a).padStart(3, '0')} · ${d.dmx} ch</span>` : ''}${rig ? `<span class="chip">${rig.label}</span>` : ''}</div></div></div>
    <div class="sec"><h4>Position</h4><div class="fields">
      <label class="f"><span>X · stage L–R</span><span class="unit"><input type="number" id="p_x" step="${UI.snap || .1}" value="${it.x}"><i>ft</i></span></label>
      <label class="f"><span>Z · up/downstage</span><span class="unit"><input type="number" id="p_z" step="${UI.snap || .1}" value="${it.z}"><i>ft</i></span></label>
      <label class="f"><span>${yLabel}</span><span class="unit"><input type="number" id="p_y" step="${UI.snap || .1}" value="${it.y}"><i>ft</i></span></label>
      <label class="f"><span>Rotation</span><span class="unit"><input type="number" id="p_r" step="15" value="${it.rot}"><i>°</i></span></label></div></div>
    ${it.type === 'truss' ? `<div class="sec fillsec" id="fillSec"><h4>Hang lights on this truss</h4><div class="fields">
      <label class="f"><span>Fixture</span><select id="fill_t">${LIGHTS().map(k => `<option value="${k}" ${k === lastFill ? 'selected' : ''}>${CAT[k].name}</option>`).join('')}</select></label>
      <label class="f"><span>How many</span><input type="number" id="fill_n" min="1" max="80" step="1" value="${defN}"></label>
      ${onIt ? `<label class="tog">Replace the ${onIt} already on it<input type="checkbox" id="fill_r" checked></label>` : ''}
      </div><button class="btn accent wide" id="fill_go">Hang ${defN} evenly</button>
      <p class="note">Spaced evenly along the ${p.len} ft span, clamped on and hanging.</p></div>` : ''}
    ${d.schema.length ? `<div class="sec"><h4>Settings</h4><div class="fields">${d.schema.map(sc => field(sc, p[sc.k])).join('')}</div></div>` : ''}
    <div class="sec"><h4>Specs</h4><dl class="kv">
      <dt>Footprint</dt><dd>${fmtFt(s.x)} × ${fmtFt(s.z)} × ${fmtFt(s.y)}</dd>
      <dt>Weight</dt><dd>${fmtN(val(d.lb, p))} lb</dd>
      ${val(d.W, p) ? `<dt>Power, max</dt><dd>${fmtN(val(d.W, p))} W · ${(val(d.W, p) / 120).toFixed(1)} A</dd>` : ''}
      ${d.beam ? `<dt>Beam angle</dt><dd>${d.beam}°</dd>` : ''}
      ${rig ? `<dt>Hung on it</dt><dd>${rig.count} · ${fmtN(rig.hung)} lb</dd><dt>vs est. rating</dt><dd>${fmtN(rig.hung)} / ${fmtN(rig.allow)} lb ${pill(rig.pct)}</dd>` : ''}
    </dl></div>
    <div class="row-actions"><button class="btn" id="i_dup">Duplicate</button><button class="btn danger" id="i_del">Delete</button></div>`;

  for (const [id, key] of [['p_x', 'x'], ['p_z', 'z'], ['p_y', 'y'], ['p_r', 'rot']]) {
    const inp = $('#' + id);
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value); if (isNaN(v)) return;
      pushUndo(); it[key] = v; o.root.position.set(it.x, it.y, it.z); o.root.rotation.y = it.rot * DEG; dirty();
    });
  }
  const apply = (k, v) => {
    if (!editing) { pushUndo(); editing = true; }
    p[k] = v; if (!LIVE.includes(k)) rebuildOne(it.id); dirty();
  };
  el.querySelectorAll('[data-k]').forEach(inp => {
    const k = inp.dataset.k, sc = d.schema.find(x => x.k === k);
    const read = () => {
      let v = sc.t === 'bool' ? inp.checked : (sc.t === 'num' || sc.t === 'range') ? parseFloat(inp.value) : inp.value;
      if (sc.t === 'sel' && typeof sc.opts[0] === 'number') v = parseFloat(v);
      if (sc.t === 'num') { if (isNaN(v)) return null; v = Math.min(sc.max, Math.max(sc.min, v)); }
      return v;
    };
    const live = sc.t === 'range' || sc.t === 'color' || sc.t === 'text';
    inp.addEventListener(live ? 'input' : 'change', () => {
      const v = read(); if (v === null) return; apply(k, v);
      if (sc.t === 'range') { $('#' + inp.id + '_v').textContent = v + (sc.u || ''); inp.style.setProperty('--p', pct(v, sc.min, sc.max)); }
      if (sc.t === 'color') el.querySelectorAll('[data-sw]').forEach(b => b.classList.toggle('on', b.dataset.sw === v));
      if (!live) { editing = false; renderInspector(); }
    });
    if (live) inp.addEventListener('change', () => { editing = false; });
  });
  el.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { editing = false; apply('color', b.dataset.sw); editing = false; renderInspector(); });
  $('#i_dup').onclick = () => { duplicate(); };
  const fg = $('#fill_go');
  if (fg) {
    const n = () => Math.max(1, Math.min(80, parseInt($('#fill_n').value) || 1));
    $('#fill_n').oninput = () => { fg.textContent = `Hang ${n()} evenly`; };
    $('#fill_t').onchange = e => { lastFill = e.target.value; };
    fg.onclick = () => {
      lastFill = $('#fill_t').value; const c = n();
      fillTruss(it.id, lastFill, c, !!$('#fill_r')?.checked);
      toast(`Hung ${c} × ${CAT[lastFill].name} on ${trussName(it.id)}`);
    };
  }
  $('#i_del').onclick = () => { removeItem(it.id); select(null); dirty(); };
}
export function syncPos() {
  const o = sel(); if (!o) return;
  const m = { p_x: 'x', p_z: 'z', p_y: 'y', p_r: 'rot' };
  for (const id in m) { const e = $('#' + id); if (e && document.activeElement !== e) e.value = o.item[m[id]]; }
}

/* ---------- paperwork ---------- */
export function renderPaper() {
  const el = $('#pane-paper');
  el.innerHTML = paperHTML() + (framed ? '' : `<div class="actions" style="margin-top:20px"><button class="btn" id="printBtn">Print or save as PDF</button></div>`);
  el.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
    if (b.dataset.copy === 'patch') copy(patchCSV(patchMap()), 'Patch copied as CSV');
    else copy(`${S.name} — gear list\n` + gearCounts().map(([k, n]) => `${n}× ${k}`).join('\n'), 'Gear list copied');
  });
  const pb = $('#printBtn'); if (pb) pb.onclick = () => window.print();
}

/* ---------- show ---------- */
export const LOOKS = [['static', 'Static'], ['sweep', 'Sweep'], ['fan', 'Fan'], ['ballyhoo', 'Ballyhoo'], ['chase', 'Chase'], ['strobe', 'Strobe hit']];
export function renderShow(onChange) {
  const s = S.show, el = $('#pane-show');
  const rng = (id, l, v, mn, mx, st, u) => `<label class="f wide"><span>${l}<em id="${id}_v">${v}${u}</em></span><input type="range" id="${id}" min="${mn}" max="${mx}" step="${st}" value="${v}" style="--p:${pct(v, mn, mx)}"></label>`;
  el.innerHTML = `<div class="empty"><h3>Show &amp; previs</h3><p>Run looks through the rig to check sightlines, beam coverage and what the crowd actually sees.</p></div>
    <div class="sec"><h4>Program</h4><div class="fields">
      <label class="f wide"><span>Look</span><select id="s_prog">${LOOKS.map(([v, l]) => `<option value="${v}" ${s.program === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${rng('s_spd', 'Speed', s.speed, 0, 3, .1, '×')}
      ${rng('s_mst', 'Grand master', s.master, 0, 100, 1, '%')}
      <label class="tog">Color-cycle every fixture<input type="checkbox" id="s_rb" ${s.rainbow ? 'checked' : ''}></label></div></div>
    <div class="sec"><h4>Atmosphere</h4><div class="fields">
      ${rng('s_hz', 'Haze', s.haze, 0, 100, 1, '%')}
      <label class="tog">Night show<input type="checkbox" id="s_nt" ${s.night ? 'checked' : ''}></label></div></div>
    <div class="sec"><h4>Audience</h4><div class="fields">
      <label class="tog">Show crowd<input type="checkbox" id="s_cr" ${s.crowd ? 'checked' : ''}></label>
      <label class="f"><span>Heads</span><input type="number" id="s_cn" min="0" max="5000" step="100" value="${s.crowdN}"></label>
      <label class="f"><span>Zone width</span><span class="unit"><input type="number" id="s_cw" min="10" max="400" step="5" value="${s.crowdW}"><i>ft</i></span></label>
      <label class="f"><span>Zone depth</span><span class="unit"><input type="number" id="s_cd" min="10" max="400" step="5" value="${s.crowdD}"><i>ft</i></span></label></div>
      <p class="note">The zone starts 14 ft downstage of the deck edge. At 5 ft² per person it holds about ${fmtN(s.crowdW * s.crowdD / 5)} people.</p></div>`;
  const bind = (id, ev, fn) => $('#' + id).addEventListener(ev, fn);
  const rangeBind = (id, k, u, after) => bind(id, 'input', e => { s[k] = +e.target.value; $('#' + id + '_v').textContent = s[k] + u; e.target.style.setProperty('--p', pct(s[k], +e.target.min, +e.target.max)); after?.(); save(); });
  bind('s_prog', 'change', e => { s.program = e.target.value; save(); onChange(); });
  rangeBind('s_spd', 'speed', '×'); rangeBind('s_mst', 'master', '%'); rangeBind('s_hz', 'haze', '%', applyEnv);
  bind('s_rb', 'change', e => { s.rainbow = e.target.checked; save(); });
  bind('s_nt', 'change', e => { s.night = e.target.checked; applyEnv(); save(); });
  bind('s_cr', 'change', e => { s.crowd = e.target.checked; buildCrowd(); save(); });
  for (const [id, k] of [['s_cn', 'crowdN'], ['s_cw', 'crowdW'], ['s_cd', 'crowdD']])
    bind(id, 'change', e => { const v = parseFloat(e.target.value); if (isNaN(v)) return; s[k] = v; buildCrowd(); renderShow(onChange); save(); });
}
