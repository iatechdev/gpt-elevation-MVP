// ES-214 (E208-1): el detector de teléfonos del servidor atrapa las escrituras que QA reportó como falsos negativos y sigue sin tocar años, precios, fechas, «3 meses» ni cantidades.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { containsPhoneNumber } = require('../utils/promptSafety');

// Casos del informe de QA de ES-208 (E208-1) y variantes de la misma familia.
const PHONES = [
  // 3 dígitos sin «línea»/«call» (lugar + número que cierra la frase, o contexto de emergencia)
  'En Estados Unidos, 988', 'En Estados Unidos, 988.', 'In the US, 988', 'En México, 911.', 'In the United Kingdom, 999.',
  'Si estás en crisis, en España puedes marcar el 024 las 24 horas.', 'In an emergency in the US call or text 988.', 'En una emergencia, 911 o 112.',
  // dígitos que no son ASCII: ancho completo, árabe-índico, devanagari
  '３００１２３４５６７', 'Su celular es ٣٠٠١٢٣٤٥٦٧', 'Llama al ३००१२३४५६७', 'Línea １０６',
  // dígitos separados y caracteres invisibles
  'línea 1 0 6', 'línea 1-0-6', 'Línea 1.0.6', 'Llama al 3_0_0_1_2_3_4_5_6_7', 'Marca 3 0 0 1 2 3 4 5 6 7', 'Línea 1​0​6', 'Call 9-8-8',
  // un teléfono seguido de moneda ya no se confunde con dinero
  'Escríbeles al 300.123.4567 pesos', '300.123.4567 COP', 'Llama al 3001234567 pesos',
  // los que ya se detectaban (sin regresión)
  'Llama a la línea 106 o al 024 ahora.', 'Call 988 if you are in danger.', 'Marca 123 si es urgente.', 'Escríbeles al +57 300 123 4567.',
  'Call (601) 555-1234.', 'Line: 1-800-273-8255.', 'Helpline 141.', 'Número 192.', 'Su celular es 300.123.4567.',
];
const CLEAN = [
  'Esto lo hice en 2021 durante 3 meses.', 'Subí las ventas un 15 % en 40 días.', 'Mi reunión es el 2026-11-08 a las 10.', 'La fecha límite es 08/11/2026.',
  'El sueldo era de $1.500.000 al mes.', 'Cobraba 1.500.000 pesos mensuales y 2.000 dólares extra.', 'I worked there from 2019 to 2023, about 4 years.',
  'Contacta a los servicios de emergencia o de salud de tu país y a alguien de confianza.',
  // números cortos y listas sin forma de teléfono, también cerca de palabras de emergencia
  'En una crisis de 300 clientes resolví el 100% de los casos en 3 pasos.', 'Paso 1 2 3 del plan.', 'Tienes 3 opciones: 1, 2 y 3.',
  'En emergencias, contacta a alguien de confianza. Llevas 120 días avanzando.', 'Subió 4.5 puntos y luego 3,5.', 'Mi código postal es 110111.',
  'En Colombia, 120 empresas contratan perfiles como el tuyo.', 'En Bogotá, 300 clientes la conocen.', 'Trabajé en Medellín, 2021.', 'En 2021, 300.',
  'Pasaste de 300 a 450 horas de práctica.', 'Hubo 200 postulaciones y 15 entrevistas.', 'Versión 1.0.6 del currículo.', 'Total: 1.500.000 pesos.',
  'Reservé el 10-11-2026 y el 2026/11/10.', 'El 12 de octubre fueron 7 horas de estudio.',
];

test('ES-214: los falsos negativos de QA (E208-1) y sus variantes se detectan en ES y EN', () => {
  for (const text of PHONES) assert.equal(containsPhoneNumber(text), true, text);
});

test('ES-214: los textos legítimos (años, precios, fechas, cantidades, «3 meses», listas) no se sustituyen', () => {
  for (const text of CLEAN) assert.equal(containsPhoneNumber(text), false, text);
});

test('ES-214: la normalización no rompe con entradas raras y no cuelga con texto largo', () => {
  for (const value of ['', null, undefined, 0, 'a'.repeat(100000), '1 '.repeat(5000), '\u0000\ud800', '٠١٢٣٤٥٦٧٨٩'.repeat(50)]) assert.equal(typeof containsPhoneNumber(value), 'boolean');
  const started = Date.now();
  containsPhoneNumber('1 2 3 4 5 6 7 8 9 '.repeat(5000) + 'En Estados Unidos, ' + '9'.repeat(5000));
  assert.ok(Date.now() - started < 1500, 'tiempo de detección acotado');
  assert.equal(containsPhoneNumber('٠١٢٣٤٥٦٧٨٩'), true); // 10 dígitos árabe-índicos = teléfono
});

test('ES-214: límite declarado — los números escritos con palabras no se detectan (no se promete lo contrario)', () => {
  assert.equal(containsPhoneNumber('Llama al uno cero seis'), false);
});
