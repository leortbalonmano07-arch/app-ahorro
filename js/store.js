// Guardado local de movimientos y ajustes (localStorage). Importes en céntimos.

const KEY = 'ahorro.v1';

function empty() {
  return { movs: [], settings: { budget: null, lastBackup: null }, learned: {} };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw);
    return { ...empty(), ...s, settings: { ...empty().settings, ...(s.settings || {}) } };
  } catch {
    return empty();
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getState() { return state; }

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function addMov(m) {
  const mov = { id: uid(), createdAt: new Date().toISOString(), ...m };
  state.movs.push(mov);
  save();
  return mov;
}

export function updateMov(id, patch) {
  const i = state.movs.findIndex((m) => m.id === id);
  if (i >= 0) { state.movs[i] = { ...state.movs[i], ...patch }; save(); }
}

export function removeMov(id) {
  const i = state.movs.findIndex((m) => m.id === id);
  if (i < 0) return null;
  const [m] = state.movs.splice(i, 1);
  save();
  return m;
}

export function restoreMov(m) { state.movs.push(m); save(); }

export function setSetting(k, v) { state.settings[k] = v; save(); }

// Recuerda la categoría que el usuario eligió para las palabras del concepto.
export function learn(words, catId) {
  for (const w of words) if (w.length > 2) state.learned[w] = catId;
  save();
}

export function movsOfMonth(year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return state.movs
    .filter((m) => m.date.startsWith(prefix))
    .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || b.createdAt.localeCompare(a.createdAt));
}

export function exportJSON() {
  return JSON.stringify({ app: 'app-ahorro', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importJSON(text, { merge = true } = {}) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.movs)) throw new Error('El archivo no tiene movimientos');
  if (merge) {
    const ids = new Set(state.movs.map((m) => m.id));
    for (const m of data.movs) if (!ids.has(m.id)) state.movs.push(m);
  } else {
    state.movs = data.movs;
  }
  if (data.learned) state.learned = { ...data.learned, ...state.learned };
  save();
  return data.movs.length;
}

export function exportCSV(catName) {
  const rows = [['Fecha', 'Hora', 'Tipo', 'Concepto', 'Categoría', 'Importe']];
  const sorted = [...state.movs].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  for (const m of sorted) {
    const amount = ((m.type === 'income' ? 1 : -1) * m.amount / 100).toFixed(2).replace('.', ',');
    rows.push([m.date, m.time || '', m.type === 'income' ? 'Ingreso' : 'Gasto', m.concept, catName(m.category), amount]);
  }
  return '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}

// Pide al navegador que no borre los datos (Safari puede borrar datos de webs poco usadas).
export async function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}
