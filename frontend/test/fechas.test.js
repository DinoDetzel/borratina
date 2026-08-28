import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fechaCorta, fechaDia, fechaHora, fijarZonaClub } from '../src/utilidades.js';

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

describe('un timestamp completo sí se lee como instante', () => {
  // Lo de arriba no puede lograrse ignorando la hora: algo con `Z` adentro es un
  // instante, y a las 21:30 UTC en el club son las 18:30 del mismo día. Si esto
  // se rompe, el arreglo se pasó de rosca.
  it('convierte el instante a la hora del club', () => {
    assert.match(fechaHora('2026-08-15T21:30:00.000Z'), /^15\/08\/2026, 06:30/);
  });
});

describe('las fechas se muestran en la zona del club, no en la del dispositivo', () => {
  /**
   * Un vendedor de viaje, o con el teléfono mal configurado, tiene que seguir
   * viendo el día que lleva impreso el comprobante. Por eso la zona la manda el
   * backend (`TZ_CLUB`) y no se toma del navegador.
   */
  it('un instante se lee igual desde cualquier dispositivo', () => {
    const nocheDelDomingo = '2026-08-16T01:55:00.000Z'; // 22:55 del sábado en el club
    const esperado = /^15\/08\/2026, 10:55 p/;

    for (const zonaDelTelefono of ZONAS) {
      enZona(zonaDelTelefono, () => {
        assert.match(
          fechaHora(nocheDelDomingo),
          esperado,
          `se corrió con el teléfono en ${zonaDelTelefono}`,
        );
      });
    }
  });

  it('cambiar TZ_CLUB cambia de verdad lo que se muestra', () => {
    // Si esto no cambiara, la variable sería decorativa: es lo que pasaba antes,
    // cuando solo la respetaba el pool de Postgres.
    const instante = '2026-08-16T01:55:00.000Z';
    try {
      fijarZonaClub('UTC');
      assert.match(fechaHora(instante), /^16\/08\/2026, 01:55/);
    } finally {
      fijarZonaClub('America/Argentina/Buenos_Aires');
    }
    assert.match(fechaHora(instante), /^15\/08\/2026, 10:55 p/);
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
