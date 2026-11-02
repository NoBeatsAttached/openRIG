// Scene objects for each design item, selection, picking and placement.
import * as THREE from 'three';
import { CAT } from './catalog.js';
import { DEG, SHARED, trussS } from './models.js';
import { scene, tc, outline, groundPlane, cam } from './engine.js';
import { S, UI, clone, r3, pushUndo, dirty, emit, fmtFt } from './state.js';

export const objs = new Map();
let hitboxes = [];

export function newItem(type, x, y, z, rot = 0, props = {}) {
  return { id: S.nextId++, type, x, y, z, rot, props: Object.assign(clone(CAT[type].props), props) };
}

export function makeObj(it) {
  const def = CAT[it.type]; if (!def) return;
  const { g, rig } = def.build(it, def);
  const root = new THREE.Group(); root.add(g);
  const heads = (rig.heads || []).filter(h => h.beam);
  heads.forEach(h => h.head.remove(h.beam));
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  heads.forEach(h => h.head.add(h.beam));
  const sz = bb.getSize(new THREE.Vector3()), ct = bb.getCenter(new THREE.Vector3());
  const hb = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sz.x, .5), Math.max(sz.y, .5), Math.max(sz.z, .5)), new THREE.MeshBasicMaterial({ visible: false }));
  hb.position.copy(ct); hb.userData.id = it.id; root.add(hb);
  root.position.set(it.x, it.y, it.z); root.rotation.y = it.rot * DEG;
  root.userData.id = it.id;
  scene.add(root);
  objs.set(it.id, { root, item: it, def, rig, hitbox: hb, size: sz, body: g });
}
function disposeObj(o) {
  scene.remove(o.root);
  o.root.traverse(n => {
    if (n.geometry && !SHARED.has(n.geometry)) n.geometry.dispose();
    const mats = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
    for (const m of mats) if (m.userData?.own) { m.userData.tex?.dispose(); m.dispose(); }
  });
}
const refreshHits = () => { hitboxes = [...objs.values()].map(o => o.hitbox); };

export function rebuildOne(id) {
  const o = objs.get(id); if (!o) return;
  disposeObj(o); objs.delete(id); makeObj(o.item); refreshHits();
  if (UI.selId === id) attachSel();
}
export function rebuildAll() {
  tc.detach();
  for (const o of objs.values()) disposeObj(o);
  objs.clear(); S.items.forEach(makeObj); refreshHits();
  if (!objs.has(UI.selId)) UI.selId = null;
  attachSel();
}
export function addItem(it) { S.items.push(it); makeObj(it); refreshHits(); }
export function removeItem(id) {
  const o = objs.get(id); if (!o) return;
  S.items = S.items.filter(i => i !== o.item); if (UI.selId === id) { UI.selId = null; attachSel(); }
  disposeObj(o); objs.delete(id); refreshHits();
}

/* selection */
export const sel = () => objs.get(UI.selId);
export function attachSel() {
  const o = sel();
  if (o) { tc.attach(o.root); const list = []; o.body.traverse(n => { if (n.isMesh && !n.material.isShaderMaterial) list.push(n); }); outline.selectedObjects = list; }
  else { tc.detach(); outline.selectedObjects = []; }
}
export function select(id) { UI.selId = id; attachSel(); emit('select', id); }
// The gizmo only does height now. Moving is drag-on-floor, rotating is a button.
export function applyTool() { tc.setMode('translate'); tc.showX = false; tc.showZ = false; tc.showY = true; }
export function applySnap() { tc.setTranslationSnap(UI.snap || null); }
let gizKids = [];
tc.addEventListener('mouseDown', () => { pushUndo(); const o = sel(); gizKids = o ? kidOffsets(o) : []; });
tc.addEventListener('objectChange', () => {
  const o = sel(); if (!o) return; const r = o.root;
  o.item.y = r3(Math.max(0, r.position.y)); r.position.y = o.item.y;
  moveKids(o, gizKids);
  emit('moved'); dirty();
});
const normDeg = d => ((d % 360) + 540) % 360 - 180;
export function rotateSel(deg) {
  const o = sel(); if (!o) return; pushUndo();
  const kids = kidOffsets(o), a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
  o.item.rot = normDeg(o.item.rot + deg); o.root.rotation.y = o.item.rot * DEG;
  for (const k of kids) { const dx = k.dx, dz = k.dz; k.dx = dx * c + dz * s; k.dz = -dx * s + dz * c; k.q.item.rot = normDeg(k.q.item.rot + deg); k.q.root.rotation.y = k.q.item.rot * DEG; }
  moveKids(o, kids);
  emit('moved'); dirty();
}

/* gear that rides along with a truss: hung fixtures and hoists on top */
export function attachedTo(o) {
  if (!o || o.item.type !== 'truss') return [];
  const out = fixturesOn(o), it = o.item, s = trussS(it.props);
  for (const q of objs.values()) {
    if (q.item.type !== 'motor') continue;
    const lp = o.root.worldToLocal(q.root.position.clone());
    if (Math.abs(lp.y - s) < .6 && Math.abs(lp.x) <= it.props.len / 2 + .5 && Math.abs(lp.z) <= s / 2 + .8) out.push(q);
  }
  return out;
}
function kidOffsets(o) { return attachedTo(o).map(q => ({ q, dx: q.item.x - o.item.x, dy: q.item.y - o.item.y, dz: q.item.z - o.item.z })); }
function moveKids(o, kids) {
  for (const k of kids) {
    const q = k.q; q.item.x = r3(o.item.x + k.dx); q.item.y = r3(o.item.y + k.dy); q.item.z = r3(o.item.z + k.dz);
    q.root.position.set(q.item.x, q.item.y, q.item.z);
  }
}

/* picking */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function setRay(e, el) {
  const r = el.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, cam());
  return { x: ndc.x, y: ndc.y, button: e.button };
}
export const pick = () => ray.intersectObjects(hitboxes, false)[0] || null;
export function groundPoint() { const p = new THREE.Vector3(); return ray.ray.intersectPlane(groundPlane, p) ? p : null; }
const sn = v => UI.snap ? Math.round(v / UI.snap) * UI.snap : r3(v);
const _pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function planePoint(y) { _pl.constant = -y; const p = new THREE.Vector3(); return ray.ray.intersectPlane(_pl, p) ? p : null; }

/* surfaces you can set gear on top of */
const SURFACE = new Set(['deck', 'foh', 'sub', 'djtable']);
const downRay = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
function surfaceAt(x, z, exclude) {
  downRay.set(new THREE.Vector3(x, 400, z), DOWN);
  const boxes = [];
  for (const o of objs.values()) if (SURFACE.has(o.item.type) && o.item.id !== exclude) boxes.push(o.hitbox);
  const h = downRay.intersectObjects(boxes, false)[0];
  return h ? { y: r3(h.point.y), o: objs.get(h.object.userData.id) } : { y: 0, o: null };
}
export function trussName(id) {
  const ids = [...objs.values()].filter(o => o.item.type === 'truss').map(o => o.item.id).sort((a, b) => a - b);
  const i = ids.indexOf(id); return 'Truss ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '');
}
function onTruss(o, point, def) {
  const it = o.item, lp = o.root.worldToLocal(point.clone());
  lp.set(Math.max(-it.props.len / 2, Math.min(it.props.len / 2, sn(lp.x))), 0, 0);
  const w = o.root.localToWorld(lp);
  const y = def.mount === 'hang' ? it.y : r3(it.y + trussS(it.props));
  return { x: r3(w.x), y, z: r3(w.z), rot: it.rot, hung: def.mount === 'hang', label: `${def.mount === 'hang' ? 'Hangs on' : 'On top of'} ${trussName(it.id)} · ${fmtFt(it.y)} trim` };
}
let placeRot = 0;
export function rotatePlacing(d) { placeRot = ((placeRot + d) % 360 + 360) % 360; }

// Where a new item of `type` lands under the cursor.
export function solvePlace(type) {
  const def = CAT[type], hit = pick();
  if (hit) {
    const o = objs.get(hit.object.userData.id);
    if (o.item.type === 'truss' && (def.mount === 'hang' || def.mount === 'top')) return onTruss(o, hit.point, def);
  }
  if (def.mount === 'free') {
    const p = groundPoint(); if (!p) return null;
    return { x: sn(p.x), y: def.defY, z: sn(p.z), rot: placeRot, label: `Goes in at ${fmtFt(def.defY)} · pull the arrow to change` };
  }
  let p = null;
  if (hit && SURFACE.has(objs.get(hit.object.userData.id).item.type)) p = hit.point; else p = groundPoint();
  if (!p) return null;
  const x = sn(p.x), z = sn(p.z), s = surfaceAt(x, z);
  return { x, y: s.y, z, rot: placeRot, hung: def.mount === 'hang' ? false : undefined, label: s.o ? `On the ${s.o.def.name.toLowerCase()} · ${fmtFt(s.y)} up` : 'On the floor' };
}

/* ghost preview while placing */
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: .42, depthWrite: false });
const ghostLine = new THREE.LineBasicMaterial({ color: 0xffb547, transparent: true, opacity: .9 });
let ghost = null, ghostKey = '';
function clearGhost() {
  if (!ghost) return; scene.remove(ghost);
  ghost.traverse(n => { if (n.geometry && !SHARED.has(n.geometry)) n.geometry.dispose(); });
  ghost = null; ghostKey = '';
}
function makeGhost(type, hung) {
  const def = CAT[type], props = { ...clone(def.props), hung: !!hung };
  const { g, rig } = def.build({ id: -1, type, props }, def);
  (rig.heads || []).forEach(h => { if (h.beam) h.head.remove(h.beam); });
  const own = [];
  g.traverse(n => {
    if (!n.isMesh) return;
    const ms = Array.isArray(n.material) ? n.material : [n.material];
    ms.forEach(m => { if (m.userData?.own) own.push(m); });
    n.material = ghostMat; n.renderOrder = 8;
  });
  own.forEach(m => { m.userData.tex?.dispose(); m.dispose(); });
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const bh = new THREE.Box3Helper(box, 0xffb547); bh.material = ghostLine;
  const root = new THREE.Group(); root.add(g); root.add(bh);
  // drop line + floor marker so you can see where airborne gear sits
  const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);
  const drop = new THREE.Line(lg, ghostLine); drop.name = 'drop'; root.add(drop);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.6, .9, 32).rotateX(-Math.PI / 2), ghostMat); ring.name = 'ring'; root.add(ring);
  return root;
}
export function updateGhost() {
  if (!UI.placing) { clearGhost(); return null; }
  const r = solvePlace(UI.placing);
  if (!r) { if (ghost) ghost.visible = false; return null; }
  const key = UI.placing + (r.hung ? ':h' : '');
  if (key !== ghostKey) { clearGhost(); ghost = makeGhost(UI.placing, r.hung); ghostKey = key; scene.add(ghost); }
  ghost.visible = true; ghost.position.set(r.x, r.y, r.z); ghost.rotation.y = (r.rot || 0) * DEG;
  const fl = r.floorY ?? 0, up = Math.max(.001, r.y - fl);
  const drop = ghost.getObjectByName('drop'), ring = ghost.getObjectByName('ring');
  drop.scale.y = up; drop.visible = up > .5; ring.position.y = -up + .05; ring.visible = up > .5;
  return r;
}
export function hideGhost() { if (ghost) ghost.visible = false; }
export function endPlacing() { clearGhost(); placeRot = 0; }

export function placeAt(type) {
  const r = solvePlace(type); if (!r) return null;
  pushUndo();
  const props = r.hung !== undefined ? { hung: r.hung } : {};
  const it = newItem(type, r.x, r.y, r.z, r.rot || 0, props); addItem(it); select(it.id); dirty();
  return { it, label: r.label };
}

/* drag to move the selected object */
let drag = null;
export const dragging = () => !!drag;
export function beginDrag(id, hitPoint) {
  const o = objs.get(id); if (!o) return;
  const h = hitPoint.y;
  drag = { o, h, start: hitPoint.clone(), x0: o.item.x, z0: o.item.z, moved: false, kids: kidOffsets(o) };
}
export function dragMove() {
  if (!drag) return null;
  const { o } = drag, def = o.def, it = o.item;
  let r = null;
  if (def.mount === 'hang' || def.mount === 'top') {
    const hit = ray.intersectObjects(hitboxes, false).find(h => h.object.userData.id !== it.id);
    if (hit) { const t = objs.get(hit.object.userData.id); if (t.item.type === 'truss') r = onTruss(t, hit.point, def); }
  }
  if (!r) {
    const p = planePoint(drag.h); if (!p) return null;
    const x = sn(drag.x0 + p.x - drag.start.x), z = sn(drag.z0 + p.z - drag.start.z);
    if (def.mount === 'free' || (def.mount === 'hang' && it.props.hung) || def.mount === 'top') r = { x, y: it.y, z, label: `${fmtFt(x)}, ${fmtFt(z)} · ${fmtFt(it.y)} up` };
    else { const s = surfaceAt(x, z, it.id); r = { x, y: s.y, z, label: s.o ? `On the ${s.o.def.name.toLowerCase()} · ${fmtFt(s.y)} up` : `${fmtFt(x)}, ${fmtFt(z)} · on the floor` }; }
  }
  if (!drag.moved) { if (r.x === it.x && r.z === it.z && r.y === it.y) return r; pushUndo(); drag.moved = true; }
  it.x = r.x; it.y = r.y; it.z = r.z;
  if (r.rot !== undefined && r.rot !== null && def.mount !== 'free') it.rot = r.rot;
  if (r.hung !== undefined && r.hung !== it.props.hung) { it.props.hung = r.hung; rebuildOne(it.id); }
  const cur = objs.get(it.id); cur.root.position.set(it.x, it.y, it.z); cur.root.rotation.y = it.rot * DEG;
  if (cur !== o) drag.o = cur;
  moveKids(cur, drag.kids);
  emit('moved');
  return r;
}
export function endDrag() { const m = drag?.moved; drag = null; if (m) dirty(); return m; }

/* fill a truss with evenly spaced fixtures */
export function fixturesOn(trussObj) {
  const it = trussObj.item, s = trussS(it.props), out = [];
  scene.updateMatrixWorld();
  for (const q of objs.values()) {
    if (!q.def.model || !q.item.props.hung) continue;
    const lp = trussObj.root.worldToLocal(q.root.position.clone());
    if (Math.abs(lp.y) < .6 && Math.abs(lp.x) <= it.props.len / 2 + .5 && Math.abs(lp.z) <= s / 2 + .6) out.push(q);
  }
  return out;
}
export function fillTruss(trussId, type, n, replace) {
  const t = objs.get(trussId); if (!t) return 0;
  pushUndo();
  if (replace) fixturesOn(t).forEach(q => removeItem(q.item.id));
  const L = t.item.props.len;
  for (let i = 0; i < n; i++) {
    const w = t.root.localToWorld(new THREE.Vector3(-L / 2 + L * (i + .5) / n, 0, 0));
    addItem(newItem(type, r3(w.x), t.item.y, r3(w.z), t.item.rot, { hung: true }));
  }
  select(trussId); dirty(); return n;
}

export function duplicate() {
  const o = sel(); if (!o) return null; pushUndo();
  const c = clone(o.item); c.id = S.nextId++;
  const a = o.item.rot * DEG, alongX = Math.abs(Math.cos(a)) > .7;
  const step = o.item.type === 'truss' ? 2 : Math.max(1, Math.round((alongX ? o.size.x : o.size.z) + .5));
  let dx = 0, dz = 0;
  if (o.item.type === 'truss') { dx = r3(-Math.sin(a) * 6); dz = r3(-Math.cos(a) * 6); }   // copy goes 6 ft upstage of the original
  else if (o.def.mount === 'hang' && o.item.props.hung) { dx = r3(Math.cos(a) * step); dz = r3(-Math.sin(a) * step); }
  else dx = step;
  c.x = r3(c.x + dx); c.z = r3(c.z + dz);
  const kids = attachedTo(o);
  addItem(c);
  for (const k of kids) { const kc = clone(k.item); kc.id = S.nextId++; kc.x = r3(kc.x + dx); kc.z = r3(kc.z + dz); addItem(kc); }
  select(c.id); dirty(); return c;
}
