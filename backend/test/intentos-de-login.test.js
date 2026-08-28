import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESPERA_MS,
  MAX_FALLOS,
  limpiarIntentos,
  registrarFallo,
  verificarIntentos,
} from '../src/utils/intentos-de-login.js';

/**
 * El freno de fuerza bruta del login.
 *
 * El estado es un Map de módulo compartido entre tests, así que cada uno usa su
 * propio nombre de usuario: sin eso, el orden en que corren cambiaría el
 * resultado.
 *
 * El reloj entra por parámetro —así lo exponen las funciones— para poder probar
 * el vencimiento de la ventana sin esperar quince minutos.
 */

let n = 0;
const cuentaNueva = () => `cuenta-de-prueba-${(n += 1)}`;

/** Falla `veces` seguidas, todas en el mismo instante. */
const fallar = (usuario, veces, ahora) => {
  for (let i = 0; i < veces; i += 1) registrarFallo(usuario, ahora);
};

describe('freno de intentos de login', () => {
  it('deja pasar a una cuenta que nunca falló', () => {
    assert.doesNotThrow(() => verificarIntentos(cuentaNueva()));
  });

  it('aguanta hasta el último intento permitido', () => {
    const usuario = cuentaNueva();
    fallar(usuario, MAX_FALLOS - 1, 0);
    assert.doesNotThrow(() => verificarIntentos(usuario, 0));
  });

  it('frena al llegar al tope, con un 429', () => {
    const usuario = cuentaNueva();
    fallar(usuario, MAX_FALLOS, 0);

    assert.throws(() => verificarIntentos(usuario, 0), (err) => {
      assert.equal(err.status, 429);
      assert.match(err.message, /Demasiados intentos/);
      return true;
    });
  });

  it('vuelve a dejar entrar cuando vence la ventana', () => {
    const usuario = cuentaNueva();
    fallar(usuario, MAX_FALLOS, 0);

    assert.throws(() => verificarIntentos(usuario, ESPERA_MS));
    assert.doesNotThrow(() => verificarIntentos(usuario, ESPERA_MS + 1));
  });

  it('el reloj se cuenta desde el último fallo, no desde el primero', () => {
    const usuario = cuentaNueva();
    fallar(usuario, MAX_FALLOS - 1, 0);
    // Uno más, diez minutos después: la espera arranca de nuevo desde ahí.
    registrarFallo(usuario, 10 * 60_000);

    assert.throws(() => verificarIntentos(usuario, 10 * 60_000 + ESPERA_MS));
    assert.doesNotThrow(() => verificarIntentos(usuario, 10 * 60_000 + ESPERA_MS + 1));
  });

  it('fallos viejos y sueltos no se acumulan hasta frenar', () => {
    const usuario = cuentaNueva();
    // Uno por ventana, que es lo que le pasa a quien se equivoca de tecla cada
    // tanto. Nunca tendría que quedar frenado.
    for (let i = 0; i < MAX_FALLOS * 3; i += 1) {
      const ahora = i * (ESPERA_MS + 1);
      assert.doesNotThrow(() => verificarIntentos(usuario, ahora), `frenado en el intento ${i}`);
      registrarFallo(usuario, ahora);
    }
  });

  it('acertar la contraseña borra lo que se venía contando', () => {
    const usuario = cuentaNueva();
    fallar(usuario, MAX_FALLOS - 1, 0);
    limpiarIntentos(usuario);

    fallar(usuario, MAX_FALLOS - 1, 0);
    assert.doesNotThrow(() => verificarIntentos(usuario, 0));
  });

  it('frena una cuenta sin tocar a las demás', () => {
    const frenada = cuentaNueva();
    const tranquila = cuentaNueva();
    fallar(frenada, MAX_FALLOS, 0);

    assert.throws(() => verificarIntentos(frenada, 0));
    assert.doesNotThrow(() => verificarIntentos(tranquila, 0));
  });

  it('avisa cuántos minutos faltan', () => {
    const usuario = cuentaNueva();
    fallar(usuario, MAX_FALLOS, 0);

    assert.throws(
      () => verificarIntentos(usuario, ESPERA_MS - 60_000),
      /en 1 minuto\b/,
      'con un minuto restante tiene que ir en singular',
    );
    assert.throws(() => verificarIntentos(usuario, 0), /en 15 minutos/);
  });
});
