// Intérprete de frases en español: "añádeme un gasto de 12,50 en cena hoy a las nueve"
// -> { type, amount (céntimos), concept, category, date 'YYYY-MM-DD', time 'HH:MM' }

import { guessCategory } from './categories.js';

const UNITS = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

const MONTHS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

const INCOME_WORDS = [
  'ingreso', 'ingresos', 'ingresame', 'ingresa', 'ingresado', 'ingresaron', 'cobro', 'cobre', 'cobrado',
  'he cobrado', 'me han pagado', 'me pagaron', 'me ha pagado', 'me pago', 'nomina', 'sueldo', 'salario',
  'me devolvieron', 'me han devuelto', 'devolucion', 'reembolso', 'me ha llegado', 'me han hecho un bizum',
  'me hicieron un bizum', 'recibido', 'recibi', 'he recibido', 'vendi', 'he vendido', 'venta', 'paga extra',
  'beneficio', 'ganado', 'gane', 'he ganado', 'premio', 'me regalaron', 'me han regalado',
];
const EXPENSE_WORDS = ['gasto', 'gastos', 'gastado', 'gaste', 'he gastado', 'pague', 'he pagado', 'compre', 'he comprado'];

// Quita tildes y pasa a minúsculas, manteniendo la longitud para poder recortar el texto original.
export function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function pad(n) { return String(n).padStart(2, '0'); }
export function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Convierte una secuencia de palabras numéricas ("ciento veinte y cinco") en número.
function wordsToNumber(words) {
  let total = 0, current = 0, used = 0;
  for (const w of words) {
    if (w === 'y' && used > 0) { used++; continue; }
    if (w === 'mil') { current = (current || 1) * 1000; total += current; current = 0; used++; continue; }
    if (w in UNITS) { current += UNITS[w]; used++; continue; }
    break;
  }
  if (words[used - 1] === 'y') used--; // "doce y" sin nada detrás
  return used ? { value: total + current, used } : null;
}

// Pasa números escritos con letras a cifras ("doce con cincuenta" -> "12 con 50").
function digitize(text) {
  const tokens = text.split(/(\s+)/);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\s+$/.test(t) || !(t in UNITS) || t === 'un' || t === 'una' || t === 'uno') {
      // "un"/"una" solo cuentan como número si van seguidos de "euro(s)" o "mil"
      if ((t === 'un' || t === 'una' || t === 'uno') && /^(euros?|€|mil)$/.test(tokens[i + 2] || '')) {
        // sigue al caso numérico
      } else { out.push(t); continue; }
    }
    const words = [];
    const idx = [];
    for (let j = i; j < tokens.length; j += 2) {
      if (j > i && !/^\s+$/.test(tokens[j - 1])) break;
      words.push(tokens[j]); idx.push(j);
    }
    const r = wordsToNumber(words);
    if (!r) { out.push(t); continue; }
    out.push(String(r.value));
    i = idx[r.used - 1];
  }
  return out.join('');
}

function parseAmountStr(s) {
  s = s.replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const v = parseFloat(s);
  return isNaN(v) ? null : Math.round(v * 100);
}

// Busca la hora. Devuelve {time, start, end} sobre el texto normalizado.
function findTime(t) {
  const re = /\b(?:a\s+las?|sobre\s+las?|hacia\s+las?|las)\s+(\d{1,2})(?:[:.h](\d{2}))?(?:\s*h(?:oras?)?)?(?:\s+y\s+(media|cuarto|\d{1,2}))?(?:\s+menos\s+(cuarto|\d{1,2}))?(?:\s+(?:de\s+la\s+|por\s+la\s+)?(manana|tarde|noche|madrugada|mediodia))?(?:\s*(am|pm|a\.\s?m\.|p\.\s?m\.))?/;
  let m = t.match(re);
  if (!m) {
    const m2 = t.match(/\b(\d{1,2}):(\d{2})\b/);
    if (m2) return { time: `${pad(+m2[1] % 24)}:${m2[2]}`, start: m2.index, end: m2.index + m2[0].length };
    const m3 = t.match(/\b(?:a\s+)?(?:al\s+)?mediodia\b/);
    if (m3) return { time: '14:00', start: m3.index, end: m3.index + m3[0].length };
    return null;
  }
  let h = +m[1], min = m[2] ? +m[2] : 0;
  if (h > 24 || min > 59) return null;
  if (m[3]) min = m[3] === 'media' ? 30 : m[3] === 'cuarto' ? 15 : +m[3];
  if (m[4]) { const sub = m[4] === 'cuarto' ? 15 : +m[4]; h = h - 1; min = 60 - sub; if (h < 0) h = 23; }
  const part = m[5], ampm = m[6];
  if ((part === 'tarde' || part === 'noche') && h < 12) h += 12;
  if (part === 'noche' && h === 24) h = 0;
  if (part === 'mediodia' && h < 5) h += 12;
  if (ampm && ampm.startsWith('p') && h < 12) h += 12;
  if (part === 'noche' && h === 24) h = 0;
  return { time: `${pad(h % 24)}:${pad(min)}`, start: m.index, end: m.index + m[0].length };
}

function findDate(t, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const add = (d) => { const x = new Date(today); x.setDate(x.getDate() + d); return x; };
  let m;
  if ((m = t.match(/\b(?:antes\s+de\s+ayer|anteayer|antier)\b/))) return { date: add(-2), m };
  if ((m = t.match(/\bayer\b/))) return { date: add(-1), m };
  if ((m = t.match(/\b(?:hoy|esta\s+(?:manana|tarde|noche))\b/))) return { date: today, m, partOfDay: m[0] };
  if ((m = t.match(/\b(?:pasado\s+manana)\b/))) return { date: add(2), m };
  // "mañana" como día solo si no va precedido de "la"/"de la"/"por la"
  if ((m = t.match(/(?<!\bla\s)\bmanana\b/))) return { date: add(1), m };
  if ((m = t.match(/\b(?:el\s+)?(?:pasado\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?:\s+pasado)?\b/))) {
    const target = WEEKDAYS[m[1]];
    let diff = today.getDay() - target;
    if (diff < 0) diff += 7;
    return { date: add(-diff), m };
  }
  if ((m = t.match(/\b(?:el\s+)?(?:dia\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?\b/))) {
    const mon = MONTHS[m[2]] - 1;
    let year = m[3] ? +m[3] : today.getFullYear();
    let d = new Date(year, mon, +m[1]);
    if (!m[3] && d > today) d = new Date(year - 1, mon, +m[1]);
    return { date: d, m };
  }
  if ((m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
    let year = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : today.getFullYear();
    let d = new Date(year, +m[2] - 1, +m[1]);
    if (!m[3] && d > today) d = new Date(year - 1, +m[2] - 1, +m[1]);
    return { date: d, m };
  }
  if ((m = t.match(/\b(?:el\s+dia|el|dia)\s+(\d{1,2})\b(?!\s*(?:euros?|€|eur|pavos|con|[.,]\d))/))) {
    const day = +m[1];
    if (day >= 1 && day <= 31) {
      let d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d > today) d = new Date(today.getFullYear(), today.getMonth() - 1, day);
      return { date: d, m };
    }
  }
  return null;
}

function findAmount(t) {
  const num = '(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
  const cur = '(?:euros?|€|eur\\b|pavos)';
  const patterns = [
    // 12 euros con 50 (céntimos)
    new RegExp(`${num}\\s*${cur}\\s*(?:con|y)\\s*(\\d{1,2})(?:\\s*(?:centimos?|cts?|cent))?`),
    // 12 con 50 euros
    new RegExp(`${num}\\s*con\\s*(\\d{1,2})\\s*${cur}?`),
    new RegExp(`${num}\\s*${cur}`),
    new RegExp(`${cur}\\s*${num}`),
    new RegExp(`(\\d+)\\s*(?:centimos?|cts?)`),
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = t.match(patterns[i]);
    if (!m) continue;
    let cents;
    if (i <= 1) cents = parseAmountStr(m[1]) + (m[2].length === 1 ? +m[2] * 10 : +m[2]);
    else if (i === 4) cents = +m[1];
    else cents = parseAmountStr(m[1]);
    if (cents != null) return { amount: cents, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

// Un número suelto como importe, si no hay moneda (el primero que no sea hora ni fecha).
function findBareNumber(t, taken) {
  const re = /\d+(?:[.,]\d{1,2})?/g;
  let m;
  while ((m = re.exec(t))) {
    const s = m.index, e = s + m[0].length;
    if (taken.some(([a, b]) => s < b && e > a)) continue;
    const cents = parseAmountStr(m[0]);
    if (cents != null) return { amount: cents, start: s, end: e };
  }
  return null;
}

function hasWord(t, w) {
  return new RegExp(`(^|[^a-z])${w.replace(/ /g, '\\s+')}([^a-z]|$)`).test(t);
}

const LEADING = /^(?:(?:oye\s+)?siri\s*,?\s*)?(?:(?:por\s+favor\s*,?\s*)?(?:anademe|anade|anademe|anadir|apuntame|apunta|apuntar|anota|anotame|pon|ponme|mete|meteme|registra|registrame|guarda|guardame|agrega|agregame|nuevo|nueva|crea|creame)\b\s*)?(?:(?:un|una|el|la)\s+)?(?:(?:nuevo|nueva)\s+)?(?:gasto|ingreso|movimiento|pago|cobro)?\s*/;

const STOP_START = /^(?:de|del|en|por|para|con|el|la|los|las|un|una|al|a|y|que|motivo|concepto|como|es|son|ha\s+sido|he\s+gastado|me\s+he\s+gastado|gastado|pagado|he\s+pagado|me\s+han\s+pagado|me\s+pagaron|cobrado|he\s+cobrado|por\s+el\s+motivo|con\s+el\s+motivo|de\s+motivo|euros?)\b\s*/;
const STOP_END = /\s*\b(?:de|del|en|por|para|con|el|la|los|las|un|una|al|a|y|hoy|que|euros?)$/;

function cleanConcept(s) {
  s = s.replace(/[,.;:!?¿¡]+/g, ' ').replace(/\s+/g, ' ').trim();
  let prev;
  do {
    prev = s;
    s = s.replace(STOP_START, '').replace(STOP_END, '').trim();
  } while (s !== prev);
  return s;
}

export function parse(input, now = new Date()) {
  const raw = (input || '').trim();
  const result = { raw, type: 'expense', amount: null, concept: '', category: null, date: isoDate(now), time: null };
  if (!raw) return result;

  // Trabajamos sobre texto normalizado (sin tildes, minúsculas); conservamos el original para el concepto.
  let t = digitize(norm(raw)).replace(/\s+/g, ' ').trim();

  // Tipo
  const incomeHit = INCOME_WORDS.some((w) => hasWord(t, w));
  const expenseHit = EXPENSE_WORDS.some((w) => hasWord(t, w));
  if (incomeHit && !(expenseHit && /^\W*(?:\w+\s+){0,3}(?:un|el)?\s*gasto/.test(t))) result.type = 'income';
  if (/^\W*(?:\w+\s+){0,3}(?:un|el)?\s*ingreso/.test(t)) result.type = 'income';

  const taken = [];
  const cut = (s, e) => { taken.push([s, e]); };

  const tm = findTime(t);
  if (tm) { result.time = tm.time; cut(tm.start, tm.end); }

  const dt = findDate(t, now);
  if (dt) {
    result.date = isoDate(dt.date);
    cut(dt.m.index, dt.m.index + dt.m[0].length);
    if (!result.time && dt.partOfDay) {
      if (/manana/.test(dt.partOfDay)) result.time = '10:00';
      else if (/tarde/.test(dt.partOfDay)) result.time = '17:00';
      else if (/noche/.test(dt.partOfDay)) result.time = '21:00';
    }
  }

  // Blanquea lo usado antes de buscar el importe para no confundir horas/fechas con dinero.
  const blank = (str) => {
    let s = str;
    for (const [a, b] of taken) s = s.slice(0, a) + ' '.repeat(b - a) + s.slice(b);
    return s;
  };
  let am = findAmount(blank(t));
  if (!am) am = findBareNumber(blank(t), []);
  if (am) { result.amount = am.amount; cut(am.start, am.end); }

  // Concepto: lo que queda, quitando órdenes y conectores.
  let rest = blank(t);
  // Quitar palabras de tipo/acción sueltas
  rest = rest.replace(/\b(?:me\s+he\s+gastado|he\s+gastado|me\s+gaste|gaste|he\s+pagado|pague|me\s+han\s+pagado|me\s+pagaron|me\s+ha\s+pagado|he\s+cobrado|cobre|he\s+recibido|recibi|me\s+ha\s+llegado|me\s+han\s+devuelto|me\s+devolvieron|he\s+vendido|vendi|me\s+he\s+comprado|he\s+comprado|compre)\b/g, ' ');
  rest = rest.replace(/\s+/g, ' ').trim();
  rest = rest.replace(LEADING, '');
  // Si sigue una palabra de tipo tras un conector ("de gasto")
  rest = rest.replace(/\b(?:un|una)\s+(?:gasto|ingreso)\b/, ' ');
  let concept = cleanConcept(rest);
  // Si el concepto es solo una palabra de tipo, lo dejamos vacío
  if (/^(?:gasto|ingreso|pago|cobro|movimiento)$/.test(concept)) concept = '';
  result.concept = recoverAccents(concept, raw);
  if (result.concept) result.concept = result.concept[0].toUpperCase() + result.concept.slice(1);

  result.category = guessCategory(norm(result.concept || t), result.type);
  if (!result.concept && result.type === 'income' && /nomina|sueldo|salario/.test(t)) result.concept = 'Nómina';
  return result;
}

// Intenta devolver el concepto con las tildes originales del texto dicho.
function recoverAccents(concept, raw) {
  if (!concept) return '';
  const words = raw.split(/\s+/);
  return concept.split(' ').map((w) => {
    const orig = words.find((o) => norm(o).replace(/[^a-z0-9ñ]/g, '') === w);
    if (!orig) return w;
    const clean = orig.replace(/[,.;:!?¿¡]+$/g, '').replace(/^[¿¡]+/, '');
    // Mantiene mayúsculas de nombres propios (Lidl, Pablo) pero no de palabras en mayúscula por inicio de frase
    return clean === raw.split(/\s+/)[0].replace(/^[¿¡]+/, '') ? clean.toLowerCase() : clean;
  }).join(' ');
}
