'use strict';
const { BlockList, isIP } = require('node:net');

function normalizeIP(value) {
  if (typeof value !== 'string' || value.includes('%')) return null;
  const address = value.trim(), family = isIP(address);
  if (family === 4) return address;
  if (family !== 6) return null;
  const canonical = new URL('http://[' + address + ']/').hostname.slice(1, -1);
  const mapped = canonical.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/);
  if (!mapped) return canonical;
  const high = Number.parseInt(mapped[1], 16), low = Number.parseInt(mapped[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

function createClientAddressResolver(configuration = '') {
  if (typeof configuration !== 'string' && !Array.isArray(configuration)) throw new Error('TRUSTED_PROXIES must list explicit proxy IP addresses or CIDR ranges.');
  const rules = new BlockList();
  const entries = Array.isArray(configuration) ? configuration : configuration.split(',');
  for (const entry of entries) {
    if (typeof entry !== 'string') throw new Error('TRUSTED_PROXIES contains an invalid address.');
    if (!entry.trim()) continue;
    const parts = entry.trim().split('/'), address = normalizeIP(parts[0]);
    const originalFamily = isIP(parts[0]), family = isIP(address || '');
    let prefix = parts.length === 1 ? (family === 4 ? 32 : 128) : Number(parts[1]);
    if (originalFamily === 6 && family === 4 && parts.length === 2) prefix -= 96;
    if (!address || parts.length > 2 || (parts.length === 2 && !/^\d+$/.test(parts[1])) || !Number.isInteger(prefix) || prefix <= 0 || prefix > (family === 4 ? 32 : 128)) {
      throw new Error('TRUSTED_PROXIES must contain valid, explicit proxy IP addresses or CIDR ranges; trust-all ranges are not allowed.');
    }
    rules.addSubnet(address, prefix, family === 4 ? 'ipv4' : 'ipv6');
  }
  const trusted = address => rules.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');
  return function clientAddress(req) {
    const peer = normalizeIP(req.socket.remoteAddress);
    if (!peer) return 'unknown';
    const header = req.headers['x-forwarded-for'];
    if (!trusted(peer) || typeof header !== 'string' || header.length > 4096) return peer;
    const chain = header.split(',');
    if (chain.length > 50) return peer;
    let current = peer;
    for (let index = chain.length - 1; index >= 0 && trusted(current); index--) {
      const next = normalizeIP(chain[index]);
      if (!next) return peer;
      current = next;
    }
    // Stop at the nearest untrusted hop, ignoring any spoofable entries to its left.
    return current;
  };
}
module.exports = { createClientAddressResolver, normalizeIP };
