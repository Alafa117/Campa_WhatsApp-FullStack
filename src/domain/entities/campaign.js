/**
 * @file campaign.js
 * @description Entidad de dominio que representa una campaña de mensajería masiva
 * de WhatsApp. Agrupa todos los destinatarios, la plantilla a usar y el resumen
 * de resultados (successful, failed). Es la unidad de trabajo principal del sistema.
 *
 * Esta entidad no tiene dependencias de infraestructura ni de frameworks externos.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {Object} Recipient
 * @property {string}  phone      - Número de teléfono en formato E.164.
 * @property {Object}  [params]   - Parámetros dinámicos para la plantilla (opcional).
 */

/**
 * @typedef {Object} CampaignResult
 * @property {string}  phone       - Número de teléfono del destinatario.
 * @property {string}  status      - 'sent' | 'failed'.
 * @property {string}  [messageId] - ID del mensaje si el envío fue exitoso.
 * @property {string}  [error]     - Descripción del error si el envío falló.
 */

/**
 * @typedef {Object} CampaignSummary
 * @property {string}           campaignId    - ID único de la campaña.
 * @property {string}           campaignName  - Nombre descriptivo de la campaña.
 * @property {number}           total         - Total de destinatarios procesados.
 * @property {number}           successful    - Cantidad de envíos exitosos.
 * @property {number}           failed        - Cantidad de envíos fallidos.
 * @property {CampaignResult[]} results       - Detalle individual de cada envío.
 */

/**
 * @typedef {Object} CampaignProps
 * @property {string}      [id]              - ID único. Si no se provee, se genera con uuid.
 * @property {string}      name              - Nombre descriptivo de la campaña.
 * @property {string}      templateName      - Nombre de la plantilla aprobada en Meta.
 * @property {string}      [templateLanguage]- Código de idioma/región (ej: "es_CO").
 * @property {Recipient[]} recipients        - Lista de destinatarios con sus parámetros.
 * @property {Date}        [createdAt]       - Fecha de creación (por defecto: ahora).
 */

/**
 * @class Campaign
 * @description Entidad de dominio que representa una campaña de mensajería masiva.
 * Gestiona la lista de destinatarios y acumula el resumen de resultados de envío.
 */
class Campaign {
  /**
   * Crea una nueva instancia de Campaign.
   * @param {CampaignProps} props - Propiedades de la campaña.
   * @throws {Error} Si no se proveen destinatarios.
   * @throws {Error} Si el nombre o la plantilla están vacíos.
   */
  constructor(props) {
    const {
      id = uuidv4(),
      name,
      templateName,
      templateLanguage = 'es_CO',
      recipients = [],
      createdAt = new Date(),
    } = props;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('El nombre de la campaña es obligatorio.');
    }

    if (!templateName || typeof templateName !== 'string' || templateName.trim() === '') {
      throw new Error('El nombre de la plantilla (templateName) es obligatorio.');
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('La campaña debe tener al menos un destinatario.');
    }

    /** @type {string} */
    this.id = id;

    /** @type {string} */
    this.name = name.trim();

    /** @type {string} */
    this.templateName = templateName.trim();

    /** @type {string} */
    this.templateLanguage = templateLanguage;

    /** @type {Recipient[]} */
    this.recipients = recipients;

    /** @type {Date} */
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);

    /** @type {CampaignResult[]} Resultados acumulados de los envíos. */
    this._results = [];
  }

  /**
   * Registra el resultado de un envío individual dentro de la campaña.
   * @param {CampaignResult} result - Resultado del envío para un destinatario.
   */
  addResult(result) {
    this._results.push(result);
  }

  /**
   * Retorna el resumen completo de la campaña con métricas de éxito y fallo.
   * @returns {CampaignSummary} Objeto con totales y detalle por destinatario.
   */
  getSummary() {
    const successful = this._results.filter((r) => r.status === 'sent').length;
    const failed = this._results.filter((r) => r.status === 'failed').length;

    return {
      campaignId: this.id,
      campaignName: this.name,
      total: this._results.length,
      successful,
      failed,
      results: [...this._results],
    };
  }

  /**
   * Total de destinatarios registrados en la campaña.
   * @returns {number} Cantidad de destinatarios.
   */
  get totalRecipients() {
    return this.recipients.length;
  }

  /**
   * Crea una instancia de Campaign desde un objeto de request HTTP.
   * Convierte el array de phones simples al formato Recipient esperado.
   *
   * @param {Object}   payload                    - Cuerpo del request HTTP.
   * @param {string}   payload.campaignName       - Nombre de la campaña.
   * @param {string}   payload.templateName       - Nombre de la plantilla.
   * @param {string}   [payload.templateLanguage] - Código de idioma.
   * @param {string[]|Recipient[]} payload.recipients - Números o destinatarios.
   * @returns {Campaign} Nueva instancia de Campaign.
   */
  static fromRequest(payload) {
    const { campaignName, templateName, templateLanguage, recipients } = payload;

    const normalizedRecipients = recipients.map((r) => {
      if (typeof r === 'string') {
        return { phone: r };
      }
      return r;
    });

    return new Campaign({
      name: campaignName,
      templateName,
      templateLanguage,
      recipients: normalizedRecipients,
    });
  }
}

module.exports = Campaign;
