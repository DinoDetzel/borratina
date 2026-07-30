import express from 'express';
import cors from 'cors';

import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.routes.js';
import sorteosRoutes from './routes/sorteos.routes.js';
import jugadasRoutes from './routes/jugadas.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'borratina-api', hora: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/sorteos', sorteosRoutes);
app.use('/api/jugadas', jugadasRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFoundHandler);
// Express 5 propaga solo el rechazo de los handlers async a este middleware.
app.use(errorHandler);
