import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { armarComprobante, normalizarCodigo } from '../src/utils/comprobante.js';

describe('normalizarCodigo', () => {
  it('deja pasar el código bien escrito', () => {
    assert.equal(normalizarCodigo('260815-K7M3XQ'), '260815-K7M3XQ');
  });

  it('acepta minúsculas, sin guion y con espacios de más', () => {
    // Se dicta por teléfono y se copia de un papel: llega de cualquier forma.
    assert.equal(normalizarCodigo('260815k7m3xq'), '260815-K7M3XQ');
    assert.equal(normalizarCodigo('  260815 - k7m3xq  '), '260815-K7M3XQ');
    assert.equal(normalizarCodigo('260815 K7M3XQ'), '260815-K7M3XQ');
  });

  it('acepta un cero en la fecha', () => {
    // La trampa del formato: el 0 no está en el alfabeto de la parte aleatoria,
    // así que validar el código entero contra él rechazaría enero, y los días
    // del 1 al 9. Cada mitad se valida por separado justamente por esto.
    assert.equal(normalizarCodigo('260105-K7M3XQ'), '260105-K7M3XQ');
    assert.equal(normalizarCodigo('261001-K7M3XQ'), '261001-K7M3XQ');
  });

  it('rechaza un largo que no sea 12', () => {
    assert.throws(() => normalizarCodigo('260815-K7M3X'), { status: 400 });
    assert.throws(() => normalizarCodigo('260815-K7M3XQZ'), { status: 400 });
    assert.throws(() => normalizarCodigo(''), { status: 400 });
  });

  it('rechaza una fecha que no sean 6 dígitos', () => {
    assert.throws(() => normalizarCodigo('26O815-K7M3XQ'), { status: 400 });
  });

  it('rechaza los caracteres ambiguos en la parte aleatoria', () => {
    // 0, 1, I, L, O y U quedaron afuera porque se confunden al leerlos.
    for (const feo of ['0', '1', 'I', 'L', 'O', 'U']) {
      assert.throws(() => normalizarCodigo(`260815-K7M3X${feo}`), { status: 400 });
    }
  });

  it('dice cuál es el carácter que molesta', () => {
    // "No encontrado" a secas deja al vendedor tipeando de nuevo a ciegas.
    assert.throws(() => normalizarCodigo('260815-K7M3XO'), /O/);
  });

  it('no explota con null ni con un número', () => {
    assert.throws(() => normalizarCodigo(null), { status: 400 });
    assert.throws(() => normalizarCodigo(undefined), { status: 400 });
    assert.throws(() => normalizarCodigo(260815), { status: 400 });
  });
});

describe('armarComprobante', () => {
  const jugada = {
    codigo: '260815-K7M3XQ',
    numero_1: 7,
    numero_2: 23,
    numero_3: 45,
    numero_4: 88,
    comprador_nombre: 'Dora Silva',
    comprador_telefono: '351-9876',
    vendedor: 'Vendedor Uno',
    created_at: '2026-08-15T22:02:14.006Z',
    anulada: false,
  };

  const sorteo = {
    periodo: '2026-08',
    estado: 'abierto',
    pozo: 1500000,
    precio_jugada: 2000,
    finaliza_at: '2026-08-31T23:59:00.000Z',
  };

  it('formatea los números a dos dígitos, como van en el papel', () => {
    assert.deepEqual(armarComprobante(jugada, sorteo).numeros, ['07', '23', '45', '88']);
  });

  it('lleva el pozo: es el premio que el comprador está comprando', () => {
    assert.equal(armarComprobante(jugada, sorteo).sorteo.pozo, 1500000);
  });

  it('lleva el día del sorteo, que es el cierre de la ventana de carga', () => {
    assert.equal(armarComprobante(jugada, sorteo).sorteo.sortea_el, sorteo.finaliza_at);
  });

  it('el importe es el precio de la jugada, no el pozo', () => {
    // Son dos números distintos y confundirlos imprime el monto equivocado.
    assert.equal(armarComprobante(jugada, sorteo).importe, 2000);
  });

  it('conserva la fecha de carga y no la de hoy', () => {
    assert.equal(armarComprobante(jugada, sorteo).fecha, jugada.created_at);
  });

  it('aguanta una jugada sin teléfono, que es opcional', () => {
    const sinTelefono = { ...jugada, comprador_telefono: null };
    assert.equal(armarComprobante(sinTelefono, sorteo).comprador.telefono, null);
  });

  it('aguanta que no venga el vendedor', () => {
    const { vendedor: _v, ...sinVendedor } = jugada;
    assert.equal(armarComprobante(sinVendedor, sorteo).vendedor, null);
  });

  it('no devuelve HTML: el maquetado es del frontend', () => {
    const comprobante = armarComprobante(jugada, sorteo);
    assert.equal(typeof comprobante, 'object');
    assert.equal(JSON.stringify(comprobante).includes('<'), false);
  });
});
