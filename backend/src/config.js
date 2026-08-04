import 'dotenv/config';

/**
 * Lee una variable de entorno obligatoria y corta el arranque si falta.
 * Preferimos fallar acá y no a mitad de un request.
 */
function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) {
    console.error(
      `\n✖ Falta la variable de entorno ${nombre}.\n` +
        `  Copiá .env.example a .env y completala.\n`,
    );
    process.exit(1);
  }
  return valor;
}

export const config = {
  port: Number(process.env.PORT) || 3000,

  /**
   * La zona del club. Todo lo que sea "qué día es" —la fecha del código de
   * comprobante, el agrupado por día del gráfico— tiene que resolverse acá y no
   * donde esté parado el servidor, que puede correr en UTC.
   */
  zonaHoraria: process.env.TZ_CLUB || 'America/Argentina/Buenos_Aires',

  db: {
    connectionString: requerida('DATABASE_URL'),
    // Supabase y la mayoría de los Postgres administrados exigen SSL, pero
    // presentan certificados que no encadenan contra la CA del sistema.
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },

  jwt: {
    secret: requerida('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
