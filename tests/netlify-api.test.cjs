'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createNetlifyHandler } = require('../lib/netlify-api.cjs');
const PASSWORD = 'test-only-private-netlify-password';
function memoryStore() {
  const values = new Map(); let version = 0;
  return {
    values,
    async get(key) { return values.has(key) ? structuredClone(values.get(key).data) : null; },
    async getWithMetadata(key) { return values.has(key) ? structuredClone(values.get(key)) : null; },
    async setJSON(key, data, options = {}) {
      if ((options.onlyIfNew && values.has(key)) || (options.onlyIfMatch && values.get(key)?.etag !== options.onlyIfMatch)) return { modified: false };
      const etag = String(++version); values.set(key, { data: structuredClone(data), etag }); return { modified: true, etag };
    },
    async delete(key) { values.delete(key); },
    async *list({ prefix }) { yield { blobs: [...values.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }; }
  };
}
function fixture({ password = PASSWORD, store = memoryStore() } = {}) {
  let time = Date.now();
  const handler = createNetlifyHandler({ store, password, now: () => time });
  return {
    store, handler, advance: ms => { time += ms; },
    async request(route, { method = 'GET', body, cookie, headers = {}, ip = '192.0.2.1', ...options } = {}) {
      const response = await handler(new Request('https://beyondclassmath.netlify.app' + route, {
        method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: 'https://beyondclassmath.netlify.app' }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...options
      }), { ip });
      return { status: response.status, headers: response.headers, json: await response.json() };
    },
    async login() {
      const result = await this.request('/api/inbox/login', { method: 'POST', body: { password } });
      assert.equal(result.status, 200);
      return result.headers.get('set-cookie').split(';')[0];
    }
  };
}
const material = extra => ({ kind: 'materials', requestToken: crypto.randomBytes(16).toString('hex'), email: 'parent@example.invalid', grade: 'Year 7', topic: 'Fractions', ...extra });

test('Netlify logout revokes a session after the API allowance is exhausted', async () => {
  const f = fixture(), cookie = await f.login();
  for (let i = 0; i < 149; i++) assert.equal((await f.request('/api/inbox/session', { cookie })).status, 200);
  assert.equal((await f.request('/api/inbox/session', { cookie })).status, 429);
  assert.equal((await f.request('/api/inbox/logout', { method: 'POST', body: {}, cookie, headers: { Origin: 'https://other.invalid' } })).status, 403);
  const logout = await f.request('/api/inbox/logout', { method: 'POST', body: {}, cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await f.request('/api/inbox/session', { cookie, ip: '192.0.2.2' })).status, 401);
});

test('Netlify requests persist across handler instances; inbox and changes require sign-in', async () => {
  const f = fixture();
  const sent = await f.request('/api/requests', { method: 'POST', body: material({ topic: '<script>alert(1)</script>' }) });
  assert.equal(sent.status, 201);
  assert.equal((await f.request('/api/inbox/requests')).status, 401);
  const cookie = await f.login();
  const next = fixture({ store: f.store });
  const list = await next.request('/api/inbox/requests', { cookie });
  assert.equal(list.json.total, 1);
  assert.equal(list.json.requests[0].details.topic, '<script>alert(1)</script>');
  const route = '/api/inbox/requests/' + list.json.requests[0].id;
  assert.equal((await next.request(route, { method: 'PATCH', body: { status: 'read' } })).status, 401);
  assert.equal((await next.request(route, { method: 'PATCH', body: { status: 'read' }, cookie })).status, 200);
  assert.equal((await next.request('/api/inbox/requests?kind=materials&unread=1', { cookie })).json.total, 0);
  assert.equal((await next.request('/api/inbox/logout', { method: 'POST', body: {}, cookie })).status, 200);
  assert.equal((await next.request('/api/inbox/requests', { cookie })).status, 401);
});

test('Netlify writes are atomic during retries and reject a different payload reusing a reference', async () => {
  const f = fixture(), body = material();
  const [a, b] = await Promise.all([f.request('/api/requests', { method: 'POST', body }), f.request('/api/requests', { method: 'POST', body })]);
  assert.equal(a.status, 201); assert.equal(b.status, 201); assert.equal(a.json.reference, b.json.reference);
  assert.equal((await f.request('/api/requests', { method: 'POST', body: { ...body, email: 'another@example.invalid' } })).status, 409);
  const cookie = await f.login();
  assert.equal((await f.request('/api/inbox/requests', { cookie })).json.total, 1);
});

test('Netlify rejects malformed, cross-origin, oversize, and invalid submissions', async () => {
  const f = fixture();
  for (const change of [{ grade: '' }, { email: 'invalid' }, { kind: 'admin' }, { requestToken: '-'.repeat(32) }, { website: 'spam' }, { topic: 'x'.repeat(301) }]) {
    assert.equal((await f.request('/api/requests', { method: 'POST', body: material(change) })).status, 422);
  }
  assert.equal((await f.request('/api/requests', { method: 'POST', body: material(), headers: { Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await f.request('/api/requests', { method: 'POST', body: material(), headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await f.request('/api/requests', { method: 'POST', body: material(), headers: { 'Content-Type': 'application/jsonp' } })).status, 415);
  assert.equal((await f.request('/api/requests', { method: 'POST', body: material({ topic: 'x'.repeat(17000) }) })).status, 413);
  assert.equal((await f.request('/api/requests', { method: 'PUT' })).status, 405);
  assert.equal((await f.request('/api/inbox/requests', { method: 'OPTIONS' })).headers.get('access-control-allow-origin'), null);
});

test('Netlify cookies, expiry, logout, and password rotation protect sessions', async () => {
  const f = fixture();
  const login = await f.request('/api/inbox/login', { method: 'POST', body: { password: PASSWORD } });
  const setCookie = login.headers.get('set-cookie'), cookie = setCookie.split(';')[0];
  for (const marker of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert(setCookie.includes(marker));
  assert.equal(login.json.canChangePassword, false);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.equal(login.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert(!JSON.stringify([...f.store.values]).includes(PASSWORD));
  const changed = fixture({ store: f.store, password: 'different-test-only-private-password' });
  assert.equal((await changed.request('/api/inbox/session', { cookie })).status, 401);
  f.advance(12 * 60 * 60 * 1000 + 1);
  assert.equal((await f.request('/api/inbox/session', { cookie })).status, 401);
});

test('Netlify rate limits persist across serverless instances and withstand concurrent logins', async () => {
  const f = fixture(), next = fixture({ store: f.store });
  for (let i = 0; i < 8; i++) assert.equal((await (i % 2 ? f : next).request('/api/inbox/login', { method: 'POST', body: { password: 'wrong' } })).status, 401);
  const limited = await f.request('/api/inbox/login', { method: 'POST', body: { password: 'wrong' } });
  assert.equal(limited.status, 429); assert(limited.headers.get('retry-after'));
  const other = await f.request('/api/inbox/login', { method: 'POST', body: { password: PASSWORD }, ip: '192.0.2.2' });
  assert.equal(other.status, 200);
  const parallel = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? f : next).request('/api/inbox/login', { method: 'POST', body: { password: 'wrong' }, ip: '192.0.2.3' })));
  assert.equal(parallel.filter(item => item.status === 401).length, 8);
  assert.equal(parallel.filter(item => item.status === 429).length, 2);
});

test('retired production deployments and alternate hosts cannot access the live inbox', async () => {
  const { default: deployed } = await import('../netlify/functions/api.mjs');
  const context = { deploy: { context: 'production', published: false }, site: { url: 'https://beyondclassmath.netlify.app' }, ip: '192.0.2.1' };
  assert.equal((await deployed(new Request('https://old-deploy--beyondclassmath.netlify.app/api/inbox/requests'), context)).status, 403);
  assert.equal((await deployed(new Request('https://beyondclassmath.netlify.app/api/inbox/requests'), context)).status, 403);
  context.deploy.published = true;
  assert.equal((await deployed(new Request('https://old-deploy--beyondclassmath.netlify.app/api/inbox/requests'), context)).status, 403);
});

test('Netlify fails closed when password or storage is missing; never confirms an unsaved request', async () => {
  const unconfigured = fixture({ password: '' });
  assert.equal((await unconfigured.request('/api/requests', { method: 'POST', body: material() })).status, 503);
  const store = memoryStore(), original = store.setJSON;
  store.setJSON = async (key, ...args) => { if (key.startsWith('requests/')) throw new Error('Private database diagnostic'); return original.call(store, key, ...args); };
  const f = fixture({ store });
  const failed = await f.request('/api/requests', { method: 'POST', body: material() });
  assert.equal(failed.status, 503); assert.equal(failed.json.ok, false);
  assert(!JSON.stringify(failed.json).includes('diagnostic'));
});

test('Netlify trial bookings and filtered pagination preserve the existing inbox contract', async () => {
  const f = fixture();
  await f.request('/api/requests', { method: 'POST', body: material() });
  const trial = { kind: 'trial', requestToken: crypto.randomUUID(), email: 'trial@example.invalid', name: 'Test Parent', grade: 'Grade 8', curriculum: 'US: Common Core', plan: 'Growth', message: 'Algebra support' };
  assert.equal((await f.request('/api/requests', { method: 'POST', body: trial })).status, 201);
  const cookie = await f.login(), list = await f.request('/api/inbox/requests?kind=trial', { cookie });
  assert.equal(list.json.total, 1); assert.equal(list.json.unreadCount, 2); assert.equal(list.json.pageSize, 30);
  assert.equal(list.json.requests[0].details.name, 'Test Parent');
});

test('anonymous counts aggregate concurrently across instances; only the owner can read totals', async () => {
  const f = fixture(), next = fixture({ store: f.store });
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => (index % 2 ? f : next).request('/api/pageviews', { method: 'POST', body: { page: index % 2 ? 'pricing.html' : 'index.html', email: 'must-not-be-stored@example.invalid', referrer: 'https://private.invalid/?secret=example' } })));
  assert(results.every(item => item.status === 200));
  assert.equal((await f.request('/api/inbox/analytics')).status, 401);
  const cookie = await f.login(), totals = await f.request('/api/inbox/analytics?days=7', { cookie });
  assert.equal(totals.json.total, 8); assert.equal(totals.json.today, 8);
  assert.equal(totals.json.daily.length, 7); assert.equal(totals.json.timeZone, 'UTC');
  assert.equal(totals.json.pages.find(page => page.page === 'pricing.html').views, 4);
  const records = [...f.store.values].filter(([key]) => key.startsWith('pageviews/'));
  assert.equal(records.length, 1); assert.deepEqual(Object.keys(records[0][1].data).sort(), ['counts', 'day']);
  assert(!JSON.stringify(records).includes('email')); assert(!JSON.stringify(records).includes('private.invalid'));
  assert(!JSON.stringify(records).includes('192.0.2.1'));
  f.advance(8 * 86400000);
  const laterCookie = await f.login();
  assert.equal((await f.request('/api/inbox/analytics?days=7', { cookie: laterCookie })).json.total, 0);
  assert.equal((await f.request('/api/inbox/analytics?days=30', { cookie: laterCookie })).json.total, 8);
});

test('anonymous counts reject private or arbitrary URLs and honor browser privacy headers', async () => {
  const f = fixture();
  for (const page of ['inbox.html', '../auth/salt', 'index.html?email=private', 'https://other.invalid/', '']) assert.equal((await f.request('/api/pageviews', { method: 'POST', body: { page } })).status, 422);
  assert.equal((await f.request('/api/pageviews', { method: 'POST', body: { page: 'index.html' }, headers: { Origin: 'https://other.invalid' } })).status, 403);
  for (const headers of [{ DNT: '1' }, { 'Sec-GPC': '1' }]) assert.equal((await f.request('/api/pageviews', { method: 'POST', body: { page: 'index.html' }, headers })).status, 200);
  const cookie = await f.login();
  assert.equal((await f.request('/api/inbox/analytics', { cookie })).json.total, 0);
});
