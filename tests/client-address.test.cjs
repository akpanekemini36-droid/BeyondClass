'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClientAddressResolver, normalizeIP } = require('../lib/client-address.cjs');
const req = (peer, forwarded) => ({ socket: { remoteAddress: peer }, headers: { 'x-forwarded-for': forwarded } });

test('proxy trust walks valid address chains from the nearest hop and ignores forged entries', () => {
  const resolve = createClientAddressResolver('127.0.0.1/32, 10.0.0.0/24, 2001:db8::/32');
  assert.equal(resolve(req('::ffff:127.0.0.1', 'garbage, 203.0.113.9, 10.0.0.2')), '203.0.113.9');
  assert.equal(resolve(req('2001:db8::1', '203.0.113.9, 2001:db8::2')), '203.0.113.9');
  assert.equal(resolve(req('198.51.100.1', '203.0.113.9')), '198.51.100.1');
  assert.equal(resolve(req('127.0.0.1', '203.0.113.9, invalid')), '127.0.0.1');
  assert.equal(resolve(req('127.0.0.1', '203.0.113.9:1234')), '127.0.0.1');
  assert.equal(resolve(req('127.0.0.1', 'x'.repeat(4097))), '127.0.0.1');
  assert.equal(createClientAddressResolver()(req('127.0.0.1', '203.0.113.9')), '127.0.0.1');
});

test('IPv6 and mapped IPv4 addresses normalize to one rate-limit identity', () => {
  assert.equal(normalizeIP('2001:0db8:0000:0000:0:0:0:1'), '2001:db8::1');
  assert.equal(normalizeIP('::ffff:192.0.2.1'), '192.0.2.1');
  assert.equal(normalizeIP('::ffff:c000:201'), '192.0.2.1');
  assert.equal(normalizeIP('192.000.2.1'), null);
  assert.equal(normalizeIP('not-an-ip'), null);
  const resolve = createClientAddressResolver('::ffff:127.0.0.1/128');
  assert.equal(resolve(req('127.0.0.1', '203.0.113.9')), '203.0.113.9');
});

test('invalid and trust-all proxy configurations fail closed at startup', () => {
  for (const value of [true, ['invalid'], '127.0.0.1/33', '::1/129', '0.0.0.0/0', '::/0', '127.0.0.1/not-a-mask']) {
    assert.throws(() => createClientAddressResolver(value), /TRUSTED_PROXIES/);
  }
});
