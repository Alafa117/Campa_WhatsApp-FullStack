/**
 * @file AppError.js
 * @description Jerarquía de clases de error personalizadas de la aplicación.
 * Permite distinguir errores operacionales (esperados, manejables) de errores
 * de programación (bugs) en el middleware de error centralizado.
 *
 * Clases exportadas:
 *  - AppError      → Error base de la aplicación
 *  - MetaApiError  → Errores de la API de Meta Cloud (HTTP 4xx/5xx)
 *  - WebhookError  → Errores durante el procesamiento de webhooks de Meta
 *  - ValidationError → Errores de validación de entrada del usuario
 */

'use strict';

/**
 * @class AppError
 * @extends Error
 * @description Error base de la aplicación. Todos los errores operacionales
 * heredan de esta clase. El middleware de error centralizado usa `isOperational`
 * para decidir si exponer el mensaje al cliente o loguear como bug crítico.
 */
class AppError extends Error {
  /**
   * @param {string} message    - Mensaje descriptivo del error.
   * @param {number} statusCode - Código HTTP asociado (ej: 400, 404, 500).
   * @param {string} [code]     - Código de error interno (ej: "INVALID_PHONE").
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);

    /** @type {string} Nombre de la clase para instanceof checks. */
    this.name = this.constructor.name;

    /** @type {number} Código HTTP de la respuesta. */
    this.statusCode = statusCode;

    /** @type {string} Código de error interno legible por máquina. */
    this.code = code;

    /**
     * @type {boolean}
     * true  = error operacional (se puede exponer al cliente)
     * false = bug de programación (solo loguear internamente)
     */
    this.isOperational = true;

    // Captura el stack trace excluyendo el constructor de la jerarquía de errores.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializa el error a un objeto plano para respuestas HTTP.
   * No incluye el stack trace en producción.
   *
   * @param {boolean} [includeStack=false] - Si incluir el stack trace.
   * @returns {Object} Representación segura del error para el cliente.
   */
  toJSON(includeStack = false) {
    const payload = {
      error: {
        code: this.code,
        message: this.message,
      },
    };

    if (includeStack && this.stack) {
      payload.error.stack = this.stack;
    }

    return payload;
  }
}

/**
 * @class MetaApiError
 * @extends AppError
 * @description Error producido al comunicarse con la API de Meta Cloud.
 * Encapsula el código de error y el mensaje original devuelto por Meta.
 */
class MetaApiError extends AppError {
  /**
   * @param {string} message          - Mensaje descriptivo del error.
   * @param {number} [httpStatus=502] - Código HTTP retornado por Meta.
   * @param {Object} [metaError]      - Objeto de error original de Meta API.
   * @param {number} [metaError.code]         - Código de error de Meta.
   * @param {string} [metaError.message]      - Mensaje de Meta.
   * @param {string} [metaError.error_subcode]- Subcódigo de error de Meta.
   */
  constructor(message, httpStatus = 502, metaError = {}) {
    super(message, httpStatus, 'META_API_ERROR');

    /** @type {Object} Datos originales del error retornado por Meta. */
    this.metaError = metaError;
  }
}

/**
 * @class WebhookError
 * @extends AppError
 * @description Error producido durante el procesamiento de un webhook de Meta.
 * Se distingue del AppError base para que el handler del webhook sepa
 * que debe responder 200 a Meta incluso cuando ocurre este error.
 */
class WebhookError extends AppError {
  /**
   * @param {string} message  - Mensaje descriptivo del error de webhook.
   * @param {Object} [payload]- Payload del webhook que causó el error (para debug).
   */
  constructor(message, payload = null) {
    // Siempre HTTP 200 internamente: Meta debe recibir 200 para no reintentar.
    super(message, 200, 'WEBHOOK_PROCESSING_ERROR');

    /** @type {Object|null} Payload original que produjo el error. */
    this.webhookPayload = payload;
  }
}

/**
 * @class ValidationError
 * @extends AppError
 * @description Error de validación de datos de entrada del usuario.
 * Producido típicamente por validación de parámetros de request HTTP.
 */
class ValidationError extends AppError {
  /**
   * @param {string}   message  - Mensaje descriptivo del error de validación.
   * @param {string[]} [fields] - Lista de campos que fallaron la validación.
   */
  constructor(message, fields = []) {
    super(message, 400, 'VALIDATION_ERROR');

    /** @type {string[]} Campos que no pasaron validación. */
    this.fields = fields;
  }

  /**
   * @override
   * Incluye los campos inválidos en la serialización JSON.
   * @param {boolean} [includeStack=false]
   * @returns {Object}
   */
  toJSON(includeStack = false) {
    const base = super.toJSON(includeStack);
    if (this.fields.length > 0) {
      base.error.fields = this.fields;
    }
    return base;
  }
}

module.exports = {
  AppError,
  MetaApiError,
  WebhookError,
  ValidationError,
};
