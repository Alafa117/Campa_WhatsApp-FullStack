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

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

// Crear directorio de logs si no existe
const LOGS_DIR = path.resolve(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Modos de debug disponibles via variable de entorno LOG_MODE:
 *   api    → Solo eventos de llamadas HTTP/Postman y Meta API
 *   status → Solo eventos de estados WhatsApp (sent, delivered, read) y webhook
 *   (sin definir) → Todos los eventos (comportamiento por defecto)
 */
const LOG_MODE = process.env.LOG_MODE;

const API_EVENTS = [
  'HTTP_REQUEST',
  'META_API_REQUEST',
  'META_API_RESPONSE',
  'META_API_TEXT_REQUEST',
  'META_API_TEXT_RESPONSE',
  'META_API_HTTP_ERROR',
  'META_API_CONNECTION_FAILED',
];

const STATUS_EVENTS = [
  'MESSAGE_SENT',
  'MESSAGE_DELIVERED',
  'MESSAGE_READ',
  'MESSAGE_STATUS_UNKNOWN',
  'WEBHOOK_RECEIVED',
  'WEBHOOK_PROCESSED',
  'WEBHOOK_VERIFIED',
  'WEBHOOK_VERIFY_ATTEMPT',
  'WEBHOOK_VERIFY_FAILED',
  'WEBHOOK_INVALID_OBJECT',
  'WEBHOOK_STATUS_IGNORED',
  'WEBHOOK_ENTRY_ERROR',
  'WEBHOOK_CRITICAL_ERROR',
];

/**
 * Filtro de Winston: deja pasar solo los eventos del modo activo.
 * Los niveles error y warn siempre se muestran en cualquier modo.
 */
const logModeFilter = format((info) => {
  if (!LOG_MODE) return info; // sin filtro: muestra todo

  const level = info.level.replace(/\u001b\[\d+m/g, '');
  if (level === 'error' || level === 'warn') return info; // siempre mostrar errores

  const event = info.message;
  if (LOG_MODE === 'api') {
    return API_EVENTS.includes(event) ? info : false;
  }
  if (LOG_MODE === 'status') {
    return STATUS_EVENTS.includes(event) ? info : false;
  }
  return info;
});

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
 * Función genérica para crear un filtro de eventos por lista permitida.
 * Siempre deja pasar error y warn.
 */
function makeEventFilter(allowedEvents) {
  return format((info) => {
    const level = info.level.replace(/\u001b\[\d+m/g, '');
    if (level === 'error' || level === 'warn') return info;
    return allowedEvents.includes(info.message) ? info : false;
  });
}

const apiFileFilter    = makeEventFilter(API_EVENTS);
const statusFileFilter = makeEventFilter(STATUS_EVENTS);

/**
 * Transporte de consola con colores para ambiente de desarrollo.
 * @type {transports.ConsoleTransportInstance}
 */
const consoleTransport = new transports.Console({
  format: combine(
    logModeFilter(),
    colorize({ all: false, level: true }),
    timestamp(),
    boxFormat
  ),
});

/**
 * Transporte de archivo para eventos de API/Postman (sin colores ANSI).
 * Leído por: npm run watch:api
 */
const apiFileTransport = new transports.File({
  filename: path.join(LOGS_DIR, 'api.log'),
  format: combine(apiFileFilter(), timestamp(), boxFormat),
  options: { flags: 'a', highWaterMark: 1 },
});

/**
 * Transporte de archivo para eventos de estados WhatsApp (sin colores ANSI).
 * Leído por: npm run watch:status
 */
const statusFileTransport = new transports.File({
  filename: path.join(LOGS_DIR, 'status.log'),
  format: combine(statusFileFilter(), timestamp(), boxFormat),
  options: { flags: 'a', highWaterMark: 1 },
});

/**
 * Instancia principal del logger de la aplicación.
 * Nivel mínimo: "debug" en desarrollo, "info" en producción.
 * @type {import('winston').Logger}
 */
const winstonLogger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [consoleTransport, apiFileTransport, statusFileTransport],
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
