// Renderer, cameras, post-processing, environment and crowd.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MAT, PERSON, SHARED, BEAM_SIDE } from './models.js';
import { S, UI, store } from './state.js';

export const canvas = document.getElementById('c');
export const host = document.getElementById('stage');
const mobileGPU = matchMedia('(max-width: 820px)').matches || /Mobi|Android/i.test(navigator.userAgent);

// Post-processing renders into its own target, so canvas antialiasing would be wasted work.
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

export const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;

export const hemi = new THREE.HemisphereLight(0xa8bcd8, 0x1b1712, .35); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff4e6, .2); sun.position.set(-80, 140, 90); scene.add(sun);

/* sky dome */
const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;
    void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h,0.0,1.0), .55)) : mix(mid, bot, clamp(-h*6.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }`,
}));
sky.renderOrder = -10; scene.add(sky);

/* ground + CAD grid */
export const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), MAT.ground);
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const gridU = { uColor: { value: new THREE.Color(0x6d7a90) }, uAccent: { value: new THREE.Color(0xffb547) }, uOpacity: { value: .55 }, uFade: { value: 260 }, uMinor: { value: 1 } };
const grid = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: gridU,
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform vec3 uColor; uniform vec3 uAccent; uniform float uOpacity; uniform float uFade; uniform float uMinor; varying vec3 vW;
    float line(vec2 p, float s){ vec2 q = p/s; vec2 g = abs(fract(q-0.5)-0.5)/fwidth(q); return 1.0 - min(min(g.x,g.y),1.0); }
    float axis(float v){ return 1.0 - min(abs(v)/fwidth(v), 1.0); }
    void main(){
      float d = length(vW.xz - cameraPosition.xz);
      float fade = 1.0 - smoothstep(uFade*0.35, uFade, d);
      float minor = line(vW.xz, 1.0) * uMinor * (1.0 - smoothstep(30.0, 90.0, d));
      float major = line(vW.xz, 5.0);
      float a = max(minor*0.22, major*0.55) * fade;
      float ax = axis(vW.x) * fade;
      vec3 c = mix(uColor, uAccent, ax);
      gl_FragColor = vec4(c, max(a, ax*0.8) * uOpacity);
    }`,
}));
grid.rotation.x = -Math.PI / 2; grid.position.y = .03; grid.renderOrder = 1; scene.add(grid);
export const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/* cameras + controls */
export const pcam = new THREE.PerspectiveCamera(42, 1, .5, 4000);
export const tcam = new THREE.OrthographicCamera(-1, 1, 1, -1, -3000, 5000); tcam.up.set(0, 0, -1); tcam.position.set(0, 800, -14);
export const fcam = new THREE.OrthographicCamera(-1, 1, 1, -1, -3000, 5000); fcam.position.set(0, 18, 800);
export const pctl = new OrbitControls(pcam, canvas); pctl.enableDamping = true; pctl.dampingFactor = .08; pctl.maxPolarAngle = Math.PI * .495; pctl.maxDistance = 1200; pctl.minDistance = 3;
export const tctl = new OrbitControls(tcam, canvas); tctl.enableRotate = false; tctl.screenSpacePanning = true; tctl.target.set(0, 0, -14); tctl.enabled = false; tctl.enableDamping = true;
export const fctl = new OrbitControls(fcam, canvas); fctl.enableRotate = false; fctl.screenSpacePanning = true; fctl.target.set(0, 18, 0); fctl.enabled = false; fctl.enableDamping = true;
export const cam = () => UI.view === 'plot' ? tcam : UI.view === 'front' ? fcam : pcam;
export const ctl = () => UI.view === 'plot' ? tctl : UI.view === 'front' ? fctl : pctl;
export function frameAll(target = [0, 12, -14], pos = [86, 52, 112]) { pcam.position.set(...pos); pctl.target.set(...target); pcam.fov = 42; pcam.updateProjectionMatrix(); }
frameAll();

export const tc = new TransformControls(pcam, canvas); tc.setSize(.8);
scene.add(tc.getHelper());
tc.addEventListener('dragging-changed', e => { ctl().enabled = !e.value; });

/* post */
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
export const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, pcam); composer.addPass(renderPass);
export const outline = new OutlinePass(new THREE.Vector2(256, 256), scene, pcam);
outline.visibleEdgeColor.set(0xffb547); outline.hiddenEdgeColor.set(0x6b4a1c); outline.edgeStrength = 4; outline.edgeThickness = 1; outline.edgeGlow = 0;
outline.downSampleRatio = 2; outline.enabled = false;
composer.addPass(outline);
export const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .6, .45, .9);
// bloom is soft by nature: run it at half resolution
const bloomSetSize = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => bloomSetSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
composer.addPass(bloom);
composer.addPass(new OutputPass());

export function setCamera(c) { renderPass.camera = c; outline.renderCamera = c; tc.camera = c; }

/* ---------- quality ----------
   auto: medium settings, and the render resolution scales itself to hold the frame rate.
   low / medium / high: fixed. */
export const QUALITY = {
  low: { dpr: .75, msaa: 0, bloom: false, spots: false, outline: false, beamSide: THREE.FrontSide, crowdEvery: 3, wallEvery: 6 },
  medium: { dpr: 1.25, msaa: 2, bloom: true, spots: false, outline: false, beamSide: THREE.FrontSide, crowdEvery: 2, wallEvery: 4 },
  high: { dpr: 2, msaa: 4, bloom: true, spots: true, outline: true, beamSide: THREE.DoubleSide, crowdEvery: 1, wallEvery: 2 },
};
export const Q = { level: 'auto', ...QUALITY.medium, scale: 1 };
const listeners = [];
export const onQuality = fn => listeners.push(fn);
export function setQuality(level) {
  Q.level = level; Object.assign(Q, QUALITY[level === 'auto' ? (mobileGPU ? 'low' : 'medium') : level]);
  Q.scale = 1;
  rt.samples = Q.msaa; composer.renderTarget1.samples = Q.msaa; composer.renderTarget2.samples = Q.msaa;
  composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
  BEAM_SIDE.value = Q.beamSide;
  store.set('openrig.quality', level);
  applyDPR(); listeners.forEach(f => f(Q));
  applyEnv();
}
function applyDPR() {
  const d = Math.max(.5, Math.min(devicePixelRatio || 1, Q.dpr) * Q.scale);
  renderer.setPixelRatio(d); composer.setPixelRatio(d); resize();
}
// Adaptive resolution: watch real frame times and step the render scale down/up.
let acc = 0, frames = 0, lastAdj = 0;
export function adapt(dt, now) {
  if (Q.level !== 'auto' || document.hidden) return;
  acc += dt; frames++;
  if (acc < 1.2) return;
  const ms = acc / frames * 1000; acc = 0; frames = 0;
  if (now - lastAdj < 1500) return;
  if (ms > 24 && Q.scale > .5) { Q.scale = Math.max(.5, +(Q.scale - .15).toFixed(2)); lastAdj = now; applyDPR(); }
  else if (ms < 14 && Q.scale < 1) { Q.scale = Math.min(1, +(Q.scale + .1).toFixed(2)); lastAdj = now; applyDPR(); }
}

function fitOrtho(c, half) { const a = host.clientWidth / Math.max(1, host.clientHeight); c.left = -half * a; c.right = half * a; c.top = half; c.bottom = -half; c.updateProjectionMatrix(); }
export function resize() {
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  pcam.aspect = w / h; pcam.updateProjectionMatrix();
  const narrow = w < 700; fitOrtho(tcam, narrow ? 62 : 46); fitOrtho(fcam, narrow ? 34 : 26);
}
new ResizeObserver(resize).observe(host);

/* environment */
export function applyEnv() {
  const n = S.show.night, hz = S.show.haze / 100;
  if (n) { skyU.top.value.set(0x020308); skyU.mid.value.set(0x121826); skyU.bot.value.set(0x07090d); }
  else { skyU.top.value.set(0x4f7cad); skyU.mid.value.set(0xc9d6e2); skyU.bot.value.set(0x8f9a8a); }
  const fogC = skyU.mid.value.clone().lerp(skyU.bot.value, .3);
  scene.fog = new THREE.FogExp2(fogC, n ? .0012 + hz * .0026 : .0009 + hz * .001);
  const cad = UI.view === 'plot' || UI.view === 'front';
  hemi.intensity = cad ? 1.5 : n ? .32 : 1.6; sun.intensity = cad ? 1.6 : n ? .08 : 2.4;
  if (cad) scene.fog = null;
  bloom.enabled = !cad && Q.bloom;
  scene.environmentIntensity = n ? .35 : 1;
  MAT.ground.color.set(n ? 0xffffff : 0x9aa38c);
  gridU.uOpacity.value = n ? .28 : .3;
  bloom.strength = n ? .6 : .25;
}
export function viewTweaks() {
  applyEnv();
  const plot = UI.view === 'plot';
  gridU.uMinor.value = plot || UI.view === 'front' ? 1 : .7;
  gridU.uFade.value = plot ? 2000 : 260;
}

/* crowd */
let crowdDown = null, crowdUp = null, base = null, zone = null;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
export function buildCrowd() {
  for (const m of [crowdDown, crowdUp]) if (m) { scene.remove(m); m.dispose(); }
  crowdDown = crowdUp = null;
  if (zone) { scene.remove(zone); zone.geometry.dispose(); zone = null; }
  const W = S.show.crowdW, D = S.show.crowdD, z0 = 14;
  const pts = [-W / 2, .06, z0, W / 2, .06, z0, W / 2, .06, z0, W / 2, .06, z0 + D, W / 2, .06, z0 + D, -W / 2, .06, z0 + D, -W / 2, .06, z0 + D, -W / 2, .06, z0];
  const zg = new THREE.BufferGeometry(); zg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  zone = new THREE.LineSegments(zg, new THREE.LineDashedMaterial({ color: 0x55627a, dashSize: 2, gapSize: 2 })); zone.computeLineDistances(); scene.add(zone);
  if (!S.show.crowd) return;
  const n = Math.max(0, Math.min(5000, S.show.crowdN | 0)); if (!n) return;
  const nUp = Math.round(n * .22), nDown = n - nUp;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: .7 });
  crowdDown = new THREE.InstancedMesh(PERSON.down, mat, nDown); crowdUp = new THREE.InstancedMesh(PERSON.up, mat, nUp);
  base = { down: new Float32Array(nDown * 4), up: new Float32Array(nUp * 4) };
  const c = new THREE.Color(), cloth = [[.6, .12, .05], [.0, .0, .06], [.62, .06, .1], [.08, .18, .07], [.58, .25, .07], [.0, .0, .03], [.75, .1, .12], [.95, .3, .08]];
  for (const [mesh, arr] of [[crowdDown, base.down], [crowdUp, base.up]]) {
    for (let i = 0; i < mesh.count; i++) {
      const z = z0 + 1 + Math.pow(Math.random(), 1.6) * (D - 2), spread = W / 2 * (.5 + .5 * (z - z0) / D), x = (Math.random() * 2 - 1) * spread;
      const s = .9 + Math.random() * .17, ry = (Math.random() - .5) * .9;
      arr.set([x, z, s, ry], i * 4);
      _e.set(0, Math.PI + ry, 0); _q.setFromEuler(_e);
      mesh.setMatrixAt(i, _m.compose(_p.set(x, 0, z), _q, _s.set(s, s, s)));
      const cl = cloth[(Math.random() * cloth.length) | 0]; c.setHSL(cl[0], cl[1], cl[2] + Math.random() * .04); mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true; scene.add(mesh);
  }
}
export function bounceCrowd(t) {
  const amp = S.show.program === 'static' || !S.show.playing ? 0 : .5;
  for (const [mesh, arr, k] of [[crowdDown, base?.down, 1.37], [crowdUp, base?.up, 2.11]]) {
    if (!mesh) continue;
    if (!amp && !mesh.userData.moving) continue;
    mesh.userData.moving = amp > 0;
    for (let i = 0; i < mesh.count; i++) {
      const x = arr[i * 4], z = arr[i * 4 + 1], s = arr[i * 4 + 2], ry = arr[i * 4 + 3];
      const y = amp ? Math.max(0, Math.sin(t * 7.8 + i * k)) * amp * (i % 3 ? 1 : .3) : 0;
      _e.set(0, Math.PI + ry, 0); _q.setFromEuler(_e);
      mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
export { SHARED };

/* smooth camera focus on a box */
let fa = null;
export function focusBox(box) {
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  const ctrl = ctl(), camera = cam();
  let toP;
  if (camera.isPerspectiveCamera) {
    const dir = camera.position.clone().sub(ctrl.target).normalize();
    if (UI.view === 'pov') { dir.set(0, .25, 1).normalize(); }
    toP = c.clone().addScaledVector(dir, Math.min(260, Math.max(14, size * 1.7)));
    if (toP.y < 3) toP.y = 3;
  } else {
    if (UI.view === 'plot') c.y = 0; else c.z = 0;
    toP = camera.position.clone().add(c.clone().sub(ctrl.target));
  }
  fa = { ctrl, camera, k: 0, fT: ctrl.target.clone(), tT: c, fP: camera.position.clone(), tP: toP };
}
export function stepFocus(dt) {
  if (!fa) return; fa.k = Math.min(1, fa.k + dt * 2.8);
  const e = 1 - Math.pow(1 - fa.k, 3);
  fa.ctrl.target.lerpVectors(fa.fT, fa.tT, e); fa.camera.position.lerpVectors(fa.fP, fa.tP, e);
  if (fa.k >= 1) fa = null;
}
export const cancelFocus = () => { fa = null; };
