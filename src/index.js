/**
 * @file index.js
 * @description Entry point de la aplicación WhatsApp Campaign System.
 * Responsabilidades:
 *  1. Cargar y validar variables de entorno (import temprano de config/env).
 *  2. Crear la app Express.
 *  3. Iniciar el servidor HTTP en el puerto configurado.
 *  4. Registrar handlers de señales del sistema para graceful shutdown.
 *  5. Manejar errores no capturados (uncaughtException, unhandledRejection).
 *
 * El orden de imports es crítico: config/env debe ser el primero para
 * garantizar que las variables de entorno estén validadas antes de
 * que cualquier otro módulo intente acceder a ellas.
 */

'use strict';

// Cargar y validar .env ANTES de cualquier otro import de la aplicación.
const config = require('./config/env');
const logger = require('./shared/logger');
const createApp = require('./presentation/app');

/**
 * Inicia el servidor HTTP de Express en el puerto configurado.
 * Registra el evento de arranque en el logger con nivel INFO.
 *
 * @returns {Promise<import('http').Server>} Instancia del servidor HTTP activo.
 */
async function startServer() {
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info('SERVER_STARTED', {
      port: config.port,
      env: config.nodeEnv,
      pid: process.pid,
    });
  });

  return server;
}

/**
 * Registra los handlers para un graceful shutdown del proceso.
 * Ante SIGTERM o SIGINT cierra el servidor HTTP limpiamente antes de salir,
 * permitiendo que los requests en curso terminen.
 *
 * @param {import('http').Server} server - Instancia del servidor HTTP.
 */
function registerShutdownHandlers(server) {
  const shutdown = (signal) => {
    logger.info('SERVER_SHUTDOWN_SIGNAL', { signal });

    server.close((err) => {
      if (err) {
        logger.error('SERVER_SHUTDOWN_ERROR', { error: err.message });
        process.exit(1);
      }

      logger.info('SERVER_SHUTDOWN_COMPLETE', { signal });
      process.exit(0);
    });

    // Forzar cierre si no termina en 10 segundos.
    setTimeout(() => {
      logger.error('SERVER_SHUTDOWN_TIMEOUT', {
        error: 'El servidor no cerró en 10 segundos. Forzando salida.',
      });
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Registra los handlers globales para errores no capturados.
 * En producción, estos errores son críticos y requieren reinicio del proceso.
 * En desarrollo, se muestran para facilitar el debug.
 */
function registerUncaughtHandlers() {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT_EXCEPTION', {
      error: err.message,
      stack: err.stack,
    });
    // Errores no capturados dejan el proceso en estado inconsistente.
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('UNHANDLED_REJECTION', {
      error: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    // En Node.js moderno, las promesas rechazadas sin handler terminan el proceso.
    process.exit(1);
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

registerUncaughtHandlers();

startServer()
  .then((server) => {
    registerShutdownHandlers(server);
  })
  .catch((err) => {
    logger.error('SERVER_START_FAILED', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
