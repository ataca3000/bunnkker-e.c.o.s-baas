/**
 * Poll loop — interface definition for the task polling service.
 * Execution logic (spawning Claude Code, uploading artifacts) is Sprint 2.
 * This sprint establishes the polling skeleton: start/stop, idle/busy state.
 */

const logger = require('./logger');
const { getClient } = require('./auth');
const { setActiveTask } = require('./heartbeat');

const IDLE_INTERVAL   = 10_000;
const SLOW_INTERVAL   = 30_000;
const SLOW_AFTER_MS   = 60_000;

let pollTimer     = null;
let idleSince     = Date.now();
let currentTaskId = null;

async function pollOnce() {
  if (currentTaskId) return;

  const client = getClient();
  try {
    const res = await client.get('/tasks/next');
    if (res.status === 204 || !res.data?.task) {
      const idleMs = Date.now() - idleSince;
      if (idleMs >= SLOW_AFTER_MS && getCurrentInterval() === IDLE_INTERVAL) {
        setInterval(SLOW_INTERVAL);
        logger.debug('No tasks for 60s. Switching to slow poll (30s).');
      }
      return;
    }

    const task = res.data.task;
    currentTaskId = task.id;
    setActiveTask(task.id);
    idleSince = Date.now();
    setInterval(IDLE_INTERVAL);

    logger.info(`Task received: ${task.id} — "${task.title}"`);

    // Sprint 2: execute the task here.
    // For Sprint 1 we just log and release.
    logger.warn(`[Sprint 1] Execution engine not implemented. Releasing task ${task.id}.`);
    currentTaskId = null;
    setActiveTask(null);
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      logger.error('Poll: auth failure. Check heartbeat logs for details.');
      return;
    }
    logger.error('Poll error.', { error: err.message });
  }
}

let _interval = IDLE_INTERVAL;
function getCurrentInterval() { return _interval; }
function setInterval(ms) {
  _interval = ms;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = global.setInterval(pollOnce, ms);
  }
}

function startPolling(intervalMs = IDLE_INTERVAL) {
  _interval = intervalMs;
  pollOnce();
  pollTimer = global.setInterval(pollOnce, intervalMs);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
}

module.exports = { startPolling, stopPolling };
