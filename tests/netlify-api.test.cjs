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

test('saved requests and read counts recover from failed index writes without a parent retry', async () => {
  for (const mode of ['throw', 'conflict']) {
    const f = fixture(), cookie = await f.login();
    await f.request('/api/inbox/requests', { cookie });
    const original = f.store.setJSON;
    let broken = true;
    f.store.setJSON = async function (key, ...args) {
      if (key === 'request-index/v1' && broken) {
        if (mode === 'conflict') return { modified: false };
        throw new Error('Synthetic index failure');
      }
      return original.call(this, key, ...args);
    };
    const sent = await f.request('/api/requests', { method: 'POST', body: material() });
    assert.equal(sent.status, 201);
    assert([...f.store.values.keys()].some(key => key.startsWith('request-index-pending/')));
    assert.equal((await f.request('/api/inbox/requests', { cookie })).status, 503, 'must not show a false empty inbox');
    broken = false;
    const next = fixture({ store: f.store });
    const listed = await next.request('/api/inbox/requests', { cookie });
    assert.equal(listed.json.total, 1);
    assert.equal(listed.json.unreadCount, 1);
    assert.equal(listed.json.requests[0].reference, sent.json.reference);
    assert(![...f.store.values.keys()].some(key => key.startsWith('request-index-pending/')));
    broken = true;
    const patch = await next.request('/api/inbox/requests/' + listed.json.requests[0].id, { method: 'PATCH', cookie, body: { status: 'read' } });
    assert.equal(patch.status, 200);
    assert.equal(patch.json.status, 'read');
    assert.equal((await next.request('/api/inbox/requests?unread=1', { cookie })).status, 503);
    broken = false;
    const repaired = await f.request('/api/inbox/requests?unread=1', { cookie });
    assert.equal(repaired.json.total, 0);
    assert.equal(repaired.json.unreadCount, 0);
  }
});

test('a committed request/status followed by a storage error is reconciled automatically', async () => {
  const f = fixture(), cookie = await f.login();
  await f.request('/api/inbox/requests', { cookie });
  const original = f.store.setJSON;
  let failAfterWrite = true;
  f.store.setJSON = async function (key, ...args) {
    const result = await original.call(this, key, ...args);
    if (key.startsWith('requests/') && failAfterWrite) throw new Error('Synthetic lost write acknowledgement');
    return result;
  };
  assert.equal((await f.request('/api/requests', { method: 'POST', body: material() })).status, 503);
  failAfterWrite = false;
  const saved = await f.request('/api/inbox/requests', { cookie });
  assert.equal(saved.json.total, 1);
  assert.equal(saved.json.unreadCount, 1);
  failAfterWrite = true;
  assert.equal((await f.request('/api/inbox/requests/' + saved.json.requests[0].id, { method: 'PATCH', cookie, body: { status: 'read' } })).status, 503);
  failAfterWrite = false;
  const corrected = await f.request('/api/inbox/requests', { cookie });
  assert.equal(corrected.json.requests[0].status, 'read');
  assert.equal(corrected.json.unreadCount, 0);
});

test('repair markers must be durable before mutation; aborted and in-flight operations are safe', async () => {
  const f = fixture(), cookie = await f.login();
  await f.request('/api/inbox/requests', { cookie });
  const original = f.store.setJSON;
  let broken = true;
  f.store.setJSON = async function (key, ...args) {
    if (key.startsWith('request-index-pending/') && broken) throw new Error('Synthetic marker failure');
    return original.call(this, key, ...args);
  };
  assert.equal((await f.request('/api/requests', { method: 'POST', body: material() })).status, 503);
  assert(![...f.store.values.keys()].some(key => key.startsWith('requests/')));
  broken = false;
  const { createRequestIndex } = require('../lib/request-index.cjs');
  const index = createRequestIndex(f.store);
  const pending = await index.prepare('a'.repeat(64));
  assert.equal((await f.request('/api/inbox/requests', { cookie })).json.total, 0);
  assert(f.store.values.has(pending), 'in-flight marker must remain when the row is not yet visible');
  const old = 'request-index-pending/' + 'b'.repeat(64) + '/old';
  await f.store.setJSON(old, { id: 'b'.repeat(64), createdAt: Date.now() - 86400001 });
  await index.reconcile();
  assert(!f.store.values.has(old));
  assert(f.store.values.has(pending));
});

test('old indexes recover invisible records and stale counts on upgrade; scheduled repair catches unmarked orphans', async () => {
  const f = fixture(), id = 'c'.repeat(64);
  const row = { id, reference: 'SYNTHETIC', kind: 'materials', status: 'read', revision: 1, created_at: new Date().toISOString(), details: { topic: 'Test' } };
  await f.store.setJSON('requests/' + id, row);
  await f.store.setJSON('request-index/v1', { entries: [] });
  const cookie = await f.login();
  const recovered = await f.request('/api/inbox/requests', { cookie });
  assert.equal(recovered.json.total, 1);
  assert.equal(recovered.json.unreadCount, 0);
  const another = { ...row, id: 'd'.repeat(64), status: 'new', revision: 0 };
  await f.store.setJSON('requests/' + another.id, another);
  const { createRequestIndex } = require('../lib/request-index.cjs');
  await createRequestIndex(f.store).reconcile();
  const all = await f.request('/api/inbox/requests', { cookie });
  assert.equal(all.json.total, 2);
  assert.equal(all.json.unreadCount, 1);
});

test('an older repair cannot remove a newer pending operation or overwrite its status', async () => {
  const store = memoryStore(), id = 'e'.repeat(64);
  await store.setJSON('request-index/v1', { schemaVersion: 2, entries: [] });
  const { createRequestIndex } = require('../lib/request-index.cjs');
  const first = createRequestIndex(store), second = createRequestIndex(store);
  const oldMarker = await first.prepare(id);
  const row = { id, kind: 'trial', status: 'read', revision: 1, created_at: new Date().toISOString() };
  await store.setJSON('requests/' + id, row);
  const originalGet = store.get, originalSet = store.setJSON;
  let release, paused = false, failIndex = false;
  store.get = async function (key, ...args) {
    const value = await originalGet.call(this, key, ...args);
    if (key === 'requests/' + id && !paused) { paused = true; return new Promise(resolve => { release = () => resolve(value); }); }
    return value;
  };
  const oldRepair = first.tryCommit(oldMarker);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const newMarker = await second.prepare(id);
  await store.setJSON('requests/' + id, { ...row, status: 'new', revision: 2 });
  store.setJSON = async function (key, ...args) {
    if (key === 'request-index/v1' && failIndex) throw new Error('Synthetic failure');
    return originalSet.call(this, key, ...args);
  };
  failIndex = true;
  assert.equal(await second.tryCommit(newMarker), false);
  failIndex = false;
  release(); await oldRepair;
  assert(store.values.has(newMarker));
  const result = await second.page({ page: 1, kind: '', unread: false });
  assert.equal(result.unreadCount, 1);
  assert.equal(result.requests[0].status, 'new');
  assert(!store.values.has(newMarker));
});

test('an inbox read cannot consume a status repair marker before its record write commits', async () => {
  const store = memoryStore(), id = 'f'.repeat(64);
  const { createRequestIndex } = require('../lib/request-index.cjs');
  const index = createRequestIndex(store);
  const row = { id, kind: 'trial', status: 'new', revision: 0, created_at: new Date().toISOString() };
  await store.setJSON('requests/' + id, row);
  await index.upsert(row);
  const pending = await index.prepare(id, 1);
  const before = await index.page({ page: 1, kind: '', unread: false });
  assert.equal(before.unreadCount, 1);
  assert(store.values.has(pending), 'marker must survive while only the previous row revision exists');
  await store.setJSON('requests/' + id, { ...row, status: 'read', revision: 1 });
  const after = await index.page({ page: 1, kind: '', unread: false });
  assert.equal(after.unreadCount, 0);
  assert.equal(after.requests[0].status, 'read');
  assert(!store.values.has(pending));
});

test('hosting routes isolate logout from the Netlify function rate limit', async () => {
  const main = await import('../netlify/functions/api.mjs');
  const logout = await import('../netlify/functions/logout.mjs');
  assert.equal(main.config.excludedPath, '/api/inbox/logout');
  assert.equal(logout.config.path, '/api/inbox/logout');
  assert.equal(logout.config.method, 'POST');
  assert.equal(logout.config.rateLimit, undefined);
  assert.equal(logout.default, main.default);
});

test('indexed inbox pagination reads at most the selected 30 request payloads after legacy migration', async () => {
  const f = fixture();
  for (let i = 0; i < 125; i++) {
    const id = i.toString(16).padStart(64, '0');
    await f.store.setJSON('requests/' + id, { id, reference: 'TEST-' + i, kind: i % 2 ? 'trial' : 'materials', status: i % 3 ? 'new' : 'read', created_at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), details: { name: 'Synthetic parent', topic: 'Test topic' } });
  }
  const cookie = await f.login();
  assert.equal((await f.request('/api/inbox/requests', { cookie })).json.total, 125);
  const reads = [], listCalls = [];
  const originalGet = f.store.get, originalList = f.store.list;
  f.store.get = async function (key, ...args) { if (key.startsWith('requests/')) reads.push(key); return originalGet.call(this, key, ...args); };
  f.store.list = function (options) { listCalls.push(options.prefix); return originalList.call(this, options); };
  const next = fixture({ store: f.store });
  const page = await next.request('/api/inbox/requests?page=2&kind=trial&unread=1', { cookie });
  assert.equal(page.status, 200);
  assert.equal(page.json.total, 41);
  assert.equal(page.json.requests.length, 11);
  assert.equal(reads.length, 11);
  assert(!listCalls.includes('requests/'));
  assert(page.json.requests.every(row => row.kind === 'trial' && row.status === 'new'));
  assert(page.json.requests.every((row, i, rows) => !i || rows[i - 1].created_at >= row.created_at));
  reads.length = 0;
  const beyond = await next.request('/api/inbox/requests?page=999', { cookie });
  assert.equal(beyond.json.requests.length, 0);
  assert.equal(reads.length, 0);
});

test('expired-record cleanup removes only expired sessions and rate records, preserving requests and current counters', async () => {
  const { cleanupExpiredRecords } = require('../lib/expired-records.cjs');
  const store = memoryStore(), now = Date.UTC(2026, 9, 16);
  for (const prefix of ['sessions/', 'rates/']) {
    await store.setJSON(prefix + 'expired', { expires: now - 1 });
    await store.setJSON(prefix + 'boundary', { expires: now });
    await store.setJSON(prefix + 'active', { expires: now + 60000 });
  }
  await store.setJSON('requests/preserve', { expires: now - 1, details: { message: 'Keep this request' } });
  await store.setJSON('auth/salt', { salt: 'synthetic' });
  const result = await cleanupExpiredRecords(store, now);
  assert.equal(result.removed, 4);
  assert(store.values.has('sessions/active'));
  assert(store.values.has('rates/active'));
  assert(store.values.has('requests/preserve'));
  assert(store.values.has('auth/salt'));
  const scheduled = await import('../netlify/functions/cleanup.mjs');
  assert.equal(scheduled.config.schedule, '*/15 * * * *');
  assert.equal((await scheduled.default(null, { deploy: { context: 'deploy-preview' } })).status, 204);
});

test('request index revisions reject delayed stale status updates and preserve concurrent additions', async () => {
  const { createRequestIndex } = require('../lib/request-index.cjs');
  const store = memoryStore();
  const first = createRequestIndex(store), second = createRequestIndex(store);
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: String(i), kind: 'trial', status: 'new', created_at: new Date(i).toISOString(), revision: 0 }));
  await Promise.all(rows.map((row, i) => (i % 2 ? first : second).upsert(row)));
  await first.upsert({ ...rows[0], status: 'read', revision: 2 });
  await second.upsert({ ...rows[0], status: 'new', revision: 1 });
  const saved = await store.get('request-index/v1');
  assert.equal(saved.entries.length, 10);
  assert.equal(saved.entries.find(row => row.id === '0').status, 'read');
});

test('Netlify saves USD notices without claiming payment receipt and filters them across instances', async () => {
  const f = fixture(), next = fixture({ store: f.store });
  const body = { kind: 'payment', requestToken: crypto.randomUUID(), name: 'Synthetic Parent', email: 'transfer@example.invalid', plan: 'Flexible', currency: 'USD', amount: '200', transferReference: 'TEST-TRANSFER', message: '', verification: 'Paid' };
  const sent = await f.request('/api/requests', { method: 'POST', body });
  assert.equal(sent.status, 201);
  assert.equal((await next.request('/api/requests', { method: 'POST', body })).json.reference, sent.json.reference);
  assert.equal((await next.request('/api/inbox/requests?kind=payment')).status, 401);
  await next.request('/api/requests', { method: 'POST', body: material() });
  const cookie = await next.login();
  const list = await next.request('/api/inbox/requests?kind=payment', { cookie });
  assert.equal(list.json.total, 1);
  assert.equal(list.json.requests[0].details.amount, '200.00');
  assert.equal(list.json.requests[0].details.currency, 'USD');
  assert.match(list.json.requests[0].details.verification, /^Unverified/);
  const naira = await next.request('/api/requests', { method: 'POST', body: { ...body, requestToken: crypto.randomUUID(), currency: 'NGN', amount: '280000' } });
  assert.equal(naira.status, 201);
  const combined = await f.request('/api/inbox/requests?kind=payment', { cookie });
  assert.equal(combined.json.total, 2);
  const opay = combined.json.requests.find(row => row.reference === naira.json.reference);
  assert.equal(opay.details.amount, '280000.00');
  assert.match(opay.details.verification, /OPay/);
  for (const changed of [{ amount: '0' }, { amount: '1.001' }, { currency: 'GBP' }, { transferReference: '' }, { plan: 'Unknown' }]) {
    assert.equal((await next.request('/api/requests', { method: 'POST', body: { ...body, ...changed, requestToken: crypto.randomUUID() } })).status, 422);
  }
});

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
  const trial = { kind: 'trial', requestToken: crypto.randomUUID(), email: 'trial@example.invalid', name: 'Test Parent', grade: 'Grade 8', curriculum: 'US: Common Core', timeZone: 'America/Toronto', availability: 'Tuesday 4 pm', plan: 'Growth', message: 'Algebra support' };
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
