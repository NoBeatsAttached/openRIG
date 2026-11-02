// Gear catalog: real-world weights, power and DMX footprints for generic fixtures.
import * as M from './models.js';

const LIGHT = pan => [
  ...(pan ? [{ k: 'pan', l: 'Pan', u: '°', t: 'range', min: -270, max: 270, step: 1 }] : []),
  { k: 'tilt', l: 'Tilt', u: '°', t: 'range', min: -135, max: 135, step: 1 },
  { k: 'dim', l: 'Dimmer', u: '%', t: 'range', min: 0, max: 100, step: 1 },
  { k: 'color', l: 'Color', t: 'color' },
  { k: 'hung', l: 'Hung under truss (inverted)', t: 'bool' },
];

export const CATS = ['Staging', 'Rigging', 'Lighting', 'Video', 'Audio'];

export const CAT = {
  deck: {
    name: 'Stage deck', cat: 'Staging', mount: 'floor', pc: 'other', build: M.buildDeck,
    lb: p => p.w * p.d * 2.6, spec: '8×4 · 2.6 lb/ft²', props: { w: 8, d: 4, h: 4, skirt: true }, thumb: { h: 2 },
    schema: [{ k: 'w', l: 'Width', u: 'ft', t: 'sel', opts: [4, 8] }, { k: 'd', l: 'Depth', u: 'ft', t: 'sel', opts: [4, 8] },
      { k: 'h', l: 'Deck height', u: 'ft', t: 'num', min: .5, max: 12, step: .5 }, { k: 'skirt', l: 'Black skirting', t: 'bool' }],
  },
  stairs: {
    name: 'Stage stairs', cat: 'Staging', mount: 'floor', pc: 'other', build: M.buildStairs,
    lb: p => p.h * 18, spec: 'Handrails both sides', props: { h: 4, w: 4 },
    schema: [{ k: 'h', l: 'To height', u: 'ft', t: 'num', min: 1, max: 12, step: .5 }, { k: 'w', l: 'Width', u: 'ft', t: 'sel', opts: [3, 4, 6] }],
  },
  djtable: { name: 'DJ booth', cat: 'Staging', mount: 'floor', pc: 'audio', build: M.buildDJ, lb: 180, W: 900, spec: '8 ft · 4 decks + mixer', props: {}, schema: [] },
  performer: { name: 'Performer', cat: 'Staging', mount: 'floor', pc: 'other', build: M.buildPerformer, lb: 0, spec: '6 ft scale figure', props: {}, schema: [] },
  barricade: {
    name: 'Crowd barricade', cat: 'Staging', mount: 'floor', pc: 'other', build: M.buildBarricade,
    lb: p => p.len / 3.3 * 95, spec: '3.3 ft sections · 4 ft', props: { len: 40 }, thumb: { len: 10 },
    schema: [{ k: 'len', l: 'Run length', u: 'ft', t: 'num', min: 3.3, max: 200, step: 3.3 }],
  },
  foh: { name: 'FOH position', cat: 'Staging', mount: 'floor', pc: 'other', build: M.buildFOH, lb: 900, W: 2400, spec: '12×10 riser + canopy', props: {}, schema: [] },

  truss: {
    name: 'Box truss', cat: 'Rigging', mount: 'free', defY: 24, pc: 'other', build: M.buildTruss,
    lb: p => p.len * (p.size == 20.5 ? 8.2 : 6), spec: '12″ or 20.5″ · any length', props: { len: 40, size: 12 }, thumb: { len: 10 },
    schema: [{ k: 'len', l: 'Length', u: 'ft', t: 'num', min: 5, max: 120, step: 5 }, { k: 'size', l: 'Box size', u: 'in', t: 'sel', opts: [12, 20.5] }],
  },
  tower: {
    name: 'Ground support', cat: 'Rigging', mount: 'floor', pc: 'other', build: M.buildTower,
    lb: p => p.h * 6 + 260, spec: '12″ mast · base + sleeve', props: { h: 30 }, thumb: { h: 12 },
    schema: [{ k: 'h', l: 'Tower height', u: 'ft', t: 'num', min: 8, max: 50, step: 1 }],
  },
  motor: {
    name: 'Chain hoist', cat: 'Rigging', mount: 'top', pc: 'other', build: M.buildMotor,
    lb: p => p.cap >= 2000 ? 110 : 75, spec: '½ ton or 1 ton', props: { cap: 1000, chain: 10 }, thumb: { chain: 2 },
    schema: [{ k: 'cap', l: 'Rated load', u: 'lb', t: 'sel', opts: [1000, 2000] }, { k: 'chain', l: 'Chain drawn', u: 'ft', t: 'num', min: 1, max: 80, step: 1 }],
  },

  spot: {
    name: 'Spot mover', short: 'SPOT', cat: 'Lighting', mount: 'hang', pc: 'light', build: M.buildFixture, model: 'mover', mover: 1,
    beam: 16, beamLen: 110, lensR: .27, lb: 48, W: 550, dmx: 22, props: { pan: 0, tilt: 0, dim: 100, color: '#ffffff', hung: false }, schema: LIGHT(true),
  },
  beamfx: {
    name: 'Beam mover', short: 'BEAM', cat: 'Lighting', mount: 'hang', pc: 'light', build: M.buildFixture, model: 'mover', mover: 1, sc: .82,
    beam: 3.5, beamLen: 150, lensR: .2, lb: 35, W: 420, dmx: 16, props: { pan: 0, tilt: 0, dim: 100, color: '#d9ecff', hung: false }, schema: LIGHT(true),
  },
  wash: {
    name: 'LED wash mover', short: 'WASH', cat: 'Lighting', mount: 'hang', pc: 'light', build: M.buildFixture, model: 'mover', mover: 1,
    beam: 28, beamLen: 75, lensR: .34, lb: 32, W: 480, dmx: 20, props: { pan: 0, tilt: 0, dim: 100, color: '#ff3f86', hung: false }, schema: LIGHT(true),
  },
  par: {
    name: 'LED par', short: 'PAR', cat: 'Lighting', mount: 'hang', pc: 'light', build: M.buildFixture, model: 'par',
    beam: 25, beamLen: 50, lensR: .29, lb: 9, W: 90, dmx: 8, props: { tilt: 0, dim: 100, color: '#7a4dff', hung: false }, schema: LIGHT(false),
  },
  strobe: {
    name: 'LED strobe bar', short: 'STRB', cat: 'Lighting', mount: 'hang', pc: 'light', build: M.buildFixture, model: 'strobe', strobe: 1,
    lb: 30, W: 1100, dmx: 20, props: { tilt: 0, dim: 0, color: '#ffffff', hung: false }, schema: LIGHT(false),
  },
  blinder: {
    name: '2-lite blinder', short: 'BLND', cat: 'Lighting', mount: 'hang', pc: 'light', build: M.buildFixture, model: 'blinder',
    beam: 55, beamLen: 30, lb: 14, W: 220, dmx: 4, props: { tilt: 90, dim: 0, color: '#ffb066', hung: false }, schema: LIGHT(false),
  },
  hazer: { name: 'Hazer', short: 'HAZE', cat: 'Lighting', mount: 'floor', pc: 'light', build: M.buildHazer, lb: 28, W: 400, dmx: 2, spec: '2 ch', props: {}, schema: [] },

  ledwall: {
    name: 'LED wall', cat: 'Video', mount: 'floor', pc: 'video', build: M.buildWall,
    lb: p => p.cols * p.rows * 17 + (p.flown ? p.cols * 12 : 0), W: p => p.cols * p.rows * 180,
    spec: '500 mm panels · 17 lb · 180 W', props: { cols: 12, rows: 7, content: 'bars', text: 'HEADLINER', flown: false }, thumb: { cols: 4, rows: 3 },
    schema: [{ k: 'cols', l: 'Panels wide', t: 'num', min: 1, max: 60, step: 1 }, { k: 'rows', l: 'Panels high', t: 'num', min: 1, max: 30, step: 1 },
      { k: 'content', l: 'Content', t: 'sel', opts: ['bars', 'gradient', 'text', 'off'] }, { k: 'text', l: 'Wall text', t: 'text' },
      { k: 'flown', l: 'Flown on a header', t: 'bool' }],
  },

  linearray: {
    name: 'Line array', cat: 'Audio', mount: 'free', defY: 30, pc: 'audio', build: M.buildLineArray,
    lb: p => p.boxes * 100 + 60, W: p => p.boxes * 450, spec: '12″ 2-way · 100 lb/box', props: { boxes: 10, splay: 2 }, thumb: { boxes: 6, splay: 3 },
    schema: [{ k: 'boxes', l: 'Boxes', t: 'num', min: 1, max: 24, step: 1 }, { k: 'splay', l: 'Splay per box', u: '°', t: 'num', min: 0, max: 10, step: .5 }],
  },
  sub: {
    name: 'Sub, dual 18″', cat: 'Audio', mount: 'floor', pc: 'audio', build: M.buildSub,
    lb: p => p.stack * 230, W: p => p.stack * 900, spec: '230 lb · stacks', props: { stack: 2 },
    schema: [{ k: 'stack', l: 'Stacked', t: 'num', min: 1, max: 4, step: 1 }],
  },
  wedge: { name: 'Floor wedge', cat: 'Audio', mount: 'floor', pc: 'audio', build: M.buildWedge, lb: 48, W: 350, spec: '12″ monitor', props: {}, schema: [] },
};

export const val = (x, p) => typeof x === 'function' ? x(p) : (x || 0);

export function specLine(t) {
  const d = CAT[t], p = d.props, b = [];
  if (d.model) { b.push(val(d.lb, p) + ' lb', val(d.W, p) + ' W', d.dmx + ' ch'); if (d.beam) b.push(d.beam + '°'); }
  else if (d.spec) b.push(d.spec);
  return b.join(' · ');
}
