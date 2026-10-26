import { getStore } from '@netlify/blobs';
import cleanup from '../../lib/expired-records.cjs';
export default async function (_request, context = {}) {
  if ((context.deploy?.context || process.env.CONTEXT) !== 'production' || context.deploy?.published === false) return new Response(null, { status: 204 });
  await cleanup.cleanupExpiredRecords(getStore({ name: 'beyondclass-assessment-production', consistency: 'strong' }));
  return new Response(null, { status: 204 });
}
export const config = { schedule: '@daily' };
