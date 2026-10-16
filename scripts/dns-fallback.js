// scripts/dns-fallback.js — Interceptor de DNS para evitar ENOTFOUND en Windows/Node.js
const dns = require('dns');

const originalLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  originalLookup(hostname, options, (err, address, family) => {
    if (err) {
      dns.resolve4(hostname, (rErr, addresses) => {
        if (!rErr && addresses && addresses.length > 0) {
          if (options && options.all) {
            return callback(null, addresses.map(a => ({ address: a, family: 4 })));
          }
          return callback(null, addresses[0], 4);
        }
        callback(err, address, family);
      });
    } else {
      callback(err, address, family);
    }
  });
};
