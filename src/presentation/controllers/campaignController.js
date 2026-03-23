/**
 * @file campaignController.js
 * @description Controller de campañas de WhatsApp. Recibe los requests HTTP,
 * valida la entrada, delega al caso de uso sendCampaign y formatea la respuesta.
 *
 * Responsabilidades:
 *  - Parsear y validar el body del request (sin lógica de negocio).
 *  - Construir la entidad Campaign desde el payload del request.
 *  - Llamar al caso de uso sendCampaign.
 *  - Retornar la respuesta HTTP con el resumen de la campaña.
 *  - Propagar errores al middleware centralizado mediante next(err).
 *
 * No debe contener lógica de negocio ni acceder directamente a la infraestructura.
 */

'use strict';

const Campaign = require('../../domain/entities/campaign');
const { sendCampaign } = require('../../application/usecases/sendCampaign');
const { ValidationError } = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');
const Message = require('../../domain/entities/message');

/**
 * @typedef {Object} SendCampaignRequestBody
 * @property {string}            campaignName       - Nombre de la campaña.
 * @property {string}            templateName       - Nombre de la plantilla de Meta.
 * @property {string}            [templateLanguage] - Código de idioma (ej: "es_CO").
 * @property {string[]|Object[]} recipients         - Números E.164 o array de objetos {phone, params}.
 */

/**
 * Valida que el body del request tenga los campos obligatorios y formatos correctos.
 *
 * @param {SendCampaignRequestBody} body - Cuerpo del request HTTP.
 * @throws {ValidationError} Si falta algún campo obligatorio o hay números inválidos.
 */
function validateRequestBody(body) {
  const errors = [];

  if (!body.campaignName || typeof body.campaignName !== 'string' || body.campaignName.trim() === '') {
    errors.push('campaignName es obligatorio y debe ser un string no vacío');
  }

  if (!body.templateName || typeof body.templateName !== 'string' || body.templateName.trim() === '') {
    errors.push('templateName es obligatorio y debe ser un string no vacío');
  }

  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    errors.push('recipients debe ser un array no vacío');
  } else {
    // Validar que todos los recipients tengan un número de teléfono.
    body.recipients.forEach((r, idx) => {
      const phone = typeof r === 'string' ? r : r?.phone;
      if (!phone || typeof phone !== 'string' || phone.trim() === '') {
        errors.push(`recipients[${idx}]: el campo phone es obligatorio`);
      }
    });
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Validación fallida: ${errors.join('; ')}`,
      errors
    );
  }
}

/**
 * Calcula métricas de cobertura de números válidos para loguear una advertencia
 * si más del 20% de los números no pasan validación E.164.
 *
 * @param {Array} recipients - Array de destinatarios del request.
 */
function warnIfManyInvalidPhones(recipients) {
  const phones = recipients.map((r) => (typeof r === 'string' ? r : r?.phone));
  const invalid = phones.filter((p) => p && !Message.isValidPhone(p));

  if (invalid.length > 0 && invalid.length / phones.length > 0.2) {
    logger.warn('CAMPAIGN_HIGH_INVALID_RATE', {
      total: phones.length,
      invalid: invalid.length,
      rate: `${Math.round((invalid.length / phones.length) * 100)}%`,
    });
  }
}

/**
 * Handler POST /api/campaigns
 * Ejecuta el envío masivo de una campaña de WhatsApp.
 *
 * Request body esperado (application/json):
 * ```json
 * {
 *   "campaignName": "Black Friday 2025",
 *   "templateName": "promo_black_friday",
 *   "templateLanguage": "es_CO",
 *   "recipients": [
 *     "+573001234567",
 *     { "phone": "+573009999999", "params": { "body": { "texts": ["Juan", "20%"] } } }
 *   ]
 * }
 * ```
 *
 * @param {import('express').Request} req   - Request de Express.
 * @param {import('express').Response} res  - Response de Express.
 * @param {import('express').NextFunction} next - Función next para propagación de errores.
 * @returns {Promise<void>}
 */
async function sendCampaignHandler(req, res, next) {
  try {
    const body = req.body;

    validateRequestBody(body);
    warnIfManyInvalidPhones(body.recipients);

    const campaign = Campaign.fromRequest(body);
    const summary = await sendCampaign(campaign);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handler GET /api/campaigns/health
 * Verifica que el servicio de campañas esté disponible.
 *
 * @param {import('express').Request} req   - Request de Express.
 * @param {import('express').Response} res  - Response de Express.
 */
function healthCheck(req, res) {
  res.status(200).json({
    success: true,
    service: 'campaigns',
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  sendCampaignHandler,
  healthCheck,
};
