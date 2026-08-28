import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * El comprobante está maquetado dos veces: en JSX para la pantalla y el papel, y
 * a mano en un canvas para la foto que se manda por WhatsApp. No es un descuido
 * —`html2canvas` no soporta el `clip-path` del escudo y `foreignObject` devuelve
 * imágenes en blanco en Safari— pero el costo es que si se toca una hay que
 * tocar la otra, y nada avisa cuando no pasa.
 *
 * Lo que se puede comparar sin renderizar es **qué dicen**: qué datos consumen y
 * qué textos fijos imprimen. Eso alcanza para el error que de verdad ocurre —
 * agregar un dato al ticket de la pantalla y olvidarlo en la foto, o cambiar un
 * rótulo en un lado solo.
 *
 * Lo que NO cubre: cómo se ven. Posiciones, tamaños y espaciados siguen sin red,
 * y eso necesitaría render y comparación visual.
 */

const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8');

const CANVAS = leer('../src/comprobanteImagen.js');
const JSX = leer('../src/componentes/Comprobante.jsx');

/** Los campos que cada uno saca del comprobante al desarmarlo. */
function camposDesestructurados(fuente) {
  const bloque = fuente.match(/\{\s*codigo,[^}]*\}/);
  assert.ok(bloque, 'no se encontró el destructuring del comprobante');
  return new Set(
    bloque[0]
      .replace(/[{}]/g, '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
  );
}

/** Los accesos tipo `sorteo.pozo` o `comprador.nombre`. */
function subcampos(fuente, objeto) {
  return new Set([...fuente.matchAll(new RegExp(`${objeto}\\.([a-z_]+)`, 'g'))].map((m) => m[1]));
}

describe('el comprobante consume los mismos datos en las dos versiones', () => {
  it('desarma el comprobante en los mismos campos', () => {
    assert.deepEqual(camposDesestructurados(CANVAS), camposDesestructurados(JSX));
  });

  it('usa los mismos datos del sorteo', () => {
    // Si el JSX empieza a mostrar el período y el canvas no, la foto sale sin él.
    assert.deepEqual(subcampos(CANVAS, 'sorteo'), subcampos(JSX, 'sorteo'));
  });

  it('usa los mismos datos del comprador', () => {
    assert.deepEqual(subcampos(CANVAS, 'comprador'), subcampos(JSX, 'comprador'));
  });
});

describe('el comprobante dice lo mismo en las dos versiones', () => {
  // Lo que va impreso en el ticket y no depende de la jugada. Si se cambia un
  // rótulo, hay que cambiarlo en los dos lados: esta lista es el recordatorio.
  const TEXTOS_DEL_TICKET = [
    'al Rojo Vivo!!!',
    'CLUB DEPORTIVO SARMIENTO',
    'Nombre:',
    'Teléfono:',
    'Pozo',
    'Sortea el',
    'ANULADA',
    'EN CASO DE HABER',
    'GANADOR EL POZO',
  ];

  for (const texto of TEXTOS_DEL_TICKET) {
    it(`"${texto}" está en las dos`, () => {
      assert.ok(CANVAS.includes(texto), `falta en comprobanteImagen.js`);
      assert.ok(JSX.includes(texto), `falta en Comprobante.jsx`);
    });
  }
});

describe('las dos versiones formatean igual', () => {
  it('comparten las utilidades de formato', () => {
    // Si una formatea el pozo a mano, la foto y el papel muestran números
    // distintos para la misma jugada.
    for (const util of ['fechaDia', 'formatearNumero', 'pesos']) {
      assert.ok(CANVAS.includes(util), `${util} no se usa en comprobanteImagen.js`);
      assert.ok(JSX.includes(util), `${util} no se usa en Comprobante.jsx`);
    }
  });

  it('el pozo se formatea con el mismo Intl en las dos', () => {
    const patron = /new Intl\.NumberFormat\('es-AR'\)\.format\(sorteo\.pozo\)/;
    assert.match(CANVAS, patron);
    assert.match(JSX, patron);
  });
});
