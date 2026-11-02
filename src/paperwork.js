// Power, rigging, DMX patch and gear list — computed straight from the design.
import { scene } from './engine.js';
import { objs } from './objects.js';
import { trussS } from './models.js';
import { val } from './catalog.js';
import { S, esc, fmtN, fmtFt } from './state.js';

// Rough uniform-load ratings (lb) for a simply supported span. Planning numbers only.
const UDL = {
  '12': [[10, 1500], [20, 900], [30, 550], [40, 350], [50, 220], [60, 140]],
  '20.5': [[10, 3500], [20, 2400], [30, 1600], [40, 1100], [50, 800], [60, 600], [70, 420], [80, 300]],
};
export function allowUDL(size, len) {
  const t = UDL[String(size)] || UDL['12'];
  if (len <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (len <= t[i][0]) { const a = t[i - 1], b = t[i]; return a[1] + (b[1] - a[1]) * (len - a[0]) / (b[0] - a[0]); }
  const l = t[t.length - 1]; return l[1] * Math.pow(l[0] / len, 2);
}
export const pill = pct => `<span class="pill ${pct > 100 ? 'bad' : pct > 80 ? 'warn' : 'ok'}">${Math.round(pct)}%</span>`;

export function rigReport() {
  scene.updateMatrixWorld();
  const trusses = [...objs.values()].filter(o => o.item.type === 'truss').sort((a, b) => a.item.id - b.item.id);
  const rows = trusses.map((o, i) => {
    const it = o.item, s = trussS(it.props), self = val(o.def.lb, it.props); let hung = 0, count = 0;
    for (const q of objs.values()) {
      if (!q.def.model || !q.item.props.hung) continue;
      const lp = o.root.worldToLocal(q.root.position.clone());
      if (Math.abs(lp.y) < .6 && Math.abs(lp.x) <= it.props.len / 2 + .5 && Math.abs(lp.z) <= s / 2 + .6) { hung += val(q.def.lb, q.item.props); count++; }
    }
    const allow = allowUDL(it.props.size, it.props.len);
    return { id: it.id, label: 'Truss ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''), len: it.props.len, size: it.props.size, trim: it.y, self, hung, count, total: self + hung, allow, pct: hung / allow * 100 };
  });
  let flown = 0; rows.forEach(r => { if (objs.get(r.id).item.y > 1) flown += r.total; });
  for (const o of objs.values()) if (o.item.type === 'linearray' || (o.item.type === 'ledwall' && o.item.props.flown) || o.item.type === 'motor') flown += val(o.def.lb, o.item.props);
  const motors = [...objs.values()].filter(o => o.item.type === 'motor');
  return { rows, flown, motors: motors.length, cap: motors.reduce((a, o) => a + o.item.props.cap, 0) };
}

export function patchMap() {
  const order = ['spot', 'beamfx', 'wash', 'par', 'strobe', 'blinder', 'hazer'];
  const fx = [...objs.values()].filter(o => o.def.dmx).sort((a, b) =>
    order.indexOf(a.item.type) - order.indexOf(b.item.type) || b.item.y - a.item.y || a.item.z - b.item.z || a.item.x - b.item.x);
  const m = new Map(); let u = 1, a = 1;
  for (const o of fx) { const c = o.def.dmx; if (a + c - 1 > 512) { u++; a = 1; } m.set(o.item.id, { u, a, o }); a += c; }
  return m;
}
export function power() {
  const g = { light: 0, video: 0, audio: 0, other: 0 };
  for (const o of objs.values()) g[o.def.pc] += val(o.def.W, o.item.props);
  return g;
}
export function totals() {
  const w = power(); let lb = 0; for (const o of objs.values()) lb += val(o.def.lb, o.item.props);
  return { watts: w.light + w.video + w.audio + w.other, lb };
}
export function gearCounts() {
  const counts = {};
  for (const o of objs.values()) {
    const p = o.item.props; let k = o.def.name;
    if (o.item.type === 'truss') k = `${p.size}″ box truss, ${p.len} ft`;
    if (o.item.type === 'ledwall') k = `LED wall ${p.cols}×${p.rows} (${p.cols * p.rows} panels)`;
    if (o.item.type === 'linearray') k = `Line array hang, ${p.boxes} boxes`;
    if (o.item.type === 'deck') k = `Stage deck ${p.w}×${p.d} @ ${p.h} ft`;
    if (o.item.type === 'tower') k = `Ground support tower, ${p.h} ft`;
    if (o.item.type === 'motor') k = `Chain hoist, ${p.cap === 2000 ? '1' : '½'} ton`;
    counts[k] = (counts[k] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
}
export const patchCSV = pm => 'Channel,Fixture,Footprint,Universe,Address,X ft,Z ft,Trim ft\n' +
  [...pm.values()].map((x, i) => `${i + 101},${x.o.def.name},${x.o.def.dmx},${x.u},${x.a},${x.o.item.x},${x.o.item.z},${x.o.item.y}`).join('\n');

export function paperHTML() {
  const pw = power(), rig = rigReport(), pm = patchMap(), list = [...pm.values()];
  const univ = list.length ? Math.max(...list.map(x => x.u)) : 0;
  const total = pw.light + pw.video + pw.audio + pw.other, leg = w => w / (208 * Math.sqrt(3));
  const svc = w => { const a = leg(w); for (const s of [60, 100, 200, 400, 600, 800]) if (a <= s * .8) return s + 'A 3φ'; return '800A+'; };
  const panels = [...objs.values()].filter(o => o.item.type === 'ledwall').reduce((a, o) => a + o.item.props.cols * o.item.props.rows, 0);
  const deckSq = [...objs.values()].filter(o => o.item.type === 'deck').reduce((a, o) => a + o.item.props.w * o.item.props.d, 0);
  const capPct = rig.cap ? rig.flown / rig.cap * 100 : 0;
  const rowsP = [['Lighting', pw.light, 'light'], ['Video', pw.video, 'video'], ['Audio', pw.audio, 'audio'], ['Other', pw.other, 'other']].filter(r => r[1]);
  const bar = rowsP.map(([n, w, c]) => `<i class="seg-${c}" style="flex:${w}" title="${n}"></i>`).join('');
  return `
  <header class="doc-head"><h2>${esc(S.name)}</h2><p class="meta">Production paperwork · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></header>
  <div class="stats">
    <div><b>${list.length}</b><span>DMX fixtures</span><em>${univ} universe${univ === 1 ? '' : 's'}</em></div>
    <div><b>${(total / 1000).toFixed(1)}</b><span>kW connected</span><em>${fmtN(leg(total))} A per leg</em></div>
    <div><b>${fmtN(rig.flown)}</b><span>lb in the air</span><em>${rig.motors} hoists</em></div>
    <div><b>${fmtN(deckSq)}</b><span>ft² of deck</span><em>${panels} LED panels</em></div>
  </div>
  <section><h3>Power</h3>
    ${total ? `<div class="stackbar">${bar}</div>` : ''}
    <div class="tw"><table><thead><tr><th>Dept</th><th class="r">Watts</th><th class="r">A/leg 3φ</th><th class="r">Service</th></tr></thead><tbody>
    ${rowsP.map(([n, w, c]) => `<tr><td><i class="dot seg-${c}"></i>${n}</td><td class="r">${fmtN(w)}</td><td class="r">${fmtN(leg(w))}</td><td class="r">${svc(w)}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="r">${fmtN(total)}</td><td class="r">${fmtN(leg(total))}</td><td class="r">${svc(total)}</td></tr></tbody></table></div>
    <p class="note">Amps per leg at 208V three-phase. Nameplate max, balanced across three legs, sized at 80% continuous. Program draw usually runs 50–70% of this. Keep audio on its own service. Lighting needs about ${Math.ceil(pw.light / 120 / 16)} × 20A circuits.</p>
  </section>
  <section><h3>Rigging</h3>
    ${rig.rows.length ? `<div class="tw"><table><thead><tr><th>Truss</th><th class="r">Span</th><th class="r">Hung lb</th><th class="r">Rating</th><th class="r">Load</th></tr></thead><tbody>
    ${rig.rows.map(r => `<tr><td>${r.label} <small>${r.size}″ @ ${fmtFt(r.trim)}</small></td><td class="r">${r.len}′</td><td class="r">${fmtN(r.hung)} <small>×${r.count}</small></td><td class="r">${fmtN(r.allow)}</td><td class="r">${pill(r.pct)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="note">No truss in the design yet.</p>'}
    <dl class="kv"><dt>Chain hoists</dt><dd>${rig.motors} · ${fmtN(rig.cap)} lb rated</dd><dt>Flown weight</dt><dd>${fmtN(rig.flown)} lb ${rig.cap ? pill(capPct) : ''}</dd></dl>
    <p class="note warnnote">Load % compares hung fixtures to a rough uniform-load rating for a simply supported span. These are planning estimates, not engineering. Use the manufacturer's load tables and have a qualified rigger sign off before anything flies.</p>
  </section>
  <section><h3>DMX patch</h3>
    ${list.length ? `<div class="actions"><button class="btn sm" data-copy="patch">Copy patch as CSV</button></div>
    <div class="tw"><table><thead><tr><th>Ch</th><th>Fixture</th><th class="r">Mode</th><th class="r">U.Addr</th><th class="r">Position</th></tr></thead><tbody>
    ${list.map((x, i) => `<tr><td>${i + 101}</td><td>${x.o.def.short || x.o.def.name}</td><td class="r">${x.o.def.dmx}ch</td><td class="r">${x.u}.${String(x.a).padStart(3, '0')}</td><td class="r">${fmtFt(x.o.item.x)}, ${fmtFt(x.o.item.y)} up</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="note">No DMX fixtures placed.</p>'}
  </section>
  <section><h3>Gear list</h3>
    <div class="actions"><button class="btn sm" data-copy="gear">Copy gear list</button></div>
    <div class="tw"><table class="gear"><tbody>${gearCounts().map(([k, n]) => `<tr><td>${esc(k)}</td><td class="r">× ${n}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}
