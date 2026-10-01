import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../js/parser.js';

const NOW = new Date(2026, 9, 1, 15, 0); // jueves 1 oct 2026, 15:00
const p = (s) => parse(s, NOW);

const cases = [
  ['Añádeme un gasto de 12 euros en cena hoy a las nueve de la noche', { type: 'expense', amount: 1200, concept: 'Cena', category: 'comer', date: '2026-10-01', time: '21:00' }],
  ['añade gasto 12,50 € gasolina', { amount: 1250, concept: 'Gasolina', category: 'transporte' }],
  ['Apunta 3,20€ de café', { amount: 320, concept: 'Café', category: 'comer' }],
  ['gasto de 45 euros en el Mercadona ayer', { amount: 4500, date: '2026-09-30', category: 'super' }],
  ['ingreso de 1.200 euros de la nómina', { type: 'income', amount: 120000, category: 'nomina' }],
  ['me han pagado 20 euros por un bizum de Pablo', { type: 'income', amount: 2000, category: 'bizum' }],
  ['doce con cincuenta en el cine', { amount: 1250, concept: 'Cine', category: 'ocio' }],
  ['veinticinco euros de gimnasio el lunes', { amount: 2500, date: '2026-09-28', category: 'deporte' }],
  ['gasto de 8 euros taxi a las 23:15', { amount: 800, time: '23:15', concept: 'Taxi' }],
  ['15 euros de farmacia el 5 de septiembre', { amount: 1500, date: '2026-09-05', category: 'salud' }],
  ['60 euros de luz el día 3', { amount: 6000, date: '2026-09-03', category: 'facturas' }],
  ['cien euros zapatillas', { amount: 10000, category: 'compras' }],
  ['ciento veinte euros de alquiler de trastero', { amount: 12000, category: 'casa' }],
  ['un euro de pan', { amount: 100, concept: 'Pan' }],
  ['apúntame 9,99 de Netflix', { amount: 999, category: 'suscripciones' }],
  ['he gastado 30 euros en una cena con amigos a las diez y media de la noche', { amount: 3000, time: '22:30', category: 'comer' }],
  ['anteayer 4 euros de metro', { amount: 400, date: '2026-09-29', category: 'transporte' }],
  ['he vendido una chaqueta en Wallapop por 35 euros', { type: 'income', amount: 3500, category: 'ventas' }],
  ['gasto de 10 euros cerveza a las 8 menos cuarto de la tarde', { amount: 1000, time: '19:45' }],
  ['comida 14,5 euros esta mañana', { amount: 1450, date: '2026-10-01' }],
  ['2 cafés 3 euros', { amount: 300 }],
  ['dos mil euros de sueldo', { type: 'income', amount: 200000 }],
  ['50 céntimos chicle', { amount: 50 }],
  ['Pádel 6 euros 30/09', { amount: 600, date: '2026-09-30', category: 'deporte' }],
  ['gasto de 5 euros mañana', { date: '2026-10-02' }],
  ['me han pagado 20 euros por un bizum de Pablo', { concept: 'Bizum de Pablo' }],
  ['he vendido una chaqueta en Wallapop por 35 euros', { concept: 'Chaqueta en Wallapop' }],
  ['Oye Siri añade un gasto de 23,40 en la compra del Lidl', { amount: 2340, concept: 'Compra del Lidl', category: 'super' }],
  ['alquiler 450 euros cada mes', { amount: 45000, repeat: true, concept: 'Alquiler', category: 'casa' }],
  ['Spotify 10,99 al mes', { amount: 1099, repeat: true, category: 'suscripciones' }],
  ['teléfono fijo 20 euros', { repeat: false, category: 'facturas' }],
  ['gasto de 12 euros por el motivo regalo de cumpleaños de mi madre hoy a las 5 de la tarde', { concept: 'Regalo de cumpleaños de mi madre', time: '17:00' }],
  ['pagué la cuota del gimnasio 39,90', { amount: 3990, concept: 'Cuota del gimnasio', category: 'deporte' }],
  ['', { amount: null }],
  ['cena', { amount: null, concept: 'Cena' }],
];

for (const [input, expected] of cases) {
  test(input, () => {
    const r = p(input);
    for (const [k, v] of Object.entries(expected)) assert.equal(r[k], v, `${k} en "${input}" -> ${JSON.stringify(r)}`);
  });
}
