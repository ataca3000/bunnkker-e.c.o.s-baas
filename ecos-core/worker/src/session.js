/**
 * Session manager — tracks the currently active task execution.
 * Provides recovery information if the worker restarts mid-execution.
 */

const logger = require('./logger');
const { getClient } = require('./auth');

async function recoverOrphanedTask() {
  const client = getClient();
  try {
    const res = await client.get('/my-running-task');
    const task = res.data?.task;
    if (task) {
      logger.warn(`Orphaned task found on startup: ${task.id}. Marking as failed.`);
      await client.post(`/tasks/${task.id}/fail`, {
        failure_code:    'worker_restarted',
        failure_message: 'Worker process restarted while task was running.',
        exit_code:       -1,
      });
      logger.info(`Orphaned task ${task.id} marked as failed.`);
    }
  } catch (err) {
    logger.error('Failed to check for orphaned tasks on startup.', { error: err.message });
  }
}

module.exports = { recoverOrphanedTask };
