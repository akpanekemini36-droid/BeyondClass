'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { fail, validateRequest } = require('./request-validation.cjs');
const { securityHeaders } = require('./security.cjs');
const analytics = require('./analytics.cjs');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const WINDOW = 15 * 60 * 1000;

function createNetlifyHandler({ store, password, now = Date.now }) {
  let credentials;
  async function getCredentials() {
    if (typeof password !== 'string' || password.length < 16 || password.length > 256) throw fail(503, 'The website inbox is being configured. Please contact us directly for now.');
    if (!credentials) credentials = (async () => {
      let entry = await store.get('auth/salt', { type: 'json' });
      if (!entry) {
        await store.setJSON('auth/salt', { salt: crypto.randomBytes(32).toString('hex') }, { onlyIfNew: true });
        entry = await store.get('auth/salt', { type: 'json' });
      }
      const hash = await scrypt(password, entry.salt, 64);
      return { salt: entry.salt, hash, version: digest(hash) };
    })().catch(error => { credentials = undefined; throw error; });
    return credentials;
  }
  async function rate(ip, group, max) {
    const slot = Math.floor(now() / WINDOW);
    const key = 'rates/' + slot + '/' + group + '/' + digest(ip);
    for (let attempt = 0; attempt < 12; attempt++) {
      const entry = await store.getWithMetadata(key, { type: 'json' });
      if (entry && !entry.etag) throw fail(503, 'The website is busy. Please try again shortly.');
      if (entry && entry.data.count >= max) throw Object.assign(fail(429, 'Please wait a little before trying again.'), { retryAfter: Math.max(1, Math.ceil(((slot + 1) * WINDOW - now()) / 1000)) });
      const result = await store.setJSON(key, { count: (entry ? entry.data.count : 0) + 1, expires: (slot + 1) * WINDOW }, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
      if (result.modified) return;
    }
    throw fail(503, 'The website is busy. Please try again shortly.');
  }
  async function body(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) throw fail(415, 'Please send this request using the website form.');
    if (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site') throw fail(403, 'Please submit this request from the website.');
    if (Number(req.headers.get('content-length')) > 16384) throw fail(413, 'Your request is too long. Please shorten it.');
    const reader = req.body?.getReader();
    if (!reader) throw fail(400, 'Please check the form and try again.');
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) { await reader.cancel(); throw fail(413, 'Your request is too long. Please shorten it.'); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch (_) { throw fail(400, 'Please check the form and try again.'); }
  }
  function token(req) {
    return (req.headers.get('cookie') || '').match(/(?:^|;\s*)bc_inbox_session=([a-f0-9]{64})(?:;|$)/)?.[1] || '';
  }
  const cookie = (value, age) => 'bc_inbox_session=' + value + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=' + age;
  function response(status, value, extra = {}) {
    return new Response(JSON.stringify(value), { status, headers: { ...securityHeaders([], true), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra } });
  }
  async function authorized(req, credential) {
    const value = token(req);
    if (!value) throw fail(401, 'Please sign in to your inbox.');
    const key = 'sessions/' + digest(value), session = await store.get(key, { type: 'json' });
    if (!session || session.expires <= now() || session.version !== credential.version) throw fail(401, 'Please sign in to your inbox.');
    return key;
  }
  async function listRequests() {
    const rows = [];
    for await (const batch of store.list({ prefix: 'requests/', paginate: true })) {
      for (let offset = 0; offset < batch.blobs.length; offset += 20) {
        const items = await Promise.all(batch.blobs.slice(offset, offset + 20).map(item => store.get(item.key, { type: 'json' })));
        rows.push(...items.filter(Boolean));
      }
    }
    return rows;
  }
  return async function handle(req, context = {}) {
    try {
      const url = new URL(req.url), route = url.pathname;
      if (!route.startsWith('/api/')) throw fail(404, 'Not found.');
      if (!['GET', 'POST', 'PATCH'].includes(req.method)) throw fail(405, 'Method not allowed.');
      if (!context.ip) throw fail(503, 'The website is temporarily unavailable. Please try again.');
      // Keep session revocation available when ordinary API calls are limited.
      if (!(route === '/api/inbox/logout' && req.method === 'POST')) await rate(context.ip, 'api', 150);
      if (route === '/api/pageviews' && req.method === 'POST') {
        await rate(context.ip, 'pageview', 30);
        const page = analytics.validatePage(await body(req));
        if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return response(200, { ok: true });
        const day = analytics.dayAt(now()), key = 'pageviews/' + day;
        for (let attempt = 0; attempt < 12; attempt++) {
          const entry = await store.getWithMetadata(key, { type: 'json' });
          if (entry && !entry.etag) throw fail(503, 'Please try again shortly.');
          const counts = { ...(entry ? entry.data.counts : {}) };
          counts[page] = (counts[page] || 0) + 1;
          const result = await store.setJSON(key, { day, counts }, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
          if (result.modified) return response(200, { ok: true });
        }
        throw fail(503, 'Please try again shortly.');
      }
      if (route === '/api/requests' && req.method === 'POST') {
        await rate(context.ip, 'request', 20);
        await getCredentials();
        const validated = validateRequest(await body(req));
        const id = digest(validated.token), key = 'requests/' + id;
        const row = { id, reference: 'BC-' + crypto.randomBytes(6).toString('hex').toUpperCase(), kind: validated.kind, created_at: new Date(now()).toISOString(), status: 'new', details: validated.details };
        const result = await store.setJSON(key, row, { onlyIfNew: true });
        const saved = result.modified ? row : await store.get(key, { type: 'json' });
        if (!saved) throw fail(503, 'We could not confirm delivery. Please try again.');
        if (saved.kind !== row.kind || JSON.stringify(saved.details) !== JSON.stringify(row.details)) throw fail(409, 'This request reference has already been used. Please refresh the page before sending a different request.');
        return response(201, { ok: true, reference: saved.reference });
      }
      if (route === '/api/inbox/login' && req.method === 'POST') {
        await rate(context.ip, 'login', 8);
        const parsed = await body(req), credential = await getCredentials();
        if (typeof parsed.password !== 'string' || parsed.password.length > 256) throw fail(401, 'That password is not correct.');
        const candidate = await scrypt(parsed.password, credential.salt, 64);
        if (!crypto.timingSafeEqual(candidate, credential.hash)) throw fail(401, 'That password is not correct.');
        const value = crypto.randomBytes(32).toString('hex');
        await store.setJSON('sessions/' + digest(value), { expires: now() + 12 * 60 * 60 * 1000, version: credential.version });
        return response(200, { ok: true, canChangePassword: false }, { 'Set-Cookie': cookie(value, 12 * 60 * 60) });
      }
      if (!route.startsWith('/api/inbox/')) throw fail(404, 'Not found.');
      const credential = await getCredentials(), sessionKey = await authorized(req, credential);
      if (route === '/api/inbox/session' && req.method === 'GET') return response(200, { ok: true, canChangePassword: false });
      if (route === '/api/inbox/analytics' && req.method === 'GET') {
        const days = analytics.periodDays(url.searchParams.get('days'));
        const dates = analytics.dateRange(now(), days), records = [];
        for (let index = 0; index < dates.length; index += 10) records.push(...await Promise.all(dates.slice(index, index + 10).map(day => store.get('pageviews/' + day, { type: 'json' }))));
        const rows = records.filter(Boolean).flatMap(record => Object.entries(record.counts).map(([page, views]) => ({ day: record.day, page, views })));
        return response(200, analytics.summarize(rows, now(), days));
      }
      if (route === '/api/inbox/logout' && req.method === 'POST') {
        await body(req); await store.delete(sessionKey);
        return response(200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
      }
      if (route === '/api/inbox/password' && req.method === 'POST') {
        await body(req); throw fail(409, 'Change the inbox password in your Netlify environment settings, then redeploy.');
      }
      if (route === '/api/inbox/requests' && req.method === 'GET') {
        const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get('page'), 10) || 1));
        const kind = ['materials', 'trial'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : '';
        const rows = await listRequests(), unreadCount = rows.filter(row => row.status === 'new').length;
        const filtered = rows.filter(row => (!kind || row.kind === kind) && (url.searchParams.get('unread') !== '1' || row.status === 'new')).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
        return response(200, { ok: true, requests: filtered.slice((page - 1) * 30, page * 30), total: filtered.length, unreadCount, page, pageSize: 30 });
      }
      const match = route.match(/^\/api\/inbox\/requests\/([a-f0-9]{64})$/);
      if (match && req.method === 'PATCH') {
        const parsed = await body(req);
        if (!['new', 'read'].includes(parsed.status)) throw fail(422, 'Choose a valid request status.');
        const key = 'requests/' + match[1];
        for (let attempt = 0; attempt < 5; attempt++) {
          const entry = await store.getWithMetadata(key, { type: 'json' });
          if (!entry) throw fail(404, 'This request could not be found.');
          if (!entry.etag) throw fail(503, 'The inbox is busy. Please try again.');
          const result = await store.setJSON(key, { ...entry.data, status: parsed.status }, { onlyIfMatch: entry.etag });
          if (result.modified) return response(200, { ok: true });
        }
        throw fail(503, 'The inbox is busy. Please try again.');
      }
      throw fail(404, 'Not found.');
    } catch (error) {
      return response(error.status || 503, { ok: false, error: error.status ? error.message : 'The website is temporarily unavailable. Please try again.' }, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
    }
  };
}
module.exports = { createNetlifyHandler };
