/**
 * Fecha y hora, en dos controles en vez de uno.
 *
 * Antes esto era un `<input type="datetime-local">` y se manejaba mal: los
 * segmentos se recorren con las flechas sin saber en cuál estás, al año
 * directamente no se llega, y pasando la hora caés en el AM/PM, donde subir y
 * bajar solo alterna entre dos valores. De ahí la sensación de que "no deja
 * subir ni bajar".
 *
 * Un campo de fecha (que abre calendario) y una lista de horas se manejan con
 * el teclado, con el mouse y con el pulgar, y no dependen de si el navegador
 * está en 12 o en 24 horas.
 *
 * El valor que entra y sale es 'AAAA-MM-DDTHH:mm', lo mismo que aceptaba el
 * campo anterior, así que quien lo usa no cambia.
 */

/** Cada media hora, más el 23:59 que es el cierre habitual de un período. */
const HORAS = (() => {
  const opciones = [];
  for (let minutos = 0; minutos < 24 * 60; minutos += 30) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    opciones.push(`${h}:${m}`);
  }
  opciones.push('23:59');
  return opciones;
})();

export default function CampoFechaHora({ id, etiqueta, valor, onCambiar, minFecha, requerido = true }) {
  const [fecha = '', hora = ''] = (valor ?? '').split('T');

  const cambiar = (nuevaFecha, nuevaHora) => onCambiar(`${nuevaFecha}T${nuevaHora}`);

  // Un sorteo viejo puede tener una hora que no cae en la media hora (00:46, por
  // ejemplo). Se agrega a la lista para no pisarle el valor a nadie por abrir
  // la pantalla.
  const horas = HORAS.includes(hora) || !hora ? HORAS : [hora, ...HORAS];

  return (
    <div className="campo-fecha-hora">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="fecha-hora">
        <input
          id={id}
          type="date"
          value={fecha}
          min={minFecha}
          onChange={(e) => cambiar(e.target.value, hora)}
          required={requerido}
        />
        <select
          value={hora}
          aria-label={`Hora — ${etiqueta}`}
          onChange={(e) => cambiar(fecha, e.target.value)}
        >
          {horas.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
