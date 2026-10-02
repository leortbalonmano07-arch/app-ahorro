import { parse, norm, isoDate } from './parser.js';
import { categoriesFor, categoryById, guessCategory, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories.js';
import * as store from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Formato propio: Intl en español no pone punto de miles en números de 4 cifras (1392,70 €).
function fmtEUR(cents, decimals = 2) {
  const neg = cents < 0;
  const v = Math.abs(cents) / 100;
  let [int, dec] = v.toFixed(decimals).split('.');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '−' : ''}${int}${dec ? ',' + dec : ''} €`;
}
const money = (cents) => fmtEUR(cents);
const moneyShort = (cents) => fmtEUR(cents, Math.abs(cents) >= 100000 ? 0 : 2);
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

const now0 = new Date();
const ui = {
  year: now0.getFullYear(),
  month: now0.getMonth(),
  filterDay: null,   // 'YYYY-MM-DD'
  filterCat: null,   // id de categoría
  catsType: 'expense',
  highlight: null,   // id recién guardado
};

/* ---------- Utilidades de fecha ---------- */
function fromIso(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function dayLabel(iso) {
  const today = isoDate(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === today) return 'Hoy';
  if (iso === isoDate(y)) return 'Ayer';
  return dayFmt.format(fromIso(iso));
}
function nowTime() { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

/* ---------- Render principal ---------- */
function render() {
  const movs = store.movsOfMonth(ui.year, ui.month);
  $('#month-label').textContent = `${MONTHS[ui.month]} ${ui.year}`;
  const isCurrent = ui.year === new Date().getFullYear() && ui.month === new Date().getMonth();
  $('#next-month').style.visibility = isCurrent ? 'hidden' : 'visible';
  renderBackupNag();
  renderStandaloneWarning();
  renderHero(movs);
  renderDaily(movs);
  renderCats(movs);
  renderList(movs);
}

// Recordatorio de copia: los datos solo viven en el móvil.
// Abierta como «app web» desde la pantalla de inicio, iPhone le da un almacén distinto al de Safari,
// y Siri (Atajos) siempre guarda en Safari: los datos no se verían aquí.
function renderStandaloneWarning() {
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  let el = $('#standalone-warn');
  if (!standalone) { if (el) el.remove(); return; }
  if (el) return;
  el = document.createElement('div');
  el.id = 'standalone-warn';
  el.className = 'nag warn';
  el.innerHTML = `<span>⚠️</span><span class="grow"><b>Este icono no ve lo que apuntas con Siri.</b> Bórralo y vuelve a añadir la app desde Safari con <b>«Abrir como app web» desactivado</b>.</span>`;
  $('#main').prepend(el);
}

function renderBackupNag() {
  const st = store.getState();
  const DAY = 864e5;
  const last = Math.max(Date.parse(st.settings.lastBackup || 0) || 0, Date.parse(st.settings.nagSnoozed || 0) || 0);
  const show = st.movs.length >= 20 && Date.now() - last > 30 * DAY;
  let el = $('#backup-nag');
  if (!show) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'backup-nag';
    el.className = 'nag';
    $('#main').prepend(el);
  }
  el.innerHTML = `<span>💾</span><span class="grow">Haz una copia de seguridad: tus datos solo están en este móvil.</span>
    <button class="chip" data-act="backup">Hacer copia</button><button class="icon-btn" data-act="later" aria-label="Más tarde">×</button>`;
  el.onclick = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'backup') {
      download(`ahorro-copia-${isoDate(new Date())}.json`, store.exportJSON(), 'application/json');
      store.setSetting('lastBackup', new Date().toISOString());
      render();
    } else if (act === 'later') {
      store.setSetting('nagSnoozed', new Date(Date.now() - 16 * DAY).toISOString()); // vuelve a avisar en 2 semanas
      render();
    }
  };
}

function sums(movs) {
  let inc = 0, exp = 0;
  for (const m of movs) (m.type === 'income' ? (inc += m.amount) : (exp += m.amount));
  return { inc, exp, bal: inc - exp };
}

function renderHero(movs) {
  const { inc, exp, bal } = sums(movs);
  const budget = store.getState().settings.budget;
  const today = new Date();
  const isCurrent = ui.year === today.getFullYear() && ui.month === today.getMonth();
  const daysInMonth = new Date(ui.year, ui.month + 1, 0).getDate();

  // Barra: gasto frente a presupuesto, o frente a ingresos si no hay presupuesto.
  const ref = budget || inc;
  const pct = ref ? Math.min(100, (exp / ref) * 100) : (exp ? 100 : 0);
  let meterCls = '', note = '';
  if (budget) {
    const left = budget - exp;
    meterCls = left < 0 ? 'over' : pct > 85 ? 'warn' : '';
    note = left >= 0
      ? `Te quedan <b class="num">${money(left)}</b> de tu presupuesto de ${moneyShort(budget)}`
      : `Te has pasado <b class="num">${money(-left)}</b> del presupuesto`;
    if (isCurrent && left > 0) {
      const daysLeft = daysInMonth - today.getDate() + 1;
      note += ` · <span class="num">${money(Math.floor(left / daysLeft))}</span>/día`;
    }
  } else if (inc) {
    meterCls = exp > inc ? 'over' : pct > 85 ? 'warn' : '';
    note = exp <= inc ? `Has gastado el ${Math.round(pct)}% de lo que has ingresado` : 'Este mes gastas más de lo que ingresas';
  } else if (exp) {
    note = 'Apunta tus ingresos para ver cuánto ahorras';
  }

  // Pequeños datos útiles.
  const insights = [];
  if (exp) {
    const days = isCurrent ? today.getDate() : daysInMonth;
    insights.push(`Media ${money(Math.round(exp / days))}/día`);
    const prev = sums(store.movsOfMonth(ui.month === 0 ? ui.year - 1 : ui.year, (ui.month + 11) % 12));
    if (prev.exp) {
      // Comparar con el mismo punto del mes anterior si es el mes en curso.
      let prevExp = prev.exp;
      if (isCurrent) {
        const py = ui.month === 0 ? ui.year - 1 : ui.year, pm = (ui.month + 11) % 12;
        const cutoff = `${py}-${String(pm + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        prevExp = store.movsOfMonth(py, pm).filter((m) => m.type === 'expense' && m.date <= cutoff).reduce((a, m) => a + m.amount, 0);
      }
      if (prevExp) {
        const diff = Math.round(((exp - prevExp) / prevExp) * 100);
        if (Math.abs(diff) >= 3) insights.push(diff < 0 ? `▼ ${-diff}% menos que el mes pasado` : `▲ ${diff}% más que el mes pasado`);
      }
    }
  }
  if (inc && bal > 0) insights.push(`Ahorras el ${Math.round((bal / inc) * 100)}%`);

  $('#hero').innerHTML = `
    <div class="label">Saldo del mes</div>
    <div class="balance num ${bal < 0 ? 'neg' : ''}">${bal > 0 ? '+' : ''}${money(bal)}</div>
    <div class="split">
      <div class="pill"><span class="muted small">Ingresos</span><b class="in num">${money(inc)}</b></div>
      <div class="pill"><span class="muted small">Gastos</span><b class="out num">${money(exp)}</b></div>
    </div>
    ${ref || exp ? `<div class="meter ${meterCls}"><span style="width:${pct}%"></span></div>` : ''}
    ${note ? `<div class="note">${note}</div>` : ''}
    ${insights.length ? `<div class="insights">${insights.map((t) => `<span class="insight">${esc(t)}</span>`).join('')}</div>` : ''}
  `;
}

function renderDaily(movs) {
  const days = new Date(ui.year, ui.month + 1, 0).getDate();
  const per = new Array(days).fill(0);
  for (const m of movs) if (m.type === 'expense') per[+m.date.slice(8) - 1] += m.amount;
  const max = Math.max(...per, 1);
  const todayIso = isoDate(new Date());
  const html = per.map((v, i) => {
    const iso = `${ui.year}-${String(ui.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const h = v ? Math.max(6, (v / max) * 76) : 2;
    const cls = [iso === todayIso && 'today', ui.filterDay === iso && 'sel', iso > todayIso && 'future'].filter(Boolean).join(' ');
    const showNum = i === 0 || (i + 1) % 5 === 0 || iso === todayIso;
    return `<button class="${cls}" data-day="${iso}" aria-label="${dayFmt.format(fromIso(iso))}: ${money(v)}">
      <span class="bar ${v ? '' : 'zero'}" style="height:${h}px"></span><span class="d">${showNum ? i + 1 : ''}</span></button>`;
  }).join('');
  $('#daily').innerHTML = html;
  $('#daily-hint').textContent = ui.filterDay ? `${dayLabel(ui.filterDay)}: ${money(per[+ui.filterDay.slice(8) - 1])}` : 'Toca un día para verlo';
}

function renderCats(movs) {
  const type = ui.catsType;
  const totals = new Map();
  for (const m of movs) if (m.type === type) totals.set(m.category, (totals.get(m.category) || 0) + m.amount);
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, v]) => a + v, 0);
  document.querySelectorAll('#cats-type button').forEach((b) => b.classList.toggle('on', b.dataset.type === type));
  $('#cats-title').textContent = type === 'expense' ? 'En qué se va' : 'De dónde viene';
  if (!rows.length) {
    $('#cats').innerHTML = `<div class="empty-mini">${type === 'expense' ? 'Aún no hay gastos este mes.' : 'Aún no hay ingresos este mes.'}</div>`;
    return;
  }
  $('#cats').innerHTML = rows.map(([id, v]) => {
    const c = categoryById(id);
    const pct = Math.round((v / total) * 100);
    return `<button class="cat-row ${ui.filterCat === id ? 'sel' : ''}" data-cat="${id}">
      <span class="cat-emoji" style="background:${c.color}22">${c.emoji}</span>
      <span><span class="cat-name"><span>${esc(c.name)}</span><span class="muted small">${pct}%</span></span>
        <span class="cat-track"><span style="width:${(v / rows[0][1]) * 100}%;background:${c.color}"></span></span></span>
      <span class="cat-amt num">${moneyShort(v)}</span></button>`;
  }).join('');
}

function renderList(movs) {
  let list = movs;
  if (ui.filterDay) list = list.filter((m) => m.date === ui.filterDay);
  if (ui.filterCat) list = list.filter((m) => m.category === ui.filterCat);

  const chip = $('#clear-filter');
  if (ui.filterDay || ui.filterCat) {
    chip.hidden = false;
    chip.textContent = `${ui.filterCat ? categoryById(ui.filterCat).name : dayLabel(ui.filterDay)} ✕`;
  } else chip.hidden = true;

  if (!list.length) {
    const isEmptyMonth = !movs.length;
    $('#list').innerHTML = isEmptyMonth
      ? `<div class="empty"><div class="big">🎙️</div><b>Toca el micro y dilo como te salga</b>
          <q>«Doce euros de cena hoy a las nueve»</q><q>«Me han pagado la nómina, mil doscientos euros»</q></div>`
      : `<div class="empty">No hay movimientos con este filtro.</div>`;
    return;
  }

  const groups = new Map();
  for (const m of list) { if (!groups.has(m.date)) groups.set(m.date, []); groups.get(m.date).push(m); }
  let html = '';
  for (const [date, items] of groups) {
    const net = items.reduce((a, m) => a + (m.type === 'income' ? m.amount : -m.amount), 0);
    html += `<div class="day-head"><span>${esc(dayLabel(date))}</span><span class="num">${net > 0 ? '+' : ''}${money(net)}</span></div><div class="day-group">`;
    for (const m of items) {
      const c = categoryById(m.category);
      html += `<div class="item-wrap"><div class="item-del">Borrar</div>
        <button class="item ${ui.highlight === m.id ? 'flash' : ''}" data-id="${m.id}">
          <span class="cat-emoji" style="background:${c.color}22">${c.emoji}</span>
          <span style="min-width:0"><div class="t1">${esc(m.concept || c.name)}</div><div class="t2">${esc(c.name)}${m.time ? ' · ' + m.time : ''}${m.recId ? ' · 🔁 fijo' : ''}</div></span>
          <span class="amt num ${m.type === 'income' ? 'in' : ''}">${m.type === 'income' ? '+' : '−'}${money(m.amount)}</span>
        </button></div>`;
    }
    html += '</div>';
  }
  $('#list').innerHTML = html;
  ui.highlight = null;
}

/* ---------- Hoja inferior ---------- */
let sheetCleanup = null;
function openSheet(html, onMount) {
  closeSheet(true);
  $('#toast').hidden = true;
  $('#sheet-body').innerHTML = html;
  $('#sheet').hidden = false;
  $('#scrim').hidden = false;
  document.body.style.overflow = 'hidden';
  sheetCleanup = onMount ? onMount($('#sheet-body')) : null;
}
function closeSheet(silent) {
  if (sheetCleanup) { try { sheetCleanup(); } catch {} sheetCleanup = null; }
  $('#sheet').hidden = true;
  $('#scrim').hidden = true;
  document.body.style.overflow = '';
}

/* ---------- Voz ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const EXAMPLES = ['12 € de cena hoy', 'Gasolina 40 euros', 'Nómina 1.200 €', 'Café 1,50 ayer a las 9'];

function openVoice({ autoStart = true } = {}) {
  openSheet(`
    <div class="listen">
      <h3 id="sheet-title">Dime el movimiento</h3>
      <button class="orb ${SR ? '' : 'idle'}" id="orb" aria-label="Escuchar">
        <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>
      </button>
      <div class="transcript placeholder" id="transcript">${SR ? 'Te escucho…' : 'Escríbelo abajo o usa el micro del teclado'}</div>
      <div class="examples">${EXAMPLES.map((e) => `<button class="chip" data-ex="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <form class="type-row" id="type-form">
        <input id="type-input" placeholder="Ej: 12 euros de cena hoy" autocomplete="off" enterkeyhint="done">
        <button class="btn primary" type="submit">Listo</button>
      </form>
    </div>`, (root) => {
    const orb = $('#orb', root), tr = $('#transcript', root), input = $('#type-input', root);
    let rec = null, finalText = '', lastInterim = '', done = false, silence = null;

    const finish = (text) => {
      if (done) return; done = true;
      if (rec) try { rec.abort(); } catch {}
      text = (text || '').trim();
      if (!text) { done = false; return; }
      openForm(draftFromText(text), { heard: text });
    };

    const start = () => {
      if (!SR) { input.focus(); return; }
      finalText = ''; lastInterim = '';
      rec = new SR();
      rec.lang = 'es-ES';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      orb.classList.remove('idle');
      tr.classList.add('placeholder'); tr.textContent = 'Te escucho…';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
        }
        lastInterim = interim;
        tr.classList.remove('placeholder');
        tr.textContent = (finalText + ' ' + interim).trim();
        // Safari en iPhone a veces no cierra solo: paramos tras 1,6 s de silencio.
        clearTimeout(silence);
        silence = setTimeout(() => { try { rec.stop(); } catch {} }, 1600);
      };
      rec.onerror = (e) => {
        orb.classList.add('idle');
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          tr.textContent = 'No tengo permiso para el micro. Escríbelo abajo o actívalo en Ajustes › Safari › Micrófono.';
        } else if (e.error === 'no-speech') {
          tr.textContent = 'No te he oído. Toca el círculo para repetir.';
        } else if (e.error !== 'aborted') {
          tr.textContent = 'El dictado ha fallado. Toca el círculo o escríbelo abajo.';
        }
      };
      rec.onend = () => {
        clearTimeout(silence);
        orb.classList.add('idle');
        const text = (finalText.trim() ? finalText : finalText + ' ' + lastInterim).trim();
        if (text) setTimeout(() => finish(text), 300);
      };
      try { rec.start(); } catch { orb.classList.add('idle'); }
    };

    orb.addEventListener('click', () => {
      if (rec && !orb.classList.contains('idle')) { try { rec.stop(); } catch {} } else start();
    });
    root.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.ex)));
    $('#type-form', root).addEventListener('submit', (e) => { e.preventDefault(); finish(input.value); });
    if (autoStart && SR) start(); else if (!SR) setTimeout(() => input.focus(), 300);
    return () => { done = true; clearTimeout(silence); if (rec) try { rec.abort(); } catch {} };
  });
}

function draftFromText(text) {
  const p = parse(text);
  const learned = store.getState().learned;
  const cat = guessCategory(norm(p.concept || text), p.type, learned);
  return {
    type: p.type,
    amount: p.amount,
    concept: p.concept,
    category: cat,
    date: p.date,
    time: p.time || (p.date === isoDate(new Date()) ? nowTime() : ''),
    repeat: p.repeat,
    raw: text,
  };
}

/* ---------- Formulario (nuevo / editar) ---------- */
function openForm(draft, { editId = null, heard = null } = {}) {
  const d = { type: 'expense', amount: null, concept: '', category: null, date: isoDate(new Date()), time: nowTime(), ...draft };
  if (!d.category) d.category = categoriesFor(d.type)[categoriesFor(d.type).length - 1].id;
  const rec = d.recId ? store.recurringById(d.recId) : null;
  const repeatOn = !!rec || (!editId && !!d.repeat);
  const amountStr = d.amount != null ? (d.amount / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') : '';

  openSheet(`
    <h3 id="sheet-title">${editId ? 'Editar movimiento' : 'Revisa y guarda'}</h3>
    ${heard ? `<div class="heard">He entendido: <i>«${esc(heard)}»</i></div>` : ''}
    <div class="seg big" id="f-type" style="margin-top:12px">
      <button type="button" data-type="expense" class="${d.type === 'expense' ? 'on' : ''}">Gasto</button>
      <button type="button" data-type="income" class="${d.type === 'income' ? 'on' : ''}">Ingreso</button>
    </div>
    <div class="amount-input"><input id="f-amount" class="${d.type} num" inputmode="decimal" placeholder="0" value="${amountStr}" aria-label="Importe"><span>€</span></div>
    <label class="field"><span>Concepto</span><input id="f-concept" value="${esc(d.concept)}" placeholder="¿En qué?" autocomplete="off"></label>
    <div class="field"><span>Categoría</span><div class="cat-chips" id="f-cats"></div></div>
    <div class="row2">
      <label class="field"><span>Día</span><input id="f-date" type="date" value="${d.date}"></label>
      <label class="field"><span>Hora</span><input id="f-time" type="time" value="${d.time || ''}"></label>
    </div>
    <label class="repeat-row"><span>🔁</span><span class="grow">Se repite cada mes<span class="sub">Alquiler, nómina, suscripciones…</span></span>
      <input id="f-repeat" type="checkbox" ${repeatOn ? 'checked' : ''}></label>
    <div class="sheet-actions">
      ${editId ? '<button class="btn danger" id="f-del" type="button">Borrar</button>' : '<button class="btn" id="f-cancel" type="button">Cancelar</button>'}
      <button class="btn primary" id="f-save" type="button">Guardar</button>
    </div>`, (root) => {
    const amountEl = $('#f-amount', root), conceptEl = $('#f-concept', root);
    let catTouched = !!editId;

    const drawCats = () => {
      const cats = categoriesFor(d.type);
      $('#f-cats', root).innerHTML = cats.map((c) => `<button type="button" class="cat-chip ${c.id === d.category ? 'on' : ''}" data-cat="${c.id}">
        <span class="cat-emoji" style="background:${c.color}22">${c.emoji}</span>${esc(c.name)}</button>`).join('');
      const on = $('.cat-chip.on', root);
      if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
    };
    const validate = () => { $('#f-save', root).disabled = !(parseAmount(amountEl.value) > 0); };

    root.querySelectorAll('#f-type button').forEach((b) => b.addEventListener('click', () => {
      if (d.type === b.dataset.type) return;
      d.type = b.dataset.type;
      root.querySelectorAll('#f-type button').forEach((x) => x.classList.toggle('on', x === b));
      amountEl.className = `${d.type} num`;
      d.category = guessCategory(norm(conceptEl.value), d.type, store.getState().learned);
      drawCats();
    }));
    $('#f-cats', root).addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      d.category = b.dataset.cat; catTouched = true; drawCats();
    });
    conceptEl.addEventListener('input', () => {
      if (catTouched) return;
      d.category = guessCategory(norm(conceptEl.value), d.type, store.getState().learned);
      drawCats();
    });
    const fit = () => { amountEl.style.width = `${Math.max(1.6, amountEl.value.length * 0.62 + 0.4)}em`; };
    amountEl.addEventListener('input', () => { validate(); fit(); });
    fit();
    $('#f-save', root).addEventListener('click', () => {
      const amount = parseAmount(amountEl.value);
      if (!(amount > 0)) { amountEl.focus(); return; }
      const concept = conceptEl.value.trim();
      const mov = { type: d.type, amount, concept, category: d.category, date: $('#f-date', root).value || isoDate(new Date()), time: $('#f-time', root).value || '' };
      if (d.raw) mov.raw = d.raw;
      // Si el usuario cambió la categoría propuesta, la app lo recuerda para la próxima vez.
      const guessed = guessCategory(norm(concept), d.type, store.getState().learned);
      if (concept && guessed !== d.category) store.learn([norm(concept).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim()], d.category);
      const repeat = $('#f-repeat', root).checked;
      if (rec && repeat) store.updateRecurring(rec.id, mov);
      else if (rec && !repeat) { store.removeRecurring(rec.id); mov.recId = null; }
      else if (!rec && repeat) mov.recId = store.addRecurring(mov).id;
      let id = editId;
      if (editId) store.updateMov(editId, mov); else id = store.addMov(mov).id;
      if (repeat && !rec) toast('Se apuntará solo cada mes');
      closeSheet();
      jumpTo(mov.date, id);
      if (!(repeat && !rec)) toast(editId ? 'Cambios guardados' : `${mov.type === 'income' ? 'Ingreso' : 'Gasto'} de ${money(amount)} guardado`);
    });
    const cancel = $('#f-cancel', root);
    if (cancel) cancel.addEventListener('click', () => closeSheet());
    const del = $('#f-del', root);
    if (del) del.addEventListener('click', () => { closeSheet(); deleteWithUndo(editId); });
    drawCats();
    validate();
    if (d.amount == null) setTimeout(() => amountEl.focus(), 350);
  });
}

function parseAmount(s) {
  s = String(s || '').trim().replace(/\s|€/g, '');
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const v = parseFloat(s);
  return isNaN(v) ? null : Math.round(v * 100);
}

function jumpTo(date, id) {
  const d = fromIso(date);
  ui.year = d.getFullYear(); ui.month = d.getMonth();
  ui.highlight = id;
  if (ui.filterDay && ui.filterDay !== date) ui.filterDay = null;
  const m = store.getState().movs.find((x) => x.id === id);
  if (ui.filterCat && m && m.category !== ui.filterCat) ui.filterCat = null;
  render();
}

function deleteWithUndo(id) {
  const m = store.removeMov(id);
  if (!m) return;
  render();
  toast(`Borrado «${m.concept || categoryById(m.category).name}»`, 'Deshacer', () => { store.restoreMov(m); render(); });
}

/* ---------- Aviso ---------- */
let toastTimer;
function toast(text, actionLabel, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(text)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
  el.hidden = false;
  if (actionLabel) $('button', el).onclick = () => { el.hidden = true; action(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 6000 : 2800);
}

/* ---------- Ajustes ---------- */
// Se conserva index.html si viene en la ruta: algunos servidores no sirven la carpeta sola.
function appUrl() { return location.origin + location.pathname; }

function openSettings() {
  const s = store.getState();
  const count = s.movs.length;
  const last = s.settings.lastBackup ? new Date(s.settings.lastBackup).toLocaleDateString('es-ES') : 'nunca';
  openSheet(`
    <h3 id="sheet-title">Ajustes</h3>
    <div class="menu">
      <button id="s-siri"><span class="ico">🗣️</span><span class="grow">Apuntar con Siri<span class="sub">Configura «Oye Siri, mis gastos»</span></span>›</button>
      <button id="s-install"><span class="ico">📲</span><span class="grow">Añadir a la pantalla de inicio<span class="sub">Para abrirla como una app</span></span>›</button>
    </div>
    <div class="menu">
      <label class="menu-item"><span class="ico">🎯</span><span class="grow">Presupuesto<span class="sub">Máximo a gastar al mes</span></span>
        <input id="s-budget" inputmode="decimal" placeholder="Sin límite" value="${s.settings.budget ? (s.settings.budget / 100).toString().replace('.', ',') : ''}" style="width:110px;text-align:right;border:0;background:transparent;outline:none;font-weight:600"></label>
      <label class="menu-item"><span class="ico">⚡</span><span class="grow">Guardar directo desde Siri<span class="sub">Si lo apagas, te pedirá confirmar</span></span>
        <input id="s-auto" type="checkbox" ${s.settings.siriAuto !== false ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--brand)"></label>
    </div>
    <div class="menu">
      <button id="s-csv"><span class="ico">📊</span><span class="grow">Exportar a Excel (CSV)<span class="sub">${count} movimientos</span></span>›</button>
      <button id="s-backup"><span class="ico">💾</span><span class="grow">Hacer copia de seguridad<span class="sub">Última: ${last}</span></span>›</button>
      <label class="menu-item" style="cursor:pointer"><span class="ico">♻️</span><span class="grow">Restaurar copia<span class="sub">Desde un archivo .json</span></span>›
        <input id="s-restore" type="file" accept="application/json,.json" hidden></label>
    </div>
    <div class="menu">
      <button id="s-wipe"><span class="ico">🗑️</span><span class="grow" style="color:var(--expense)">Borrar todos los datos</span></button>
    </div>
    <p class="muted small" style="text-align:center">Tus datos se guardan solo en este móvil.</p>
  `, (root) => {
    $('#s-siri', root).onclick = openSiriGuide;
    $('#s-install', root).onclick = openInstallGuide;
    $('#s-budget', root).addEventListener('change', (e) => { store.setSetting('budget', parseAmount(e.target.value)); render(); });
    $('#s-auto', root).addEventListener('change', (e) => store.setSetting('siriAuto', e.target.checked));
    $('#s-csv', root).onclick = () => download(`ahorro-${isoDate(new Date())}.csv`, store.exportCSV((id) => categoryById(id).name), 'text/csv;charset=utf-8');
    $('#s-backup', root).onclick = () => {
      download(`ahorro-copia-${isoDate(new Date())}.json`, store.exportJSON(), 'application/json');
      store.setSetting('lastBackup', new Date().toISOString());
    };
    $('#s-restore', root).addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const n = store.importJSON(await f.text()); closeSheet(); render(); toast(`Copia restaurada (${n} movimientos)`); }
      catch (err) { toast('Ese archivo no es una copia válida'); }
    });
    $('#s-wipe', root).onclick = () => {
      if (confirm('¿Seguro que quieres borrar todos tus movimientos? Haz antes una copia si los quieres conservar.')) {
        store.importJSON(JSON.stringify({ movs: [], recurring: [] }), { merge: false }); closeSheet(); render(); toast('Datos borrados');
      }
    };
  });
}

async function download(name, content, type) {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  // En iPhone, compartir permite guardarlo en Archivos, mandarlo por WhatsApp, etc.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function openSiriGuide() {
  const url = `${appUrl()}?t=`;
  openSheet(`
    <h3 id="sheet-title">Apuntar con Siri</h3>
    <div class="tip">Cuando esté listo, solo tendrás que decir <b>«Oye Siri, mis gastos»</b>, contarle el gasto y la app lo guarda sola.</div>
    <ol class="steps">
      <li>Abre la app <b>Atajos</b> y toca <b>+</b> arriba a la derecha.</li>
      <li>Busca la acción <b>Dictar texto</b> y añádela. Toca «Idioma» y elige <b>Español (España)</b>. En «Dejar de escuchar» elige <b>Tras una pausa</b>.</li>
      <li>Añade la acción <b>Codificar URL</b>. Debe usar el «Texto dictado».</li>
      <li>Busca la acción que se llama solo <b>URL</b> (icono azul) y añádela. Pega este enlace y, justo detrás (sin espacio), toca encima del teclado la variable <b>Texto codificado en URL</b>:
        <code class="code" id="siri-url">${esc(url)}</code>
        <button class="chip" id="copy-url" style="margin-top:8px">Copiar enlace</button></li>
      <li>Añade la acción <b>Abrir URL</b> (usa la «URL» anterior).</li>
      <li>Arriba, cambia el nombre del atajo a <b>Mis gastos</b> (evita «apunta» o «ahorro»: Siri los confunde con Notas o Wikipedia). </li>
      <li>Para ingresos: duplica el atajo, llámalo <b>Mis ingresos</b> y añade <b>&amp;tipo=ingreso</b> al final de la URL del paso 4.</li>
      <li>Pruébalo: «Oye Siri, mis gastos» → «doce euros de cena».</li>
    </ol>
    <div class="tip">Truco: en Ajustes › Accesibilidad › Tocar › <b>Tocar atrás</b> puedes asignar el atajo a dos toques en la parte trasera del iPhone.</div>
    <div class="sheet-actions"><button class="btn" id="test-siri">Probar con un ejemplo</button><button class="btn primary" id="close-siri">Hecho</button></div>
  `, (root) => {
    $('#copy-url', root).onclick = async () => {
      try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { toast('Mantén pulsado el enlace para copiarlo'); }
    };
    $('#close-siri', root).onclick = () => closeSheet();
    $('#test-siri', root).onclick = () => { closeSheet(); handleIncomingText('un café de 1,80 hoy'); };
  });
}

function openInstallGuide() {
  openSheet(`
    <h3 id="sheet-title">Añadir a la pantalla de inicio</h3>
    <ol class="steps">
      <li>Abre esta página en <b>Safari</b>.</li>
      <li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>
      <li>Elige <b>Añadir a pantalla de inicio</b> y luego <b>Añadir</b>.</li>
    </ol>
    <div class="tip">Se abrirá en Safari a propósito: así Siri y la app comparten los mismos datos.</div>
    <div class="sheet-actions"><button class="btn primary" id="close-inst">Entendido</button></div>
  `, (root) => { $('#close-inst', root).onclick = () => closeSheet(); });
}

/* ---------- Texto que llega desde Siri / Atajos (?t=...) ---------- */
function handleIncomingText(text, forcedType = null) {
  const recentKey = 'ahorro.lastIncoming';
  let recent = null;
  try { recent = JSON.parse(sessionStorage.getItem(recentKey) || localStorage.getItem(recentKey) || 'null'); } catch {}
  // Evita duplicados si Safari recarga la misma URL.
  if (recent && recent.text === text && Date.now() - recent.at < 3 * 60 * 1000) return;
  try { localStorage.setItem(recentKey, JSON.stringify({ text, at: Date.now() })); } catch {}

  const draft = draftFromText(text);
  if (forcedType && forcedType !== draft.type) {
    draft.type = forcedType;
    draft.category = guessCategory(norm(draft.concept || text), forcedType, store.getState().learned);
  }
  const auto = store.getState().settings.siriAuto !== false;
  if (auto && draft.amount > 0) {
    const base = { type: draft.type, amount: draft.amount, concept: draft.concept, category: draft.category, date: draft.date, time: draft.time, raw: text };
    if (draft.repeat) base.recId = store.addRecurring(base).id;
    const mov = store.addMov(base);
    jumpTo(mov.date, mov.id);
    toast(`${mov.type === 'income' ? 'Ingreso' : 'Gasto'} de ${money(mov.amount)} · ${mov.concept || categoryById(mov.category).name}`, 'Editar', () => openForm(mov, { editId: mov.id }));
  } else {
    openForm(draft, { heard: text });
  }
}

function readIncoming() {
  const params = new URLSearchParams(location.search);
  const text = params.get('t') || params.get('texto') || params.get('q');
  if (params.has('t') || params.has('texto') || params.has('q') || params.has('voz') || params.has('tipo')) {
    history.replaceState(null, '', location.pathname + location.hash);
  }
  const tipo = norm(params.get('tipo') || '');
  const forced = /^ingreso/.test(tipo) ? 'income' : /^gasto/.test(tipo) ? 'expense' : null;
  if (text && text.trim()) handleIncomingText(text.trim(), forced);
  else if (params.has('voz')) openVoice();
}

/* ---------- Deslizar para borrar ---------- */
function setupSwipe() {
  const list = $('#list');
  let start = null, item = null, dx = 0, moved = false;
  list.addEventListener('touchstart', (e) => {
    item = e.target.closest('.item'); if (!item) return;
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY }; dx = 0; moved = false;
  }, { passive: true });
  list.addEventListener('touchmove', (e) => {
    if (!item || !start) return;
    const x = e.touches[0].clientX - start.x, y = e.touches[0].clientY - start.y;
    if (!moved && Math.abs(y) > Math.abs(x)) { start = null; return; }
    if (Math.abs(x) > 8) moved = true;
    dx = Math.min(0, x);
    item.classList.add('dragging');
    item.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  list.addEventListener('touchend', () => {
    if (!item) return;
    item.classList.remove('dragging');
    if (dx < -110) {
      item.style.transform = 'translateX(-100%)';
      const id = item.dataset.id;
      setTimeout(() => deleteWithUndo(id), 180);
    } else item.style.transform = '';
    if (moved) { item.dataset.swiped = '1'; setTimeout(() => item && delete item.dataset.swiped, 50); }
    start = null;
  });
}

/* ---------- Eventos ---------- */
function bind() {
  $('#btn-mic').addEventListener('click', () => openVoice());
  $('#btn-type').addEventListener('click', () => openForm({}));
  $('#btn-siri').addEventListener('click', openSiriGuide);
  $('#btn-settings').addEventListener('click', openSettings);
  $('#scrim').addEventListener('click', () => closeSheet());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  $('#prev-month').addEventListener('click', () => { shiftMonth(-1); });
  $('#next-month').addEventListener('click', () => { shiftMonth(1); });
  $('#month-label').addEventListener('click', () => {
    const n = new Date(); ui.year = n.getFullYear(); ui.month = n.getMonth(); ui.filterDay = ui.filterCat = null; render();
  });

  $('#daily').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]'); if (!b) return;
    ui.filterDay = ui.filterDay === b.dataset.day ? null : b.dataset.day;
    ui.filterCat = null;
    render();
    if (ui.filterDay) $('.list-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#cats-type').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    ui.catsType = b.dataset.type; ui.filterCat = null; render();
  });
  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    ui.filterCat = ui.filterCat === b.dataset.cat ? null : b.dataset.cat;
    ui.filterDay = null;
    render();
    if (ui.filterCat) $('.list-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#clear-filter').addEventListener('click', () => { ui.filterDay = ui.filterCat = null; render(); });
  $('#list').addEventListener('click', (e) => {
    const b = e.target.closest('.item'); if (!b || b.dataset.swiped) return;
    const m = store.getState().movs.find((x) => x.id === b.dataset.id);
    if (m) openForm(m, { editId: m.id });
  });
  setupSwipe();

  // Deslizar horizontalmente sobre el resumen cambia de mes.
  let sx = null;
  $('#hero').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  $('#hero').addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 60) shiftMonth(dx < 0 ? 1 : -1);
  });

  // Al volver a la app desde Siri (misma pestaña), Safari puede no recargar: revisamos la URL.
  window.addEventListener('pageshow', () => { store.materializeRecurring(); readIncoming(); render(); });
}

function shiftMonth(delta) {
  const d = new Date(ui.year, ui.month + delta, 1);
  const n = new Date();
  if (d > new Date(n.getFullYear(), n.getMonth(), 1)) return;
  ui.year = d.getFullYear(); ui.month = d.getMonth();
  ui.filterDay = ui.filterCat = null;
  render();
}

/* ---------- Arranque ---------- */
bind();
store.materializeRecurring();
render();
store.askPersist();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Exponer para pruebas automáticas
window.__ahorro = { store, parse, render, handleIncomingText };
