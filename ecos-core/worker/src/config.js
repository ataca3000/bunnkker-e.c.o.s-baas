/**
 * Configuration loader.
 *
 * In production the config is AES-256-GCM encrypted at C:\claude-bridge\config.json.
 * Encryption is implemented in Sprint 2. For the foundation sprint, the file is plain JSON.
 *
 * ANTHROPIC_API_KEY is never in this file. It must be in the system environment
 * or in %APPDATA%\claude-bridge\.env loaded by dotenv before this module runs.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.env.APPDATA || '', 'claude-bridge', '.env') });

const CONFIG_PATH = path.join('C:\\claude-bridge', 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found at ${CONFIG_PATH}. Run the worker setup first.`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);

  const required = ['ecos_url', 'api_token', 'worker_id', 'worker_name'];
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Config missing required field: ${key}`);
    }
  }

  if (!config.ecos_url.startsWith('https://')) {
    throw new Error('ecos_url must use HTTPS. Plain HTTP is not permitted.');
  }

  return {
    ecosUrl:             config.ecos_url,
    apiToken:            config.api_token,
    workerId:            config.worker_id,
    workerName:          config.worker_name,
    pollInterval:        (config.poll_interval_seconds ?? 10) * 1000,
    heartbeatInterval:   (config.heartbeat_interval_seconds ?? 30) * 1000,
    logLevel:            config.log_level ?? 'info',
  };
}

module.exports = { loadConfig };
