/**
 * @file logger.js
 * @description Logger estructurado con niveles (info, warn, error, debug) y colores
 * para consola. Utiliza winston como motor de logging. Cada nivel produce una
 * salida visual diferenciada con timestamp ISO, nivel y mensaje.
 *
 * Uso:
 *   const logger = require('./logger');
 *   logger.info('CAMPAIGN_SEND', { status: 'SENT', to: '+573001234567' });
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

/**
 * @typedef {Object} LogMeta
 * @property {string} [status]     - Estado del mensaje (SENT, DELIVERED, READ, FAILED)
 * @property {string} [to]         - Número de teléfono destinatario
 * @property {string} [by]         - Número de teléfono que realizó la acción (READ)
 * @property {string} [campaign]   - Nombre de la campaña
 * @property {string} [template]   - Nombre de la plantilla de Meta
 * @property {string} [messageId]  - ID del mensaje (wamid)
 * @property {string} [error]      - Descripción del error ocurrido
 */

/**
 * Ancho fijo del cuadro de log en caracteres.
 * @constant {number}
 */
const BOX_WIDTH = 65;

/**
 * Construye una línea de contenido alineada dentro del cuadro ASCII.
 * @param {string} label - Etiqueta del campo (ej: "status").
 * @param {string} value - Valor del campo.
 * @returns {string} Línea formateada: "│ label    : value               │"
 */
function buildLine(label, value) {
  const content = `${label.padEnd(10)}: ${value}`;
  const padded = content.padEnd(BOX_WIDTH - 2);
  return `│ ${padded} │`;
}

/**
 * Construye el encabezado del cuadro con timestamp, nivel y evento.
 * @param {string} isoTimestamp - Timestamp en formato ISO (ej: "2025-03-21 10:45:01").
 * @param {string} level        - Nivel de log en mayúsculas (INFO, WARN, ERROR, DEBUG).
 * @param {string} event        - Nombre del evento (ej: "CAMPAIGN_SEND").
 * @returns {string} Encabezado formateado dentro del cuadro.
 */
function buildHeader(isoTimestamp, level, event) {
  const content = `[${isoTimestamp}] ${level.padEnd(5)} ${event}`;
  const padded = content.padEnd(BOX_WIDTH - 2);
  return `│ ${padded} │`;
}

/**
 * Dibuja la línea superior del cuadro ASCII.
 * @returns {string} Línea superior con esquinas redondeadas.
 */
function buildTopBorder() {
  return `┌${'─'.repeat(BOX_WIDTH)}┐`;
}

/**
 * Dibuja la línea inferior del cuadro ASCII.
 * @returns {string} Línea inferior con esquinas redondeadas.
 */
function buildBottomBorder() {
  return `└${'─'.repeat(BOX_WIDTH)}┘`;
}

/**
 * Formatea un timestamp Date en formato legible para consola.
 * @param {string|Date} ts - Timestamp a formatear.
 * @returns {string} Timestamp en formato "YYYY-MM-DD HH:mm:ss".
 */
function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return [
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  ].join(' ');
}

/**
 * Formato personalizado de winston que genera el cuadro ASCII con los metadatos
 * del log. Si no hay metadatos adicionales, sólo muestra la cabecera.
 *
 * @param {Object} info                - Objeto de log de winston.
 * @param {string} info.timestamp      - Timestamp ISO generado por winston.
 * @param {string} info.level          - Nivel del log.
 * @param {string} info.message        - Evento/mensaje principal.
 * @param {LogMeta} [info.meta]        - Metadatos opcionales del evento.
 * @returns {string} Cadena completa del cuadro ASCII.
 */
const boxFormat = printf((info) => {
  const ts = formatTimestamp(info.timestamp);
  const level = info.level.replace(/\u001b\[\d+m/g, '').toUpperCase();
  const event = info.message;
  const meta = info.meta || {};

  const lines = [buildTopBorder(), buildHeader(ts, level, event)];

  const metaEntries = Object.entries(meta);
  if (metaEntries.length > 0) {
    for (const [key, value] of metaEntries) {
      if (value !== undefined && value !== null) {
        lines.push(buildLine(key, String(value)));
      }
    }
  }

  lines.push(buildBottomBorder());
  return lines.join('\n');
});

/**
 * Formato de winston para entornos de producción (JSON estructurado sin colores).
 * Facilita la ingesta de logs en herramientas como Datadog, ELK o CloudWatch.
 */
const jsonFormat = combine(
  timestamp(),
  format.json()
);

/**
 * Transporte de consola con colores para ambiente de desarrollo.
 * @type {transports.ConsoleTransportInstance}
 */
const consoleTransport = new transports.Console({
  format: combine(
    colorize({ all: false, level: true }),
    timestamp(),
    boxFormat
  ),
});

/**
 * Instancia principal del logger de la aplicación.
 * Nivel mínimo: "debug" en desarrollo, "info" en producción.
 * @type {import('winston').Logger}
 */
const winstonLogger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [consoleTransport],
  exitOnError: false,
});

/**
 * Wrapper del logger que expone métodos tipados y con metadatos estructurados.
 * @namespace logger
 */
const logger = {
  /**
   * Registra un evento informativo (flujos exitosos).
   * @param {string} event    - Nombre del evento (ej: "CAMPAIGN_SEND").
   * @param {LogMeta} [meta]  - Metadatos adicionales del evento.
   */
  info(event, meta) {
    winstonLogger.info(event, { meta });
  },

  /**
   * Registra una advertencia (fallos parciales, degradación de servicio).
   * @param {string} event    - Nombre del evento (ej: "CAMPAIGN_SEND_FAILED").
   * @param {LogMeta} [meta]  - Metadatos adicionales del evento.
   */
  warn(event, meta) {
    winstonLogger.warn(event, { meta });
  },

  /**
   * Registra un error crítico con stack trace cuando está disponible.
   * @param {string} event         - Nombre del evento (ej: "META_API_ERROR").
   * @param {LogMeta|Error} [meta] - Metadatos o instancia de Error.
   */
  error(event, meta) {
    if (meta instanceof Error) {
      winstonLogger.error(event, { meta: { message: meta.message, stack: meta.stack } });
    } else {
      winstonLogger.error(event, { meta });
    }
  },

  /**
   * Registra trazas internas para depuración (solo visible en NODE_ENV=development).
   * @param {string} event   - Nombre del evento.
   * @param {*} [meta]       - Cualquier dato adicional relevante para debug.
   */
  debug(event, meta) {
    winstonLogger.debug(event, { meta });
  },
};

module.exports = logger;
