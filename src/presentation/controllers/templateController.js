'use strict';

/**
 * @file templateController.js
 * @description Controladores para consulta de plantillas de Meta Business.
 *
 * GET /templates        → Listar todas las plantillas aprobadas.
 * GET /templates/:name  → Obtener una plantilla específica por nombre.
 */

const { getTemplates, getTemplate } = require('../../infrastructure/whatsapp/whatsappClient');

/**
 * GET /templates
 * Retorna todas las plantillas registradas en Meta Business.
 */
async function listTemplates(req, res, next) {
  try {
    const templates = await getTemplates();
    res.status(200).json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /templates/:name
 * Retorna una plantilla específica por nombre.
 */
async function getTemplateByName(req, res, next) {
  try {
    const { name } = req.params;
    const template = await getTemplate(name);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: { code: 'TEMPLATE_NOT_FOUND', message: `Plantilla "${name}" no encontrada.` },
      });
    }

    res.status(200).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

module.exports = { listTemplates, getTemplateByName };
