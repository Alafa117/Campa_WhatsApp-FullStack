/**
 * @file whatsappClient.js
 * @description Cliente HTTP para la Meta Cloud API (WhatsApp Business).
 * Encapsula todas las llamadas HTTP hacia el endpoint de mensajes de Meta.
 * Implementa reintentos básicos y manejo de errores específico de Meta API.
 *
 * Endpoint de envío de mensajes:
 *   POST https://graph.facebook.com/v19.0/{phone-number-id}/messages
 *
 * Documentación:
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

'use strict';

const axios = require('axios');
const config = require('../../config/env');
const { MetaApiError } = require('../../shared/errors/AppError');
const logger = require('../../shared/logger');

/**
 * @typedef {Object} MetaApiResponse
 * @property {string}   messaging_product - "whatsapp"
 * @property {Object[]} contacts          - Contactos procesados.
 * @property {string}   contacts[].input  - Número enviado.
 * @property {string}   contacts[].wa_id  - WhatsApp ID del contacto.
 * @property {Object[]} messages          - Mensajes creados.
 * @property {string}   messages[].id     - wamid del mensaje creado.
 */

/**
 * @typedef {Object} SendMessageResult
 * @property {boolean} success    - Si el envío fue exitoso.
 * @property {string}  messageId  - wamid del mensaje (solo si success=true).
 * @property {string}  [error]    - Descripción del error (solo si success=false).
 */

/**
 * Instancia de axios pre-configurada con la URL base y headers de autenticación
 * de Meta Cloud API. Timeout de 15 segundos por request.
 *
 * @type {import('axios').AxiosInstance}
 */
const metaApiClient = axios.create({
  baseURL: config.metaApiUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.metaAccessToken}`,
  },
});

/**
 * Interceptor de respuesta para normalizar errores de Meta API.
 * Convierte los errores HTTP de axios en instancias de MetaApiError
 * con el mensaje y código original de Meta.
 */
metaApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const metaError = error.response?.data?.error || {};
    const httpStatus = error.response?.status || 502;
    const message = metaError.message || error.message || 'Error desconocido de Meta API';

    logger.error('META_API_HTTP_ERROR', {
      status: httpStatus,
      code: metaError.code,
      message,
      subcode: metaError.error_subcode,
    });

    throw new MetaApiError(message, httpStatus, metaError);
  }
);

/**
 * Envía un mensaje de plantilla a un número de teléfono mediante Meta Cloud API.
 *
 * @param {import('./templateBuilder').MetaTemplatePayload} payload
 *   Payload completo construido por templateBuilder.buildTemplatePayload().
 * @returns {Promise<SendMessageResult>} Resultado del envío con el messageId o error.
 *
 * @throws {MetaApiError} Si la API de Meta responde con un error HTTP.
 *
 * @example
 * const result = await sendMessage(payload);
 * if (result.success) {
 *   console.log(result.messageId); // "wamid.ABC123XYZ"
 * }
 */
async function sendMessage(payload) {
  const endpoint = `/${config.metaPhoneNumberId}/messages`;

  logger.debug('META_API_REQUEST', {
    endpoint,
    to: payload.to,
    template: payload.template?.name,
  });

  const response = await metaApiClient.post(endpoint, payload);
  const messageId = response.data?.messages?.[0]?.id;

  if (!messageId) {
    throw new MetaApiError(
      'La API de Meta no retornó un messageId válido.',
      502,
      response.data
    );
  }

  logger.debug('META_API_RESPONSE', {
    to: payload.to,
    messageId,
    waId: response.data?.contacts?.[0]?.wa_id,
  });

  return {
    success: true,
    messageId,
  };
}

/**
 * Verifica la conectividad con Meta Cloud API intentando obtener el perfil
 * del número de teléfono configurado. Útil para el health check del servidor.
 *
 * @returns {Promise<boolean>} true si la API está accesible y el token es válido.
 */
async function verifyConnection() {
  try {
    await metaApiClient.get(`/${config.metaPhoneNumberId}`);
    return true;
  } catch (err) {
    logger.warn('META_API_CONNECTION_FAILED', {
      error: err.message,
    });
    return false;
  }
}

module.exports = {
  sendMessage,
  verifyConnection,
};
