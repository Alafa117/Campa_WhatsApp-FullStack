'use strict';

/**
 * @file index.js
 * @description Definición y composición de todas las rutas de la aplicación Express.
 *
 * Rutas expuestas:
 *   GET    /health                     → Health check del servidor
 *   GET    /templates                  → Listar todas las plantillas de Meta Business
 *   GET    /templates/:name            → Ver plantilla específica de Meta Business
 *   GET    /campaign/stats             → Estadísticas de mensajes (sent, delivered, read)
 *   POST   /send/text                  → Enviar mensaje de texto individual
 *   GET    /webhook                    → Verificación del webhook de Meta
 *   POST   /webhook                    → Recepción de actualizaciones de estado de Meta
 */

const { Router } = require('express');
const { listTemplates, getTemplateByName } = require('../controllers/templateController');
const { getCampaignStats } = require('../controllers/statsController');
const { sendText } = require('../controllers/sendController');
const { sendTemplate } = require('../controllers/sendTemplateController');
const { verifyWebhook, receiveStatusUpdate } = require('../webhooks/whatsappWebhook');

function createRouter() {
  const router = Router();

  // GET /health
  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /templates
  router.get('/templates', listTemplates);

  // GET /templates/:name
  router.get('/templates/:name', getTemplateByName);

  // GET /campaign/stats
  router.get('/campaign/stats', getCampaignStats);

  // POST /send/text
  router.post('/send/text', sendText);

  // POST /send/template
  router.post('/send/template', sendTemplate);

  // GET /webhook  (verificación Meta)
  router.get('/webhook', verifyWebhook);

  // POST /webhook (actualizaciones de estado Meta)
  router.post('/webhook', receiveStatusUpdate);

  return router;
}

module.exports = createRouter;
