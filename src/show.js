// Show engine: drives fixtures, beams, real spot lights and LED wall content every frame.
import * as THREE from 'three';
import { DEG } from './models.js';
import { scene } from './engine.js';
import { objs } from './objects.js';
import { S, UI, reduceMotion } from './state.js';

const POOL = 8, pool = [];
for (let i = 0; i < POOL; i++) {
  const l = new THREE.SpotLight(0xffffff, 0, 0, .3, .5, 2);
  scene.add(l); scene.add(l.target); pool.push(l);
}
export let T = 0;
const col = new THREE.Color(), wp = new THREE.Vector3(), wd = new THREE.Vector3();

export function animate(dt) {
  const sh = S.show; if (sh.playing) T += dt * sh.speed;
  const prog = sh.playing ? sh.program : 'static', haze = sh.haze / 100, master = sh.master / 100, night = sh.night;
  const flat = UI.view === 'plot' ? 0 : UI.view === 'front' ? .45 : 1;
  const lit = []; let i = 0;
  for (const o of objs.values()) {
    const heads = o.rig.heads; if (!heads) continue;
    const p = o.item.props, d = o.def; let touched = false;
    for (const h of heads) {
      let pan = p.pan || 0, tilt = p.tilt || 0, dim = (p.dim ?? 100) / 100 * master; const k = i++;
      col.set(p.color || '#ffffff');
      if (d.mover && !reduceMotion) {
        if (prog === 'sweep') { pan += Math.sin(T * .7 + k * .35) * 45; tilt += Math.sin(T * .9 + k * .5) * 24; }
        else if (prog === 'fan') { tilt += Math.sin(T * 1.1) * (k % 2 ? 1 : -1) * 34; pan += Math.sin(T * .45) * 18; }
        else if (prog === 'ballyhoo') { pan += Math.sin(T * 1.5 + k) * 85; tilt += Math.cos(T * 1.25 + k * 1.7) * 42; }
      }
      if (d.strobe) {
        if (prog === 'strobe' || prog === 'chase') dim = master * (Math.random() < .3 ? 1 : 0);
        else if (prog !== 'static') dim = master * (Math.random() < .04 ? 1 : 0);
      } else if (prog === 'chase') dim *= ((Math.floor(T * 6) + k) % 4 === 0) ? 1 : .05;
      else if (prog === 'strobe') dim *= Math.random() < .4 ? 1 : 0;
      if (sh.rainbow) col.setHSL((T * .07 + k * .031) % 1, 1, .55);
      if (h.yoke) h.yoke.rotation.y = pan * DEG;
      if (h.head) h.head.rotation.x = tilt * DEG;
      h.lensMat.color.copy(col).multiplyScalar(.03 + dim * (d.strobe ? 9 : 6));
      if (h.beam) {
        const on = dim > .01 && haze > 0; h.beam.visible = on;
        if (on) {
          if (!touched) { o.root.updateMatrixWorld(true); touched = true; }
          h.beam.getWorldPosition(wp); wd.setFromMatrixColumn(h.head.matrixWorld, 1).normalize();
          const max = d.beamLen || 90, L = wd.y < -.02 ? Math.min(max, (wp.y + .01) / -wd.y) : max, r = Math.tan(d.beam / 2 * DEG);
          h.beam.scale.set(Math.max(r * L, .05), L, Math.max(r * L, .05));
          const k2 = (d.beam < 6 ? 1.4 : d.beam < 20 ? .55 : .26) * (night ? 1 : .22) * (.25 + haze) * flat;
          h.beamM.uniforms.uColor.value.copy(col);
          h.beamM.uniforms.uInt.value = dim * k2;
          h.beamM.uniforms.uTime.value = T;
          lit.push({ pos: wp.clone(), dir: wd.clone(), col: col.clone(), dim, beam: d.beam, len: L });
        }
      }
    }
  }
  // feed a handful of real spot lights so beams actually light the deck and the crowd
  const step = lit.length > POOL ? lit.length / POOL : 1;
  for (let j = 0; j < POOL; j++) {
    const l = pool[j], s = j < lit.length ? lit[Math.floor(j * step)] : null;
    if (!s) { l.intensity = 0; continue; }
    l.position.copy(s.pos); l.target.position.copy(s.pos).addScaledVector(s.dir, 10);
    l.angle = Math.min(s.beam / 2 * DEG * 1.3, 1.1); l.color.copy(s.col);
    l.intensity = flat ? s.dim * (night ? 1600 : 700) * Math.min(2, step) : 0;
  }
}

export function drawWall(w) {
  const { ctx, cv, p } = w, W = cv.width, H = cv.height, m = S.show.master / 100, t = T;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (p.content === 'bars') {
    const n = Math.max(8, p.cols * 2);
    for (let i = 0; i < n; i++) {
      const v = (Math.sin(t * 3.1 + i * .7) * .5 + .5) * (Math.sin(t * 1.3 + i * .21) * .3 + .7);
      ctx.fillStyle = `hsl(${(i * 9 + t * 35) % 360},95%,55%)`; ctx.fillRect(i * W / n + 1, H - v * H, W / n - 2, v * H);
    }
  } else if (p.content === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    for (let s = 0; s <= 4; s++) g.addColorStop(s / 4, `hsl(${(t * 25 + s * 55) % 360},90%,${38 + s * 4}%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (p.content === 'text') {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120a24'); g.addColorStop(1, `hsl(${(t * 20) % 360},70%,20%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const txt = String(p.text || '').toUpperCase(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = H * .42; ctx.font = `800 ${fs}px "Big Shoulders Display", sans-serif`;
    const tw = ctx.measureText(txt).width; if (tw > W * .9) { fs *= W * .9 / tw; ctx.font = `800 ${fs}px "Big Shoulders Display", sans-serif`; }
    ctx.globalAlpha = .8 + .2 * Math.sin(t * 4); ctx.fillText(txt, W / 2, H / 2); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let c = 1; c < p.cols; c++) { const x = Math.round(c * W / p.cols) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let r = 1; r < p.rows; r++) { const y = Math.round(r * H / p.rows) + .5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  if (m < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - m})`; ctx.fillRect(0, 0, W, H); }
  w.tex.needsUpdate = true;
}
