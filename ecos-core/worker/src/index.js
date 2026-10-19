'use strict';

const { loadConfig }          = require('./config');
const { createClient }        = require('./auth');
const { startHeartbeat }      = require('./heartbeat');
const { startPolling }        = require('./poll');
const { recoverOrphanedTask } = require('./session');
const logger                  = require('./logger');

async function main() {
  logger.info('Claude Bridge Worker starting...');

  // 1. Load and validate configuration
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error(`Configuration error: ${err.message}`);
    process.exit(1);
  }

  // 2. Wire the HTTP client
  createClient(config);
  logger.info(`Connected to ECOS at ${config.ecosUrl} as worker "${config.workerName}"`);

  // 3. Recover any task that was running when the worker last died
  await recoverOrphanedTask();

  // 4. Start heartbeat loop
  startHeartbeat(config.heartbeatInterval);
  logger.info(`Heartbeat started (every ${config.heartbeatInterval / 1000}s)`);

  // 5. Start poll loop
  startPolling(config.pollInterval);
  logger.info(`Poll loop started (every ${config.pollInterval / 1000}s)`);

  logger.info('Claude Bridge Worker online.');

  process.on('SIGINT',  () => { logger.info('Shutting down (SIGINT).');  process.exit(0); });
  process.on('SIGTERM', () => { logger.info('Shutting down (SIGTERM).'); process.exit(0); });
}

main().catch((err) => {
  logger.error('Fatal startup error.', { error: err.message, stack: err.stack });
  process.exit(1);
});
