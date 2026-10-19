/**
 * Heartbeat scheduler.
 * Sends POST /heartbeat every heartbeatInterval ms.
 * Stops the process on 401 (invalid token) or 403 (worker deactivated).
 * Backs off exponentially on consecutive failures.
 */

const logger = require('./logger');
const { getClient } = require('./auth');

let consecutiveFailures = 0;
let currentTaskId       = null;
let heartbeatTimer      = null;

const BACKOFF_SCHEDULE = [60_000, 120_000, 300_000];

function setActiveTask(taskId) {
  currentTaskId = taskId;
}

async function sendHeartbeat() {
  const client = getClient();
  try {
    await client.post('/heartbeat', {
      status:          currentTaskId ? 'busy' : 'idle',
      active_task_id:  currentTaskId ?? null,
    });
    consecutiveFailures = 0;
  } catch (err) {
    if (err.status === 401) {
      logger.error('Heartbeat: API token invalid or revoked. Update config.json and restart.');
      process.exit(1);
    }
    if (err.status === 403) {
      logger.error('Heartbeat: Worker has been deactivated. Exiting.');
      process.exit(0);
    }

    consecutiveFailures += 1;
    const backoff = BACKOFF_SCHEDULE[Math.min(consecutiveFailures - 1, BACKOFF_SCHEDULE.length - 1)];
    logger.warn(`Heartbeat failed (${consecutiveFailures} consecutive). Retrying in ${backoff / 1000}s.`, {
      error: err.message,
    });

    clearInterval(heartbeatTimer);
    setTimeout(() => {
      sendHeartbeat();
    }, backoff);
  }
}

function startHeartbeat(intervalMs) {
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, intervalMs);
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
}

module.exports = { startHeartbeat, stopHeartbeat, setActiveTask };
