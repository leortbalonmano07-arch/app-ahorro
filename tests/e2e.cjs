const { chromium, devices } = require('playwright');
// Prueba de punta a punta en un iPhone simulado. Uso: python3 -m http.server 8765 && node tests/e2e.cjs
const OUT = process.env.OUT || require('os').tmpdir();
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const S = (fn, a) => p.evaluate(fn, a);
  await p.goto('http://localhost:8765/');
  // 1. Siri con tipo=ingreso
  await p.goto('http://localhost:8765/?t=' + encodeURIComponent('300 euros clases particulares') + '&tipo=ingreso');
  await p.waitForTimeout(300);
  let movs = await S(() => window.__ahorro.store.getState().movs);
  assert.equal(movs.length, 1); assert.equal(movs[0].type, 'income'); assert.equal(movs[0].amount, 30000);
  // 2. recarga misma URL no duplica
  await p.goto('http://localhost:8765/?t=' + encodeURIComponent('300 euros clases particulares') + '&tipo=ingreso');
  await p.waitForTimeout(300);
  movs = await S(() => window.__ahorro.store.getState().movs);
  assert.equal(movs.length, 1, 'no duplica');
  // 3. Siri con "cada mes" crea fijo
  await p.goto('http://localhost:8765/?t=' + encodeURIComponent('Netflix 12,99 cada mes'));
  await p.waitForTimeout(300);
  let st = await S(() => window.__ahorro.store.getState());
  assert.equal(st.recurring.length, 1); assert.equal(st.movs.length, 2);
  // 4. Siri sin importe abre el formulario
  await p.goto('http://localhost:8765/?t=' + encodeURIComponent('cena con Marta'));
  await p.waitForTimeout(400);
  assert.equal(await p.isVisible('#f-amount'), true);
  await p.fill('#f-amount', '27,5');
  await p.check('#f-repeat');
  await p.uncheck('#f-repeat');
  await p.click('#f-save');
  await p.waitForTimeout(300);
  st = await S(() => window.__ahorro.store.getState());
  assert.equal(st.movs.length, 3);
  const cena = st.movs.find((m) => m.concept === 'Cena con Marta');
  assert.equal(cena.amount, 2750); assert.equal(cena.category, 'comer');
  // 5. Editar: cambiar categoría y aprender
  await p.click(`.item[data-id="${cena.id}"]`);
  await p.waitForTimeout(300);
  await p.click('.cat-chip[data-cat="ocio"]');
  await p.click('#f-save');
  await p.waitForTimeout(300);
  st = await S(() => window.__ahorro.store.getState());
  assert.equal(st.movs.find((m) => m.id === cena.id).category, 'ocio');
  assert.equal(st.learned['cena con marta'], 'ocio'); assert.equal(st.learned.cena, undefined);
  // 6. Deslizar para borrar + deshacer
  await S((id) => {
    const el = document.querySelector(`.item[data-id="${id}"]`);
    const r = el.getBoundingClientRect();
    const mk = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: r.top + 10 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [mk(300)] }));
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [mk(250)] }));
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [mk(120)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }));
  }, cena.id);
  await p.waitForTimeout(500);
  assert.equal((await S(() => window.__ahorro.store.getState().movs.length)), 2, 'borrado');
  await p.screenshot({ path: `${OUT}/10-undo.png` });
  await p.click('#toast button');
  await p.waitForTimeout(200);
  assert.equal((await S(() => window.__ahorro.store.getState().movs.length)), 3, 'deshecho');
  // 7. Mes anterior y vuelta
  await p.click('#prev-month');
  await p.waitForTimeout(200);
  const lbl = await p.textContent('#month-label');
  await p.click('#month-label');
  // 8. Aviso de copia con 20+ movimientos
  await S(() => { const { store } = window.__ahorro; for (let i = 0; i < 20; i++) store.addMov({ type: 'expense', amount: 100 + i, concept: 'Prueba ' + i, category: 'otros', date: new Date().toISOString().slice(0, 10), time: '' }); window.__ahorro.render(); });
  assert.equal(await p.isVisible('#backup-nag'), true);
  await p.screenshot({ path: `${OUT}/11-nag.png` });
  await p.click('#backup-nag [data-act=later]');
  assert.equal(await p.isVisible('#backup-nag'), false);
  console.log('mes anterior:', lbl, 'errors:', JSON.stringify(errors));
  await b.close();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
