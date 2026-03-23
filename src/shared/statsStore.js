'use strict';

/**
 * @file statsStore.js
 * @description Almacén en memoria para estadísticas de mensajes WhatsApp.
 * Acumula conteos de sent, delivered y read recibidos desde el webhook de Meta.
 */

const stats = {
  sent: 0,
  delivered: 0,
  read: 0,
};

function increment(status) {
  const key = status.toLowerCase();
  if (key in stats) {
    stats[key]++;
  }
}

function getStats() {
  return { ...stats };
}

module.exports = { increment, getStats };
