'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createApp } = require('../server.cjs');
const TEST_PASSWORD = 'test-only-inbox-password';

async function fixture(t, generatedPassword = false, appOptions = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beyondclass-inbox-test-'));
  let app, base;
  async function start() {
    app = createApp({dataDir,...appOptions,...(generatedPassword ? {} : {password: TEST_PASSWORD})});
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + app.server.address().port;
  }
  async function stop() { await new Promise(resolve => app.server.close(resolve)); }
  await start();
  t.after(async () => {
    await stop();
    const resolved = path.resolve(dataDir);
    assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(path.basename(resolved).startsWith('beyondclass-inbox-test-'));
    fs.rmSync(resolved, {recursive:true,force:true});
  });
  return {
    dataDir,
    restart: async () => { await stop(); await start(); },
    request: async (route, {method='GET', body, cookie, origin, headers={}} = {}) => {
      const response = await fetch(base + route, {
        method, headers: {...(body===undefined ? {} : {'Content-Type':'application/json',Origin:origin || base}),...(cookie ? {Cookie:cookie} : {}),...headers},
        ...(body===undefined ? {} : {body:JSON.stringify(body)})
      });
      const text = await response.text();
      let json; try {json=JSON.parse(text);} catch (_) {}
      return {status:response.status,headers:response.headers,json,text};
    },
    login: async function (password=TEST_PASSWORD) {
      const result = await this.request('/api/inbox/login',{method:'POST',body:{password}});
      assert.equal(result.status,200);
      return result.headers.get('set-cookie').split(';')[0];
    }
  };
}
const material = overrides => ({kind:'materials',requestToken:crypto.randomUUID(),email:'parent@example.invalid',grade:'Year 7',topic:'Fractions',...overrides});
const trial = () => ({kind:'trial',requestToken:crypto.randomUUID(),email:'trial@example.invalid',name:'Test Parent',grade:'Grade 8',curriculum:'US: Common Core',timeZone:'America/Toronto',availability:'Tuesday 4 pm',plan:'Growth',message:'Help with algebra.'});

test('trusted proxy clients have independent limits; spoofed leftmost addresses cannot reset them', async t => {
  const f = await fixture(t, false, { trustedProxies: ['127.0.0.1/32'] });
  for (let i = 1; i <= 21; i++) {
    assert.equal((await f.request('/api/requests', { method: 'POST', body: material(), headers: { 'X-Forwarded-For': '203.0.113.' + i } })).status, 201);
  }
  for (let i = 0; i < 19; i++) {
    assert.equal((await f.request('/api/requests', { method: 'POST', body: material(), headers: { 'X-Forwarded-For': '198.51.100.' + i + ', 203.0.113.1' } })).status, 201);
  }
  assert.equal((await f.request('/api/requests', { method: 'POST', body: material(), headers: { 'X-Forwarded-For': '192.0.2.99, 203.0.113.1' } })).status, 429);
});

test('forwarded headers from an untrusted connection cannot bypass rate limits', async t => {
  const f = await fixture(t, false, { trustedProxies: '' });
  for (let i = 0; i < 20; i++) assert.equal((await f.request('/api/requests', { method: 'POST', body: material(), headers: { 'X-Forwarded-For': '203.0.113.' + i } })).status, 201);
  assert.equal((await f.request('/api/requests', { method: 'POST', body: material(), headers: { 'X-Forwarded-For': '198.51.100.99' } })).status, 429);
});

test('Node password setup and login enforce the same length boundaries', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beyondclass-password-boundary-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  for (const length of [11, 257]) assert.throws(() => createApp({ dataDir, password: 'x'.repeat(length) }), /between 12 and 256/);
  for (const length of [12, 256]) {
    const password = 'x'.repeat(length), app = createApp({ dataDir, password });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + app.server.address().port;
    try {
      const login = await fetch(origin + '/api/inbox/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ password }) });
      assert.equal(login.status, 200);
      await login.text();
    } finally { await new Promise(resolve => app.server.close(resolve)); }
  }
});

test('bookings require an explicit curriculum and save time zone and availability; sample PDF needs no form', async t => {
  const f = await fixture(t);
  for (const changed of [{ curriculum: '' }, { timeZone: '' }, { availability: '' }]) {
    assert.equal((await f.request('/api/requests', { method: 'POST', body: { ...trial(), ...changed } })).status, 422);
  }
  assert.equal((await f.request('/api/requests', { method: 'POST', body: { ...trial(), curriculum: 'Canada: provincial curriculum' } })).status, 201);
  const cookie = await f.login();
  const saved = (await f.request('/api/inbox/requests?kind=trial', { cookie })).json.requests[0];
  assert.equal(saved.details.timeZone, 'America/Toronto');
  assert.equal(saved.details.availability, 'Tuesday 4 pm');
  const pdf = await f.request('/assets/materials/grade9-probability-homework.pdf', { method: 'HEAD' });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
});

test('USD transfer notices remain unverified, private, retry-safe and separately filterable', async t => {
  const f = await fixture(t);
  const body = { kind: 'payment', requestToken: crypto.randomUUID(), name: 'Synthetic Parent', email: 'transfer@example.invalid', plan: 'Confidence Week', currency: 'USD', amount: '19.99', transferReference: 'TEST-TRANSFER', message: 'Test only', verification: 'Paid' };
  const sent = await f.request('/api/requests', { method: 'POST', body });
  assert.equal(sent.status, 201);
  assert.equal((await f.request('/api/requests', { method: 'POST', body })).json.reference, sent.json.reference);
  assert.equal((await f.request('/api/inbox/requests?kind=payment')).status, 401);
  await f.request('/api/requests', { method: 'POST', body: trial() });
  const cookie = await f.login();
  const list = await f.request('/api/inbox/requests?kind=payment', { cookie });
  assert.equal(list.json.total, 1);
  const saved = list.json.requests[0];
  assert.equal(saved.details.amount, '19.99');
  assert.equal(saved.details.currency, 'USD');
  assert.match(saved.details.verification, /^Unverified/);
  await f.request('/api/inbox/requests/' + saved.id, { method: 'PATCH', cookie, body: { status: 'read' } });
  const read = await f.request('/api/inbox/requests?kind=payment', { cookie });
  assert.match(read.json.requests[0].details.verification, /^Unverified/);
  const naira = await f.request('/api/requests', { method: 'POST', body: { ...body, requestToken: crypto.randomUUID(), plan: 'Flexible', currency: 'NGN', amount: '280000' } });
  assert.equal(naira.status, 201);
  const combined = await f.request('/api/inbox/requests?kind=payment', { cookie });
  assert.equal(combined.json.total, 2);
  const opay = combined.json.requests.find(row => row.reference === naira.json.reference);
  assert.equal(opay.details.amount, '280000.00');
  assert.match(opay.details.verification, /OPay/);
  for (const changed of [{ amount: '0' }, { amount: '-1' }, { amount: '1.234' }, { amount: 'NaN' }, { amount: '100000' }, { currency: 'GBP' }, { plan: 'Unknown' }, { transferReference: '' }]) {
    assert.equal((await f.request('/api/requests', { method: 'POST', body: { ...body, ...changed, requestToken: crypto.randomUUID() } })).status, 422);
  }
});

test('logout still revokes the local session after the API allowance is exhausted', async t => {
  const f = await fixture(t), cookie = await f.login();
  for (let i = 0; i < 149; i++) assert.equal((await f.request('/api/inbox/session', { cookie })).status, 200);
  assert.equal((await f.request('/api/inbox/session', { cookie })).status, 429);
  assert.equal((await f.request('/api/inbox/logout', { method: 'POST', body: {}, cookie, origin: 'https://other.invalid' })).status, 403);
  const logout = await f.request('/api/inbox/logout', { method: 'POST', body: {}, cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await f.request('/api/inbox/logout', { method: 'POST', body: {}, cookie })).status, 401);
});

test('materials and trials save directly, remain private, and support owner read status',async t=>{
  const f=await fixture(t);
  const sent=await f.request('/api/requests',{method:'POST',body:material()});
  assert.equal(sent.status,201); assert.match(sent.json.reference,/^BC-[A-F0-9]{12}$/);
  assert.equal((await f.request('/api/requests',{method:'POST',body:trial()})).status,201);
  assert.equal((await f.request('/api/inbox/requests')).status,401);
  assert.equal((await f.request('/api/inbox/login',{method:'POST',body:{password:'wrong'}})).status,401);
  const login=await f.request('/api/inbox/login',{method:'POST',body:{password:TEST_PASSWORD}});
  assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const list=await f.request('/api/inbox/requests',{cookie});
  assert.equal(list.json.total,2); assert.equal(list.json.unreadCount,2);
  const saved=list.json.requests.find(r=>r.reference===sent.json.reference);
  assert.equal(saved.details.topic,'Fractions');
  assert.equal((await f.request('/api/inbox/requests/'+saved.id,{method:'PATCH',cookie,body:{status:'read'}})).status,200);
  const filtered=await f.request('/api/inbox/requests?kind=materials&unread=1',{cookie});
  assert.equal(filtered.json.total,0); assert.equal(filtered.json.unreadCount,1);
  assert.equal((await f.request('/api/inbox/logout',{method:'POST',cookie,body:{}})).status,200);
  assert.equal((await f.request('/api/inbox/requests',{cookie})).status,401);
});

test('retries do not duplicate saved requests and storage survives server restart',async t=>{
  const f=await fixture(t), body=material();
  const first=await f.request('/api/requests',{method:'POST',body});
  const retry=await f.request('/api/requests',{method:'POST',body});
  assert.equal(first.json.reference,retry.json.reference);
  assert.equal((await f.request('/api/requests',{method:'POST',body:{...body,topic:'A different request'}})).status,409);
  await f.restart();
  const cookie=await f.login();
  const result=await f.request('/api/inbox/requests',{cookie});
  assert.equal(result.json.total,1);
  assert.equal(result.json.requests[0].reference,first.json.reference);
});

test('public pages and search files have security headers; private routes stay out of search', async t => {
  const f = await fixture(t);
  const home = await f.request('/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-security-policy'), /script-src-attr 'none'/);
  assert.match(home.headers.get('content-security-policy'), /object-src 'none'/);
  assert.match(home.headers.get('content-security-policy'), /sha256-/);
  assert.equal(home.headers.get('x-frame-options'), 'DENY');
  assert.equal((await f.request('/inbox.html')).headers.get('x-robots-tag'), 'noindex, nofollow');
  const sitemap = await f.request('/sitemap.xml');
  assert.equal(sitemap.status, 200); assert.match(sitemap.headers.get('content-type'), /application\/xml/);
  assert(!sitemap.text.includes('inbox.html'));
  assert.equal((await f.request('/robots.txt')).status, 200);
});

test('validation, body limits, origin checks and private-file restrictions reject invalid access',async t=>{
  const f=await fixture(t);
  for(const body of [material({email:'invalid'}),material({grade:''}),material({topic:'x'.repeat(301)}),material({kind:'unknown'}),material({website:'spam'}),material({requestToken:'invalid'})]) {
    assert.equal((await f.request('/api/requests',{method:'POST',body})).status,422);
  }
  assert.equal((await f.request('/api/requests',{method:'POST',body:material(),origin:'https://other.invalid'})).status,403);
  assert.equal((await f.request('/api/requests',{method:'POST',body:material(),headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await f.request('/api/requests',{method:'POST',body:material({topic:'x'.repeat(17000)})})).status,413);
  for(const route of ['/.data/requests.sqlite','/.data/inbox-password.txt','/server.cjs','/assets/..%2f.data%2finbox-auth.json']) {
    assert.equal((await f.request(route)).status,404);
  }
  const cookie=await f.login();
  assert.equal((await f.request('/api/inbox/requests',{cookie})).json.total,0);
});

test('owner can change the generated password; old sessions and password stop working',async t=>{
  const f=await fixture(t,true);
  const initial=fs.readFileSync(path.join(f.dataDir,'inbox-password.txt'),'utf8').trim();
  const cookie=await f.login(initial);
  const next='new-test-only-inbox-password';
  assert.equal((await f.request('/api/inbox/password',{method:'POST',cookie,body:{currentPassword:'wrong',newPassword:next}})).status,401);
  assert.equal((await f.request('/api/inbox/password',{method:'POST',cookie,body:{currentPassword:initial,newPassword:next}})).status,200);
  assert.equal(fs.existsSync(path.join(f.dataDir,'inbox-password.txt')),false);
  assert.equal(fs.readFileSync(path.join(f.dataDir,'inbox-auth.json'),'utf8').includes(next),false);
  assert.equal((await f.request('/api/inbox/requests',{cookie})).status,401);
  assert.equal((await f.request('/api/inbox/login',{method:'POST',body:{password:initial}})).status,401);
  await f.restart();
  await f.login(next);
});

test('environment-managed passwords cannot be changed through the owner interface',async t=>{
  const f=await fixture(t);
  const cookie=await f.login();
  assert.equal((await f.request('/api/inbox/session',{cookie})).json.canChangePassword,false);
  assert.equal((await f.request('/api/inbox/password',{method:'POST',cookie,body:{currentPassword:TEST_PASSWORD,newPassword:'some-other-long-password'}})).status,409);
});

test('login attempts and public submissions have bounded rates',async t=>{
  const f=await fixture(t);
  for(let i=0;i<8;i++) assert.equal((await f.request('/api/inbox/login',{method:'POST',body:{password:'incorrect'}})).status,401);
  const limited=await f.request('/api/inbox/login',{method:'POST',body:{password:'incorrect'}});
  assert.equal(limited.status,429); assert(limited.headers.get('retry-after'));
  const same=material();
  for(let i=0;i<20;i++) assert.equal((await f.request('/api/requests',{method:'POST',body:same})).status,201);
  assert.equal((await f.request('/api/requests',{method:'POST',body:same})).status,429);
});

test('background video is served as MP4 with bounded byte ranges and HEAD metadata',async t=>{
  const f=await fixture(t);
  const videoFile=path.join(__dirname,'../assets/media/teaching-approach.mp4');
  const bytes=fs.readFileSync(videoFile);
  const route='/assets/media/teaching-approach.mp4';
  const head=await f.request(route,{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(head.headers.get('content-type'),'video/mp4');
  assert.equal(Number(head.headers.get('content-length')),bytes.length);
  assert.equal(head.text,'');
  const first=await f.request(route,{headers:{Range:'bytes=0-15'}});
  assert.equal(first.status,206);
  assert.equal(first.headers.get('content-range'),'bytes 0-15/'+bytes.length);
  assert.equal(first.text,bytes.subarray(0,16).toString('utf8'));
  const suffix=await f.request(route,{headers:{Range:'bytes=-16'}});
  assert.equal(suffix.status,206);
  assert.equal(suffix.headers.get('content-range'),'bytes '+(bytes.length-16)+'-'+(bytes.length-1)+'/'+bytes.length);
  for(const range of ['bytes='+bytes.length+'-','bytes=7-2','bytes=-0','bytes=invalid','bytes=0-1,3-4']) {
    const invalid=await f.request(route,{headers:{Range:range}});
    assert.equal(invalid.status,416);
    assert.equal(invalid.headers.get('content-range'),'bytes */'+bytes.length);
  }
});

test('local anonymous page counts persist, stay private, and omit personal input', async t => {
  const f = await fixture(t);
  for (const page of ['index.html', 'index.html', 'pricing.html']) assert.equal((await f.request('/api/pageviews', { method: 'POST', body: { page, email: 'not-stored@example.invalid' } })).status, 200);
  assert.equal((await f.request('/api/pageviews', { method: 'POST', body: { page: 'inbox.html' } })).status, 422);
  assert.equal((await f.request('/api/pageviews', { method: 'POST', body: { page: 'index.html?private=value' } })).status, 422);
  assert.equal((await f.request('/api/pageviews', { method: 'POST', body: { page: 'index.html' }, headers: { DNT: '1' } })).status, 200);
  assert.equal((await f.request('/api/pageviews', { method: 'POST', body: { page: 'index.html' }, headers: { 'Sec-GPC': '1' } })).status, 200);
  assert.equal((await f.request('/api/inbox/analytics')).status, 401);
  await f.restart();
  const cookie = await f.login(), totals = await f.request('/api/inbox/analytics?days=7', { cookie });
  assert.equal(totals.json.total, 3); assert.equal(totals.json.today, 3); assert.equal(totals.json.daily.length, 7);
  assert.equal(totals.json.pages.find(page => page.page === 'index.html').views, 2);
  assert(!JSON.stringify(totals.json).includes('not-stored'));
});
