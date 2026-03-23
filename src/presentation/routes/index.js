/**
 * @file index.js
 * @description Definición y composición de todas las rutas de la aplicación Express.
 * Centraliza el montaje de routers para campaigns y webhooks, evitando
 * que app.js tenga conocimiento directo de las rutas individuales.
 *
 * Rutas expuestas:
 *   POST   /api/campaigns          → Envío masivo de campaña de WhatsApp
 *   GET    /api/campaigns/health   → Health check del servicio de campañas
 *   GET    /webhook                → Verificación inicial del webhook de Meta
 *   POST   /webhook                → Recepción de actualizaciones de estado de Meta
 *   GET    /health                 → Health check global de la aplicación
 */

'use strict';

const { Router } = require('express');
const { sendCampaignHandler, healthCheck } = require('../controllers/campaignController');
const { verifyWebhook, receiveStatusUpdate } = require('../webhooks/whatsappWebhook');

/**
 * Router de campañas. Prefijo de montaje: /api/campaigns
 * @type {import('express').Router}
 */
const campaignRouter = Router();

/**
 * GET /api/campaigns/health
 * Verifica que el servicio de campañas esté operativo.
 *
 * @returns {200} { success: true, service: "campaigns", timestamp: "ISO" }
 */
campaignRouter.get('/health', healthCheck);

/**
 * POST /api/campaigns
 * Inicia el envío masivo de una campaña de WhatsApp.
 *
 * Body: { campaignName, templateName, templateLanguage?, recipients[] }
 * @returns {200} { success: true, data: CampaignSummary }
 * @returns {400} { error: { code, message } } si hay errores de validación
 */
campaignRouter.post('/', sendCampaignHandler);

/**
 * Router del webhook de Meta. Prefijo de montaje: /webhook
 * @type {import('express').Router}
 */
const webhookRouter = Router();

/**
 * GET /webhook
 * Endpoint de verificación del webhook requerido por Meta al configurar el webhook.
 * Meta envía hub.mode, hub.verify_token y hub.challenge como query params.
 *
 * @returns {200} hub.challenge (texto plano) si el token es válido.
 * @returns {403} Si el token no coincide.
 */
webhookRouter.get('/', verifyWebhook);

/**
 * POST /webhook
 * Recibe actualizaciones de estado de mensajes enviadas por Meta.
 * Siempre responde HTTP 200 para evitar reintentos de la plataforma.
 *
 * @returns {200} { received: true }
 */
webhookRouter.post('/', receiveStatusUpdate);

/**
 * Crea y configura el router raíz que monta todos los sub-routers.
 *
 * @returns {import('express').Router} Router configurado con todas las rutas.
 */
function createRouter() {
  const router = Router();

  /**
   * GET /health
   * Health check global de la aplicación.
   * Útil para load balancers y herramientas de monitoreo.
   *
   * @returns {200} { status: "ok", uptime: number, timestamp: string }
   */
  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Montar sub-routers.
  router.use('/api/campaigns', campaignRouter);
  router.use('/webhook', webhookRouter);

  return router;
}

module.exports = createRouter;
