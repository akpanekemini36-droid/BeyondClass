'use strict';
const crypto = require('node:crypto');
function securityHeaders(scriptHashes = [], secure = false) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': [
      "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
      "script-src 'self' " + scriptHashes.map(hash => "'sha256-" + hash + "'").join(' '),
      "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
      "font-src 'self' data:", "media-src 'self'", "connect-src 'self'", "form-action 'self'"
    ].join('; '),
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  if (secure) headers['Strict-Transport-Security'] = 'max-age=31536000';
  return headers;
}
function inlineHashes(html) {
  return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => crypto.createHash('sha256').update(match[1]).digest('base64'));
}
module.exports = { securityHeaders, inlineHashes };
