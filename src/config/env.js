/**
 * @file env.js
 * @description Carga, valida y exporta las variables de entorno requeridas por
 * la aplicación. La validación ocurre en el arranque con Joi: si falta alguna
 * variable obligatoria o el formato es inválido, el proceso termina con un error
 * descriptivo antes de iniciar cualquier servidor o conexión.
 *
 * Las variables se leen desde el archivo .env mediante dotenv y se validan
 * con un schema Joi estricto. Exporta un objeto inmutable con los valores ya
 * coercionados a sus tipos correctos.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const Joi = require('joi');

/**
 * Objeto de variables de entorno raw tal como las entrega Joi tras validar process.env.
 * Las claves son UPPERCASE (igual que en .env) y los valores ya están coercionados.
 * @typedef {Object} RawEnvVars
 * @property {number}  PORT                    - Puerto del servidor.
 * @property {string}  NODE_ENV                - Entorno de ejecución.
 * @property {string}  META_API_URL            - URL base de Meta Graph API.
 * @property {string}  META_PHONE_NUMBER_ID    - ID del número de teléfono.
 * @property {string}  META_ACCESS_TOKEN       - Token de acceso a Meta Cloud API.
 * @property {string}  META_WEBHOOK_VERIFY_TOKEN - Token de verificación del webhook.
 * @property {string}  [META_WABA_ID]          - ID de la cuenta WABA (opcional).
 * @property {string}  DEFAULT_TEMPLATE_LANGUAGE - Código de idioma por defecto.
 * @property {number}  MAX_CONCURRENT_SENDS    - Máximo de envíos en paralelo.
 */

/**
 * Objeto de configuración de la aplicación con claves en camelCase.
 * Exportado como resultado de mapear las RawEnvVars a nombres legibles.
 * @typedef {Object} AppConfig
 * @property {number}  port                    - Puerto en el que escucha el servidor HTTP.
 * @property {string}  nodeEnv                 - Entorno de ejecución (development|production|test).
 * @property {boolean} isProduction            - true si NODE_ENV === 'production'.
 * @property {boolean} isDevelopment           - true si NODE_ENV === 'development'.
 * @property {string}  metaApiUrl              - URL base de la Meta Graph API.
 * @property {string}  metaPhoneNumberId       - ID del número de teléfono de Meta Business.
 * @property {string}  metaAccessToken         - Token permanente de acceso a Meta Cloud API.
 * @property {string}  metaWebhookVerifyToken  - Token secreto para verificar el webhook de Meta.
 * @property {string}  [metaWabaId]            - ID de la cuenta WhatsApp Business (WABA).
 * @property {string}  defaultTemplateLanguage - Código de idioma/región por defecto (ej: "es_CO").
 * @property {number}  maxConcurrentSends      - Máximo de envíos en paralelo por campaña.
 */

/**
 * Schema Joi para la validación estricta de variables de entorno.
 * - `unknown()` permite variables no declaradas sin error.
 * - `abortEarly: false` recopila todos los errores antes de fallar.
 * @type {import('joi').ObjectSchema}
 */
const envSchema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).default(3000)
    .description('Puerto del servidor HTTP'),

  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development')
    .description('Entorno de ejecución'),

  META_API_URL: Joi.string().uri().default('https://graph.facebook.com/v19.0')
    .description('URL base de Meta Graph API. Por defecto v19.0'),

  META_PHONE_NUMBER_ID: Joi.string().min(1).required()
    .description('ID del número de teléfono registrado en Meta Business'),

  META_ACCESS_TOKEN: Joi.string().min(10).required()
    .description('Token de acceso permanente a Meta Cloud API'),

  META_WEBHOOK_VERIFY_TOKEN: Joi.string().min(6).required()
    .description('Token secreto para verificar el webhook de Meta'),

  META_WABA_ID: Joi.string().min(1).optional()
    .description('ID de la cuenta de WhatsApp Business (WABA)'),

  DEFAULT_TEMPLATE_LANGUAGE: Joi.string().default('es_CO')
    .description('Código de idioma/región por defecto para plantillas'),

  MAX_CONCURRENT_SENDS: Joi.number().integer().min(1).max(500).default(50)
    .description('Máximo de envíos simultáneos por campaña'),
}).unknown();

/**
 * Valida las variables de entorno actuales contra el schema Joi.
 * Termina el proceso con código 1 si la validación falla.
 *
 * @throws {Error} Si alguna variable requerida falta o tiene formato incorrecto.
 * @returns {{ error: import('joi').ValidationError|undefined, value: RawEnvVars }}
 */
const { error, value: envVars } = envSchema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
});

if (error) {
  const details = error.details.map((d) => `  • ${d.message}`).join('\n');
  console.error(`\n[CONFIG] Error en variables de entorno:\n${details}\n`);
  process.exit(1);
}

/**
 * Objeto de configuración inmutable de la aplicación.
 * Exportado como Object.freeze para prevenir mutaciones accidentales en runtime.
 * @type {AppConfig}
 */
const config = Object.freeze({
  port: envVars.PORT,
  nodeEnv: envVars.NODE_ENV,
  isProduction: envVars.NODE_ENV === 'production',
  isDevelopment: envVars.NODE_ENV === 'development',

  metaApiUrl: envVars.META_API_URL,
  metaPhoneNumberId: envVars.META_PHONE_NUMBER_ID,
  metaAccessToken: envVars.META_ACCESS_TOKEN,
  metaWebhookVerifyToken: envVars.META_WEBHOOK_VERIFY_TOKEN,
  metaWabaId: envVars.META_WABA_ID || null,

  defaultTemplateLanguage: envVars.DEFAULT_TEMPLATE_LANGUAGE,
  maxConcurrentSends: envVars.MAX_CONCURRENT_SENDS,
});

module.exports = config;
