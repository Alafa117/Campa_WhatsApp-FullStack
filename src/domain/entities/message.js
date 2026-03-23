/**
 * @file message.js
 * @description Entidad de dominio que representa un mensaje individual de WhatsApp
 * enviado a un destinatario específico. Encapsula el estado del ciclo de vida del
 * mensaje y su metadata asociada. Es inmutable por diseño: los cambios de estado
 * generan una nueva instancia mediante withStatus().
 *
 * Esta entidad es independiente de cualquier framework o librería externa.
 * No debe importar módulos de infraestructura.
 */

'use strict';

const { MessageStatus, isValid } = require('../enums/messageStatus');

/**
 * @typedef {Object} MessageProps
 * @property {string} id           - Identificador único del mensaje (wamid de Meta).
 * @property {string} to           - Número de teléfono destinatario en formato E.164.
 * @property {string} campaignId   - ID de la campaña a la que pertenece este mensaje.
 * @property {string} templateName - Nombre de la plantilla de Meta usada.
 * @property {string} status       - Estado actual del mensaje (valor de MessageStatus).
 * @property {Date}   sentAt       - Timestamp del momento de envío.
 * @property {Date}   [updatedAt]  - Timestamp de la última actualización de estado.
 */

/**
 * @class Message
 * @description Entidad de dominio que modela un mensaje de WhatsApp enviado
 * a un único destinatario. Pertenece a la capa de dominio y no tiene
 * dependencias de infraestructura.
 */
class Message {
  /**
   * Crea una nueva instancia de Message.
   * @param {MessageProps} props - Propiedades del mensaje.
   * @throws {Error} Si el número de teléfono no tiene formato E.164.
   * @throws {Error} Si el status no es un valor válido del enum MessageStatus.
   */
  constructor(props) {
    const {
      id,
      to,
      campaignId,
      templateName,
      status = MessageStatus.SENT,
      sentAt = new Date(),
      updatedAt,
    } = props;

    if (!Message.isValidPhone(to)) {
      throw new Error(`Número de teléfono inválido: "${to}". Se requiere formato E.164.`);
    }

    if (!isValid(status)) {
      throw new Error(`Estado inválido: "${status}". Valores válidos: ${Object.values(MessageStatus).join(', ')}`);
    }

    /** @type {string} */
    this.id = id;

    /** @type {string} */
    this.to = to;

    /** @type {string} */
    this.campaignId = campaignId;

    /** @type {string} */
    this.templateName = templateName;

    /** @type {string} */
    this.status = status;

    /** @type {Date} */
    this.sentAt = sentAt instanceof Date ? sentAt : new Date(sentAt);

    /** @type {Date|undefined} */
    this.updatedAt = updatedAt ? (updatedAt instanceof Date ? updatedAt : new Date(updatedAt)) : undefined;

    Object.freeze(this);
  }

  /**
   * Genera una nueva instancia de Message con el estado actualizado.
   * No muta la instancia actual (inmutabilidad por diseño).
   *
   * @param {string} newStatus - Nuevo estado (valor de MessageStatus).
   * @returns {Message} Nueva instancia de Message con el estado actualizado.
   * @throws {Error} Si el nuevo estado no es válido.
   */
  withStatus(newStatus) {
    return new Message({
      id: this.id,
      to: this.to,
      campaignId: this.campaignId,
      templateName: this.templateName,
      status: newStatus,
      sentAt: this.sentAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Verifica si el número de teléfono cumple el formato E.164.
   * @param {string} phone - Número de teléfono a validar.
   * @returns {boolean} true si cumple E.164, false en caso contrario.
   *
   * @example
   * Message.isValidPhone('+573001234567'); // → true
   * Message.isValidPhone('3001234567');    // → false
   */
  static isValidPhone(phone) {
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }

  /**
   * Crea una instancia de Message a partir de un resultado exitoso de la API de Meta.
   *
   * @param {Object} params
   * @param {string} params.messageId    - wamid devuelto por la API de Meta.
   * @param {string} params.to           - Número destinatario en formato E.164.
   * @param {string} params.campaignId   - ID de la campaña.
   * @param {string} params.templateName - Nombre de la plantilla.
   * @returns {Message} Nueva instancia de Message con estado SENT.
   */
  static createSent({ messageId, to, campaignId, templateName }) {
    return new Message({
      id: messageId,
      to,
      campaignId,
      templateName,
      status: MessageStatus.SENT,
      sentAt: new Date(),
    });
  }

  /**
   * Serializa la entidad a un objeto plano para logging o respuestas HTTP.
   * @returns {MessageProps} Representación plana de la entidad.
   */
  toJSON() {
    return {
      id: this.id,
      to: this.to,
      campaignId: this.campaignId,
      templateName: this.templateName,
      status: this.status,
      sentAt: this.sentAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Message;
