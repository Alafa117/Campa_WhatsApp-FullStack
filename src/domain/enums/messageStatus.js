/**
 * @file messageStatus.js
 * @description Enum de estados del ciclo de vida de un mensaje de WhatsApp.
 * Define los únicos tres estados válidos que un mensaje puede tener en el sistema.
 * Debe usarse en TODA la aplicación para evitar strings literales dispersos.
 *
 * Ciclo de vida:
 *   SENT → DELIVERED → READ
 *
 * Meta también puede reportar "failed" en el webhook; se mapea externamente
 * antes de llegar al dominio.
 */

'use strict';

/**
 * @readonly
 * @enum {string}
 * @description Estados del ciclo de vida de un mensaje de WhatsApp.
 *
 * @property {string} SENT      - El mensaje fue enviado exitosamente a la API de Meta.
 * @property {string} DELIVERED - El mensaje fue entregado al dispositivo del destinatario.
 * @property {string} READ      - El destinatario abrió y leyó el mensaje.
 */
const MessageStatus = Object.freeze({
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
});

/**
 * Conjunto de valores válidos del enum (útil para validación y mapeo rápido).
 * @type {Set<string>}
 */
const VALID_STATUSES = new Set(Object.values(MessageStatus));

/**
 * Mapeo desde los strings de estado que envía Meta (minúsculas) hacia
 * los valores internos del enum MessageStatus.
 * @type {Object.<string, string>}
 */
const META_STATUS_MAP = Object.freeze({
  sent: MessageStatus.SENT,
  delivered: MessageStatus.DELIVERED,
  read: MessageStatus.READ,
});

/**
 * Convierte un estado recibido desde Meta (string en minúsculas) al enum interno.
 * @param {string} metaStatus - Estado recibido en el payload del webhook de Meta.
 * @returns {string|null} Valor del enum MessageStatus, o null si el estado es desconocido.
 *
 * @example
 * fromMetaStatus('delivered'); // → 'DELIVERED'
 * fromMetaStatus('unknown');   // → null
 */
function fromMetaStatus(metaStatus) {
  return META_STATUS_MAP[metaStatus] ?? null;
}

/**
 * Verifica si un string es un valor válido del enum MessageStatus.
 * @param {string} status - Valor a verificar.
 * @returns {boolean} true si el valor pertenece al enum, false en caso contrario.
 *
 * @example
 * isValid('SENT');    // → true
 * isValid('PENDING'); // → false
 */
function isValid(status) {
  return VALID_STATUSES.has(status);
}

module.exports = {
  MessageStatus,
  fromMetaStatus,
  isValid,
};
