import { CANTIDAD_EXTRACTO } from '../utilidades.js';

/**
 * Los 20 campos del extracto de la quiniela.
 *
 * Se usa para cargarlo por primera vez y para corregirlo, así que el `prefijo`
 * separa los ids cuando llega a haber dos en la misma pantalla.
 *
 * El foco salta solo al completar cada número: son 20 casilleros y llegar al
 * siguiente con el mouse cada vez vuelve la carga insoportable.
 */
export default function CamposExtracto({ valores, onCambiar, prefijo = 'extracto' }) {
  return (
    <div className="extracto">
      {valores.map((valor, i) => (
        <input
          key={i}
          id={`${prefijo}-${i}`}
          inputMode="numeric"
          value={valor}
          placeholder={String(i + 1)}
          aria-label={`Número ${i + 1} del extracto`}
          onChange={(e) => {
            const limpio = e.target.value.replace(/\D/g, '').slice(0, 2);
            onCambiar(valores.map((n, j) => (j === i ? limpio : n)));

            if (limpio.length === 2 && i < CANTIDAD_EXTRACTO - 1) {
              document.getElementById(`${prefijo}-${i + 1}`)?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
