'use strict';

/**
 * @file sendTemplateController.js
 * @description Controlador para envío de mensajes de plantilla individuales.
 *
 * POST /send/template → Enviar un mensaje de plantilla a un número de WhatsApp.
 *
 * Soporta plantillas con:
 *  - Header de imagen (imageUrl)
 *  - Header de texto (texts[])
 *  - Body con variables (texts[])
 *  - Botones (quick_reply / url)
 */

const { sendMessage } = require('../../infrastructure/whatsapp/whatsappClient');
const { buildTemplatePayload } = require('../../infrastructure/whatsapp/templateBuilder');
const { ValidationError } = require('../../shared/errors/AppError');
const Message = require('../../domain/entities/message');
const config = require('../../config/env');

/**
 * POST /send/template
 *
 * Body esperado:
 * {
 *   "to": "+573001234567",
 *   "templateName": "nombre_plantilla",
 *   "templateLanguage": "es_CO",          // opcional, usa DEFAULT_TEMPLATE_LANGUAGE
 *   "params": {
 *     "header": {
 *       "type": "image",
 *       "imageUrl": "https://..."
 *     },
 *     "body": {
 *       "texts": ["valor para {{1}}", "valor para {{2}}"]
 *     }
 *   }
 * }
 */
async function sendTemplate(req, res, next) {
  try {
    const { to, templateName, templateLanguage, params } = req.body;

    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new ValidationError('El campo "to" es obligatorio.', ['to']);
    }

    if (!templateName || typeof templateName !== 'string' || templateName.trim() === '') {
      throw new ValidationError('El campo "templateName" es obligatorio.', ['templateName']);
    }

    if (!Message.isValidPhone(to)) {
      throw new ValidationError(`El número "${to}" no tiene formato E.164 válido (ej: +573001234567).`, ['to']);
    }

    const payload = buildTemplatePayload({
      to: to.trim(),
      templateName: templateName.trim(),
      languageCode: templateLanguage || config.defaultTemplateLanguage,
      params: params || {},
    });

    const result = await sendMessage(payload);

    res.status(200).json({
      success: true,
      data: {
        to: to.trim(),
        templateName: templateName.trim(),
        messageId: result.messageId,
        status: 'sent',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendTemplate };
