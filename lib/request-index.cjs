'use strict';
const crypto = require('node:crypto');
const { fail } = require('./request-validation.cjs');
const KEY = 'request-index/v1';
const PENDING = 'request-index-pending/';
const summary = row => ({ id: row.id, kind: row.kind, status: row.status, created_at: row.created_at, revision: row.revision || 0 });
const order = (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);

function createRequestIndex(store, { now = Date.now } = {}) {
  async function writeIndex(updates) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const entry = await store.getWithMetadata(KEY, { type: 'json' });
      if (entry && (!entry.etag || !Array.isArray(entry.data.entries))) throw fail(503, 'The inbox could not be loaded. Please try again.');
      const entries = new Map((entry?.data.entries || []).map(item => [item.id, item]));
      for (const next of updates) {
        const previous = entries.get(next.id);
        if (!previous || (previous.revision || 0) <= next.revision) entries.set(next.id, next);
      }
      const data = { schemaVersion: 2, entries: [...entries.values()].sort(order) };
      if (entry?.data.schemaVersion === 2 && JSON.stringify(entry.data.entries) === JSON.stringify(data.entries)) return entry;
      const result = await store.setJSON(KEY, data, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
      if (result.modified) return { data, etag: result.etag };
    }
    throw fail(503, 'The inbox is busy. Please try again.');
  }
  async function reconcileAll() {
    const entries = [];
    for await (const batch of store.list({ prefix: 'requests/', paginate: true })) {
      for (let offset = 0; offset < batch.blobs.length; offset += 20) {
        const rows = await Promise.all(batch.blobs.slice(offset, offset + 20).map(blob => store.get(blob.key, { type: 'json' })));
        entries.push(...rows.filter(Boolean).map(summary));
      }
    }
    return writeIndex(entries);
  }
  async function ensure() {
    const entry = await store.getWithMetadata(KEY, { type: 'json' });
    // Upgrade older indexes too: previously saved requests may be missing.
    return entry?.data.schemaVersion === 2 ? entry : reconcileAll();
  }
  async function upsert(row) {
    await ensure();
    return writeIndex([summary(row)]);
  }
  async function prepare(id, expectedRevision = 0) {
    const key = PENDING + id + '/' + crypto.randomUUID();
    // Persist before changing the request. Each operation owns its marker.
    const result = await store.setJSON(key, { id, expectedRevision, createdAt: now() }, { onlyIfNew: true });
    if (!result.modified) throw fail(503, 'The website is busy. Please try again.');
    return key;
  }
  async function repairOne(key, { expireOrphans = false } = {}) {
    const pending = await store.get(key, { type: 'json' });
    if (!pending) return;
    const row = await store.get('requests/' + pending.id, { type: 'json' });
    if (!row || (row.revision || 0) < (pending.expectedRevision || 0)) {
      // A prepared status write can still be in flight even when its old row
      // exists. Only repair a revision that reached this attempt's target.
      if (expireOrphans && now() - pending.createdAt >= 86400000) await store.delete(key);
      return;
    }
    await upsert(row);
    await store.delete(key);
  }
  async function tryCommit(key) {
    try { await repairOne(key); return true; }
    catch (_) { return false; } // A durable marker remains for automatic retry.
  }
  async function reconcilePending(options) {
    for await (const batch of store.list({ prefix: PENDING, paginate: true })) {
      for (let offset = 0; offset < batch.blobs.length; offset += 10) {
        await Promise.all(batch.blobs.slice(offset, offset + 10).map(blob => repairOne(blob.key, options)));
      }
    }
  }
  async function reconcile() {
    await reconcileAll();
    await reconcilePending({ expireOrphans: true });
  }
  async function page({ page, kind, unread }) {
    await ensure();
    // Fail rather than show incomplete lists/counts while repair is unavailable.
    await reconcilePending();
    const entry = await store.getWithMetadata(KEY, { type: 'json' });
    const entries = entry.data.entries;
    const matching = entries.filter(item => (!kind || item.kind === kind) && (!unread || item.status === 'new'));
    const selected = matching.slice((page - 1) * 30, page * 30);
    const requests = [];
    for (let offset = 0; offset < selected.length; offset += 10) {
      const items = selected.slice(offset, offset + 10);
      const rows = await Promise.all(items.map(item => store.get('requests/' + item.id, { type: 'json' })));
      if (rows.some(row => !row)) throw fail(503, 'Some inbox records could not be loaded. Please try again.');
      // Row statuses and counts describe the same snapshot during other writes.
      requests.push(...rows.map((row, index) => ({ ...row, status: items[index].status, revision: items[index].revision })));
    }
    return { ok: true, requests, total: matching.length, unreadCount: entries.filter(item => item.status === 'new').length, page, pageSize: 30 };
  }
  return { upsert, prepare, tryCommit, reconcile, page };
}
module.exports = { createRequestIndex };
