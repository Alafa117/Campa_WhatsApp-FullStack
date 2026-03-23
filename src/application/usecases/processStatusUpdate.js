/**
 * @file processStatusUpdate.js
 * @description Caso de uso: procesamiento de actualizaciones de estado recibidas
 * desde el webhook de Meta. Extrae el messageId, número y nuevo estado del payload
 * del webhook, mapea el estado al enum interno y genera el log correspondiente.
 *
 * Contrato con el webhook handler:
 *  - Nunca lanza errores no controlados.
 *  - Retorna siempre un objeto de resultado con success true/false.
 *  - El logging del estado usa el formato visual definido en las especificaciones.
 */

'use strict';

const { fromMetaStatus, MessageStatus } = require('../../domain/enums/messageStatus');
const { WebhookError } = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');

/**
 * @typedef {Object} StatusEntry
 * @property {string} id           - wamid del mensaje.
 * @property {string} recipient_id - ID del destinatario (sin el "+").
 * @property {string} status       - Estado de Meta: "sent"|"delivered"|"read".
 * @property {string} timestamp    - Timestamp Unix como string.
 */

/**
 * @typedef {Object} MetaWebhookPayload
 * @property {string}   object - "whatsapp_business_account"
 * @property {Object[]} entry  - Array de entradas del webhook.
 */

/**
 * @typedef {Object} ProcessResult
 * @property {boolean} success       - Si el procesamiento fue exitoso.
 * @property {number}  processed     - Cantidad de status entries procesadas.
 * @property {string}  [error]       - Descripción del error si success=false.
 */

/**
 * Construye el número E.164 desde el recipient_id de Meta (que viene sin "+").
 * Meta envía el número sin el "+" en recipient_id.
 *
 * @param {string} recipientId - ID del destinatario devuelto por Meta.
 * @returns {string} Número en formato E.164 con "+" prefijo.
 */
function toE164(recipientId) {
  return recipientId.startsWith('+') ? recipientId : `+${recipientId}`;
}

/**
 * Genera el log visual correcto según el estado recibido.
 * Cada estado tiene su propio formato de salida en el logger.
 *
 * @param {string} internalStatus - Estado interno del enum MessageStatus.
 * @param {string} phone          - Número E.164 del destinatario.
 * @param {string} messageId      - wamid del mensaje.
 */
function logStatusUpdate(internalStatus, phone, messageId) {
  switch (internalStatus) {
    case MessageStatus.SENT:
      logger.info('MESSAGE_SENT', {
        status: MessageStatus.SENT,
        to: phone,
        messageId,
      });
      break;

    case MessageStatus.DELIVERED:
      logger.info('MESSAGE_DELIVERED', {
        status: MessageStatus.DELIVERED,
        to: phone,
        messageId,
      });
      break;

    case MessageStatus.READ:
      logger.info('MESSAGE_READ', {
        status: MessageStatus.READ,
        by: phone,
        messageId,
      });
      break;

    default:
      logger.warn('MESSAGE_STATUS_UNKNOWN', {
        status: internalStatus,
        to: phone,
        messageId,
      });
  }
}

/**
 * Procesa una única entrada de status del payload del webhook de Meta.
 *
 * @param {StatusEntry} statusEntry - Objeto de estado del webhook.
 * @returns {{ messageId: string, phone: string, status: string }} Datos procesados.
 * @throws {WebhookError} Si el status no puede mapearse al enum interno.
 */
function processStatusEntry(statusEntry) {
  const { id: messageId, recipient_id, status: metaStatus } = statusEntry;

  if (!messageId || !recipient_id || !metaStatus) {
    throw new WebhookError(
      'Status entry incompleta: falta id, recipient_id o status.',
      statusEntry
    );
  }

  const internalStatus = fromMetaStatus(metaStatus);

  if (!internalStatus) {
    // Meta puede enviar estados como "failed" o "deleted" que no mapeamos.
    logger.warn('WEBHOOK_STATUS_IGNORED', {
      metaStatus,
      messageId,
      reason: 'Estado no mapeado al enum interno',
    });
    return null;
  }

  const phone = toE164(recipient_id);
  logStatusUpdate(internalStatus, phone, messageId);

  return { messageId, phone, status: internalStatus };
}

/**
 * Caso de uso principal: procesa el payload completo del webhook de Meta.
 * Itera sobre todas las entradas y status entries disponibles.
 *
 * @param {MetaWebhookPayload} webhookPayload - Payload recibido en el POST del webhook.
 * @returns {ProcessResult} Resultado del procesamiento.
 *
 * @example
 * const result = await processStatusUpdate(req.body);
 * // result → { success: true, processed: 1 }
 */
async function processStatusUpdate(webhookPayload) {
  try {
    if (!webhookPayload || webhookPayload.object !== 'whatsapp_business_account') {
      logger.warn('WEBHOOK_INVALID_OBJECT', {
        received: webhookPayload?.object,
        expected: 'whatsapp_business_account',
      });
      return { success: false, processed: 0, error: 'Objeto de webhook inválido' };
    }

    const entries = webhookPayload.entry || [];
    let processedCount = 0;

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const statuses = change.value?.statuses || [];

        for (const statusEntry of statuses) {
          try {
            const result = processStatusEntry(statusEntry);
            if (result !== null) {
              processedCount++;
            }
          } catch (entryError) {
            // Error en una entrada individual no detiene el procesamiento del resto.
            logger.error('WEBHOOK_ENTRY_ERROR', {
              error: entryError.message,
              messageId: statusEntry?.id,
            });
          }
        }
      }
    }

    logger.debug('WEBHOOK_PROCESSED', {
      processed: processedCount,
      entries: entries.length,
    });

    return { success: true, processed: processedCount };
  } catch (err) {
    logger.error('WEBHOOK_PROCESSING_CRITICAL', {
      error: err.message,
    });
    return { success: false, processed: 0, error: err.message };
  }
}

module.exports = { processStatusUpdate };
