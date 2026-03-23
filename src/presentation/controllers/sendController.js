'use strict';

/**
 * @file sendController.js
 * @description Controlador para envío de mensajes de texto individuales.
 *
 * POST /send/text → Enviar un mensaje de texto a un número de WhatsApp.
 */

const { sendTextMessage } = require('../../infrastructure/whatsapp/whatsappClient');
const { ValidationError } = require('../../shared/errors/AppError');
const Message = require('../../domain/entities/message');

/**
 * POST /send/text
 * Envía un mensaje de texto individual a un número de WhatsApp.
 *
 * Body esperado:
 * {
 *   "to": "+573001234567",
 *   "message": "Hola, este es un mensaje de prueba"
 * }
 */
async function sendText(req, res, next) {
  try {
    const { to, message } = req.body;

    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new ValidationError('El campo "to" es obligatorio y debe ser un string no vacío.', ['to']);
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw new ValidationError('El campo "message" es obligatorio y debe ser un string no vacío.', ['message']);
    }

    if (!Message.isValidPhone(to)) {
      throw new ValidationError(`El número "${to}" no tiene formato E.164 válido (ej: +573001234567).`, ['to']);
    }

    const result = await sendTextMessage(to.trim(), message.trim());

    res.status(200).json({
      success: true,
      data: {
        to: to.trim(),
        messageId: result.messageId,
        status: 'sent',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendText };
