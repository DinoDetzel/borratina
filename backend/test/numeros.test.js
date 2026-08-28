import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANTIDAD_EXTRACTO,
  CANTIDAD_NUMEROS,
  formatear,
  normalizar,
  validarExtracto,
  validarNumeros,
} from '../src/utils/numeros.js';

describe('normalizar', () => {
  it('ordena ascendentemente', () => {
    assert.deepEqual(normalizar([45, 7, 88, 23]), [7, 23, 45, 88]);
  });

  it('deja igual lo que ya está ordenado', () => {
    assert.deepEqual(normalizar([7, 23, 45, 88]), [7, 23, 45, 88]);
  });

  it('ordena por valor y no como texto', () => {
    // El `.sort()` pelado compara strings y pondría el 10 antes que el 9.
    assert.deepEqual(normalizar([9, 10, 2, 1]), [1, 2, 9, 10]);
  });

  it('no toca el array que recibe', () => {
    const original = [45, 7, 88, 23];
    normalizar(original);
    assert.deepEqual(original, [45, 7, 88, 23]);
  });
});

describe('validarNumeros', () => {
  it('devuelve los 4 números normalizados', () => {
    assert.deepEqual(validarNumeros([45, 7, 88, 23]), [7, 23, 45, 88]);
  });

  it('acepta strings de dos dígitos, como los manda el formulario', () => {
    assert.deepEqual(validarNumeros(['07', '23', '45', '88']), [7, 23, 45, 88]);
  });

  it('acepta los repetidos, que son parte del juego', () => {
    assert.deepEqual(validarNumeros([7, 7, 23, 45]), [7, 7, 23, 45]);
    assert.deepEqual(validarNumeros([55, 55, 55, 55]), [55, 55, 55, 55]);
  });

  it('acepta los extremos del rango', () => {
    assert.deepEqual(validarNumeros([0, 0, 99, 99]), [0, 0, 99, 99]);
  });

  it('rechaza una cantidad distinta de 4', () => {
    assert.throws(() => validarNumeros([7, 23, 45]), { status: 400 });
    assert.throws(() => validarNumeros([7, 23, 45, 88, 91]), { status: 400 });
  });

  it('rechaza lo que no es un array', () => {
    assert.throws(() => validarNumeros('07,23,45,88'), { status: 400 });
    assert.throws(() => validarNumeros(null), { status: 400 });
  });

  it('rechaza números fuera de 00-99', () => {
    assert.throws(() => validarNumeros([-1, 23, 45, 88]), { status: 400 });
    assert.throws(() => validarNumeros([100, 23, 45, 88]), { status: 400 });
  });

  it('rechaza lo que no es un entero limpio', () => {
    // "07abc" no puede colarse como 7: se juega plata con esto.
    assert.throws(() => validarNumeros(['07abc', 23, 45, 88]), { status: 400 });
    assert.throws(() => validarNumeros([7.5, 23, 45, 88]), { status: 400 });
    assert.throws(() => validarNumeros([NaN, 23, 45, 88]), { status: 400 });
  });

  it('nombra el campo en el error, que es lo que ve quien llama a la API', () => {
    assert.throws(() => validarNumeros([1], 'numeros_nuevos'), /numeros_nuevos/);
  });
});

describe('validarExtracto', () => {
  const extracto = [7, 14, 23, 31, 45, 52, 60, 66, 71, 88, 2, 19, 27, 33, 40, 55, 63, 77, 84, 91];

  it('acepta los 20 números', () => {
    assert.equal(validarExtracto(extracto).length, CANTIDAD_EXTRACTO);
  });

  it('NO reordena: el extracto se guarda como se publicó', () => {
    assert.deepEqual(validarExtracto(extracto), extracto);
  });

  it('acepta repetidos, que en el extracto son legítimos', () => {
    const conRepetidos = [7, 7, ...extracto.slice(2)];
    assert.deepEqual(validarExtracto(conRepetidos), conRepetidos);
  });

  it('rechaza una cantidad distinta de 20', () => {
    assert.throws(() => validarExtracto(extracto.slice(0, 19)), { status: 400 });
    assert.throws(() => validarExtracto([...extracto, 5]), { status: 400 });
  });
});

describe('formatear', () => {
  it('lleva a dos dígitos, que es como se juega y como se imprime', () => {
    assert.equal(formatear(7), '07');
    assert.equal(formatear(0), '00');
    assert.equal(formatear(88), '88');
  });
});

describe('las constantes son las del juego', () => {
  it('4 números por jugada, 20 en el extracto', () => {
    assert.equal(CANTIDAD_NUMEROS, 4);
    assert.equal(CANTIDAD_EXTRACTO, 20);
  });
});
