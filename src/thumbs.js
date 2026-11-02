// Renders a small 3D product shot of every catalog item for the library.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CAT } from './catalog.js';
import { DEG } from './models.js';

export async function renderThumbs(onEach) {
  const W = 220, H = 160;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x202020, .8));
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 6, 5); scene.add(key);
  const cam = new THREE.PerspectiveCamera(28, W / H, .1, 500);
  for (const [type, def] of Object.entries(CAT)) {
    const it = { id: 0, type, x: 0, y: 0, z: 0, rot: 0, props: { ...def.props, ...(def.thumb || {}) } };
    if (def.model) { it.props.dim = 100; if (def.mover) it.props.tilt = 35; if (def.model === 'blinder') it.props.tilt = 50; }
    const { g, rig } = def.build(it, def);
    (rig.heads || []).forEach(h => { if (h.beam) h.beam.visible = false; if (h.lensMat) h.lensMat.color.set(def.strobe ? 0xffffff : it.props.color || '#ffffff').multiplyScalar(1.4); });
    if (rig.wall) {
      const { ctx, cv } = rig.wall; const gr = ctx.createLinearGradient(0, 0, cv.width, cv.height);
      gr.addColorStop(0, '#ff3d7f'); gr.addColorStop(.5, '#7a4dff'); gr.addColorStop(1, '#23c6ff'); ctx.fillStyle = gr; ctx.fillRect(0, 0, cv.width, cv.height); rig.wall.tex.needsUpdate = true;
    }
    if (rig.heads && def.mover) rig.heads.forEach(h => { if (h.yoke) h.yoke.rotation.y = -30 * DEG; });
    g.rotation.y = -28 * DEG; scene.add(g); g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const rad = Math.max(s.x, s.y * 1.25, s.z) * .62 + .2, dist = rad / Math.tan(cam.fov / 2 * DEG) * 1.05;
    cam.position.set(c.x + dist * .35, c.y + dist * .38, c.z + dist * .86); cam.lookAt(c);
    r.render(scene, cam);
    onEach(type, r.domElement.toDataURL('image/webp', .9));
    scene.remove(g);
    g.traverse(n => { if (n.material?.userData?.own) n.material.dispose(); });
    await new Promise(res => setTimeout(res, 0));
  }
  pm.dispose(); r.dispose(); r.forceContextLoss();
}
