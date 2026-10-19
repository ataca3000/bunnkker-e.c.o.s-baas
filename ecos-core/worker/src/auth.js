/**
 * Axios instance pre-configured with ECOS URL and worker Bearer token.
 * Every outbound request uses this client.
 */

const axios = require('axios');

let client = null;

function createClient(config) {
  client = axios.create({
    baseURL: `${config.ecosUrl}/api/cb/worker`,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 30_000,
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response) {
        const { status, data } = err.response;
        const code = data?.error?.code ?? 'UNKNOWN';
        const msg  = data?.error?.message ?? err.message;
        const enhanced = new Error(`ECOS API error ${status} [${code}]: ${msg}`);
        enhanced.status = status;
        enhanced.code   = code;
        throw enhanced;
      }
      throw err;
    },
  );

  return client;
}

function getClient() {
  if (!client) throw new Error('Auth client not initialised. Call createClient() first.');
  return client;
}

module.exports = { createClient, getClient };
