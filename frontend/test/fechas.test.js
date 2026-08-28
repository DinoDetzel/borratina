import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fechaCorta, fechaDia, fechaHora } from '../src/utilidades.js';

/**
 * `/dashboard/ventas` manda el día como texto 'AAAA-MM-DD' y no como fecha,
 * justamente para que no se corra por zona horaria. Del lado de acá eso se
 * perdía: `new Date('2026-08-15')` es medianoche **UTC**, y formateada en la
 * zona local caía en el día anterior en cualquier lugar al oeste de Greenwich.
 * En Buenos Aires —donde corre el club— el gráfico mostraba 14/08.
 *
 * Se fija la zona a mano en vez de confiar en la de la máquina: en UTC el bug
 * no se ve, así que un test que dependiera del entorno pasaría en CI y dejaría
 * el error suelto justo donde importa.
 */
const enZona = (zona, fn) => {
  const previa = process.env.TZ;
  process.env.TZ = zona;
  try {
    return fn();
  } finally {
    process.env.TZ = previa;
  }
};

/** Al oeste, al este y en el meridiano: el día no se mueve en ninguna. */
const ZONAS = ['America/Argentina/Buenos_Aires', 'UTC', 'Pacific/Kiritimati'];

describe('un día sin hora se lee como el día que es', () => {
  for (const zona of ZONAS) {
    it(`no se corre en ${zona}`, () => {
      enZona(zona, () => {
        assert.equal(fechaDia('2026-08-15'), '15/08/2026');
        assert.match(fechaCorta('2026-08-15'), /^15\/0?8$/);
      });
    });
  }

  it('tampoco en el primero del mes, que es donde se iría al mes anterior', () => {
    enZona('America/Argentina/Buenos_Aires', () => {
      assert.equal(fechaDia('2026-08-01'), '01/08/2026');
      assert.equal(fechaDia('2026-01-01'), '01/01/2026');
    });
  });
});

describe('un timestamp completo sí se lee en la zona de quien mira', () => {
  // Lo de arriba no puede lograrse ignorando la zona: una hora con `Z` adentro
  // es un instante, y a las 21:30 UTC en Buenos Aires son las 18:30 del mismo
  // día. Si esto se rompe, el arreglo se pasó de rosca.
  it('convierte el instante a hora local', () => {
    enZona('America/Argentina/Buenos_Aires', () => {
      assert.match(fechaHora('2026-08-15T21:30:00.000Z'), /^15\/08\/2026, 06:30/);
    });
    enZona('UTC', () => {
      assert.match(fechaHora('2026-08-15T21:30:00.000Z'), /^15\/08\/2026, 09:30/);
    });
  });
});

describe('sin dato, un guion', () => {
  it('no inventa una fecha con null o vacío', () => {
    for (const vacio of [null, undefined, '']) {
      assert.equal(fechaDia(vacio), '—');
      assert.equal(fechaCorta(vacio), '—');
      assert.equal(fechaHora(vacio), '—');
    }
  });
});
