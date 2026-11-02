// Starter designs. Coordinates in feet; downstage edge at z = 0, crowd toward +z.
import { newItem } from './objects.js';

export function festival() {
  const L = [], A = (...a) => L.push(newItem(...a));
  for (let x = -20; x <= 20; x += 8) for (let z = -2; z >= -30; z -= 4) A('deck', x, 0, z, 0, { w: 8, d: 4, h: 6 });
  A('stairs', 24.4, 0, -26, 90, { h: 6, w: 4 }); A('stairs', -24.4, 0, -26, -90, { h: 6, w: 4 });
  for (const x of [-29, 29]) for (const z of [-1, -31]) A('tower', x, 0, z, 0, { h: 32 });
  A('truss', 0, 32, -1, 0, { len: 62, size: 20.5 }); A('truss', 0, 32, -31, 0, { len: 62, size: 20.5 });
  A('truss', -29, 32, -16, 90, { len: 28, size: 20.5 }); A('truss', 29, 32, -16, 90, { len: 28, size: 20.5 });
  A('truss', 0, 32, -16, 0, { len: 56, size: 20.5 });
  for (let i = 0; i < 10; i++) A('wash', -27 + i * 6, 32, -1, 0, { hung: true, tilt: -32, color: i % 2 ? '#ff3f86' : '#ff9a3c' });
  for (const x of [-24, -12, 12, 24]) A('blinder', x, 32, -1, 0, { hung: true, tilt: 70 });
  for (let i = 0; i < 10; i++) A('spot', -24.75 + i * 5.5, 32, -16, 0, { hung: true, tilt: -8 });
  for (let i = 0; i < 12; i++) A('beamfx', -27.5 + i * 5, 32, -31, 0, { hung: true, tilt: 22, color: '#7fe3ff' });
  for (let i = 0; i < 8; i++) A('beamfx', -21 + i * 6, 6, -24, 0, { tilt: 10, color: '#ff2ad4' });
  for (let i = 0; i < 6; i++) A('strobe', -20 + i * 8, 6, -.7, 0, { tilt: 60 });
  A('ledwall', 0, 6.4, -27.2, 0, { cols: 20, rows: 10, content: 'bars' });
  A('ledwall', -44, 13, -2, 18, { cols: 10, rows: 6, content: 'text', flown: true });
  A('ledwall', 44, 13, -2, -18, { cols: 10, rows: 6, content: 'text', flown: true });
  for (const s of [-1, 1]) { A('linearray', s * 36, 38, 2, 0, { boxes: 12, splay: 2.5 }); A('motor', s * 36 - 1, 38, 1.3, 0, { chain: 14 }); A('motor', s * 36 + 1, 38, 1.3, 0, { chain: 14 }); }
  for (let i = 0; i < 6; i++) A('sub', -18 + i * 7.2, 0, 5, 0, { stack: 2 });
  A('barricade', 0, 0, 10.5, 0, { len: 66 });
  for (const x of [-7, 7]) A('wedge', x, 6, -3.2, 180);
  A('djtable', 0, 6, -12, 0); A('performer', 0, 6, -14.6, 0);
  A('hazer', -18, 6, -30.5, 0); A('hazer', 18, 6, -30.5, 0);
  A('foh', 0, 0, 104, 0);
  return { name: 'Festival Main Stage', items: L, show: { crowdW: 130, crowdD: 85, crowdN: 1400 } };
}

export function club() {
  const L = [], A = (...a) => L.push(newItem(...a));
  for (const x of [-8, 0, 8]) for (const z of [-2, -6, -10]) A('deck', x, 0, z, 0, { w: 8, d: 4, h: 3 });
  A('stairs', 12.4, 0, -9, 90, { h: 3, w: 3 });
  A('truss', 0, 16, -1, 0, { len: 30 }); A('truss', 0, 16, -11.5, 0, { len: 30 });
  for (const z of [-1, -11.5]) for (const x of [-12, 12]) A('motor', x, 17, z, 0, { chain: 8 });
  for (let i = 0; i < 6; i++) A('wash', -12.5 + i * 5, 16, -1, 0, { hung: true, tilt: -35, color: i % 2 ? '#3fa2ff' : '#c74dff' });
  for (let i = 0; i < 6; i++) A('spot', -12.5 + i * 5, 16, -11.5, 0, { hung: true, tilt: 18 });
  for (const x of [-14, 14]) A('strobe', x, 16, -11.5, 0, { hung: true, tilt: 60 });
  for (let i = 0; i < 6; i++) A('par', -11 + i * 4.4, 3, -11.4, 0, { tilt: 15, color: '#ff3c6e' });
  A('ledwall', 0, 3.4, -10.2, 0, { cols: 12, rows: 6, content: 'gradient' });
  for (const s of [-1, 1]) { A('linearray', s * 17, 17, 0, 0, { boxes: 6, splay: 3 }); A('motor', s * 17, 17, -.7, 0, { chain: 6 }); }
  for (const s of [-1, 1]) A('sub', s * 8, 0, 2.5, 0, { stack: 1 });
  for (const x of [-4, 4]) A('wedge', x, 3, -1.5, 180);
  A('djtable', 0, 3, -5, 0); A('performer', 0, 3, -7.4, 0); A('hazer', -10, 3, -11.4, 0);
  A('foh', 0, 0, 46, 0);
  return { name: 'Club Stage', items: L, show: { crowdW: 50, crowdD: 30, crowdN: 300 } };
}

export function blank() {
  const L = [], A = (...a) => L.push(newItem(...a));
  for (let x = -12; x <= 12; x += 8) for (const z of [-2, -6, -10, -14]) A('deck', x, 0, z, 0, { w: 8, d: 4, h: 4 });
  A('performer', 0, 4, -8, 0);
  return { name: 'Untitled Stage', items: L, show: { crowdW: 70, crowdD: 50, crowdN: 500 } };
}

export const TEMPLATES = { festival, club, blank };
