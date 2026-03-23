/**
 * @file sendCampaign.js
 * @description Caso de uso: envío masivo de mensajes de WhatsApp a múltiples
 * destinatarios. Orquesta la validación de números, construcción de payloads,
 * envíos en paralelo con Promise.allSettled() y generación del resumen final.
 *
 * Reglas de negocio:
 *  - Valida cada número E.164 antes de enviar.
 *  - Usa Promise.allSettled() para que un fallo individual no detenga los demás.
 *  - Registra cada resultado (éxito o fallo) en la entidad Campaign.
 *  - Retorna el resumen de campaña con totales y detalle por destinatario.
 *
 * Dependencias de infraestructura inyectadas para facilitar testing.
 */

'use strict';

const Message = require('../../domain/entities/message');
const { MessageStatus } = require('../../domain/enums/messageStatus');
const { ValidationError } = require('../../shared/errors/AppError');
const { buildTemplatePayload } = require('../../infrastructure/whatsapp/templateBuilder');
const { sendMessage } = require('../../infrastructure/whatsapp/whatsappClient');
const logger = require('../../shared/logger');
const config = require('../../config/env');

/**
 * @typedef {Object} SendCampaignInput
 * @property {import('../../domain/entities/campaign')} campaign
 *   Entidad Campaign con los destinatarios y configuración de plantilla.
 */

/**
 * @typedef {Object} SendCampaignOutput
 * @property {string}           campaignId    - ID único de la campaña procesada.
 * @property {string}           campaignName  - Nombre de la campaña.
 * @property {number}           total         - Total de destinatarios procesados.
 * @property {number}           successful    - Envíos exitosos.
 * @property {number}           failed        - Envíos fallidos.
 * @property {Object[]}         results       - Detalle individual por destinatario.
 */

/**
 * Procesa el envío de un mensaje individual a un destinatario.
 * Valida el número, construye el payload de plantilla y llama al cliente de Meta.
 *
 * @param {import('../../domain/entities/campaign').Recipient} recipient
 *   Destinatario con número de teléfono y parámetros dinámicos opcionales.
 * @param {import('../../domain/entities/campaign')} campaign
 *   Entidad de campaña con templateName, templateLanguage y nombre.
 * @returns {Promise<Object>} Resultado del envío (phone, status, messageId?, error?).
 */
async function processSingleRecipient(recipient, campaign) {
  const { phone, params = {} } = recipient;

  // Validación E.164 antes de intentar el envío.
  if (!Message.isValidPhone(phone)) {
    const errorMsg = `Número inválido (no es E.164): ${phone}`;

    logger.warn('CAMPAIGN_SEND_FAILED', {
      status: 'FAILED',
      to: phone,
      campaign: campaign.name,
      error: errorMsg,
    });

    return { phone, status: 'failed', error: errorMsg };
  }

  try {
    const payload = buildTemplatePayload({
      to: phone,
      templateName: campaign.templateName,
      languageCode: campaign.templateLanguage || config.defaultTemplateLanguage,
      params,
    });

    const { messageId } = await sendMessage(payload);

    logger.info('CAMPAIGN_SEND', {
      status: MessageStatus.SENT,
      to: phone,
      campaign: campaign.name,
      template: campaign.templateName,
      messageId,
    });

    return { phone, status: 'sent', messageId };
  } catch (err) {
    const errorMsg = err.message || 'Error desconocido al enviar mensaje';

    logger.warn('CAMPAIGN_SEND_FAILED', {
      status: 'FAILED',
      to: phone,
      campaign: campaign.name,
      error: errorMsg,
    });

    return { phone, status: 'failed', error: errorMsg };
  }
}

/**
 * Caso de uso principal: ejecuta el envío masivo de una campaña de WhatsApp.
 *
 * Proceso:
 *  1. Valida que la campaña tenga destinatarios.
 *  2. Divide los destinatarios en lotes según MAX_CONCURRENT_SENDS.
 *  3. Procesa cada lote con Promise.allSettled() para tolerancia a fallos.
 *  4. Acumula resultados en la entidad Campaign.
 *  5. Retorna el resumen completo.
 *
 * @param {import('../../domain/entities/campaign')} campaign
 *   Entidad Campaign completamente inicializada.
 * @returns {Promise<SendCampaignOutput>} Resumen de la campaña ejecutada.
 * @throws {ValidationError} Si la campaña no tiene destinatarios.
 *
 * @example
 * const campaign = Campaign.fromRequest(req.body);
 * const summary = await sendCampaign(campaign);
 * console.log(summary.successful, summary.failed);
 */
async function sendCampaign(campaign) {
  if (!campaign.recipients || campaign.recipients.length === 0) {
    throw new ValidationError(
      'La campaña debe tener al menos un destinatario.',
      ['recipients']
    );
  }

  logger.info('CAMPAIGN_START', {
    campaign: campaign.name,
    template: campaign.templateName,
    total: campaign.totalRecipients,
  });

  const batchSize = config.maxConcurrentSends;
  const recipients = campaign.recipients;
  const batches = [];

  // Dividir en lotes para respetar el límite de concurrencia.
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }

  logger.debug('CAMPAIGN_BATCHES', {
    campaign: campaign.name,
    batches: batches.length,
    batchSize,
  });

  // Procesar cada lote de forma secuencial, con concurrencia interna por lote.
  for (const batch of batches) {
    const settledResults = await Promise.allSettled(
      batch.map((recipient) => processSingleRecipient(recipient, campaign))
    );

    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        campaign.addResult(settled.value);
      } else {
        // Promise.allSettled nunca rechaza, pero por robustez manejamos el caso.
        logger.error('CAMPAIGN_UNEXPECTED_ERROR', {
          error: settled.reason?.message || 'Error inesperado en lote',
        });
        campaign.addResult({
          phone: 'unknown',
          status: 'failed',
          error: settled.reason?.message || 'Error inesperado',
        });
      }
    }
  }

  const summary = campaign.getSummary();

  const logLevel = summary.failed > 0 ? 'warn' : 'info';
  logger[logLevel]('CAMPAIGN_COMPLETE', {
    campaign: summary.campaignName,
    total: summary.total,
    successful: summary.successful,
    failed: summary.failed,
  });

  return summary;
}

module.exports = { sendCampaign };
