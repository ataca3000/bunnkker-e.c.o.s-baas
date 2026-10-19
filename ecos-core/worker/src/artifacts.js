/**
 * Artifact directory manager.
 * Ensures local scratch directories exist for the current execution.
 */

const fs   = require('fs');
const path = require('path');

const ARTIFACTS_ROOT = path.join('C:\\claude-bridge', 'artifacts');

function ensureDirectories(taskId, executionId) {
  const dir = path.join(ARTIFACTS_ROOT, taskId, executionId);
  fs.mkdirSync(dir, { recursive: true });
  return {
    root:   dir,
    diff:   path.join(dir, 'diff.patch'),
    report: path.join(dir, 'report.md'),
    log:    path.join(dir, 'execution.log'),
  };
}

function cleanupExecution(taskId, executionId) {
  const dir = path.join(ARTIFACTS_ROOT, taskId, executionId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { ensureDirectories, cleanupExecution };
