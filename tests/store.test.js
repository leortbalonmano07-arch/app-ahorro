import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const store = await import('../js/store.js');

test('los fijos se crean cada mes hasta hoy y no se duplican', () => {
  const base = { type: 'expense', amount: 45000, concept: 'Alquiler', category: 'casa', date: '2026-07-31', time: '' };
  const r = store.addRecurring(base);
  store.addMov({ ...base, recId: r.id });
  const n = store.materializeRecurring(new Date(2026, 9, 15));
  assert.equal(n, 2); // agosto (31) y septiembre (30); octubre 31 todavía no
  const dates = store.getState().movs.filter((m) => m.recId === r.id).map((m) => m.date).sort();
  assert.deepEqual(dates, ['2026-07-31', '2026-08-31', '2026-09-30']);
  assert.equal(store.materializeRecurring(new Date(2026, 9, 15)), 0);
});

test('borrar un fijo no lo vuelve a crear ese mes, deshacer lo recupera', () => {
  const r = store.getState().recurring[0];
  const sep = store.getState().movs.find((m) => m.recId === r.id && m.date === '2026-09-30');
  const removed = store.removeMov(sep.id);
  assert.equal(store.materializeRecurring(new Date(2026, 9, 15)), 0);
  store.restoreMov(removed);
  assert.equal(store.getState().movs.filter((m) => m.recId === r.id).length, 3);
});

test('exportar CSV y copia JSON', () => {
  const csv = store.exportCSV(() => 'Casa');
  assert.match(csv, /"2026-08-31";"";"Gasto";"Alquiler";"Casa";"-450,00"/);
  const json = store.exportJSON();
  store.importJSON(JSON.stringify({ movs: [], recurring: [] }), { merge: false });
  assert.equal(store.getState().movs.length, 0);
  store.importJSON(json, { merge: false });
  assert.equal(store.getState().movs.length, 3);
  assert.equal(store.getState().recurring.length, 1);
});
