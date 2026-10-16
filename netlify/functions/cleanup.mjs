import { getStore } from '@netlify/blobs';
import cleanup from '../../lib/expired-records.cjs';
import index from '../../lib/request-index.cjs';

export default async function (_request, context = {}) {
  const environment = context.deploy?.context || process.env.CONTEXT;
  if (environment !== 'production' || context.deploy?.published === false) return new Response(null, { status: 204 });
  const store = getStore({ name: 'beyondclass-inbox-production', consistency: 'strong' });
  await cleanup.cleanupExpiredRecords(store);
  await index.createRequestIndex(store).reconcile();
  return new Response(null, { status: 204 });
}
export const config = { schedule: '*/15 * * * *' };
