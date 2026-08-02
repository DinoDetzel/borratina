import { fechaDia, formatearNumero, pesos } from './utilidades.js';

/**
 * Dibuja el comprobante en un canvas y devuelve un PNG.
 *
 * Hace falta una imagen porque WhatsApp no acepta adjuntos por URL: `wa.me`
 * solo lleva texto. Para mandar el ticket como foto hay que pasarle un archivo
 * al selector del sistema (Web Share API), y para eso hay que rasterizarlo.
 *
 * Se dibuja a mano en vez de capturar el DOM con una librería:
 *
 * - `html2canvas` reinterpreta el CSS y no soporta `clip-path: path()`, así que
 *   el escudo del club saldría como un rectángulo.
 * - `html-to-image` mete el DOM en un `<foreignObject>`; anda bien en Chrome
 *   pero en Safari es conocido que devuelve imágenes en blanco o sin las
 *   tipografías, y un comprobante que a veces sale vacío es peor que ninguno.
 *
 * Dibujar a canvas es determinista y no agrega dependencias. El costo es que
 * esta maqueta y la de `componentes/Comprobante.jsx` son la misma pieza escrita
 * dos veces: **si se toca una, hay que tocar la otra.** Las medidas son las
 * mismas de allá, en el mismo orden, para que compararlas sea directo.
 */

const ANCHO = 720;
const ESCALA = 2; // el PNG sale al doble para que no se vea pixelado al ampliarlo

const ROJO = '#e04b2f';
const CREMA = '#f7f4ec';
const TINTA = '#1a1a1a';

const ESCUDO =
  'M 3 26 C 3 10 12 3 28 3 H 98 C 114 3 123 10 123 26 V 74 C 123 112 100 136 63 149 C 26 136 3 112 3 74 Z';

/** Las tipografías tienen que estar listas antes de dibujar, o el canvas usa
 *  la de sistema y el ticket sale con otra cara. */
async function esperarTipografias() {
  const caras = [
    '400 74px Yellowtail',
    '800 35px Barlow',
    '700 34px Barlow',
    '500 24px Barlow',
    'italic 500 30px Barlow',
    'italic 400 19px Barlow',
    '700 15px "Barlow Semi Condensed"',
    '800 110px Barlow', // el sello de anulada
  ];
  await Promise.all(caras.map((f) => document.fonts.load(f)));
  await document.fonts.ready;
}

export async function comprobanteAImagen(comprobante) {
  await esperarTipografias();

  const lienzo = document.createElement('canvas');
  const c = lienzo.getContext('2d');

  // Se recorre dos veces: la primera solo mide cuánto ocupa todo, y recién la
  // segunda dibuja, ya sobre un canvas del alto justo.
  const alto = Math.ceil(pintar(c, comprobante, true));
  lienzo.width = ANCHO * ESCALA;
  lienzo.height = alto * ESCALA;
  c.scale(ESCALA, ESCALA);
  pintar(c, comprobante, false);

  return new Promise((resolver) => lienzo.toBlob(resolver, 'image/png'));
}

/**
 * Pinta el comprobante y devuelve el alto total.
 * Con `midiendo` en true no dibuja nada: solo acumula posiciones.
 */
function pintar(c, { codigo, numeros, comprador, sorteo, importe, anulada }, midiendo) {
  const PAD_X = 30;
  const ancho = ANCHO - PAD_X * 2; // 660
  const izq = PAD_X;
  const der = PAD_X + ancho;

  const dibujar = (fn) => {
    if (!midiendo) fn();
  };

  const texto = (str, x, y, { fuente, color = ROJO, alinear = 'left', espaciado = 0 } = {}) => {
    dibujar(() => {
      c.font = fuente;
      c.fillStyle = color;
      c.textAlign = alinear;
      c.textBaseline = 'alphabetic';
      if ('letterSpacing' in c) c.letterSpacing = `${espaciado}px`;
      c.fillText(str, x, y);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
    });
  };

  const anchoDe = (str, fuente, espaciado = 0) => {
    c.font = fuente;
    if ('letterSpacing' in c) c.letterSpacing = `${espaciado}px`;
    const m = c.measureText(str).width;
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    return m;
  };

  const caja = (x, y, w, h, grosor) => {
    dibujar(() => {
      c.strokeStyle = ROJO;
      c.lineWidth = grosor;
      c.strokeRect(x + grosor / 2, y + grosor / 2, w - grosor, h - grosor);
    });
  };

  const relleno = (x, y, w, h, color) => {
    dibujar(() => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    });
  };

  // Fondo crema. Se pinta con un alto generoso; el canvas final ya viene
  // recortado al alto justo.
  relleno(0, 0, ANCHO, 2000, CREMA);

  let y = 26;

  // ---- Escudo y nombre del club ----
  dibujar(() => {
    c.save();
    c.translate(izq, y);
    c.clip(new Path2D(ESCUDO));
    c.fillStyle = ROJO;
    c.fillRect(0, 0, 126, 152);
    c.restore();
  });

  // Las tres iniciales, escalonadas dentro del escudo. El bloque de tres líneas
  // va centrado en el alto del escudo pero corrido hacia arriba, igual que el
  // `padding-bottom: 22` de la maqueta: si no, quedan encima de la punta.
  const altoIniciales = 3 * 29 * 1.02;
  const arriba = y + (152 - (altoIniciales + 22)) / 2;
  ['C.', 'D.', 'S.'].forEach((letra, i) => {
    texto(letra, izq + 63 + (i - 1) * 22, arriba + 29 * 0.75 + i * 29 * 1.02, {
      fuente: '800 29px Barlow',
      color: CREMA,
      alinear: 'center',
    });
  });

  const xTexto = izq + 126 + 16;
  texto('al Rojo Vivo!!!', xTexto, y + 4 + 74 * 0.72, {
    fuente: '400 74px Yellowtail',
    espaciado: -1,
  });
  texto('CLUB DEPORTIVO SARMIENTO', xTexto, y + 4 + 74 * 0.9 + 8 + 35 * 0.8, {
    fuente: '800 35px Barlow',
    espaciado: -0.6,
  });

  y += 152 + 20;

  // ---- Pozo (izquierda) y período (derecha) ----
  const anchoPozo = 250;
  const yCaja = y + 16;
  caja(izq, yCaja, anchoPozo, 86, 3);

  texto('$', izq + 10, yCaja + 86 - 8 - 4, { fuente: '400 32px Yellowtail' });
  texto(
    sorteo.pozo == null ? '' : new Intl.NumberFormat('es-AR').format(sorteo.pozo),
    izq + anchoPozo - 10,
    yCaja + 86 - 8 - 4,
    { fuente: '700 34px Barlow', alinear: 'right' },
  );

  // La etiqueta "Pozo" pisa el borde de arriba, con el fondo tapando la línea.
  const anchoEtiqueta = anchoDe('Pozo', '400 44px Yellowtail') + 16;
  relleno(izq + 6, yCaja - 8, anchoEtiqueta, 44, CREMA);
  texto('Pozo', izq + 14, yCaja - 8 + 44 * 0.75, { fuente: '400 44px Yellowtail' });

  const yLeyenda = yCaja + 86 + 6;
  ['EN CASO DE HABER MÁS DE UN', 'GANADOR EL POZO SE DIVIDE'].forEach((linea, i) => {
    texto(linea, izq + anchoPozo / 2, yLeyenda + 15 * 0.85 + i * 15 * 1.15, {
      fuente: '700 15px "Barlow Semi Condensed"',
      alinear: 'center',
      espaciado: 0.3,
    });
  });

  const xDer = izq + anchoPozo + 20;
  const anchoDer = der - xDer;
  const yBanda = y + 14;
  const altoBanda = 6 + 40 + 5;

  relleno(xDer, yBanda, anchoDer, altoBanda, ROJO);
  texto('Sortea el', xDer + 14, yBanda + 6 + 40 * 0.78, {
    fuente: '400 40px Yellowtail',
    color: CREMA,
  });
  const xFecha = xDer + 14 + anchoDe('Sortea el', '400 40px Yellowtail') + 10;
  texto(
    sorteo.sortea_el ? fechaDia(sorteo.sortea_el) : '',
    (xFecha + der - 14) / 2,
    yBanda + 6 + 40 * 0.78,
    { fuente: '700 30px Barlow', color: CREMA, alinear: 'center', espaciado: 1 },
  );

  const ySub = yBanda + altoBanda;
  const altoSub = 3 + 17 * 1.25 + 5;
  relleno(xDer, ySub, anchoDer, altoSub, ROJO);
  texto('POR QUINIELA DE LA CIUDAD NOCTURNA', xDer + anchoDer / 2, ySub + 3 + 17, {
    fuente: '700 17px Barlow',
    color: CREMA,
    alinear: 'center',
    espaciado: 0.2,
  });

  texto(`VALOR ${pesos(importe)}`, xDer + anchoDer / 2, ySub + altoSub + 12 + 44 * 0.78, {
    fuente: '700 44px Barlow',
    alinear: 'center',
  });

  y = yLeyenda + 15 * 1.15 * 2 + 26;

  // ---- Comprador ----
  const renglon = (etiqueta, valor, yBase) => {
    texto(etiqueta, izq, yBase, { fuente: '700 26px Barlow' });
    const xValor = izq + anchoDe(etiqueta, '700 26px Barlow') + 8;
    texto(valor ?? '', xValor + 6, yBase, { fuente: '500 24px Barlow', color: TINTA });
    dibujar(() => {
      c.strokeStyle = ROJO;
      c.lineWidth = 2;
      c.setLineDash([2, 4]);
      c.beginPath();
      c.moveTo(xValor, yBase + 6);
      c.lineTo(der, yBase + 6);
      c.stroke();
      c.setLineDash([]);
    });
  };

  renglon('Nombre:', comprador.nombre, y + 26 * 0.8);
  renglon('Teléfono:', comprador.telefono, y + 26 * 0.8 + 14 + 26 * 1.2);
  y += 26 * 0.8 + 14 + 26 * 1.2 + 20;

  // ---- Números ----
  texto(`Números elegidos (${numeros.length})`, ANCHO / 2, y + 30 * 0.78, {
    fuente: 'italic 500 30px Barlow',
    alinear: 'center',
  });
  y += 30 + 12;

  const separacion = 14;
  const anchoCaja = (ancho - separacion * (numeros.length - 1)) / numeros.length;
  numeros.forEach((n, i) => {
    const x = izq + i * (anchoCaja + separacion);
    caja(x, y, anchoCaja, 84, 2);
    texto(formatearNumero(n), x + anchoCaja / 2, y + 84 / 2 + 46 * 0.36, {
      fuente: '700 46px Barlow',
      color: TINTA,
      alinear: 'center',
    });
  });
  y += 84 + 14;

  // ---- Letra chica ----
  const NORMAL = 'italic 400 19px Barlow';
  const FUERTE = 'italic 700 19px Barlow';

  // La línea del medio lleva "20 primeros" en negrita, que es la regla del
  // juego: se dibuja en tres tramos para poder cambiar de peso en el medio.
  const legales = [
    [['Para hacerce acreedor del sorteo, los números elegidos, deberán figurar', NORMAL]],
    [
      ['en los ', NORMAL],
      ['20 primeros', FUERTE],
      [' premios de la Quiniela de la Ciudad Nocturna.', NORMAL],
    ],
    [['El premio prescribe a los 10 días porteriores al sorteo.', NORMAL]],
  ];

  legales.forEach((tramos, i) => {
    const yLinea = y + 19 * 0.8 + i * 19 * 1.25;
    const anchoLinea = tramos.reduce((suma, [t, f]) => suma + anchoDe(t, f), 0);
    let x = (ANCHO - anchoLinea) / 2;
    for (const [t, f] of tramos) {
      texto(t, x, yLinea, { fuente: f });
      x += anchoDe(t, f);
    }
  });
  y += 19 * 1.25 * legales.length + 10;

  // ---- Corte y número de comprobante ----
  texto('* '.repeat(28).trim(), izq, y + 26 * 0.7, {
    fuente: '700 26px Barlow',
    espaciado: 6,
  });
  y += 22 + 10;

  const etiquetaComp = 'N° de comprobante: ';
  const anchoEtiquetaComp = anchoDe(etiquetaComp, '500 34px Barlow', 0.5);
  const anchoCodigo = anchoDe(codigo, '700 34px Barlow', 0.5);
  const xComp = (ANCHO - (anchoEtiquetaComp + anchoCodigo)) / 2;
  texto(etiquetaComp, xComp, y + 34 * 0.78, {
    fuente: '500 34px Barlow',
    color: TINTA,
    espaciado: 0.5,
  });
  texto(codigo, xComp + anchoEtiquetaComp, y + 34 * 0.78, {
    fuente: '700 34px Barlow',
    color: TINTA,
    espaciado: 0.5,
  });
  y += 34 + 18;

  // ---- Sello de anulada ----
  // Va último, encima de todo, como el `.sello-anulada` de la maqueta. Sin esto
  // la foto de una jugada anulada sale idéntica a una vigente, y desde que el
  // comprobante se puede reenviar desde la lista eso es un ticket que dice que
  // vale cuando no vale.
  if (anulada) {
    dibujar(() => {
      const CUERPO = 110;
      const ESPACIADO = 6;
      const GIRO = (-18 * Math.PI) / 180;

      c.save();
      c.font = `800 ${CUERPO}px Barlow`;
      if ('letterSpacing' in c) c.letterSpacing = `${ESPACIADO}px`;

      // Al girar, lo que ocupa a lo ancho es la palabra proyectada más el alto
      // volcado. A cuerpo entero la palabra se sale de la hoja, así que se la
      // achica lo justo para que entre con aire a los costados; el navegador que
      // no soporte `letterSpacing` la mide más angosta y el ajuste lo contempla.
      const largo = c.measureText('ANULADA').width;
      const ancho = largo * Math.cos(GIRO) + CUERPO * Math.abs(Math.sin(GIRO));
      const factor = Math.min(1, (ANCHO * 0.9) / ancho);

      c.translate(ANCHO / 2, y / 2);
      c.rotate(GIRO);
      c.scale(factor, factor);

      // Se dibuja desde la izquierda y no con `textAlign: center`: el espaciado
      // que el canvas agrega después de la última letra entra en la medición y
      // con el centrado automático la palabra queda corrida.
      c.fillStyle = 'rgba(224, 75, 47, 0.28)';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText('ANULADA', -(largo - ESPACIADO) / 2, 0);

      if ('letterSpacing' in c) c.letterSpacing = '0px';
      c.restore();
    });
  }

  return y;
}
