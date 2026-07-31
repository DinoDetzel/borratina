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
 * `aliasJugada` y `aliasSorteo` son los alias de las tablas en la query que la use.
 */
export const condicionGanadora = (aliasJugada = 'j', aliasSorteo = 's') => `
  NOT EXISTS (
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
