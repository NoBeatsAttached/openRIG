// Geometry + materials for every piece of gear. Units are feet.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DEG = Math.PI / 180;
export const PANEL = 500 / 304.8; // 500 mm LED panel in feet
export const SHARED = new WeakSet(); // geometries/materials that must never be disposed

const keep = g => { SHARED.add(g); return g; };

/* ---------- procedural textures ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function noiseFill(x, w, h, base, amt) {
  const img = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (Math.random() - .5) * amt;
    img.data[i * 4] = base[0] + n; img.data[i * 4 + 1] = base[1] + n; img.data[i * 4 + 2] = base[2] + n; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
}
export const TEX = {
  grille: canvasTex(64, 64, (x, w, h) => {
    x.fillStyle = '#3a3d42'; x.fillRect(0, 0, w, h); x.fillStyle = '#0c0d0f';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(i * 8 + 4 + (j % 2) * 4, j * 8 + 4, 2.6, 0, 7); x.fill(); }
  }, [6, 3]),
  deck: canvasTex(256, 256, (x, w, h) => {
    noiseFill(x, w, h, [52, 50, 47], 14);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2);
  }),
  ground: canvasTex(256, 256, (x, w, h) => noiseFill(x, w, h, [34, 36, 38], 18), [220, 220]),
  strobe: canvasTex(128, 16, (x, w, h) => {
    x.fillStyle = '#111'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff';
    for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) x.fillRect(i * 4 + 1, j * 4 + 1, 2, 2);
  }),
};
TEX.strobe.colorSpace = THREE.SRGBColorSpace;

/* ---------- materials ---------- */
const std = (o) => new THREE.MeshStandardMaterial(o);
export const MAT = {
  alu: std({ color: 0xd3d7dd, metalness: .95, roughness: .3 }),
  steel: std({ color: 0x6d727a, metalness: .75, roughness: .45 }),
  body: std({ color: 0x18191c, metalness: .35, roughness: .42 }),
  matte: std({ color: 0x0f1012, metalness: .1, roughness: .85 }),
  deck: std({ map: TEX.deck, roughness: .92 }),
  deckEdge: std({ color: 0x8a8f96, metalness: .9, roughness: .35 }),
  skirt: std({ color: 0x08080a, roughness: 1 }),
  grille: std({ map: TEX.grille, metalness: .55, roughness: .55 }),
  tent: std({ color: 0xe9e7e0, roughness: .85 }),
  person: std({ color: 0x5c6170, roughness: .85 }),
  screen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.55, 1.1) }),
  ground: std({ map: TEX.ground, roughness: .96, color: 0xffffff }),
};
Object.values(MAT).forEach(keep);
export function ownBasic(c) { const m = new THREE.MeshBasicMaterial({ color: c }); m.userData.own = 1; return m; }

/* ---------- helpers ---------- */
export const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export function mk(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }

const rbCache = new Map();
export function rbox(w, h, d, r = .05) {
  const k = [w, h, d, r].join('_'); if (rbCache.has(k)) return rbCache.get(k);
  r = Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001);
  const s = new THREE.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
  s.moveTo(x, y); s.lineTo(x + W, y); s.lineTo(x + W, y + H); s.lineTo(x, y + H); s.lineTo(x, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals();
  keep(g); rbCache.set(k, g); return g;
}
const _up = new THREE.Vector3(0, 1, 0);
function cylBetween(a, b, r, seg = 5) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize());
  g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- truss ---------- */
const trussCache = new Map();
export function trussGeometry(L, s) {
  const k = L + '_' + s; if (trussCache.has(k)) return trussCache.get(k);
  const R = .083, r = .038, y0 = R, y1 = s - R, h = s / 2 - R, parts = [];
  for (const [y, z] of [[y0, -h], [y0, h], [y1, -h], [y1, h]]) {
    const c = new THREE.CylinderGeometry(R, R, L, 8, 1, true); c.rotateZ(Math.PI / 2); c.translate(0, y, z); parts.push(c);
  }
  const n = Math.max(1, Math.round(L / (s * .95))), st = L / n;
  for (let i = 0; i < n; i++) {
    const a = -L / 2 + i * st, b = a + st, f = i % 2 === 0;
    for (const z of [-h, h]) parts.push(cylBetween(V(a, f ? y0 : y1, z), V(b, f ? y1 : y0, z), r));
    for (const y of [y0, y1]) parts.push(cylBetween(V(a, y, f ? -h : h), V(b, y, f ? h : -h), r));
  }
  const secs = Math.max(1, Math.round(L / 10));
  for (let i = 0; i <= secs; i++) {
    const x = -L / 2 + i * L / secs, e = i === 0 ? .06 : i === secs ? -.06 : 0;
    parts.push(cylBetween(V(x + e, y0, -h), V(x + e, y1, -h), r), cylBetween(V(x + e, y0, h), V(x + e, y1, h), r));
    parts.push(cylBetween(V(x + e, y0, -h), V(x + e, y0, h), r), cylBetween(V(x + e, y1, -h), V(x + e, y1, h), r));
    for (const [y, z] of [[y0, -h], [y0, h], [y1, -h], [y1, h]]) { const c = new THREE.BoxGeometry(.22, .2, .2); c.translate(x, y, z); parts.push(c); }
  }
  const norm = parts.map(p => p.index ? p.toNonIndexed() : p);
  norm.forEach(p => { p.deleteAttribute('uv'); });
  const g = mergeGeometries(norm, false); g.computeBoundingBox();
  keep(g); trussCache.set(k, g); return g;
}

/* ---------- draw-call reduction ----------
   Every builder makes lots of small meshes. Before an object goes in the scene we
   bake all static meshes that share a material into one mesh. Groups flagged
   userData.dyn (moving-head yokes and heads) are baked separately so they can still move. */
const _inv = new THREE.Matrix4(), _m4 = new THREE.Matrix4();
export function optimize(root) {
  root.updateMatrixWorld(true);
  bake(root);
  return root;
}
function bake(node) {
  _inv.copy(node.matrixWorld).invert();
  const inv = _inv.clone(), buckets = new Map();
  (function walk(n) {
    for (const c of [...n.children]) {
      if (c.userData.dyn) { bake(c); continue; }
      if (c.isMesh && !Array.isArray(c.material) && !c.material.isShaderMaterial && !c.userData.keep) {
        const k = c.material.uuid;
        if (!buckets.has(k)) buckets.set(k, { mat: c.material, list: [] });
        buckets.get(k).list.push(c);
      }
      walk(c);
    }
  })(node);
  for (const { mat, list } of buckets.values()) {
    if (list.length < 2) continue;
    const needUV = !!mat.map;
    const geos = [];
    for (const m of list) {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && !(needUV && a === 'uv')) g.deleteAttribute(a);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (needUV && !g.attributes.uv) { geos.length = 0; break; }
      g.morphAttributes = {}; g.clearGroups();
      g.applyMatrix4(_m4.multiplyMatrices(inv, m.matrixWorld));
      geos.push(g);
    }
    if (geos.length !== list.length) continue;
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    geos.forEach(g => g.dispose());
    merged.computeBoundingSphere();
    list.forEach(m => m.parent.remove(m));
    const mesh = new THREE.Mesh(merged, mat); mesh.renderOrder = list[0].renderOrder;
    node.add(mesh);
  }
}

/* ---------- fixtures ---------- */
const lathe = (pts, seg = 24) => keep(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg));
const G = {
  moverHead: lathe([[0, -.5], [.2, -.52], [.33, -.44], [.41, -.22], [.43, .12], [.41, .4], [.37, .52], [.34, .54], [.3, .52]]),
  parCan: lathe([[0, -.32], [.22, -.33], [.3, -.26], [.32, .22], [.34, .31], [.29, .3]]),
  blinderCup: lathe([[0, -.18], [.18, -.2], [.33, .1], [.35, .2], [.31, .2]], 20),
  lens: keep(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2)),
  ring: keep(new THREE.RingGeometry(.9, 1, 28).rotateX(-Math.PI / 2)),
};

// beam cone: tip at origin, opening toward +Y, base radius 1 at y=1
export const CONE = keep((() => { const g = new THREE.ConeGeometry(1, 1, 28, 1, true); g.rotateX(Math.PI); g.translate(0, .5, 0); return g; })());

const BEAM_VS = `
varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  vY = position.y;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * normal);
  vW = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FS = `
uniform vec3 uColor; uniform float uInt; uniform float uTime; uniform sampler2D uNoise;
varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  float edge = abs(dot(normalize(vN), normalize(vV)));
  edge *= edge;
  float fall = 1.0 - vY; fall *= fall;
  float hz = texture2D(uNoise, vW.xy*0.012 + vec2(uTime*0.010, uTime*0.016)).r * 0.6
           + texture2D(uNoise, vW.zy*0.031 - vec2(uTime*0.02, 0.0)).r * 0.4;
  gl_FragColor = vec4(uColor * (edge * fall * (0.4 + 0.9*hz) * uInt), 1.0);
}`;
// small tiling noise texture for haze in the beams (generated once)
const NOISE = (() => {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  const base = new Float32Array(16 * 16).map(() => Math.random()), img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0, amp = .6;
    for (let o = 0, f = 16; o < 3; o++, f /= 2, amp *= .5) {
      const gx = i / N * (16 / f), gy = j / N * (16 / f), x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0;
      const k = (a, b) => base[((b % (16 / f) + 16 / f) % (16 / f)) * 16 + ((a % (16 / f) + 16 / f) % (16 / f))];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      v += amp * ((k(x0, y0) * (1 - sx) + k(x0 + 1, y0) * sx) * (1 - sy) + (k(x0, y0 + 1) * (1 - sx) + k(x0 + 1, y0 + 1) * sx) * sy);
    }
    const p = (j * N + i) * 4; img.data[p] = img.data[p + 1] = img.data[p + 2] = Math.min(255, v * 255 / 1.05); img.data[p + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
export const BEAM_SIDE = { value: THREE.FrontSide };
export function beamMaterial() {
  const m = new THREE.ShaderMaterial({
    vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
    uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uInt: { value: 1 }, uTime: { value: 0 }, uNoise: { value: NOISE } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: BEAM_SIDE.value,
  });
  m.userData.own = 1; return m;
}

export function buildFixture(it, def) {
  const p = it.props, g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  if (p.hung) { inner.rotation.z = Math.PI; inner.add(mk(rbox(.3, .34, .5, .04), MAT.body, 0, -.17, 0)); }
  const lensMat = ownBasic(0x111111);
  let yoke = null, head = null, lensY = 0; const sc = def.sc || 1, lr = (def.lensR || .3) * sc;
  if (def.model === 'mover') {
    inner.add(mk(rbox(1.15 * sc, .5 * sc, .95 * sc, .07), MAT.body, 0, .25 * sc, 0));
    yoke = new THREE.Group(); yoke.userData.dyn = true; yoke.position.y = .5 * sc; inner.add(yoke);
    yoke.add(mk(rbox(.15 * sc, .2 * sc, .4 * sc, .05), MAT.body, 0, .1 * sc, 0));
    yoke.add(mk(rbox(1.3 * sc, .14 * sc, .44 * sc, .06), MAT.body, 0, .22 * sc, 0));
    for (const x of [-.58, .58]) yoke.add(mk(rbox(.16 * sc, 1.08 * sc, .44 * sc, .06), MAT.body, x * sc, .74 * sc, 0));
    head = new THREE.Group(); head.userData.dyn = true; head.position.y = 1.05 * sc; yoke.add(head);
    const hm = mk(G.moverHead, MAT.body); hm.scale.setScalar(sc); head.add(hm);
    lensY = .5 * sc;
    const ring = mk(G.ring, MAT.body, 0, lensY + .006, 0); ring.scale.setScalar(.31 * sc); head.add(ring);
  } else if (def.model === 'par') {
    inner.add(mk(BOX(.95, .07, .34), MAT.steel, 0, .035, 0));
    for (const x of [-.46, .46]) inner.add(mk(BOX(.06, .55, .22), MAT.steel, x, .32, 0));
    head = new THREE.Group(); head.userData.dyn = true; head.position.y = .5; inner.add(head);
    head.add(mk(G.parCan, MAT.body)); lensY = .3;
  } else if (def.model === 'strobe') {
    head = new THREE.Group(); head.userData.dyn = true; inner.add(head);
    head.add(mk(rbox(2.3, .36, .5, .05), MAT.body, 0, .18, 0)); lensY = .365;
    lensMat.map = TEX.strobe;
    head.add(mk(BOX(2.1, .01, .34), lensMat, 0, lensY, 0));
  } else if (def.model === 'blinder') {
    inner.add(mk(BOX(.08, .5, .08), MAT.steel, 0, .25, 0));
    head = new THREE.Group(); head.userData.dyn = true; head.position.y = .75; inner.add(head);
    head.add(mk(rbox(1.6, .32, .85, .05), MAT.body, 0, -.12, 0));
    for (const x of [-.4, .4]) { head.add(mk(G.blinderCup, MAT.steel, x, .06, 0)); const l = mk(G.lens, lensMat, x, .25, 0); l.scale.setScalar(.31); head.add(l); }
    lensY = .26;
  }
  if (def.model !== 'strobe' && def.model !== 'blinder') { const l = mk(G.lens, lensMat, 0, lensY, 0); l.scale.setScalar(lr); head.add(l); }
  let beam = null, beamM = null;
  if (def.beam) { beamM = beamMaterial(); beam = new THREE.Mesh(CONE, beamM); beam.position.y = lensY + .01; beam.renderOrder = 5; beam.frustumCulled = false; head.add(beam); }
  return { g, rig: { heads: [{ yoke, head, lensMat, beam, beamM }] } };
}

/* ---------- staging ---------- */
export function buildDeck(it) {
  const p = it.props, g = new THREE.Group(), t = .28, lh = p.h - t;
  g.add(mk(BOX(p.w, t, p.d), MAT.deck, 0, p.h - t / 2, 0));
  if (lh > .05) {
    if (p.skirt) {
      g.add(mk(BOX(p.w, lh, .02), MAT.skirt, 0, lh / 2, p.d / 2 - .01)); g.add(mk(BOX(p.w, lh, .02), MAT.skirt, 0, lh / 2, -p.d / 2 + .01));
      g.add(mk(BOX(.02, lh, p.d), MAT.skirt, p.w / 2 - .01, lh / 2, 0)); g.add(mk(BOX(.02, lh, p.d), MAT.skirt, -p.w / 2 + .01, lh / 2, 0));
    } else {
      const lg = new THREE.CylinderGeometry(.1, .1, lh, 6);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mk(lg, MAT.steel, sx * (p.w / 2 - .35), lh / 2, sz * (p.d / 2 - .35)));
    }
  }
  return { g, rig: {} };
}
export function buildStairs(it) {
  const p = it.props, g = new THREE.Group(), n = Math.max(1, Math.round(p.h / .6)), rise = p.h / n, run = .92;
  for (let i = 0; i < n; i++) {
    const top = (i + 1) * rise;
    g.add(mk(BOX(p.w, top, run), MAT.matte, 0, top / 2, (n - 1 - i) * run + run / 2));
    g.add(mk(BOX(p.w, .02, .12), MAT.deckEdge, 0, top + .01, (n - 1 - i) * run + run - .06));
  }
  const L = n * run;
  for (const x of [-p.w / 2, p.w / 2]) {
    g.add(new THREE.Mesh(cylBetween(V(x, rise + 3, L - .3), V(x, p.h + 3, .3), .06, 8), MAT.steel));
    g.add(new THREE.Mesh(cylBetween(V(x, rise, L - .3), V(x, rise + 3, L - .3), .06, 8), MAT.steel));
    g.add(new THREE.Mesh(cylBetween(V(x, p.h, .3), V(x, p.h + 3, .3), .06, 8), MAT.steel));
  }
  return { g, rig: {} };
}
export function buildDJ() {
  const g = new THREE.Group();
  g.add(mk(BOX(8, 3.3, 2.6), MAT.skirt, 0, 1.65, 0));
  g.add(mk(BOX(8.1, .08, 2.7), MAT.matte, 0, 3.34, 0));
  g.add(mk(rbox(1.2, .3, 1.35, .04), MAT.body, 0, 3.5, -.1));
  for (const x of [-1.45, 1.45, -2.75, 2.75]) {
    g.add(mk(rbox(1.05, .36, 1.42, .04), MAT.body, x, 3.55, -.1));
    g.add(mk(BOX(.62, .01, .34), MAT.screen, x, 3.74, -.47));
    const jw = mk(new THREE.CylinderGeometry(.33, .33, .04, 24), MAT.steel, x, 3.75, .2); g.add(jw);
  }
  return { g, rig: {} };
}

/* ---------- people ---------- */
function personGeo(armsUp) {
  const parts = [];
  for (const x of [-.24, .24]) { const l = new THREE.CylinderGeometry(.2, .17, 2.8, 5, 1, true); l.translate(x, 1.4, 0); parts.push(l); }
  const t = new THREE.CapsuleGeometry(.47, 1.2, 2, 6); t.scale(1, 1, .62); t.translate(0, 3.75, 0); parts.push(t);
  const h = new THREE.SphereGeometry(.38, 7, 5); h.translate(0, 5.25, 0); parts.push(h);
  for (const s of [-1, 1]) {
    const a = new THREE.CylinderGeometry(.13, .11, 2.2, 4, 1, true);
    if (armsUp) { a.rotateZ(s * -.35); a.translate(s * .95, 5.35, 0); }
    else { a.rotateZ(s * .12); a.translate(s * .66, 3.45, 0); }
    parts.push(a);
  }
  const g = mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; }));
  return keep(g);
}
export const PERSON = { down: personGeo(false), up: personGeo(true) };
export function buildPerformer() { const g = new THREE.Group(); g.add(mk(PERSON.down, MAT.person)); return { g, rig: {} }; }

export function buildBarricade(it) {
  const p = it.props, g = new THREE.Group(), n = Math.max(1, Math.round(p.len / 3.3)), w = p.len / n;
  for (let i = 0; i < n; i++) {
    const x = -p.len / 2 + w * i + w / 2;
    g.add(mk(BOX(w - .06, .14, .14), MAT.alu, x, 4, 0));
    g.add(mk(BOX(w - .1, 3.4, .03), MAT.grille, x, 2.2, 0));
    g.add(mk(BOX(w - .06, .1, 3.2), MAT.alu, x, .05, 1.5));
    g.add(mk(BOX(.12, 4, .12), MAT.alu, x - w / 2 + .08, 2, 0));
    g.add(new THREE.Mesh(cylBetween(V(x, 3.9, .05), V(x, .1, 2.9), .05, 6), MAT.alu));
  }
  return { g, rig: {} };
}
export function buildFOH() {
  const g = new THREE.Group();
  g.add(mk(BOX(12, 1, 10), MAT.deck, 0, .5, 0));
  g.add(mk(rbox(7, 2.9, 2.4, .08), MAT.body, 0, 2.45, -1));
  g.add(mk(BOX(6.4, .02, 1.7), MAT.screen, 0, 3.92, -1));
  const pg = new THREE.CylinderGeometry(.09, .09, 9.5, 8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mk(pg, MAT.steel, sx * 6.8, 4.75, sz * 5.8));
  const roof = new THREE.ConeGeometry(10, 2.2, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1, 1, .86);
  g.add(mk(roof, MAT.tent, 0, 10.6, 0));
  return { g, rig: {} };
}

/* ---------- rigging ---------- */
export const trussS = p => p.size == 20.5 ? 20.5 / 12 : 1;
export function buildTruss(it) {
  const g = new THREE.Group(); g.add(new THREE.Mesh(trussGeometry(it.props.len, trussS(it.props)), MAT.alu));
  return { g, rig: {} };
}
export function buildTower(it) {
  const p = it.props, g = new THREE.Group(), h = p.h;
  g.add(mk(BOX(7, .3, .6), MAT.steel, 0, .15, 0)); g.add(mk(BOX(.6, .3, 7), MAT.steel, 0, .15, 0));
  for (const [x, z] of [[3.3, 0], [-3.3, 0], [0, 3.3], [0, -3.3]]) g.add(mk(new THREE.CylinderGeometry(.25, .3, .12, 10), MAT.matte, x, .06, z));
  const L = h - .3, tm = new THREE.Mesh(trussGeometry(L, 1), MAT.alu);
  tm.rotation.z = Math.PI / 2; tm.position.set(.5, .3 + L / 2, 0); g.add(tm);
  g.add(mk(BOX(1.75, 1.3, 1.75), MAT.steel, 0, h - .65, 0));
  return { g, rig: {} };
}
export function buildMotor(it) {
  const p = it.props, g = new THREE.Group();
  g.add(mk(rbox(.75, 1.15, .85, .08), MAT.body, 0, .85, 0));
  g.add(mk(new THREE.TorusGeometry(.14, .04, 6, 14), MAT.steel, 0, .15, 0));
  g.add(mk(new THREE.CylinderGeometry(.035, .035, p.chain, 5), MAT.steel, 0, 1.4 + p.chain / 2, 0));
  g.add(mk(BOX(.1, .5, .3), MAT.steel, .45, 1.1, 0));
  return { g, rig: {} };
}

/* ---------- audio ---------- */
const cabGeo = keep((() => {
  const s = new THREE.Shape(); s.moveTo(-1.15, 0); s.lineTo(1.15, 0); s.lineTo(.82, 1.65); s.lineTo(-.82, 1.65); s.lineTo(-1.15, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.08, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2); g.scale(1, 1, 1); g.translate(0, -1.08, 0);
  // after rotateX(-90): shape y -> -z, extrude z -> y. front edge at z=0, back at z=-1.65
  return g;
})());
export function buildLineArray(it) {
  const p = it.props, g = new THREE.Group();
  g.add(mk(BOX(2.6, .22, 2), MAT.steel, 0, -.11, -.7));
  g.add(mk(BOX(.08, .5, .08), MAT.steel, 0, .25, -.7));
  let hy = -.24, hz = 0, a = 0;
  for (let i = 0; i < p.boxes; i++) {
    const bg = new THREE.Group(); bg.position.set(0, hy, hz); bg.rotation.x = a * DEG;
    bg.add(mk(cabGeo, MAT.body));
    bg.add(mk(BOX(2.22, .98, .02), MAT.grille, 0, -.54, .045));
    g.add(bg);
    const ar = a * DEG; hy -= 1.1 * Math.cos(ar); hz -= 1.1 * Math.sin(ar); a += p.splay;
  }
  return { g, rig: {} };
}
export function buildSub(it) {
  const g = new THREE.Group();
  for (let i = 0; i < it.props.stack; i++) {
    g.add(mk(rbox(2.4, 1.9, 2.6, .04), MAT.body, 0, .95 + i * 1.92, 0));
    g.add(mk(BOX(2.24, 1.6, .02), MAT.grille, 0, .95 + i * 1.92, 1.31));
  }
  return { g, rig: {} };
}
export function buildWedge() {
  const g = new THREE.Group(), w = new THREE.Group(); w.rotation.x = -35 * DEG; w.position.y = .6;
  w.add(mk(rbox(2, 1.05, 1.5, .05), MAT.body)); w.add(mk(BOX(1.86, .9, .02), MAT.grille, 0, 0, .76)); g.add(w);
  return { g, rig: {} };
}
export function buildHazer() {
  const g = new THREE.Group();
  g.add(mk(rbox(1.4, .9, .8, .06), MAT.body, 0, .45, 0));
  g.add(mk(new THREE.CylinderGeometry(.12, .1, .3, 10).rotateX(Math.PI / 2), MAT.steel, 0, .6, .52));
  return { g, rig: {} };
}

/* ---------- video ---------- */
export function buildWall(it) {
  const p = it.props, W = p.cols * PANEL, H = p.rows * PANEL, g = new THREE.Group();
  g.add(mk(BOX(W + .08, H + .08, .3), MAT.body, 0, H / 2, -.02));
  const ppp = Math.max(4, Math.min(12, Math.floor(360 / p.cols))); // pixels per panel
  const cv = document.createElement('canvas'); cv.width = p.cols * ppp; cv.height = p.rows * ppp;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const m = new THREE.MeshBasicMaterial({ map: tex }); m.color.setScalar(1.7); m.userData.own = 1; m.userData.tex = tex;
  g.add(mk(new THREE.PlaneGeometry(W, H), m, 0, H / 2, .135));
  if (p.flown) { g.add(mk(BOX(W + .4, .3, .5), MAT.steel, 0, H + .2, 0)); }
  else { for (const x of [-W / 2 + .5, W / 2 - .5]) g.add(mk(BOX(.2, .2, 2.2), MAT.steel, x, .1, -.6)); }
  return { g, rig: { wall: { cv, ctx: cv.getContext('2d'), tex, p } } };
}
