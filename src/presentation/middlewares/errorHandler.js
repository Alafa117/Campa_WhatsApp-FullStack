/**
 * @file errorHandler.js
 * @description Middleware de manejo centralizado de errores para Express.
 * Captura todos los errores propagados mediante next(err) en la cadena de
 * middlewares, los clasifica y genera respuestas HTTP apropiadas.
 *
 * Comportamiento:
 *  - Errores operacionales (AppError.isOperational=true): retorna el mensaje al cliente.
 *  - Errores de programación (isOperational=false): retorna 500 genérico, logea el stack.
 *  - En desarrollo incluye el stack trace en la respuesta para facilitar debug.
 *  - En producción oculta detalles internos al cliente.
 *
 * Este middleware DEBE registrarse al final de todos los middlewares de Express,
 * con la firma de 4 parámetros (err, req, res, next).
 */

'use strict';

const { AppError } = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');
const config = require('../../config/env');

/**
 * Genera el cuerpo de la respuesta de error según el tipo de error y el entorno.
 *
 * @param {Error|AppError} err  - Error capturado.
 * @param {boolean} isDev       - Si el entorno es desarrollo.
 * @returns {Object} Objeto de respuesta JSON con el error.
 */
function buildErrorResponse(err, isDev) {
  if (err instanceof AppError && err.isOperational) {
    // Error conocido: exponer al cliente de forma segura.
    const body = err.toJSON(isDev);
    return body;
  }

  // Error desconocido (bug): no exponer detalles internos en producción.
  if (isDev) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'Error interno del servidor',
        stack: err.stack,
      },
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error interno. Por favor intenta más tarde.',
    },
  };
}

/**
 * Determina el código HTTP de la respuesta a partir del error.
 *
 * @param {Error|AppError} err - Error capturado.
 * @returns {number} Código HTTP (400-599).
 */
function resolveStatusCode(err) {
  if (err instanceof AppError && err.statusCode) {
    return err.statusCode;
  }
  return 500;
}

/**
 * Middleware de Express para manejo centralizado de errores.
 * La firma de 4 parámetros es obligatoria para que Express lo reconozca
 * como middleware de error.
 *
 * @param {Error|AppError} err     - Error propagado mediante next(err).
 * @param {import('express').Request} req   - Request de Express.
 * @param {import('express').Response} res  - Response de Express.
 * @param {import('express').NextFunction} next - Función next (requerida por la firma).
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isDev = config.isDevelopment;
  const statusCode = resolveStatusCode(err);
  const isOperational = err instanceof AppError && err.isOperational;

  // Loguear el error con el nivel apropiado.
  if (!isOperational || statusCode >= 500) {
    logger.error('UNHANDLED_ERROR', {
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      error: err.message,
      stack: isDev ? err.stack : undefined,
    });
  } else {
    logger.warn('OPERATIONAL_ERROR', {
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      code: err.code,
      error: err.message,
    });
  }

  const responseBody = buildErrorResponse(err, isDev);

  // Evitar enviar respuesta si los headers ya fueron enviados.
  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json(responseBody);
}

/**
 * Middleware para rutas no encontradas (404).
 * Debe registrarse después de todas las rutas válidas y antes de errorHandler.
 *
 * @param {import('express').Request} req   - Request de Express.
 * @param {import('express').Response} res  - Response de Express.
 * @param {import('express').NextFunction} next - Función next.
 */
function notFoundHandler(req, res, next) {
  const { AppError: AE } = require('../../shared/errors/AppError');
  next(new AE(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

module.exports = { errorHandler, notFoundHandler };
