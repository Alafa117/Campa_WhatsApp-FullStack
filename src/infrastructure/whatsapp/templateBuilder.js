/**
 * @file templateBuilder.js
 * @description Builder de payloads de plantillas de Meta Cloud API.
 * Construye el objeto JSON correcto para enviar mensajes de tipo "template"
 * a la API de WhatsApp Business. Extensible para nuevas plantillas sin
 * modificar la lógica de negocio.
 *
 * Referencia Meta API:
 *   POST /{phone-number-id}/messages
 *   type: "template"
 */

'use strict';

/**
 * @typedef {Object} TemplateParameter
 * @property {string} type  - Tipo del parámetro: "text" | "image" | "document".
 * @property {string} text  - Valor del parámetro (para type "text").
 */

/**
 * @typedef {Object} TemplateComponent
 * @property {string}              type        - "header" | "body" | "button".
 * @property {string}              [sub_type]  - Para botones: "quick_reply" | "url".
 * @property {string}              [index]     - Índice del botón (0-based, string).
 * @property {TemplateParameter[]} parameters  - Parámetros dinámicos del componente.
 */

/**
 * @typedef {Object} MetaTemplatePayload
 * @property {string}            messaging_product - Siempre "whatsapp".
 * @property {string}            to                - Número E.164 del destinatario.
 * @property {string}            type              - Siempre "template".
 * @property {Object}            template          - Objeto de plantilla.
 * @property {string}            template.name     - Nombre aprobado en Meta.
 * @property {Object}            template.language - Objeto de idioma.
 * @property {string}            template.language.code - Código de idioma (ej: "es_CO").
 * @property {TemplateComponent[]} template.components - Componentes con parámetros.
 */

/**
 * @typedef {Object} TemplateParams
 * @property {Object}   [header]             - Parámetros del componente header.
 * @property {string[]} [header.texts]       - Valores de texto para el header.
 * @property {Object}   [body]               - Parámetros del componente body.
 * @property {string[]} [body.texts]         - Valores de texto para el body (en orden).
 * @property {Object[]} [buttons]            - Parámetros de botones.
 * @property {string}   [buttons[].subType]  - "quick_reply" | "url".
 * @property {string}   [buttons[].index]    - Índice del botón como string.
 * @property {string}   [buttons[].payload]  - Payload del botón quick_reply.
 * @property {string}   [buttons[].text]     - Texto del botón url.
 */

/**
 * Construye un array de TemplateParameter de tipo "text" a partir de strings.
 *
 * @param {string[]} texts - Array de valores de texto.
 * @returns {TemplateParameter[]} Array de parámetros con type "text".
 */
function buildTextParameters(texts) {
  return texts.map((text) => ({ type: 'text', text }));
}

/**
 * Construye el componente "header" si se proveen parámetros de header.
 *
 * @param {Object}   [header]       - Configuración del header.
 * @param {string[]} [header.texts] - Textos dinámicos del header.
 * @returns {TemplateComponent|null} Componente header o null si no aplica.
 */
function buildHeaderComponent(header) {
  if (!header || !Array.isArray(header.texts) || header.texts.length === 0) {
    return null;
  }

  return {
    type: 'header',
    parameters: buildTextParameters(header.texts),
  };
}

/**
 * Construye el componente "body" con los parámetros dinámicos del cuerpo.
 *
 * @param {Object}   [body]       - Configuración del body.
 * @param {string[]} [body.texts] - Textos dinámicos del body ({{1}}, {{2}}, ...).
 * @returns {TemplateComponent|null} Componente body o null si no hay parámetros.
 */
function buildBodyComponent(body) {
  if (!body || !Array.isArray(body.texts) || body.texts.length === 0) {
    return null;
  }

  return {
    type: 'body',
    parameters: buildTextParameters(body.texts),
  };
}

/**
 * Construye los componentes "button" para plantillas con botones interactivos.
 *
 * @param {Array}  [buttons]              - Configuración de botones.
 * @param {string} buttons[].subType      - "quick_reply" | "url".
 * @param {string} buttons[].index        - Índice del botón (string, 0-based).
 * @param {string} [buttons[].payload]    - Payload del quick_reply.
 * @param {string} [buttons[].text]       - Texto del botón url.
 * @returns {TemplateComponent[]} Array de componentes de tipo "button".
 */
function buildButtonComponents(buttons) {
  if (!Array.isArray(buttons) || buttons.length === 0) {
    return [];
  }

  return buttons.map((btn) => {
    const parameters = btn.subType === 'quick_reply'
      ? [{ type: 'payload', payload: btn.payload }]
      : [{ type: 'text', text: btn.text }];

    return {
      type: 'button',
      sub_type: btn.subType,
      index: String(btn.index),
      parameters,
    };
  });
}

/**
 * Construye el payload completo para el endpoint de mensajes de Meta Cloud API.
 * Filtra los componentes nulos y vacíos antes de incluirlos en el payload.
 *
 * @param {Object}         options                  - Opciones del builder.
 * @param {string}         options.to               - Número E.164 del destinatario.
 * @param {string}         options.templateName     - Nombre de la plantilla aprobada en Meta.
 * @param {string}         options.languageCode     - Código de idioma/región (ej: "es_CO").
 * @param {TemplateParams} [options.params]         - Parámetros dinámicos para la plantilla.
 * @returns {MetaTemplatePayload} Payload listo para enviar a la API de Meta.
 *
 * @example
 * const payload = buildTemplatePayload({
 *   to: '+573001234567',
 *   templateName: 'promo_black_friday',
 *   languageCode: 'es_CO',
 *   params: {
 *     body: { texts: ['Juan', '20%', '2025-11-29'] },
 *     buttons: [{ subType: 'quick_reply', index: '0', payload: 'ACEPTO_PROMO' }]
 *   }
 * });
 */
function buildTemplatePayload({ to, templateName, languageCode, params = {} }) {
  const components = [
    buildHeaderComponent(params.header),
    buildBodyComponent(params.body),
    ...buildButtonComponents(params.buttons),
  ].filter(Boolean); // Elimina null/undefined

  const templatePayload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  // Solo incluir "components" si hay al menos uno con parámetros.
  if (components.length > 0) {
    templatePayload.template.components = components;
  }

  return templatePayload;
}

module.exports = {
  buildTemplatePayload,
  buildHeaderComponent,
  buildBodyComponent,
  buildButtonComponents,
  buildTextParameters,
};
