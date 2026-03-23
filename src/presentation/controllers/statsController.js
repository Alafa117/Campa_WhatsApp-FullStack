'use strict';

/**
 * @file statsController.js
 * @description Controlador para consulta de estadísticas de mensajes.
 *
 * GET /campaign/stats → Retorna conteos de sent, delivered y read
 *                       acumulados desde el inicio del servidor.
 */

const { getStats } = require('../../shared/statsStore');

/**
 * GET /campaign/stats
 * Retorna estadísticas acumuladas de mensajes desde el webhook de Meta.
 */
function getCampaignStats(req, res) {
  const stats = getStats();
  res.status(200).json({
    success: true,
    data: {
      sent: stats.sent,
      delivered: stats.delivered,
      read: stats.read,
    },
  });
}

module.exports = { getCampaignStats };
