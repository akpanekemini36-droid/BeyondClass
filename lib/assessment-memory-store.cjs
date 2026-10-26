// Local development only. Production uses Netlify Blobs with conditional writes.
function createMemoryStore() {
  const values = new Map(); let version = 0;
  return {
    async get(key) { return values.has(key) ? structuredClone(values.get(key).data) : null; },
    async getWithMetadata(key) { return values.has(key) ? structuredClone(values.get(key)) : null; },
    async setJSON(key, data, options = {}) {
      if ((options.onlyIfNew && values.has(key)) || (options.onlyIfMatch && values.get(key)?.etag !== options.onlyIfMatch)) return { modified: false };
      const etag = String(++version); values.set(key, { data: structuredClone(data), etag }); return { modified: true, etag };
    }
  };
}
module.exports = { createMemoryStore };
