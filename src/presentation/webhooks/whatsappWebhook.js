/**
 * @file whatsappWebhook.js
 * @description Handler del webhook de Meta para recibir actualizaciones de estado
 * de mensajes de WhatsApp. Maneja dos tipos de requests:
 *
 *  GET  /webhook → Verificación inicial del webhook por parte de Meta.
 *  POST /webhook → Recepción de actualizaciones de estado (sent, delivered, read).
 *
 * Reglas críticas del webhook de Meta:
 *  1. Siempre responder HTTP 200 al POST, incluso si hay errores de procesamiento.
 *     Meta reintentará si recibe cualquier otro código o timeout.
 *  2. Responder en menos de 5 segundos. El procesamiento lento debe ser asíncrono.
 *  3. Nunca lanzar errores no controlados desde el handler de POST.
 *
 * Documentación Meta:
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

'use strict';

const { processStatusUpdate } = require('../../application/usecases/processStatusUpdate');
const logger = require('../../shared/logger');
const config = require('../../config/env');

/**
 * Handler GET para la verificación inicial del webhook de Meta.
 * Meta envía una solicitud GET con los parámetros hub.mode, hub.verify_token
 * y hub.challenge. Debemos verificar el token y responder con hub.challenge.
 *
 * Query params de Meta:
 *  - hub.mode         → "subscribe" (siempre)
 *  - hub.verify_token → Token que Meta recibió al registrar el webhook
 *  - hub.challenge    → Número que debemos retornar para confirmar la verificación
 *
 * @param {import('express').Request} req   - Request de Express.
 * @param {import('express').Response} res  - Response de Express.
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.debug('WEBHOOK_VERIFY_ATTEMPT', {
    mode,
    tokenMatch: token === config.metaWebhookVerifyToken,
  });

  if (mode === 'subscribe' && token === config.metaWebhookVerifyToken) {
    logger.info('WEBHOOK_VERIFIED', {
      status: 'OK',
      mode,
    });
    // Responder con el challenge en texto plano (Meta lo espera así).
    return res.status(200).send(challenge);
  }

  logger.warn('WEBHOOK_VERIFY_FAILED', {
    reason: mode !== 'subscribe'
      ? `mode inválido: ${mode}`
      : 'token no coincide',
  });

  return res.status(403).json({
    error: { code: 'WEBHOOK_FORBIDDEN', message: 'Token de verificación inválido.' },
  });
}

/**
 * Handler POST para la recepción de actualizaciones de estado de Meta.
 * Procesa el payload de forma segura y siempre responde HTTP 200.
 *
 * Payload esperado de Meta:
 * ```json
 * {
 *   "object": "whatsapp_business_account",
 *   "entry": [{
 *     "changes": [{
 *       "value": {
 *         "statuses": [{
 *           "id": "wamid.ABC123XYZ",
 *           "recipient_id": "573001234567",
 *           "status": "delivered",
 *           "timestamp": "1742560015"
 *         }]
 *       }
 *     }]
 *   }]
 * }
 * ```
 *
 * @param {import('express').Request} req   - Request de Express.
 * @param {import('express').Response} res  - Response de Express.
 * @returns {Promise<void>}
 */
async function receiveStatusUpdate(req, res) {
  // Responder 200 inmediatamente para evitar reintentos de Meta.
  // El procesamiento ocurre después de enviar la respuesta.
  res.status(200).json({ received: true });

  const payload = req.body;

  logger.debug('WEBHOOK_RECEIVED', {
    object: payload?.object,
    entries: payload?.entry?.length ?? 0,
  });

  try {
    await processStatusUpdate(payload);
  } catch (err) {
    // Error crítico e inesperado: loguear pero no relanzar (la respuesta ya fue enviada).
    logger.error('WEBHOOK_CRITICAL_ERROR', {
      error: err.message,
      stack: err.stack,
    });
  }
}

module.exports = {
  verifyWebhook,
  receiveStatusUpdate,
};
