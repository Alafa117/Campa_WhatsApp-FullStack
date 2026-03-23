/**
 * @file app.js
 * @description Configuración y setup de la aplicación Express.
 * Registra middlewares globales, monta las rutas y configura los handlers
 * de error. Exporta la instancia de app para ser usada por el entry point
 * y por los tests de integración.
 *
 * Middlewares registrados (en orden):
 *  1. express.json()       → Parseo de body JSON
 *  2. express.urlencoded() → Parseo de body URL-encoded
 *  3. requestLogger        → Logging de requests HTTP
 *  4. Rutas de la app      → Campaigns y Webhook
 *  5. notFoundHandler      → Captura de rutas inexistentes (404)
 *  6. errorHandler         → Manejo centralizado de errores
 */

'use strict';

const express = require('express');
const createRouter = require('./routes/index');
const { requestLogger } = require('./middlewares/requestLogger');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

/**
 * Crea y configura la instancia de Express con todos los middlewares y rutas.
 *
 * @returns {import('express').Application} Instancia de Express configurada.
 */
function createApp() {
  const app = express();

  // ─── Middlewares de parseo ────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Confiar en el proxy si está detrás de un reverse proxy (nginx, AWS ALB).
  app.set('trust proxy', 1);

  // ─── Middleware de logging de requests ───────────────────────────────────
  app.use(requestLogger);

  // ─── Rutas de la aplicación ───────────────────────────────────────────────
  app.use('/', createRouter());

  // ─── Handlers de error (deben ir al final) ───────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
