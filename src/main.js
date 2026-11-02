// OpenRig — boot, input wiring and the render loop.
import * as THREE from 'three';
import { CAT } from './catalog.js';
import { S, UI, on, dirty, save, exportDesign, loadSaved, pushUndo, popUndo, popRedo, dropUndo, fmtFt, fmtN, clone, reduceMotion, store, esc } from './state.js';
import { canvas, host, composer, pcam, pctl, tctl, fctl, cam, ctl, tc, frameAll, setCamera, resize, applyEnv, viewTweaks, buildCrowd, bounceCrowd, focusBox, stepFocus, cancelFocus, Q, setQuality, adapt } from './engine.js';
import { objs, rebuildAll, select, sel, applyTool, applySnap, setRay, pick, groundPoint, placeAt, duplicate, removeItem, attachedTo,
  updateGhost, hideGhost, endPlacing, rotatePlacing, rotateSel, beginDrag, dragMove, endDrag, dragging, trussName, updateSelHelper } from './objects.js';
import { animate, drawWall, T } from './show.js';
import { TEMPLATES } from './templates.js';
import { totals } from './paperwork.js';
import { renderThumbs } from './thumbs.js';
import { $, thumbs, isMobile, framed, toast, copy, renderLibrary, markPlacing, renderInspector, syncPos, renderPaper, renderShow, renderScene, focusFill, LOOKS } from './ui.js';

const tip = $('#tip');
function showTip(e, html) {
  if (!html) { tip.hidden = true; return; }
  const r = host.getBoundingClientRect();
  tip.innerHTML = html; tip.hidden = false;
  const x = Math.min(e.clientX - r.left + 16, r.width - tip.offsetWidth - 8), y = Math.max(8, e.clientY - r.top - tip.offsetHeight - 12);
  tip.style.transform = `translate(${x}px, ${y}px)`;
}

/* ---------- placing ---------- */
function setPlace(t) {
  if (t) select(null);
  UI.placing = t; markPlacing();
  const h = $('#hint');
  if (!t) { h.hidden = true; canvas.style.cursor = ''; endPlacing(); tip.hidden = true; syncSelbar(); return; }
  const d = CAT[t]; canvas.style.cursor = 'crosshair';
  const where = d.mount === 'hang' ? 'on a truss, a deck or the floor' : d.mount === 'top' ? 'on a truss' : d.mount === 'free' ? 'on the floor under where it should hang' : 'on the floor or a deck';
  h.innerHTML = isMobile() ? `Tap the stage to drop the <b>${esc(d.name.toLowerCase())}</b> ${where}. <button id="hintX">Cancel</button>`
    : `Click ${where} to drop the <b>${esc(d.name.toLowerCase())}</b>. <kbd>R</kbd> rotates · <kbd>Shift</kbd> keeps placing · <kbd>Esc</kbd> cancels`;
  h.hidden = false;
  const x = $('#hintX'); if (x) x.onclick = () => setPlace(null);
}
let suppressClick = false;
const pickFromLibrary = t => { if (suppressClick) { suppressClick = false; return; } setPlace(UI.placing === t ? null : t); };
function doPlace(shift) {
  const r = placeAt(UI.placing);
  if (r) toast(`${CAT[r.it.type].name} added · ${r.label}`);
  if (!shift) setPlace(null);
}

/* drag a card from the library straight onto the stage (mouse/pen) */
let libDrag = null;
$('#libList').addEventListener('pointerdown', e => {
  const card = e.target.closest('.card'); if (!card || e.pointerType === 'touch' || e.button !== 0) return;
  e.preventDefault(); // no native drag ghost
  libDrag = { t: card.dataset.t, x: e.clientX, y: e.clientY, on: false };
});
const overCanvas = e => { const r = canvas.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && !e.target.closest('.panel'); };
document.addEventListener('pointermove', e => {
  if (!libDrag) return;
  if (!libDrag.on && Math.hypot(e.clientX - libDrag.x, e.clientY - libDrag.y) > 6) { libDrag.on = true; setPlace(libDrag.t); document.body.classList.add('dragging'); }
  if (!libDrag.on) return;
  if (overCanvas(e)) { setRay(e, canvas); const r = updateGhost(); showTip(e, r ? `<b>${esc(CAT[UI.placing].name)}</b>${esc(r.label)}` : ''); }
  else { hideGhost(); tip.hidden = true; }
});
document.addEventListener('pointerup', e => {
  if (!libDrag) return; const d = libDrag; libDrag = null; document.body.classList.remove('dragging');
  if (!d.on) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  if (overCanvas(e)) { setRay(e, canvas); doPlace(e.shiftKey); } else setPlace(null);
});

/* ---------- canvas pointer ---------- */
let down = null;
canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary || e.button !== 0) { down = null; return; }
  cancelFocus();
  const ptr = setRay(e, canvas);
  down = { x: e.clientX, y: e.clientY, giz: false, drag: false };
  if (UI.placing) return;
  const o = sel();
  if (o) {
    tc.pointerHover(ptr);
    if (tc.axis) { down.giz = true; return; }
    const h = pick();
    if (h && h.object.userData.id === o.item.id) {
      // drag the selected object: block the camera for this gesture
      beginDrag(o.item.id, h.point); down.drag = true;
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
      e.stopImmediatePropagation();
    }
  }
}, { capture: true });

let hovT = 0;
canvas.addEventListener('pointermove', e => {
  if (down?.drag) {
    setRay(e, canvas); const r = dragMove();
    if (r) showTip(e, `<b>${esc(sel()?.def.name || '')}</b>${esc(r.label)}`);
    return;
  }
  const now = performance.now(); if (now - hovT < 40) return; hovT = now;
  setRay(e, canvas);
  const p = groundPoint(); if (p) $('#rdCur').innerHTML = `X <b>${fmtFt(p.x)}</b>  Z <b>${fmtFt(p.z)}</b>`;
  if (down) { tip.hidden = true; return; }
  if (UI.placing) { const r = updateGhost(); showTip(e, r ? `<b>${esc(CAT[UI.placing].name)}</b>${esc(r.label)}` : ''); return; }
  if (e.pointerType !== 'mouse') return;
  const h = pick(), o = h && objs.get(h.object.userData.id);
  if (!o) { tip.hidden = true; canvas.style.cursor = ''; return; }
  const isSel = o.item.id === UI.selId;
  canvas.style.cursor = isSel ? 'grab' : 'pointer';
  const nm = o.item.type === 'truss' ? `${trussName(o.item.id)} · ${o.item.props.len} ft` : o.def.name;
  showTip(e, `<b>${esc(nm)}</b>${isSel ? 'Drag to move' : 'Click to select'}`);
});
canvas.addEventListener('pointerleave', () => { tip.hidden = true; if (UI.placing && !libDrag) hideGhost(); });
canvas.addEventListener('pointerup', e => {
  if (!down) return; const d = down; down = null;
  if (d.drag) { endDrag(); canvas.style.cursor = 'grab'; tip.hidden = true; syncPos(); renderInspector(); return; }
  const mv = Math.hypot(e.clientX - d.x, e.clientY - d.y);
  if (mv > 6 || d.giz) return;
  setRay(e, canvas);
  if (UI.placing) { doPlace(e.shiftKey); return; }
  const h = pick(); select(h ? h.object.userData.id : null);
});
canvas.addEventListener('dblclick', e => {
  setRay(e, canvas); const h = pick(); if (!h) return;
  select(h.object.userData.id); focusSel();
});
function focusSel() { const o = sel(); if (o) focusBox(new THREE.Box3().setFromObject(o.hitbox)); }

/* ---------- floating selection bar ---------- */
const selbar = $('#selbar'), _v = new THREE.Vector3(), _b = new THREE.Box3();
function syncSelbar() {
  const o = sel();
  if (!o || UI.placing) { selbar.hidden = true; return; }
  selbar.hidden = false;
  $('#sbName').textContent = o.item.type === 'truss' ? `${trussName(o.item.id)} · ${o.item.props.len} ft` : o.def.name;
  $('#sbFill').hidden = o.item.type !== 'truss';
  $('#sbHint').textContent = isMobile() ? 'Drag it to move' : 'Drag to move · pull the arrow for height';
}
function placeSelbar() {
  const o = sel(); if (!o || selbar.hidden || isMobile()) { selbar.style.transform = ''; return; }
  _b.setFromObject(o.hitbox); _b.getCenter(_v); _v.y = _b.max.y;
  _v.project(cam());
  const W = host.clientWidth, H = host.clientHeight, w = selbar.offsetWidth, h = selbar.offsetHeight;
  let x = (_v.x * .5 + .5) * W - w / 2, y = (-_v.y * .5 + .5) * H - h - 18;
  if (_v.z > 1) y = -999;
  const minX = W > 1100 ? 296 : 260, maxX = W - (W > 1100 ? 376 : 344) - w;
  x = Math.max(minX, Math.min(maxX, x)); y = Math.max(12, Math.min(H - h - 80, y));
  selbar.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
$('#sbRot').onclick = () => rotateSel(90);
$('#sbDup').onclick = () => dup();
$('#sbDel').onclick = () => del();
$('#sbFocus').onclick = focusSel;
$('#sbFill').onclick = () => { showTab('insp'); requestAnimationFrame(focusFill); };

/* ---------- views ---------- */
const VIEWTAG = { '3d': 'Perspective · grid 5 ft', plot: 'Plan view · grid 1 ft / 5 ft', front: 'Front elevation', pov: 'Crowd POV · eye 5′ 6″' };
function setView(v) {
  cancelFocus();
  UI.view = v; [pctl, tctl, fctl].forEach(c => c.enabled = false); ctl().enabled = true; setCamera(cam());
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'pov') { pcam.position.set(0, 5.5, 60); pctl.target.set(0, 15, -14); pcam.fov = 55; pcam.updateProjectionMatrix(); }
  else if (v === '3d' && pcam.position.y < 8) frameAll();
  $('#viewtag').textContent = VIEWTAG[v]; viewTweaks(); resize();
  $('#navhelp').innerHTML = v === 'plot' || v === 'front'
    ? '<span><kbd>Drag</kbd> pan</span><span><kbd>Scroll</kbd> zoom</span><span><kbd>Double-click</kbd> zoom to</span>'
    : '<span><kbd>Drag</kbd> orbit</span><span><kbd>Right-drag</kbd> pan</span><span><kbd>Scroll</kbd> zoom</span><span><kbd>Double-click</kbd> zoom to</span>';
}
// in flat views a left-drag pans instead of doing nothing
tctl.mouseButtons.LEFT = THREE.MOUSE.PAN; fctl.mouseButtons.LEFT = THREE.MOUSE.PAN;
tctl.touches.ONE = THREE.TOUCH.PAN; fctl.touches.ONE = THREE.TOUCH.PAN;

/* ---------- actions ---------- */
function restore(d) {
  S.items = d.items; S.nextId = d.nextId; if (d.name) { S.name = d.name; $('#projName').value = S.name; }
  rebuildAll(); renderInspector(); dirty();
}
function undo() { const d = popUndo(); if (!d) { toast('Nothing to undo'); return; } restore(d); toast('Undone'); }
function redo() { const d = popRedo(); if (!d) { toast('Nothing to redo'); return; } restore(d); toast('Redone'); }
function del() {
  const o = sel(); if (!o) return; pushUndo();
  const n = o.def.name, kids = attachedTo(o);
  kids.forEach(k => removeItem(k.item.id)); removeItem(o.item.id); select(null); dirty();
  toast(kids.length ? `Deleted the truss and the ${kids.length} things on it. Ctrl+Z brings them back.` : `Deleted ${n}. Ctrl+Z brings it back.`);
}
function dup() { const o = sel(), n = attachedTo(o).length; if (duplicate()) toast(n ? `Copied the truss with its ${n} fixtures, 6 ft upstage.` : 'Duplicated. Drag the copy where you want it.'); }
function loadDesign(d) {
  if (!d || !Array.isArray(d.items)) throw new Error('That is not an OpenRig design.');
  S.items = d.items.filter(i => CAT[i.type]).map(i => ({ ...i, props: Object.assign(clone(CAT[i.type].props), i.props || {}) }));
  S.nextId = Math.max(d.nextId || 1, ...S.items.map(i => i.id + 1), 1);
  if (d.name) S.name = d.name; if (d.show) Object.assign(S.show, d.show);
  $('#projName').value = S.name; UI.selId = null;
  rebuildAll(); buildCrowd(); applyEnv(); renderShow(syncLook); renderInspector(); syncLook(); dirty();
}
function loadTemplate(k) {
  pushUndo(); S.nextId = 1; const t = TEMPLATES[k]();
  S.items = t.items; S.name = t.name; Object.assign(S.show, t.show); $('#projName').value = S.name; UI.selId = null;
  rebuildAll(); buildCrowd(); renderInspector(); renderShow(syncLook); dirty(); setView('3d');
  if (k === 'blank') frameAll([0, 4, -8], [34, 26, 48]); else if (k === 'club') frameAll([0, 7, -6], [42, 26, 58]); else frameAll();
}
function togglePlay() { S.show.playing = !S.show.playing; syncLook(); save(); }
function syncLook() {
  $('#dockLook').value = S.show.program; $('#playBtn').classList.toggle('paused', !S.show.playing);
  $('#playBtn .pl').textContent = S.show.playing ? 'Pause show' : 'Play show';
  const sp = $('#s_prog'); if (sp) sp.value = S.show.program;
}

/* ---------- tabs ---------- */
const PANES = ['lib', 'insp', 'scene', 'paper', 'show'];
function showTab(p) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  for (const k of PANES) $('#pane-' + k).hidden = k !== p;
  if (p === 'paper') renderPaper();
  if (p === 'scene') renderScene(scenePick);
}
const scenePick = id => { select(id); focusSel(); };
const mq = matchMedia('(max-width: 820px)');
function placeLibrary() {
  const libBody = [document.querySelector('.lsub'), document.querySelector('.search'), $('#libList')];
  const dest = isMobile() ? $('#pane-lib') : $('#lib');
  libBody.forEach(n => dest.appendChild(n));
  if (!isMobile() && !$('#pane-lib').hidden) showTab('insp');
  syncSelbar();
}
mq.addEventListener('change', placeLibrary);

/* ---------- welcome ---------- */
function showWelcome(v) { $('#welcome').hidden = !v; if (!v) store.set('openrig.welcomed', '1'); }
$('#helpBtn').onclick = () => showWelcome($('#welcome').hidden);
$('#wDemo').onclick = () => showWelcome(false);
$('#wBlank').onclick = () => { loadTemplate('blank'); showWelcome(false); toast('Blank stage loaded. Drag gear on from the Library.'); };

/* ---------- wiring ---------- */
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) showTab(b.dataset.p); };
$('#views').onclick = e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); };
$('#snap').onchange = e => { UI.snap = parseFloat(e.target.value); applySnap(); };
$('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;
$('#frameBtn').onclick = () => { setView('3d'); frameAll(); };
$('#playBtn').onclick = togglePlay;
$('#dockLook').innerHTML = LOOKS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
$('#dockLook').onchange = e => { S.show.program = e.target.value; S.show.playing = true; syncLook(); save(); };
$('#tpl').onchange = e => { if (e.target.value) { loadTemplate(e.target.value); toast('Template loaded. Ctrl+Z brings your last design back.'); } e.target.value = ''; };
$('#projName').onchange = e => { S.name = e.target.value.trim() || 'Untitled Stage'; dirty(); };
$('#libSearch').oninput = () => renderLibrary(pickFromLibrary);

const ioText = () => JSON.stringify(exportDesign(), null, 1);
$('#fileBtn').onclick = () => { $('#io').value = ioText(); $('#ioDownload').hidden = framed; $('#modal').hidden = false; };
$('#ioClose').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
$('#ioCopy').onclick = () => copy($('#io').value, 'Design copied');
$('#ioDownload').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ioText()], { type: 'application/json' }));
  a.download = (S.name || 'stage').replace(/[^\w-]+/g, '-').toLowerCase() + '.openrig.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#ioLoad').onclick = () => { try { pushUndo(); loadDesign(JSON.parse($('#io').value)); $('#modal').hidden = true; toast('Design loaded'); } catch (err) { dropUndo(); toast('Could not load: ' + (err.message || 'not valid JSON')); } };
$('#ioFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { pushUndo(); loadDesign(JSON.parse(r.result)); $('#modal').hidden = true; toast('Opened ' + f.name); } catch (err) { dropUndo(); toast(`Could not open ${f.name}: ${err.message || 'not valid JSON'}`); } };
  r.readAsText(f); e.target.value = '';
};

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); dup(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); del(); }
  else if (k === 'escape') { if (!$('#modal').hidden) $('#modal').hidden = true; else if (!$('#welcome').hidden) showWelcome(false); else if (UI.placing) setPlace(null); else select(null); }
  else if (k === 'r') { if (UI.placing) { rotatePlacing(e.shiftKey ? 15 : 90); updateGhost(); } else rotateSel(e.shiftKey ? 15 : 90); }
  else if (k === 'd') dup();
  else if (k === 'f') { if (sel()) focusSel(); else { setView('3d'); frameAll(); } }
  else if (k === ' ') { e.preventDefault(); togglePlay(); }
  else if (k === '1') setView('3d'); else if (k === '2') setView('plot'); else if (k === '3') setView('front'); else if (k === '4') setView('pov');
});

/* ---------- state events ---------- */
let paperT = 0, sceneT = 0;
function updateTotals() { const t = totals(); $('#rdTot').innerHTML = `<b>${objs.size}</b> objects · <b>${fmtN(t.lb)}</b> lb · <b>${(t.watts / 1000).toFixed(1)}</b> kW`; }
on('changed', () => {
  updateTotals();
  if (!$('#pane-paper').hidden) { clearTimeout(paperT); paperT = setTimeout(renderPaper, 250); }
  if (!$('#pane-scene').hidden) { clearTimeout(sceneT); sceneT = setTimeout(() => renderScene(scenePick), 250); }
});
on('select', id => {
  renderInspector(); syncSelbar();
  if (!$('#pane-scene').hidden) renderScene(scenePick);
  if (id !== null && isMobile() && $('#pane-scene').hidden) showTab('insp');
});
on('moved', syncPos);

/* ---------- boot ---------- */
applyTool(); applySnap(); renderLibrary(pickFromLibrary); placeLibrary();
const qSaved = store.get('openrig.quality');
setQuality(['auto', 'low', 'medium', 'high'].includes(qSaved) ? qSaved : 'auto');
$('#quality').value = Q.level;
$('#quality').onchange = e => { setQuality(e.target.value); applyEnv(); toast(e.target.value === 'auto' ? 'Quality: Auto. Resolution adjusts to keep it smooth.' : `Quality: ${e.target.value}`); };
const saved = loadSaved();
let booted = false;
if (saved?.items?.length) { try { loadDesign(saved); booted = true; } catch { booted = false; } }
if (!booted) {
  const t = TEMPLATES.festival(); S.items = t.items; S.name = t.name; Object.assign(S.show, t.show);
  if (reduceMotion) S.show.program = 'static';
  $('#projName').value = S.name; rebuildAll(); buildCrowd(); save();
}
applyEnv(); renderShow(syncLook); renderInspector(); syncLook(); setView('3d'); updateTotals();
if (!store.get('openrig.welcomed')) showWelcome(true);

let last = performance.now(), frame = 0, fpsAcc = 0, fpsN = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (document.hidden) { last = now; return; }
  const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now; frame++;
  adapt(raw, now);
  fpsAcc += raw; fpsN++;
  if (fpsAcc > .5) { $('#fps').textContent = Math.round(fpsN / fpsAcc) + ' fps' + (Q.level === 'auto' && Q.scale < 1 ? ` · ${Math.round(Q.scale * 100)}% res` : ''); fpsAcc = 0; fpsN = 0; }
  animate(dt);
  if (frame % Q.wallEvery === 0) for (const o of objs.values()) if (o.rig.wall) drawWall(o.rig.wall);
  if (frame % Q.crowdEvery === 0) bounceCrowd(T);
  stepFocus(dt);
  ctl().update();
  placeSelbar(); updateSelHelper();
  composer.render();
}
requestAnimationFrame(loop);
window.__openrig = { S, objs, setView, select, cam, ready: true };

// library thumbnails render after first frame so the stage shows up fast
const TKEY = 'openrig.thumbs.v3';
let cached = null; try { cached = JSON.parse(store.get(TKEY) || 'null'); } catch { cached = null; }
if (cached && Object.keys(CAT).every(k => cached[k])) {
  Object.assign(thumbs, cached); renderLibrary(pickFromLibrary); renderInspector(); window.__openrig.thumbs = true;
} else {
  setTimeout(() => renderThumbs((t, url) => { thumbs[t] = url; }).then(() => {
    store.set(TKEY, JSON.stringify(thumbs)); renderLibrary(pickFromLibrary); renderInspector(); window.__openrig.thumbs = true;
  }).catch(() => { window.__openrig.thumbs = true; }), 600);
}
