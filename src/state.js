// Shared app state, undo history and persistence.
const KEY = 'openrig.v2';

export const S = {
  name: 'Main Stage',
  items: [],
  nextId: 1,
  show: {
    haze: 55, night: true, program: 'sweep', speed: 1, master: 100,
    rainbow: false, crowd: true, crowdN: 1400, crowdW: 130, crowdD: 85, playing: true,
  },
};

export const UI = { selId: null, placing: null, tool: 'translate', snap: 0.5, view: '3d' };

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) S.show.program = 'static';

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

// tiny event bus
const bus = new EventTarget();
export const on = (n, fn) => bus.addEventListener(n, e => fn(e.detail));
export const emit = (n, d) => bus.dispatchEvent(new CustomEvent(n, { detail: d }));

// undo
const stack = [], redoStack = [];
export function snapshot() { return JSON.stringify({ items: S.items, nextId: S.nextId, name: S.name }); }
export function pushUndo() { stack.push(snapshot()); if (stack.length > 100) stack.shift(); redoStack.length = 0; }
export function popUndo() { const s = stack.pop(); if (!s) return null; redoStack.push(snapshot()); return JSON.parse(s); }
export function popRedo() { const s = redoStack.pop(); if (!s) return null; stack.push(snapshot()); return JSON.parse(s); }
export function dropUndo() { stack.pop(); }

let saveT = 0;
export function dirty() {
  clearTimeout(saveT);
  saveT = setTimeout(save, 400);
  emit('changed');
}
export function save() {
  store.set(KEY, JSON.stringify(exportDesign()));
}
export function exportDesign() {
  return { app: 'OpenRig', v: 2, name: S.name, items: S.items, nextId: S.nextId, show: S.show };
}
export function loadSaved() {
  try { const raw = store.get(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export const clone = o => JSON.parse(JSON.stringify(o));
export const r3 = v => Math.round(v * 1000) / 1000;
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmtN = n => Math.round(n).toLocaleString('en-US');
export function fmtFt(v) {
  const neg = v < 0; v = Math.abs(v);
  let f = Math.floor(v), i = Math.round((v - f) * 12);
  if (i === 12) { f++; i = 0; }
  return (neg ? '-' : '') + f + '′' + (i ? ' ' + i + '″' : '');
}
export const val = (x, p) => typeof x === 'function' ? x(p) : (x || 0);
