// Categorías con emoji, color y palabras clave (sin tildes) para adivinarlas desde el concepto.

export const EXPENSE_CATEGORIES = [
  { id: 'super', name: 'Supermercado', emoji: '🛒', color: '#22a06b',
    words: ['super', 'supermercado', 'mercadona', 'lidl', 'carrefour', 'aldi', 'eroski', 'alcampo', 'hipercor', 'consum', 'compra', 'fruta', 'frutas', 'verdura', 'pan', 'panaderia', 'carniceria', 'pescaderia', 'leche', 'huevos', 'alimentacion', 'comestibles'] },
  { id: 'comer', name: 'Comer fuera', emoji: '🍽️', color: '#e8833a',
    words: ['cena', 'cenar', 'comida', 'comer', 'almuerzo', 'desayuno', 'desayunar', 'restaurante', 'bar', 'cafe', 'cafes', 'cerveza', 'cervezas', 'cana', 'canas', 'copa', 'copas', 'tapas', 'menu', 'pizza', 'burger', 'hamburguesa', 'kebab', 'sushi', 'glovo', 'just eat', 'uber eats', 'mcdonalds', 'telepizza', 'bocadillo', 'helado', 'vermut', 'brunch', 'chino'] },
  { id: 'transporte', name: 'Transporte', emoji: '🚗', color: '#3b82f6',
    words: ['gasolina', 'gasoil', 'gasoleo', 'diesel', 'combustible', 'metro', 'bus', 'autobus', 'taxi', 'uber', 'cabify', 'bolt', 'tren', 'renfe', 'cercanias', 'parking', 'aparcamiento', 'peaje', 'abono', 'transporte', 'bici', 'patinete', 'itv', 'taller', 'coche', 'moto', 'blablacar'] },
  { id: 'casa', name: 'Casa', emoji: '🏠', color: '#8b5cf6',
    words: ['alquiler', 'hipoteca', 'comunidad', 'muebles', 'ikea', 'leroy', 'limpieza', 'detergente', 'casa', 'piso', 'reforma', 'fontanero', 'electricista', 'bricolaje'] },
  { id: 'facturas', name: 'Facturas', emoji: '🧾', color: '#64748b',
    words: ['luz', 'agua', 'gas', 'internet', 'wifi', 'fibra', 'movil', 'telefono', 'factura', 'seguro', 'impuesto', 'impuestos', 'ibi', 'hacienda', 'banco', 'comision', 'cuota'] },
  { id: 'ocio', name: 'Ocio', emoji: '🎉', color: '#ec4899',
    words: ['cine', 'concierto', 'entrada', 'entradas', 'teatro', 'museo', 'fiesta', 'discoteca', 'juego', 'videojuego', 'playstation', 'steam', 'xbox', 'nintendo', 'bolera', 'karaoke', 'festival', 'partido', 'apuestas', 'loteria'] },
  { id: 'suscripciones', name: 'Suscripciones', emoji: '📺', color: '#06b6d4',
    words: ['netflix', 'spotify', 'hbo', 'hbo max', 'disney', 'prime', 'youtube', 'icloud', 'suscripcion', 'apple music', 'dazn', 'chatgpt', 'claude', 'movistar'] },
  { id: 'compras', name: 'Compras', emoji: '🛍️', color: '#f59e0b',
    words: ['ropa', 'zapatillas', 'zapatos', 'camiseta', 'pantalon', 'chaqueta', 'amazon', 'zara', 'primark', 'shein', 'aliexpress', 'decathlon', 'regalo', 'regalos', 'tienda', 'compras', 'electronica', 'cascos', 'auriculares', 'cargador', 'funda', 'perfume', 'colonia'] },
  { id: 'salud', name: 'Salud', emoji: '💊', color: '#ef4444',
    words: ['farmacia', 'medico', 'medicina', 'medicamentos', 'dentista', 'fisio', 'fisioterapeuta', 'psicologo', 'optica', 'gafas', 'lentillas', 'hospital', 'analisis', 'peluqueria', 'barberia', 'corte de pelo'] },
  { id: 'deporte', name: 'Deporte', emoji: '🏐', color: '#10b981',
    words: ['gimnasio', 'gym', 'padel', 'futbol', 'balonmano', 'baloncesto', 'tenis', 'natacion', 'piscina', 'crossfit', 'yoga', 'deporte', 'equipacion', 'club', 'ficha', 'proteina'] },
  { id: 'educacion', name: 'Estudios', emoji: '📚', color: '#6366f1',
    words: ['libro', 'libros', 'curso', 'clase', 'clases', 'academia', 'universidad', 'matricula', 'material', 'apuntes', 'fotocopias', 'colegio', 'master', 'examen'] },
  { id: 'viajes', name: 'Viajes', emoji: '✈️', color: '#0ea5e9',
    words: ['viaje', 'vuelo', 'avion', 'hotel', 'airbnb', 'booking', 'hostal', 'ryanair', 'vueling', 'iberia', 'maleta', 'vacaciones', 'escapada'] },
  { id: 'otros', name: 'Otros', emoji: '📦', color: '#94a3b8', words: [] },
];

export const INCOME_CATEGORIES = [
  { id: 'nomina', name: 'Nómina', emoji: '💼', color: '#16a34a', words: ['nomina', 'sueldo', 'salario', 'paga', 'paga extra', 'trabajo', 'empresa'] },
  { id: 'bizum', name: 'Bizum / transferencia', emoji: '📲', color: '#0891b2', words: ['bizum', 'transferencia', 'me pago', 'me pagaron', 'me han pagado', 'me ha pagado', 'deuda', 'me devolvio'] },
  { id: 'ventas', name: 'Ventas', emoji: '🏷️', color: '#ca8a04', words: ['venta', 'vendi', 'vendido', 'wallapop', 'vinted', 'milanuncios'] },
  { id: 'extras', name: 'Extras', emoji: '🎁', color: '#db2777', words: ['regalo', 'regalaron', 'premio', 'loteria', 'beca', 'ayuda', 'devolucion', 'reembolso', 'hacienda', 'propina', 'propinas', 'clases'] },
  { id: 'otros_in', name: 'Otros ingresos', emoji: '💰', color: '#65a30d', words: [] },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function categoriesFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function categoryById(id) {
  return ALL_CATEGORIES.find((c) => c.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

// Devuelve el id de categoría más probable para un texto normalizado (minúsculas, sin tildes).
export function guessCategory(text, type = 'expense', learned = {}) {
  const list = categoriesFor(type);
  const t = ` ${text.replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ')} `;
  // Primero, lo que el usuario ya corrigió antes (aprendizaje simple por palabra).
  // (frases completas; gana la más larga)
  let learnedHit = null;
  for (const [phrase, catId] of Object.entries(learned)) {
    if (t.includes(` ${phrase} `) && list.some((c) => c.id === catId) && (!learnedHit || phrase.length > learnedHit[0].length)) learnedHit = [phrase, catId];
  }
  if (learnedHit) return learnedHit[1];
  let best = null, bestLen = 0;
  for (const c of list) {
    for (const w of c.words) {
      if (t.includes(` ${w} `) && w.length > bestLen) { best = c.id; bestLen = w.length; }
    }
  }
  return best || list[list.length - 1].id;
}
