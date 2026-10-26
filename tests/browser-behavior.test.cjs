'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => ({ ok: status < 400, ...data }) });

// Small DOM/event fixture: execute the actual browser scripts and control
// response timing without using real inbox data or a browser dependency.
function element() {
  const attributes = new Map();
  return {
    hidden: false, disabled: false, value: '', checked: false, textContent: '',
    children: [], listeners: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) || null; },
    removeAttribute(name) { attributes.delete(name); },
    append(...items) { this.children.push(...items); this.firstChild = this.children[0]; },
    replaceChildren(...items) { this.children = items; },
    querySelector() { return this.button || element(); },
    querySelectorAll() { return []; }, reset() {}, reportValidity() { return true; }
  };
}

test('Ultra checkout carries its currency, amount and lesson terms into the bank transfer notice', () => {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  get('checkoutPlan').value = 'Growth';
  get('checkoutCurrency').value = 'USD';
  const context = vm.createContext({
    document: { getElementById: get, querySelectorAll: () => [] },
    window: { location: { search: '?plan=Ultra&currency=NGN' } },
    URLSearchParams, URL, Intl
  });
  vm.runInContext(source('assets/plans.js'), context);
  vm.runInContext(source('assets/checkout-config.js'), context);
  vm.runInContext(source('assets/checkout.js'), context);
  assert.equal(get('checkoutPlan').value, 'Ultra');
  assert.equal(get('summaryPlan').textContent, 'Ultra');
  assert.match(get('summaryPrice').textContent, /490,000 \/ 4 weeks/);
  assert.equal(get('bankSelectedAmount').textContent, get('summaryPrice').textContent);
  assert.equal(get('transferAmount').value, 490000);
  assert.equal(get('transferPlan').textContent, 'Ultra');
  assert.match(get('summaryDetail').textContent, /Five private 90-minute lessons per week: 20 lessons and 30 hours every four weeks/);
  assert.equal(get('checkoutContact').href, 'contact.html?plan=Ultra#contact');
  assert.match(get('bankTransferHeading').textContent, /OPay/);

  get('checkoutCurrency').value = 'USD';
  get('checkoutCurrency').listeners.change();
  assert.equal(get('summaryPrice').textContent, '$350 / 4 weeks');
  assert.equal(get('bankSelectedAmount').textContent, '$350 / 4 weeks');
  assert.equal(get('transferAmount').value, 350);
  assert.match(get('bankTransferHeading').textContent, /Cleva/);
  get('transferAmount').value = '175';
  get('checkoutCurrency').listeners.change();
  assert.equal(get('transferAmount').value, '175', 'preserve the amount actually sent');
  get('checkoutPlan').value = 'Growth';
  get('checkoutPlan').listeners.change();
  assert.equal(get('summaryPrice').textContent, '$160 / 4 weeks');
  assert.equal(get('transferAmount').value, 160);
  assert.match(get('summaryDetail').textContent, /Three private 90-minute lessons/);
  for (const [plan, usd, ngn] of [['Essential', 120, 168000], ['Growth', 160, 224000], ['Ultra', 350, 490000]]) {
    get('checkoutPlan').value = plan;
    for (const [currency, amount] of [['USD', usd], ['NGN', ngn]]) {
      get('checkoutCurrency').value = currency;
      get('checkoutPlan').listeners.change();
      assert.equal(get('transferAmount').value, amount);
      assert.equal(get('summaryPlan').textContent, plan);
      assert.match(get('summaryPrice').textContent, /4 weeks$/);
      assert.equal(get('bankSelectedAmount').textContent, get('summaryPrice').textContent);
      assert.equal(get('checkoutContact').href, 'contact.html?plan=' + plan + '#contact');
    }
  }
});
function inboxFixture() {
  const nodes = new Map(), requests = [], events = {};
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  get('inboxContent').hidden = true;
  for (const id of ['inboxLoginForm', 'changeInboxPassword']) {
    get(id).button = element(); get(id).button.disabled = true;
  }
  vm.runInNewContext(source('assets/inbox.js'), {
    document: { getElementById: get, createElement: element },
    window: { addEventListener(name, fn) { events[name] = fn; } },
    URLSearchParams, Intl, Date,
    fetch(url, options) { return new Promise(resolve => requests.push({ url, options, resolve })); }
  });
  const take = part => {
    const index = requests.findIndex(request => request.url.includes(part));
    assert.notEqual(index, -1, 'Expected request: ' + part);
    return requests.splice(index, 1)[0];
  };
  return { get, take, requests, events };
}
const requestList = { requests: [{ id: 'test', kind: 'trial', status: 'new', reference: 'TEST', created_at: '2026-10-15T10:00:00Z', details: { name: 'Synthetic parent', email: 'review@example.invalid' } }], total: 1, unreadCount: 1, page: 1, pageSize: 30 };

async function shownInbox() {
  const f = inboxFixture();
  f.take('/session').resolve(response({})); await flush();
  const data = structuredClone(requestList);
  data.requests[0].status = 'new'; data.unreadCount = 1;
  f.take('/requests?').resolve(response(data)); await flush();
  return f;
}

test('automatic read and manual status actions cannot overlap, and counts change only once', async () => {
  const f = await shownInbox(), card = f.get('requestList').children[0], button = card.children.at(-1);
  card.open = true;
  const automatic = card.listeners.toggle();
  const patch = f.take('/requests/test');
  assert.equal(button.disabled, true);
  await button.listeners.click();
  assert.equal(f.requests.filter(item => item.options?.method === 'PATCH').length, 0);
  patch.resolve(response({ status: 'read', revision: 1 })); await automatic;
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Mark as new');
  assert.match(f.get('inboxCount').textContent, /0 new/);
  const manual = button.listeners.click();
  const next = f.take('/requests/test');
  assert.equal(JSON.parse(next.options.body).status, 'new');
  next.resolve(response({ status: 'new', revision: 2 })); await manual;
  assert.equal(button.textContent, 'Mark as read');
  assert.match(f.get('inboxCount').textContent, /1 new/);
});

test('a refreshed card stays locked until its existing status operation settles', async () => {
  const f = await shownInbox(), oldCard = f.get('requestList').children[0];
  oldCard.open = true;
  const automatic = oldCard.listeners.toggle();
  const patch = f.take('/requests/test');
  const refresh = f.get('refreshInbox').listeners.click();
  f.take('/requests?').resolve(response(structuredClone(requestList))); await refresh;
  const refreshed = f.get('requestList').children[0], button = refreshed.children.at(-1);
  assert.equal(button.disabled, true);
  await button.listeners.click();
  assert.equal(f.requests.filter(item => item.options?.method === 'PATCH').length, 0);
  patch.resolve(response({ status: 'read', revision: 1 })); await automatic;
  const latest = structuredClone(requestList); latest.requests[0].status = 'read'; latest.unreadCount = 0;
  f.take('/requests?').resolve(response(latest)); await flush();
  assert.equal(f.get('requestList').children[0].children.at(-1).disabled, false);
  assert.match(f.get('inboxCount').textContent, /0 new/);
});

test('a status response from before logout cannot change the next session or its counts', async () => {
  const f = await shownInbox(), card = f.get('requestList').children[0];
  card.open = true;
  const pending = card.listeners.toggle(), oldPatch = f.take('/requests/test');
  const logout = f.get('logoutInbox').listeners.click();
  f.take('/logout').resolve(response({})); await logout;
  const form = f.get('inboxLoginForm');
  const login = form.listeners.submit.call(form, { preventDefault() {} });
  f.take('/login').resolve(response({})); await flush();
  f.take('/requests?').resolve(response(structuredClone(requestList))); await login;
  oldPatch.resolve(response({ status: 'read', revision: 1 })); await pending;
  assert.match(f.get('inboxCount').textContent, /1 new/);
  assert.equal(f.get('requestList').children[0].children.at(-1).textContent, 'Mark as read');
});

test('an uncertain failed status response refreshes authoritative inbox counts', async () => {
  const f = await shownInbox(), card = f.get('requestList').children[0];
  card.open = true;
  const pending = card.listeners.toggle();
  f.take('/requests/test').resolve(response({ error: 'Could not confirm status' }, 503)); await pending;
  const latest = structuredClone(requestList); latest.requests[0].status = 'read'; latest.unreadCount = 0;
  f.take('/requests?').resolve(response(latest)); await flush();
  assert.match(f.get('inboxCount').textContent, /0 new/);
  assert.equal(f.get('requestList').children[0].children.at(-1).textContent, 'Mark as new');
});

test('sensitive forms fail safely before JavaScript initializes', () => {
  let count = 0;
  for (const file of ['index.html', 'resources.html', 'contact.html', 'inbox.html', 'payment.html']) {
    for (const match of source(file).matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)) {
      count++;
      assert.match(match[1], /\bmethod="post"/i, file + ' must never default to GET');
      const button = match[2].match(/<button\b[^>]*type="submit"[^>]*>/);
      assert(button, file + ' needs an explicit submit control');
      assert.match(button[0], /\bdisabled\b/, file + ' must block submission before its handler exists');
    }
  }
  assert.equal(count, 7);
  const fixture = inboxFixture();
  for (const id of ['inboxLoginForm', 'changeInboxPassword']) {
    assert.equal(typeof fixture.get(id).listeners.submit, 'function');
    assert.equal(fixture.get(id).button.disabled, false);
  }
});

test('a delayed inbox list cannot redisplay private requests after logout', async () => {
  const f = inboxFixture();
  f.take('/session').resolve(response({ canChangePassword: false })); await flush();
  const pendingList = f.take('/requests?');
  const logout = f.get('logoutInbox').listeners.click();
  f.take('/logout').resolve(response({})); await logout;
  pendingList.resolve(response(requestList)); await flush();
  assert.equal(f.get('inboxContent').hidden, true);
  assert.equal(f.get('inboxLogin').hidden, false);
  assert.equal(f.get('requestList').children.length, 0);
  assert.equal(f.get('inboxStatus').textContent, 'You are signed out.');
  assert.equal(f.requests.length, 0, 'stale list must not start analytics');
});

test('late unauthorized responses from the old session do not sign out a new login', async () => {
  const f = inboxFixture();
  f.take('/session').resolve(response({})); await flush();
  const oldList = f.take('/requests?');
  const logout = f.get('logoutInbox').listeners.click();
  f.take('/logout').resolve(response({})); await logout;
  const form = f.get('inboxLoginForm');
  const login = form.listeners.submit.call(form, { preventDefault() {} });
  f.take('/login').resolve(response({})); await flush();
  const newList = f.take('/requests?');
  oldList.resolve(response({ error: 'Expired session' }, 401)); await flush();
  newList.resolve(response(requestList)); await login;
  assert.equal(f.get('inboxContent').hidden, false);
  assert.equal(f.get('requestList').children.length, 1);
  assert.equal(f.get('inboxStatus').textContent, '');
});

test('pagehide invalidates both pending list and pending session checks', async () => {
  for (const stage of ['session', 'list']) {
    const f = inboxFixture();
    let pending = f.take('/session');
    if (stage === 'list') {
      pending.resolve(response({})); await flush(); pending = f.take('/requests?');
    }
    f.events.pagehide(); pending.resolve(response(stage === 'list' ? requestList : {})); await flush();
    assert.equal(f.get('inboxContent').hidden, true);
    assert.equal(f.get('requestList').children.length, 0);
    assert.equal(f.requests.length, 0);
  }
});

function siteFixture(protocol = 'file:', hash = '') {
  const nodes = new Map(), requests = [], events = {}, redirects = [];
  const location = { protocol, hash, search: '', pathname: '/', replace(url) { redirects.push(url); } };
  for (const id of ['triCanvas', 'triShape', 'triRandomize', 'bookingForm', 'formStatus', 'freeResourceForm', 'frStatus']) nodes.set(id, element());
  const handles = ['A', 'B', 'C'].map(key => {
    for (const prefix of ['triPoint', 'triText', 'triEq']) nodes.set(prefix + key, element());
    const handle = element(); handle.setAttribute('data-vertex', key); return handle;
  });
  const svg = nodes.get('triCanvas');
  svg.viewBox = { baseVal: { x: 0, y: 0, width: 700, height: 400 } };
  svg.querySelectorAll = () => handles;
  svg.getScreenCTM = () => ({ inverse() { return {}; } });
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return this; } });
  for (const id of ['bookingForm', 'freeResourceForm']) {
    nodes.get(id).button = element(); nodes.get(id).button.disabled = true;
  }
  const formFields = { bookingForm: ['parentName', 'email', 'studentGrade', 'curriculum', 'bookingTimeZone', 'bookingAvailability', 'planInterest', 'message'], freeResourceForm: ['frEmail', 'frGrade', 'frTopic'] };
  for (const [formId, fields] of Object.entries(formFields)) {
    fields.forEach(id => { nodes.set(id, element()); nodes.get(id).value = 'Test ' + id; });
    nodes.get(formId).reset = () => fields.forEach(id => { nodes.get(id).value = ''; });
  }
  nodes.get('planInterest').options = [];
  vm.runInNewContext(source('assets/site.js'), {
    document: { documentElement: element(), visibilityState: 'hidden', addEventListener() {}, getElementById: id => nodes.get(id) || null, querySelector: () => null, querySelectorAll: () => [] },
    window: { location, addEventListener(name, callback) { events[name] = callback; }, crypto: crypto.webcrypto, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    navigator: { doNotTrack: '1' }, URLSearchParams, Uint8Array, AbortController, setTimeout, clearTimeout,
    fetch(url, options) { return new Promise(resolve => requests.push({ url, options, resolve })); }
  });
  return { nodes, handles, requests, events, redirects, location };
}

test('public form buttons enable only after their submit handlers are attached', () => {
  const { nodes } = siteFixture();
  for (const id of ['bookingForm', 'freeResourceForm']) {
    assert.equal(typeof nodes.get(id).listeners.submit, 'function');
    assert.equal(nodes.get(id).button.disabled, false);
  }
});

test('inherited or unexpected URL fragments cannot interrupt form initialization', () => {
  for (const hash of ['#__proto__', '#constructor', '#toString', '#unknown', '#%E0%A4%A']) {
    const { nodes } = siteFixture('https:', hash);
    for (const id of ['bookingForm', 'freeResourceForm']) {
      assert.equal(typeof nodes.get(id).listeners.submit, 'function', hash);
      assert.equal(nodes.get(id).button.disabled, false, hash);
    }
  }
});

test('allowlisted section fragments redirect on arrival and on later hash changes', () => {
  assert.deepEqual(siteFixture('https:', '#pricing').redirects, ['pricing.html#pricing']);
  const f = siteFixture('https:');
  f.location.hash = '#contact';
  f.events.hashchange();
  assert.deepEqual(f.redirects, ['contact.html#contact']);
  f.location.hash = '#__proto__';
  f.events.hashchange();
  assert.equal(f.redirects.length, 1);
  assert.equal(f.nodes.get('bookingForm').button.disabled, false);
});

test('triangle keyboard and pointer movements reject flat shapes but allow valid movement', () => {
  const { nodes, handles } = siteFixture();
  const top = handles[2];
  for (let i = 0; i < 22; i++) top.listeners.keydown({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(nodes.get('triShape').getAttribute('points'), '140,300 560,300 350,290');
  const angles = ['A', 'B', 'C'].map(key => parseInt(nodes.get('triEq' + key).textContent, 10));
  assert(angles.every(angle => angle > 0 && angle < 180));
  assert.equal(angles.reduce((sum, angle) => sum + angle, 0), 180);
  top.listeners.pointerdown({ preventDefault() {}, pointerId: 1 });
  for (const y of [300, 299.99]) top.listeners.pointermove({ clientX: 350, clientY: y, preventDefault() {} });
  assert.equal(nodes.get('triShape').getAttribute('points'), '140,300 560,300 350,290');
  top.listeners.pointermove({ clientX: 350, clientY: 330, preventDefault() {} });
  assert.equal(nodes.get('triShape').getAttribute('points'), '140,300 560,300 350,330');
});

test('latest inbox filter wins regardless of response order', async () => {
  for (const latestFirst of [true, false]) {
    const f = inboxFixture();
    f.take('/session').resolve(response({})); await flush();
    const oldList = f.take('/requests?');
    f.get('inboxKind').value = 'trial'; f.get('inboxKind').listeners.change();
    const latest = f.take('/requests?');
    assert.match(latest.url, /kind=trial/);
    const oldResult = { ...requestList, requests: [{ ...requestList.requests[0], kind: 'materials', details: { topic: 'Fractions' } }] };
    const order = latestFirst ? [[latest, requestList], [oldList, oldResult]] : [[oldList, oldResult], [latest, requestList]];
    order[0][0].resolve(response(order[0][1])); await flush();
    if (!latestFirst) assert.equal(f.get('requestList').children.length, 0, 'old results must not render while the new filter loads');
    order[1][0].resolve(response(order[1][1])); await flush();
    assert.equal(f.get('requestList').children[0].children[0].children[0].textContent, 'Trial booking: Synthetic parent');
    assert.equal(f.requests.filter(r => r.url.includes('/analytics')).length, 1);
  }
});

test('reading the first 30 unread requests does not skip the final request', async () => {
  const f = inboxFixture(); f.get('inboxUnread').checked = true;
  f.take('/session').resolve(response({})); await flush();
  f.take('/requests?').resolve(response({ ...requestList, total: 31, unreadCount: 31, requests: Array.from({ length: 30 }, (_, i) => ({ ...requestList.requests[0], id: String(i) })) })); await flush();
  for (const card of f.get('requestList').children) {
    card.open = true; const mark = card.listeners.toggle();
    f.take('/api/inbox/requests/').resolve(response({})); await mark;
  }
  assert.equal(f.get('requestList').children.length, 30, 'open requests must stay readable');
  assert.equal(f.get('inboxCount').textContent, '1 matching request · 1 new overall');
  assert.equal(f.get('nextInboxPage').disabled, false);
  assert.equal(f.get('nextInboxPage').textContent, 'Show remaining new requests');
  f.get('nextInboxPage').listeners.click();
  const remaining = f.take('/requests?'); assert.match(remaining.url, /page=1&/);
  remaining.resolve(response({ ...requestList, requests: [{ ...requestList.requests[0], id: '30' }] })); await flush();
  assert.equal(f.get('requestList').children.length, 1);
  assert.equal(f.get('inboxPageLabel').textContent, 'Page 1 of 1');
  assert.equal(f.get('nextInboxPage').disabled, true);
  const card = f.get('requestList').children[0]; card.open = true;
  const mark = card.listeners.toggle(); f.take('/api/inbox/requests/').resolve(response({})); await mark;
  card.open = false; await card.listeners.toggle();
  f.take('/requests?').resolve(response({ ...requestList, requests: [], total: 0, unreadCount: 0 })); await flush();
  assert.equal(f.get('inboxCount').textContent, '0 matching requests · 0 new overall');
});

test('an emptied last inbox page reloads the last valid page', async () => {
  const f = inboxFixture();
  f.take('/session').resolve(response({})); await flush();
  f.take('/requests?').resolve(response({ ...requestList, total: 31 })); await flush();
  f.get('nextInboxPage').listeners.click();
  f.take('/requests?').resolve(response({ ...requestList, requests: [], page: 2 })); await flush();
  const corrected = f.take('/requests?'); assert.match(corrected.url, /page=1&/);
  corrected.resolve(response(requestList)); await flush();
  assert.equal(f.get('inboxPageLabel').textContent, 'Page 1 of 1');
  assert.equal(f.get('requestList').children.length, 1);
});

test('public forms preserve edits made while sending, reset unchanged success, and keep failed entries', async () => {
  for (const [formId, field, payloadField, statusId] of [['bookingForm', 'message', 'message', 'formStatus'], ['freeResourceForm', 'frTopic', 'topic', 'frStatus']]) {
    for (const outcome of ['edited', 'unchanged', 'failed']) {
      const f = siteFixture('https:'), form = f.nodes.get(formId);
      const original = f.nodes.get(field).value;
      const submit = form.listeners.submit({ preventDefault() {} });
      const pending = f.requests.shift();
      assert.equal(JSON.parse(pending.options.body)[payloadField], original);
      if (outcome === 'edited') f.nodes.get(field).value = 'New unsent text';
      pending.resolve(outcome === 'failed' ? response({ error: 'Try again' }, 503) : response({ reference: 'TEST' }));
      await submit;
      assert.equal(f.nodes.get(field).value, outcome === 'edited' ? 'New unsent text' : outcome === 'failed' ? original : '');
      if (outcome === 'edited') assert.match(f.nodes.get(statusId).textContent, /later edits.*have not been sent/);
      assert.equal(form.button.disabled, false);
      assert.equal(form.getAttribute('aria-busy'), null);
    }
  }
});
