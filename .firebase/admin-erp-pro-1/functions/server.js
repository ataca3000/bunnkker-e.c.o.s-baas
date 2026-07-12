const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssradminerppro1 = onRequest({"region":"us-central1"}, (req, res) => server.then(it => it.handle(req, res)));
  