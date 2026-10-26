import { getStore } from '@netlify/blobs';
import access from '../../lib/assessment-access.cjs';
import accessConfig from '../../lib/assessment-access-config.cjs';
import html from '../../private/assessment-app.cjs';
let handler;
export default async function (request, context = {}) {
  const environment = context.deploy?.context || process.env.CONTEXT || 'dev';
  if (environment === 'production' && (context.deploy?.published !== true || !context.site?.url || new URL(request.url).origin !== new URL(context.site.url).origin)) return new Response('Use the current BeyondClass website.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  if (!handler) handler = access.createAssessmentAccess({ store: getStore({ name: 'beyondclass-assessment-' + (environment === 'production' ? 'production' : 'preview-' + (context.deploy?.id || 'local')), consistency: 'strong' }), codeHash: accessConfig.codeHash, html });
  return handler(request, { ip: context.ip });
}
export const config = { path: ['/assessment/start', '/assessment/unlock', '/assessment/lock', '/assessment/session'], rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 60 } };
