# Ahorro · gastos con la voz

App web para llevar los gastos e ingresos del mes desde el iPhone, apuntándolos con la voz o con Siri.

- **Micrófono**: dices «doce euros de cena hoy a las nueve» y la app saca importe, concepto, categoría, día y hora.
- **Siri**: con un atajo de la app Atajos («Oye Siri, apunta gasto»). La guía paso a paso está dentro de la app (botón *Siri*).
- **Fijos**: marca «se repite cada mes» (o di «cada mes») y la app lo apunta sola cada mes.
- **Aprende**: si corriges la categoría de un concepto, la próxima vez la acierta.
- **Resumen del mes**: saldo, ingresos, gastos, gasto por día, por categoría, presupuesto y comparación con el mes anterior.
- **Tus datos se quedan en tu móvil** (almacenamiento del navegador). Exportación a CSV y copias de seguridad en JSON.

## Cómo funciona Siri

El atajo dicta el texto y abre `https://<usuario>.github.io/app-ahorro/?t=<texto>`. La app interpreta la frase y guarda el movimiento (o pide confirmación si así se configura).

La app se abre en Safari a propósito (`"display": "browser"` en el manifiesto): en iPhone, las webs instaladas como app independiente tienen un almacenamiento separado de Safari, y los atajos siempre abren Safari. Así Siri y la app ven los mismos datos.

## Desarrollo

Sin dependencias ni compilación: HTML, CSS y JavaScript (módulos ES).

```sh
python3 -m http.server 8000   # abrir http://localhost:8000
npm test                      # pruebas del intérprete y del guardado
node tests/e2e.cjs            # prueba completa en un iPhone simulado (necesita Playwright y el servidor en el puerto 8765)
```

- `js/parser.js`: convierte frases en español en movimientos.
- `js/categories.js`: categorías y palabras clave.
- `js/store.js`: guardado local, exportar e importar.
- `js/app.js`: interfaz.
- `sw.js`: funciona sin conexión.
