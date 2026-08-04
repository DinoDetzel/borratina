/**
 * La condición SQL que define una jugada ganadora.
 *
 * Gana la jugada cuyos 4 números están **contenidos en el extracto de 20**. La
 * contención es de multiconjunto y no de conjunto: si la jugada repite un número,
 * el extracto tiene que traerlo esa misma cantidad de veces.
 *
 *   extracto 07 14 23 45 …   jugada 07 07 23 45  → NO gana (un solo 07)
 *   extracto 07 07 23 45 …   jugada 07 07 23 45  → gana
 *
 * Se expresa por la negativa —"no hay ningún número que la jugada repita más
 * veces de las que salió"— porque es la forma directa de comparar las
 * multiplicidades sin tener que desarmar y rearmar los dos conjuntos.
 *
 * Adelante va un `<@`, que pregunta lo mismo pero sin mirar repeticiones. Es una
 * condición necesaria —si un número no está, tampoco va a estar la cantidad de
 * veces que haga falta— y descarta de un saque casi todas las jugadas, que es lo
 * que son: perdedoras. Solo las poquísimas que la pasan pagan la cuenta de
 * arriba, que es cara porque corre una vez por jugada. La respuesta no cambia:
 * lo que el `<@` deja pasar de más lo rechaza igual la condición exacta.
 *
 * Sin esto, el historial del panel —el único lugar que la evalúa sobre todos los
 * sorteos juntos— tardaba 750ms con seis años de jugadas cargadas.
 *
 * `aliasJugada` y `aliasSorteo` son los alias de las tablas en la query que la use.
 */
export const condicionGanadora = (aliasJugada = 'j', aliasSorteo = 's') => `(
  ARRAY[
    ${aliasJugada}.numero_1, ${aliasJugada}.numero_2,
    ${aliasJugada}.numero_3, ${aliasJugada}.numero_4
  ] <@ ${aliasSorteo}.numeros
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      ${aliasJugada}.numero_1, ${aliasJugada}.numero_2,
      ${aliasJugada}.numero_3, ${aliasJugada}.numero_4
    ]) AS jugado
    GROUP BY jugado
    HAVING COUNT(*) > (
      SELECT COUNT(*)
      FROM unnest(${aliasSorteo}.numeros) AS salido
      WHERE salido = jugado
    )
  )
)`;

/**
 * Misma regla en JavaScript, para cuando ya se tienen los datos en memoria y no
 * vale la pena volver a la base (el comprobante, por ejemplo).
 */
export function esGanadora(numerosJugada, extracto) {
  if (!extracto) return false;

  return numerosJugada.every((n) => {
    const vecesJugado = numerosJugada.filter((x) => x === n).length;
    const vecesSalido = extracto.filter((x) => x === n).length;
    return vecesJugado <= vecesSalido;
  });
}
