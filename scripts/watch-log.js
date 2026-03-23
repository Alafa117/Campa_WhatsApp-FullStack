'use strict';

/**
 * @file watch-log.js
 * @description Lector en tiempo real de archivos de log usando polling.
 * Usa fs.readFileSync + slice para máxima compatibilidad en Windows.
 *
 * Uso:
 *   node scripts/watch-log.js api     → lee logs/api.log
 *   node scripts/watch-log.js status  → lee logs/status.log
 */

const fs   = require('fs');
const path = require('path');

const MODE = process.argv[2];

if (!MODE || !['api', 'status'].includes(MODE)) {
  console.error('Uso: node scripts/watch-log.js <api|status>');
  process.exit(1);
}

const LOG_FILE = path.resolve(__dirname, '..', 'logs', `${MODE}.log`);
const LOGS_DIR = path.dirname(LOG_FILE);
const LABEL    = MODE === 'api'
  ? '[ API DEBUG ]    — Postman / Meta API calls'
  : '[ STATUS DEBUG ] — sent / delivered / read';

const POLL_MS = 200;

// ─── Crear directorio y archivo si no existen ────────────────────────────────
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');

// ─── Banner inicial ───────────────────────────────────────────────────────────
console.log('');
console.log('┌─────────────────────────────────────────────────────────────────┐');
console.log(`│  ${LABEL.padEnd(65)}│`);
console.log('│  Esperando eventos del servidor...                              │');
console.log('└─────────────────────────────────────────────────────────────────┘');
console.log('');

// ─── Posición inicial: final del archivo (no mostrar logs anteriores) ─────────
let position = fs.readFileSync(LOG_FILE).length;

// ─── Polling: lee el archivo completo y muestra solo lo nuevo ─────────────────
setInterval(() => {
  let content;
  try {
    content = fs.readFileSync(LOG_FILE);
  } catch {
    return; // archivo no disponible momentáneamente
  }

  // Si el archivo fue truncado (reinicio del servidor), resetear posición
  if (content.length < position) {
    position = 0;
  }

  if (content.length <= position) return; // nada nuevo

  process.stdout.write(content.subarray(position));
  position = content.length;

}, POLL_MS);

// ─── Mantener el proceso vivo ─────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[Watch terminado]\n');
  process.exit(0);
});
