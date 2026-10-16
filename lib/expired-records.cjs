'use strict';
async function cleanupExpiredRecords(store, now = Date.now()) {
  let removed = 0;
  for (const prefix of ['sessions/', 'rates/']) {
    for await (const batch of store.list({ prefix, paginate: true })) {
      for (let offset = 0; offset < batch.blobs.length; offset += 20) {
        await Promise.all(batch.blobs.slice(offset, offset + 20).map(async blob => {
          const value = await store.get(blob.key, { type: 'json' });
          if (value && Number.isFinite(value.expires) && value.expires <= now) {
            await store.delete(blob.key);
            removed++;
          }
        }));
      }
    }
  }
  return { removed };
}
module.exports = { cleanupExpiredRecords };
