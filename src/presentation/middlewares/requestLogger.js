/**
 * @file requestLogger.js
 * @description Middleware de logging de requests HTTP entrantes.
 * Registra método, URL, status y duración de cada request procesado.
 * Excluye rutas de health check para no contaminar los logs con checks frecuentes.
 */

'use strict';

const logger = require('../../shared/logger');

/**
 * Rutas que se excluyen del logging para reducir ruido en los logs.
 * @type {string[]}
 */
const EXCLUDED_PATHS = ['/health', '/api/campaigns/health'];

/**
 * Middleware de Express que registra cada request HTTP entrante.
 * Se engancha al evento 'finish' de la response para capturar el status code
 * y la duración total del request.
 *
 * @param {import('express').Request} req   - Request de Express.
 * @param {import('express').Response} res  - Response de Express.
 * @param {import('express').NextFunction} next - Función next.
 */
function requestLogger(req, res, next) {
  if (EXCLUDED_PATHS.includes(req.path)) {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 ? 'warn'
        : 'info';

    logger[level]('HTTP_REQUEST', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
    });
  });

  next();
}

module.exports = { requestLogger };
