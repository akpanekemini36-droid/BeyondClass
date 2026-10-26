'use strict';
const crypto = require('node:crypto');
const { securityHeaders, inlineHashes } = require('./security.cjs');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const normalizedCode = value => String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
const TTL = 2 * 60 * 60 * 1000;
function createAssessmentAccess({ store, codeHash, html, now = Date.now, secure = true }) {
  const cookieName = secure ? '__Secure-bc_assessment' : 'bc_assessment';
  const headers = { ...securityHeaders(inlineHashes(html), secure), 'Cache-Control': 'private, no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive', Vary: 'Cookie' };
  const cookie = (value, age) => `${cookieName}=${value}; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Path=/assessment; Max-Age=${age}`;
  const json = (status, value, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
  let signingKey;
  async function key() {
    if (!signingKey) signingKey = (async () => {
      let saved = await store.get('signing-key', { type: 'json' });
      if (!saved) { await store.setJSON('signing-key', { key: crypto.randomBytes(32).toString('hex') }, { onlyIfNew: true }); saved = await store.get('signing-key', { type: 'json' }); }
      if (!/^[a-f0-9]{64}$/.test(saved?.key || '')) throw new Error('Signing key unavailable');
      return Buffer.from(saved.key, 'hex');
    })().catch(e => { signingKey = undefined; throw e; });
    return signingKey;
  }
  async function signature(payload) { return crypto.createHmac('sha256', await key()).update(payload).digest('hex'); }
  async function authorized(request) {
    const value = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
    const parts = value.split('.');
    if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || parts[1] !== codeHash || !/^[a-f0-9]{64}$/.test(parts[2])) return false;
    const expires = Number(parts[0]); if (expires <= now() || expires > now() + TTL) return false;
    return crypto.timingSafeEqual(Buffer.from(parts[2], 'hex'), Buffer.from(await signature(parts[0] + '.' + parts[1]), 'hex'));
  }
  async function limit(ip) {
    const name = 'rates/' + digest(ip || 'unknown');
    for (let n = 0; n < 8; n++) {
      const entry = await store.getWithMetadata(name, { type: 'json' });
      const record = entry?.data?.expires > now() ? entry.data : { count: 0, expires: now() + 15 * 60 * 1000 };
      if (record.count >= 12) return false;
      const result = await store.setJSON(name, { ...record, count: record.count + 1 }, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
      if (result.modified) return true;
    }
    throw new Error('Rate counter unavailable');
  }
  return async function handler(request, { ip = 'unknown' } = {}) {
    try {
      if (!/^[a-f0-9]{64}$/.test(codeHash || '')) return json(503, { ok: false, error: 'Assessment access is being set up. Please contact BeyondClass.' });
      const url = new URL(request.url);
      if (request.method === 'POST') {
        if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return json(403, { ok: false, error: 'Use the access form on the BeyondClass website.' });
        if (url.pathname === '/assessment/lock') return json(200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
        if (url.pathname !== '/assessment/unlock') return json(404, { ok: false });
        if (!await limit(ip)) return json(429, { ok: false, error: 'Too many attempts. Please wait 15 minutes or contact BeyondClass.' }, { 'Retry-After': '900' });
        if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json(415, { ok: false, error: 'Please use the code box on this page.' });
        if (Number(request.headers.get('content-length')) > 1024) return json(413, { ok: false, error: 'The code is too long.' });
        const reader = request.body?.getReader(); if (!reader) return json(400, { ok: false, error: 'Enter your access code.' });
        const chunks = []; let size = 0;
        try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1024) { await reader.cancel(); return json(413, { ok: false, error: 'The code is too long.' }); } chunks.push(Buffer.from(value)); } } finally { reader.releaseLock(); }
        let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(400, { ok: false, error: 'Please enter the code again.' }); }
        if (typeof body?.code !== 'string' || body.code.length > 80 || !crypto.timingSafeEqual(Buffer.from(digest(normalizedCode(body.code)), 'hex'), Buffer.from(codeHash, 'hex'))) return json(401, { ok: false, error: 'That code did not match. Check it or request a code from BeyondClass.' });
        const payload = `${now() + TTL}.${codeHash}`;
        return json(200, { ok: true }, { 'Set-Cookie': cookie(payload + '.' + await signature(payload), TTL / 1000) });
      }
      if (!['GET', 'HEAD'].includes(request.method)) return json(405, { ok: false }, { Allow: 'GET, HEAD, POST' });
      if (!['/assessment/start', '/assessment/session'].includes(url.pathname)) return json(404, { ok: false });
      const valid = await authorized(request);
      if (url.pathname === '/assessment/session') return json(valid ? 200 : 401, { ok: valid });
      if (!valid) return new Response(null, { status: 303, headers: { ...headers, Location: '/assessment.html?locked=1' } });
      return new Response(request.method === 'HEAD' ? null : html, { status: 200, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
    } catch { return json(503, { ok: false, error: 'Access is temporarily unavailable. Please try again shortly.' }); }
  };
}
module.exports = { createAssessmentAccess, normalizedCode, digest, TTL };
